import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateDocumentReference } from "@/lib/doc-ref";
import { isModuleClosed } from "@/lib/period-lock";
import { ensureCoreAccounts, applyAccountBalanceDeltas } from "@/lib/accounting";
import { assertBalancedLines } from "@/lib/double-entry";

type DeliveryRequestItem = {
  orderItemId?: number;
  invoiceItemId?: number;
  quantity?: number;
};

type DeliveryExpenseInput = {
  description?: string;
  amount?: number;
  supplierId?: number | null;
};

async function postDeliveryExpenses(
  tx: Prisma.TransactionClient,
  reference: string,
  totalDeliveryExpense: number
) {
  if (totalDeliveryExpense <= 0) return;

  try {
    const accounts = await ensureCoreAccounts(tx);
    const lines = [
      {
        accountId: accounts.cogs.id,
        type: "debit" as const,
        amount: totalDeliveryExpense,
        description: `Delivery expenses on ${reference}`,
      },
      {
        accountId: accounts.freightInAccrual.id,
        type: "credit" as const,
        amount: totalDeliveryExpense,
        description: `Delivery expenses accrual on ${reference}`,
      },
    ];

    assertBalancedLines(lines.map((line) => ({ type: line.type, amount: line.amount })));

    const journalRef = await generateDocumentReference(tx, "journal");
    await tx.journalEntry.create({
      data: {
        reference: journalRef,
        date: new Date(),
        journalType: "sales",
        description: `Delivery expense posting for ${reference}`,
        isPosted: true,
        lines: { create: lines },
      },
    });

    await applyAccountBalanceDeltas(tx, [
      {
        accountId: accounts.cogs.id,
        accountType: accounts.cogs.type,
        type: "debit",
        amount: totalDeliveryExpense,
      },
      {
        accountId: accounts.freightInAccrual.id,
        accountType: accounts.freightInAccrual.type,
        type: "credit",
        amount: totalDeliveryExpense,
      },
    ]);
  } catch {
    // Delivery creation should not fail when accounting posting fails.
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (await isModuleClosed(prisma, "sales", new Date())) {
      return NextResponse.json({ error: "Sales period is closed for this month" }, { status: 423 });
    }

    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json();
    const items = Array.isArray(body?.items) ? (body.items as DeliveryRequestItem[]) : [];
    const expenses = Array.isArray(body?.expenses) ? (body.expenses as DeliveryExpenseInput[]) : [];
    const standalone = Boolean(body?.standalone);
    const carrier = body?.carrier ? String(body.carrier) : null;
    const waybill = body?.waybill ? String(body.waybill) : null;

    if (items.length === 0) {
      return NextResponse.json({ error: "At least one delivered item is required" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        order: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const normalizedExpenses = expenses
      .map((expense) => ({
        description: String(expense.description || "").trim(),
        amount: Number(expense.amount),
        supplierId: expense.supplierId ? Number(expense.supplierId) : null,
      }))
      .filter((expense) => expense.description && Number.isFinite(expense.amount) && expense.amount >= 0);

    const delivery = await prisma.$transaction(async (tx) => {
      const reference = await generateDocumentReference(tx, "delivery");

      if (invoice.orderId && invoice.order && !standalone) {
        const orderItemsById = new Map(invoice.order.items.map((item) => [item.id, item]));

        const normalizedItems = items
          .map((item) => ({
            orderItemId: Number(item.orderItemId),
            quantity: Number(item.quantity),
          }))
          .filter((item) => Number.isInteger(item.orderItemId) && item.orderItemId > 0 && Number.isFinite(item.quantity) && item.quantity > 0);

        if (normalizedItems.length === 0) {
          throw new Error("No valid delivery quantities provided");
        }

        const mergedItems = new Map<number, number>();
        for (const item of normalizedItems) {
          mergedItems.set(item.orderItemId, (mergedItems.get(item.orderItemId) || 0) + item.quantity);
        }

        for (const [orderItemId, quantity] of mergedItems.entries()) {
          const orderItem = orderItemsById.get(orderItemId);
          if (!orderItem) {
            throw new Error(`Order item ${orderItemId} does not belong to invoice order`);
          }
          const remaining = Number(orderItem.quantity) - Number(orderItem.deliveredQty);
          if (quantity > remaining) {
            throw new Error(`Delivered quantity for item ${orderItemId} exceeds remaining quantity`);
          }
        }

        const updatedDeliveredQty = new Map<number, number>();
        for (const orderItem of invoice.order.items) {
          const deliveredIncrement = mergedItems.get(orderItem.id) || 0;
          updatedDeliveredQty.set(orderItem.id, Number(orderItem.deliveredQty) + deliveredIncrement);
        }

        const allDelivered = invoice.order.items.every((orderItem) => {
          const after = updatedDeliveredQty.get(orderItem.id) || Number(orderItem.deliveredQty);
          return after >= Number(orderItem.quantity);
        });

        const createdDelivery = await tx.delivery.create({
          data: {
            orderId: invoice.orderId,
            invoiceId: invoice.id,
            reference,
            carrier,
            waybill,
            status: allDelivered ? "delivered" : "partial",
            items: {
              create: Array.from(mergedItems.entries()).map(([orderItemId, quantity]) => ({
                orderId: orderItemId,
                quantity,
              })),
            },
            expenses: {
              create: normalizedExpenses.map((expense) => ({
                description: expense.description,
                amount: expense.amount,
                supplierId: expense.supplierId,
              })),
            },
          },
          include: {
            order: {
              include: { customer: true },
            },
            items: true,
            expenses: {
              include: { supplier: true },
            },
          },
        });

        for (const [orderItemId, deliveredQty] of updatedDeliveredQty.entries()) {
          await tx.salesOrderItem.update({
            where: { id: orderItemId },
            data: { deliveredQty },
          });
        }

        await tx.salesOrder.update({
          where: { id: invoice.orderId },
          data: { status: allDelivered ? "delivered" : "shipped" },
        });

        const totalDeliveryExpense = normalizedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        await postDeliveryExpenses(tx, reference, totalDeliveryExpense);

        return createdDelivery;
      }

      const invoiceItemsById = new Map(
        invoice.items
          .filter((item) => item.itemType === "product")
          .map((item) => [item.id, item])
      );

      const normalizedItems = items
        .map((item) => ({
          invoiceItemId: Number(item.invoiceItemId),
          quantity: Number(item.quantity),
        }))
        .filter((item) => Number.isInteger(item.invoiceItemId) && item.invoiceItemId > 0 && Number.isFinite(item.quantity) && item.quantity > 0);

      if (normalizedItems.length === 0) {
        throw new Error("No valid delivery quantities provided");
      }

      const mergedItems = new Map<number, number>();
      for (const item of normalizedItems) {
        mergedItems.set(item.invoiceItemId, (mergedItems.get(item.invoiceItemId) || 0) + item.quantity);
      }

      for (const [invoiceItemId, quantity] of mergedItems.entries()) {
        const invoiceItem = invoiceItemsById.get(invoiceItemId);
        if (!invoiceItem) {
          throw new Error(`Invoice item ${invoiceItemId} is not a valid product line`);
        }
        if (quantity > Number(invoiceItem.quantity || 0)) {
          throw new Error(`Delivered quantity for invoice item ${invoiceItemId} exceeds invoiced quantity`);
        }
      }

      const createdDelivery = await tx.delivery.create({
        data: {
          invoiceId: invoice.id,
          reference,
          carrier,
          waybill,
          status: "delivered",
          items: {
            create: Array.from(mergedItems.entries()).map(([invoiceItemId, quantity]) => ({
              orderId: invoiceItemId,
              quantity,
            })),
          },
          expenses: {
            create: normalizedExpenses.map((expense) => ({
              description: expense.description,
              amount: expense.amount,
              supplierId: expense.supplierId,
            })),
          },
        },
        include: {
          order: {
            include: { customer: true },
          },
          items: true,
          expenses: {
            include: { supplier: true },
          },
        },
      });

      const totalDeliveryExpense = normalizedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      await postDeliveryExpenses(tx, reference, totalDeliveryExpense);

      return createdDelivery;
    });

    return NextResponse.json(delivery, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create delivery note from invoice" }, { status: 500 });
  }
}
