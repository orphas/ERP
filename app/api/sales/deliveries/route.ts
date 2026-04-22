import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDocumentReference } from "@/lib/doc-ref";
import { isModuleClosed } from "@/lib/period-lock";
import { ensureCoreAccounts, applyAccountBalanceDeltas } from "@/lib/accounting";
import { assertBalancedLines } from "@/lib/double-entry";

export async function GET() {
  try {
    const deliveries = await prisma.delivery.findMany({
      include: {
        order: {
          include: { customer: true },
        },
        items: true,
        expenses: {
          include: { supplier: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(deliveries);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch deliveries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (await isModuleClosed(prisma, "sales", new Date())) {
      return NextResponse.json({ error: "Sales period is closed for this month" }, { status: 423 });
    }

    const body = await req.json();
    const { orderId, waybill, carrier, items, expenses } = body;

    if (!orderId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "orderId and at least one item are required" },
        { status: 400 }
      );
    }

    const delivery = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: Number(orderId) },
        include: { items: true },
      });
      if (!order) {
        throw new Error("Order not found");
      }

      const mergedItems = new Map<number, number>();
      const rawItems = Array.isArray(items) ? items : [];
      for (const item of rawItems) {
        const maybeOrderItemId = Number(item.orderItemId ?? item.orderId);
        const quantity = Number(item.quantity);
        if (!Number.isInteger(maybeOrderItemId) || maybeOrderItemId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
          continue;
        }
        mergedItems.set(maybeOrderItemId, (mergedItems.get(maybeOrderItemId) || 0) + quantity);
      }

      if (mergedItems.size === 0) {
        throw new Error("No valid delivery quantities provided");
      }

      const orderItemsById = new Map(order.items.map((orderItem) => [orderItem.id, orderItem]));
      const updatedDeliveredQty = new Map<number, number>();
      for (const orderItem of order.items) {
        const deliveredIncrement = mergedItems.get(orderItem.id) || 0;
        updatedDeliveredQty.set(orderItem.id, Number(orderItem.deliveredQty) + deliveredIncrement);
      }

      const allDelivered = order.items.every((orderItem) => {
        const after = updatedDeliveredQty.get(orderItem.id) || Number(orderItem.deliveredQty);
        return after >= Number(orderItem.quantity);
      });

      const reference = await generateDocumentReference(tx, "delivery");
      const created = await tx.delivery.create({
        data: {
          orderId: Number(orderId),
          reference,
          waybill: waybill ?? null,
          carrier: carrier ?? null,
          status: allDelivered ? "delivered" : "partial",
          items: {
            create: Array.from(mergedItems.entries())
              .filter(([orderItemId, quantity]) => {
                const orderItem = orderItemsById.get(orderItemId);
                if (!orderItem) return false;
                const remaining = Number(orderItem.quantity) - Number(orderItem.deliveredQty);
                return quantity > 0 && quantity <= remaining;
              })
              .map(([orderItemId, quantity]) => ({ orderId: orderItemId, quantity })),
          },
          expenses: {
            create: (Array.isArray(expenses) ? expenses : [])
              .map((expense: { description?: string; amount?: number; supplierId?: number | null }) => ({
                description: String(expense.description || "").trim(),
                amount: Number(expense.amount),
                supplierId: expense.supplierId ? Number(expense.supplierId) : null,
              }))
              .filter((expense) => expense.description && Number.isFinite(expense.amount) && expense.amount >= 0),
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
        await tx.salesOrderItem.update({ where: { id: orderItemId }, data: { deliveredQty } });
      }

      await tx.salesOrder.update({
        where: { id: Number(orderId) },
        data: { status: allDelivered ? "delivered" : "shipped" },
      });

      const totalDeliveryExpense = (created.expenses || []).reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      );
      if (totalDeliveryExpense > 0) {
        const accounts = await ensureCoreAccounts(tx);
        const lines = [
          {
            accountId: accounts.cogs.id,
            type: "debit" as const,
            amount: totalDeliveryExpense,
            description: `Delivery expenses on ${created.reference}`,
          },
          {
            accountId: accounts.freightInAccrual.id,
            type: "credit" as const,
            amount: totalDeliveryExpense,
            description: `Delivery expenses accrual on ${created.reference}`,
          },
        ];
        assertBalancedLines(lines.map((line) => ({ type: line.type, amount: line.amount })));

        const journalRef = await generateDocumentReference(tx, "journal");
        await tx.journalEntry.create({
          data: {
            reference: journalRef,
            date: new Date(),
            journalType: "sales",
            description: `Delivery expense posting for ${created.reference}`,
            isPosted: true,
            lines: { create: lines },
          },
        });

        await applyAccountBalanceDeltas(
          tx,
          [
            { accountId: accounts.cogs.id, accountType: accounts.cogs.type, type: "debit", amount: totalDeliveryExpense },
            {
              accountId: accounts.freightInAccrual.id,
              accountType: accounts.freightInAccrual.type,
              type: "credit",
              amount: totalDeliveryExpense,
            },
          ]
        );
      }

      return created;
    });

    return NextResponse.json(delivery, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create delivery" }, { status: 500 });
  }
}
