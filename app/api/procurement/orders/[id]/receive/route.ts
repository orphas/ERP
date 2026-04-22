import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/ops-log";
import { isModuleClosed } from "@/lib/period-lock";
import { generateDocumentReference } from "@/lib/doc-ref";
import { assertBalancedLines } from "@/lib/double-entry";
import { applyAccountBalanceDeltas, ensureCoreAccounts } from "@/lib/accounting";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (await isModuleClosed(prisma, "procurement", new Date())) {
      return NextResponse.json({ error: "Procurement period is closed for this month" }, { status: 423 });
    }

    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json();
    const items = body?.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items are required" }, { status: 400 });
    }

    const exists = await prisma.purchaseOrder.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      let receiptValue = 0;

      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        select: {
          reference: true,
          currency: true,
          exchangeRate: true,
          purchaseType: true,
          productSubtotal: true,
          vatAmount: true,
          expenseVatAmount: true,
        },
      });
      if (!po) {
        throw new Error("Purchase order not found");
      }

      const poCurrency = String(po.currency || "MAD").toUpperCase();
      const fx = Number(po.exchangeRate || 0);

      for (const item of items as { itemId: number; receivedQty: number }[]) {
        const poItem = await tx.purchaseOrderItem.findUnique({ where: { id: Number(item.itemId) } });
        if (!poItem || poItem.orderId !== id) {
          throw new Error("Invalid purchase order item");
        }

        if (!poItem.productId) {
          continue;
        }

        const qtyToReceive = Number(item.receivedQty);
        if (!Number.isFinite(qtyToReceive) || qtyToReceive <= 0) continue;
        const remaining = poItem.quantity - Number(poItem.receivedQty);
        if (qtyToReceive > remaining) {
          throw new Error(`Received quantity exceeds remaining for item ${poItem.id}`);
        }

        receiptValue += qtyToReceive * Number(poItem.unitPrice);

        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: {
            receivedQty: Number(poItem.receivedQty) + qtyToReceive,
          },
        });
      }

      const allItems = await tx.purchaseOrderItem.findMany({ where: { orderId: id } });
  const fullyReceived = allItems.every((item) => !item.productId || Number(item.receivedQty) >= item.quantity);

      if (fullyReceived) {
        await tx.purchaseOrder.update({
          where: { id },
          data: { status: "received" },
        });
      }

      if (receiptValue > 0) {
        const accounts = await ensureCoreAccounts(tx);

        let receiptValueMad = receiptValue;
        if (poCurrency !== "MAD") {
          if (!Number.isFinite(fx) || fx <= 0) {
            throw new Error(`Missing exchange rate for ${poCurrency} purchase order`);
          }
          receiptValueMad = receiptValue * fx;
        }

        const productSubtotal = Number(po.productSubtotal || 0);
        const totalRecoverableVat = Number(po.vatAmount || 0) + Number(po.expenseVatAmount || 0);
        const ratio = productSubtotal > 0 ? Math.max(0, Math.min(1, receiptValue / productSubtotal)) : 0;
        const receiptVatInOrderCurrency = totalRecoverableVat * ratio;
        const receiptVatMad = poCurrency === "MAD" ? receiptVatInOrderCurrency : receiptVatInOrderCurrency * fx;
        const isImport = String(po.purchaseType || "local").toLowerCase() === "import";

        const journalLines: Array<{ accountId: number; accountType: string; type: "debit" | "credit"; amount: number; description: string }> = [
          {
            accountId: accounts.inventory.id,
            accountType: accounts.inventory.type,
            type: "debit" as const,
            amount: receiptValueMad,
            description: `Inventory increase from PO ${po.reference} (${poCurrency}${poCurrency === "MAD" ? "" : ` @ ${fx}`})`,
          },
        ];

        if (receiptVatMad > 0) {
          journalLines.push({
            accountId: isImport ? accounts.vatRecoverableImports.id : accounts.vatRecoverablePurchases.id,
            accountType: isImport ? accounts.vatRecoverableImports.type : accounts.vatRecoverablePurchases.type,
            type: "debit",
            amount: receiptVatMad,
            description: isImport
              ? `Recoverable import VAT from PO ${po.reference}`
              : `Recoverable purchase VAT from PO ${po.reference}`,
          });
        }

        journalLines.push({
          accountId: accounts.payableSuppliers.id,
          accountType: accounts.payableSuppliers.type,
          type: "credit",
          amount: isImport ? receiptValueMad : receiptValueMad + receiptVatMad,
          description: `Supplier payable from PO ${po.reference}`,
        });

        if (isImport && receiptVatMad > 0) {
          journalLines.push({
            accountId: accounts.importVatClearing.id,
            accountType: accounts.importVatClearing.type,
            type: "credit",
            amount: receiptVatMad,
            description: `Import VAT clearing for PO ${po.reference}`,
          });
        }

        assertBalancedLines(journalLines.map((line) => ({ type: line.type, amount: line.amount })));

        const reference = await generateDocumentReference(tx, "journal");
        await tx.journalEntry.create({
          data: {
            reference,
            date: new Date(),
            journalType: "purchases",
            description: `Goods receipt for purchase order ${po.reference}`,
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
      }
    });

    const updated = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: { product: true },
        },
      },
    });

    if (updated) {
      await logOperation({
        action: "PURCHASE_RECEIPT",
        entityType: "PurchaseOrder",
        entityId: updated.id,
        details: `Items received for purchase order ${updated.reference}`,
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && (error.message.includes("exceeds remaining") || error.message.includes("Invalid purchase order item") || error.message.includes("Double-entry check failed") || error.message.includes("Missing exchange rate"))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to receive purchase order items" }, { status: 500 });
  }
}
