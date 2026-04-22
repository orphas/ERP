import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDocumentReference } from "@/lib/doc-ref";
import { isModuleClosed } from "@/lib/period-lock";
import { assertBalancedLines } from "@/lib/double-entry";
import { applyAccountBalanceDeltas, ensureCoreAccounts } from "@/lib/accounting";

export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        customer: true,
        order: {
          include: {
            deliveries: {
              select: { id: true, reference: true },
              orderBy: { createdAt: "desc" },
            },
          },
        },
        items: { select: { id: true, itemType: true, lineTotal: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(invoices);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (await isModuleClosed(prisma, "sales", new Date())) {
      return NextResponse.json({ error: "Sales period is closed for this month" }, { status: 423 });
    }

    const body = await req.json();
    const { customerId, dueDate, vatRate, items } = body;

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "customerId and at least one item are required" }, { status: 400 });
    }

    const normalizedItems = items
      .map((item: { itemType?: string; productId?: number; description?: string; quantity?: number; unitPrice?: number }) => {
        const type = String(item.itemType || "product").toLowerCase() === "charge" ? "charge" : "product";
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        const description = item.description ? String(item.description).trim() : null;
        const productId = item.productId ? Number(item.productId) : null;

        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
          return null;
        }

        if (type === "product" && !productId) return null;
        if (type === "charge" && !description) return null;

        return {
          itemType: type,
          productId: type === "product" ? productId : null,
          description: type === "charge" ? description : null,
          quantity,
          unitPrice,
          lineTotal: quantity * unitPrice,
        };
      })
      .filter((item): item is { itemType: string; productId: number | null; description: string | null; quantity: number; unitPrice: number; lineTotal: number } => Boolean(item));

    if (normalizedItems.length === 0) {
      return NextResponse.json({ error: "Add at least one valid product or charge line" }, { status: 400 });
    }

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const vatRateNumber = Number(vatRate ?? 20);
    const vatAmount = subtotal * (vatRateNumber / 100);
    const total = subtotal + vatAmount;

    const invoice = await prisma.$transaction(async (tx) => {
      const reference = await generateDocumentReference(tx, "invoice");
      const accounts = await ensureCoreAccounts(tx);

      const createdInvoice = await tx.invoice.create({
        data: {
          customer: { connect: { id: Number(customerId) } },
          reference,
          status: "sent",
          dueDate: dueDate ? new Date(dueDate) : null,
          subtotal,
          vatRate: vatRateNumber,
          vatAmount,
          total,
          items: {
            create: normalizedItems,
          },
        },
        include: {
          customer: true,
          items: {
            include: { product: true },
          },
        },
      });

      let totalInventoryCogs = 0;
      let thirdPartyChargeCost = 0;
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
        if (line.itemType === "charge") {
          const chargeCost = Number(line.lineTotal || 0);
          if (chargeCost > 0) {
            await tx.invoiceItem.update({ where: { id: line.id }, data: { cogsAmount: chargeCost } });
            thirdPartyChargeCost += chargeCost;
          }
          continue;
        }

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

        await tx.invoiceItem.update({ where: { id: line.id }, data: { cogsAmount: lineCogs } });
        totalInventoryCogs += lineCogs;
      }

      if (usageRows.length > 0) {
        await tx.invoiceBatchUsage.createMany({ data: usageRows });
      }

      const salesRevenueAmount = Math.max(Number(createdInvoice.subtotal) - thirdPartyChargeCost, 0);

      const journalLines: Array<{
        accountId: number;
        accountType: string;
        type: "debit" | "credit";
        amount: number;
        description: string;
      }> = [
        {
          accountId: accounts.receivable.id,
          accountType: accounts.receivable.type,
          type: "debit" as const,
          amount: Number(createdInvoice.total),
          description: `Accounts receivable for invoice ${createdInvoice.reference}`,
        },
      ];

      if (salesRevenueAmount > 0) {
        journalLines.push({
          accountId: accounts.salesRevenue.id,
          accountType: accounts.salesRevenue.type,
          type: "credit",
          amount: salesRevenueAmount,
          description: `Sales revenue for invoice ${createdInvoice.reference}`,
        });
      }

      if (thirdPartyChargeCost > 0) {
        journalLines.push({
          accountId: accounts.thirdPartyRebillingRevenue.id,
          accountType: accounts.thirdPartyRebillingRevenue.type,
          type: "credit",
          amount: thirdPartyChargeCost,
          description: `Third-party expense rebilling for invoice ${createdInvoice.reference}`,
        });
      }

      if (Number(createdInvoice.vatAmount) > 0) {
        journalLines.push({
          accountId: accounts.vatOutput.id,
          accountType: accounts.vatOutput.type,
          type: "credit",
          amount: Number(createdInvoice.vatAmount),
          description: `Output VAT for invoice ${createdInvoice.reference}`,
        });
      }

      const totalCogs = totalInventoryCogs + thirdPartyChargeCost;

      if (totalCogs > 0) {
        journalLines.push(
          {
            accountId: accounts.cogs.id,
            accountType: accounts.cogs.type,
            type: "debit",
            amount: totalCogs,
            description: `COGS recognition for invoice ${createdInvoice.reference}`,
          }
        );
      }

      if (totalInventoryCogs > 0) {
        journalLines.push(
          {
            accountId: accounts.inventory.id,
            accountType: accounts.inventory.type,
            type: "credit",
            amount: totalInventoryCogs,
            description: `Inventory reduction for invoice ${createdInvoice.reference}`,
          }
        );
      }

      if (thirdPartyChargeCost > 0) {
        journalLines.push({
          accountId: accounts.freightInAccrual.id,
          accountType: accounts.freightInAccrual.type,
          type: "credit",
          amount: thirdPartyChargeCost,
          description: `Third-party payable for invoice ${createdInvoice.reference}`,
        });
      }

      assertBalancedLines(journalLines.map((line) => ({ type: line.type, amount: line.amount })));

      const journalRef = await generateDocumentReference(tx, "journal");
      await tx.journalEntry.create({
        data: {
          reference: journalRef,
          date: new Date(),
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
          items: { include: { product: true, batchUsages: true } },
          batchUsages: true,
        },
      });
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Insufficient stock")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}
