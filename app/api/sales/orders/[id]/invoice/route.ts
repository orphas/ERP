import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/ops-log";
import { generateDocumentReference } from "@/lib/doc-ref";
import { isModuleClosed } from "@/lib/period-lock";
import { assertBalancedLines } from "@/lib/double-entry";
import { applyAccountBalanceDeltas, ensureCoreAccounts } from "@/lib/accounting";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (await isModuleClosed(prisma, "sales", new Date())) {
      return NextResponse.json({ error: "Sales period is closed for this month" }, { status: 423 });
    }

    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
      },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + Number(order.creditTermDays));
      const reference = await generateDocumentReference(tx, "invoice");

      const accounts = await ensureCoreAccounts(tx);

      const createdInvoice = await tx.invoice.create({
        data: {
          customerId: order.customerId,
          orderId: order.id,
          reference,
          status: "sent",
          subtotal: Number(order.subtotal),
          vatRate: Number(order.vatRate),
          vatAmount: Number(order.vatAmount),
          total: Number(order.total),
          dueDate,
          items: {
            create: order.items.map((item) => ({
              itemType: "product",
              productId: item.productId,
              description: null,
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice),
              lineTotal: Number(item.lineTotal),
            })),
          },
        },
        include: {
          customer: true,
          order: true,
          items: {
            include: { product: true },
          },
        },
      });

      let totalCogs = 0;
      const usageRows: Array<{
        invoiceId: number;
        invoiceItemId: number;
        productId: number;
        batchId: number;
        quantity: number;
        unitCost: number;
        totalCost: number;
      }> = [];

      for (const line of createdInvoice.items) {
        if (line.itemType !== "product" || !line.productId) continue;

        let remainingQty = Number(line.quantity);
        let lineCogs = 0;
        const batches = await tx.batch.findMany({
          where: { productId: line.productId, availableQuantity: { gt: 0 } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });

        for (const batch of batches) {
          if (remainingQty <= 0) break;
          const available = Number(batch.availableQuantity);
          if (available <= 0) continue;

          const consumeQty = Math.min(remainingQty, available);
          const unitCost = Number(batch.landedUnitCost);
          const totalCost = consumeQty * unitCost;
          lineCogs += totalCost;
          remainingQty -= consumeQty;

          usageRows.push({
            invoiceId: createdInvoice.id,
            invoiceItemId: line.id,
            productId: line.productId,
            batchId: batch.id,
            quantity: consumeQty,
            unitCost,
            totalCost,
          });

          await tx.batch.update({
            where: { id: batch.id },
            data: { availableQuantity: available - consumeQty },
          });
        }

        if (remainingQty > 0) {
          const sku = line.product?.sku || `#${line.productId}`;
          throw new Error(`Insufficient stock to invoice SKU ${sku}`);
        }

        await tx.invoiceItem.update({
          where: { id: line.id },
          data: { cogsAmount: lineCogs },
        });
        totalCogs += lineCogs;
      }

      if (usageRows.length > 0) {
        await tx.invoiceBatchUsage.createMany({ data: usageRows });
      }

      const journalLines = [
        {
          accountId: accounts.receivable.id,
          accountType: accounts.receivable.type,
          type: "debit" as const,
          amount: Number(createdInvoice.total),
          description: `Accounts receivable for invoice ${createdInvoice.reference}`,
        },
        {
          accountId: accounts.salesRevenue.id,
          accountType: accounts.salesRevenue.type,
          type: "credit" as const,
          amount: Number(createdInvoice.subtotal),
          description: `Sales revenue for invoice ${createdInvoice.reference}`,
        },
      ];

      if (Number(createdInvoice.vatAmount) > 0) {
        journalLines.push({
          accountId: accounts.vatOutput.id,
          accountType: accounts.vatOutput.type,
          type: "credit" as const,
          amount: Number(createdInvoice.vatAmount),
          description: `Output VAT for invoice ${createdInvoice.reference}`,
        });
      }

      if (totalCogs > 0) {
        journalLines.push(
          {
            accountId: accounts.cogs.id,
            accountType: accounts.cogs.type,
            type: "debit" as const,
            amount: totalCogs,
            description: `COGS recognition for invoice ${createdInvoice.reference}`,
          },
          {
            accountId: accounts.inventory.id,
            accountType: accounts.inventory.type,
            type: "credit" as const,
            amount: totalCogs,
            description: `Inventory reduction for invoice ${createdInvoice.reference}`,
          }
        );
      }

      assertBalancedLines(journalLines.map((line) => ({ type: line.type, amount: line.amount })));

      const journalRef = await generateDocumentReference(tx, "journal");
      await tx.journalEntry.create({
        data: {
          reference: journalRef,
          date: now,
          journalType: "sales",
          description: `Invoice posting ${createdInvoice.reference}`,
          isPosted: true,
          lines: {
            create: journalLines.map((line) => ({
              accountId: line.accountId,
              type: line.type,
              amount: line.amount,
              description: line.description,
            })),
          },
        },
      });

      await applyAccountBalanceDeltas(tx, journalLines);

      return tx.invoice.findUniqueOrThrow({
        where: { id: createdInvoice.id },
        include: {
          customer: true,
          order: true,
          items: { include: { product: true, batchUsages: true } },
          batchUsages: true,
        },
      });
    });

    await logOperation({
      action: "INVOICE_CREATED",
      entityType: "Invoice",
      entityId: invoice.id,
      details: `Invoice ${invoice.reference} created from order ${order.reference}`,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Insufficient stock")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}
