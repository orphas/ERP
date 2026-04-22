import { Prisma } from "@prisma/client";
import { applyAccountBalanceDeltas } from "@/lib/accounting";

type TxClient = Prisma.TransactionClient;

async function reverseAndDeleteJournalEntry(tx: TxClient, entryId: number) {
  const entry = await tx.journalEntry.findUnique({
    where: { id: entryId },
    include: {
      lines: {
        include: {
          account: {
            select: {
              type: true,
            },
          },
        },
      },
    },
  });

  if (!entry) return;

  const reversalLines = entry.lines
    .map((line) => ({
      accountId: line.accountId,
      accountType: String(line.account.type || "").toLowerCase(),
      type: line.type === "debit" ? ("credit" as const) : ("debit" as const),
      amount: Number(line.amount || 0),
    }))
    .filter((line) => Number.isFinite(line.amount) && line.amount > 0);

  if (reversalLines.length > 0) {
    await applyAccountBalanceDeltas(tx, reversalLines);
  }

  await tx.journalEntry.delete({ where: { id: entryId } });
}

export async function reverseAndDeleteJournalEntriesByDescriptionContains(tx: TxClient, containsTokens: string[]) {
  const tokens = Array.from(new Set(containsTokens.map((token) => token.trim()).filter(Boolean)));
  if (tokens.length === 0) return 0;

  const entries = await tx.journalEntry.findMany({
    where: {
      OR: tokens.map((token) => ({ description: { contains: token } })),
    },
    select: { id: true },
  });

  for (const entry of entries) {
    await reverseAndDeleteJournalEntry(tx, entry.id);
  }

  return entries.length;
}

export async function reverseAndDeleteJournalEntryById(tx: TxClient, entryId: number) {
  await reverseAndDeleteJournalEntry(tx, entryId);
}

async function recalculateSalesOrderStatus(tx: TxClient, orderId: number) {
  const [items, invoiceCount] = await Promise.all([
    tx.salesOrderItem.findMany({ where: { orderId }, select: { quantity: true, deliveredQty: true } }),
    tx.invoice.count({ where: { orderId } }),
  ]);

  const totalDelivered = items.reduce((sum, item) => sum + Number(item.deliveredQty || 0), 0);
  const allDelivered = items.length > 0 && items.every((item) => Number(item.deliveredQty || 0) >= Number(item.quantity || 0));

  let status = "pending";
  if (allDelivered) {
    status = "delivered";
  } else if (totalDelivered > 0) {
    status = "shipped";
  } else if (invoiceCount > 0) {
    status = "confirmed";
  }

  await tx.salesOrder.update({ where: { id: orderId }, data: { status } });
}

export async function deleteDeliveryCascadeTx(tx: TxClient, deliveryId: number) {
  const delivery = await tx.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      items: true,
      order: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!delivery) return;

  if (delivery.orderId) {
    for (const item of delivery.items) {
      const orderItem = await tx.salesOrderItem.findUnique({ where: { id: item.orderId } });
      if (!orderItem || orderItem.orderId !== delivery.orderId) continue;
      await tx.salesOrderItem.update({
        where: { id: orderItem.id },
        data: {
          deliveredQty: Math.max(0, Number(orderItem.deliveredQty || 0) - Number(item.quantity || 0)),
        },
      });
    }

    await recalculateSalesOrderStatus(tx, delivery.orderId);
  }

  await reverseAndDeleteJournalEntriesByDescriptionContains(tx, [
    `Delivery expense posting for ${delivery.reference}`,
    `Delivery expense posting ${delivery.reference}`,
    delivery.reference,
  ]);

  await tx.delivery.delete({ where: { id: delivery.id } });
}

async function restoreInvoiceBatchAvailability(tx: TxClient, invoiceId: number) {
  const usages = await tx.invoiceBatchUsage.findMany({ where: { invoiceId } });
  for (const usage of usages) {
    const batch = await tx.batch.findUnique({ where: { id: usage.batchId }, select: { availableQuantity: true } });
    if (!batch) continue;
    await tx.batch.update({
      where: { id: usage.batchId },
      data: {
        availableQuantity: Number(batch.availableQuantity || 0) + Number(usage.quantity || 0),
      },
    });
  }
}

export async function deleteInvoiceCascadeTx(tx: TxClient, invoiceId: number) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      deliveries: { select: { id: true } },
      order: { select: { id: true } },
    },
  });

  if (!invoice) return;

  for (const delivery of invoice.deliveries) {
    await deleteDeliveryCascadeTx(tx, delivery.id);
  }

  await restoreInvoiceBatchAvailability(tx, invoice.id);

  await reverseAndDeleteJournalEntriesByDescriptionContains(tx, [
    `Invoice posting ${invoice.reference}`,
    `Invoice ${invoice.reference} payment`,
    invoice.reference,
  ]);

  await tx.invoice.delete({ where: { id: invoice.id } });

  if (invoice.orderId) {
    await recalculateSalesOrderStatus(tx, invoice.orderId);
  }
}

export async function deleteSalesOrderCascadeTx(tx: TxClient, orderId: number) {
  const order = await tx.salesOrder.findUnique({
    where: { id: orderId },
    include: {
      invoices: { select: { id: true } },
      deliveries: { select: { id: true } },
    },
  });

  if (!order) return;

  for (const invoice of order.invoices) {
    await deleteInvoiceCascadeTx(tx, invoice.id);
  }

  const remainingDeliveries = await tx.delivery.findMany({ where: { orderId }, select: { id: true } });
  for (const delivery of remainingDeliveries) {
    await deleteDeliveryCascadeTx(tx, delivery.id);
  }

  await tx.salesOrder.delete({ where: { id: orderId } });
}

export async function deletePurchaseOrderCascadeTx(tx: TxClient, orderId: number) {
  const order = await tx.purchaseOrder.findUnique({ where: { id: orderId }, select: { id: true, reference: true } });
  if (!order) return;

  await reverseAndDeleteJournalEntriesByDescriptionContains(tx, [
    `Goods receipt for purchase order ${order.reference}`,
    `PO ${order.reference}`,
    order.reference,
  ]);

  await tx.purchaseOrder.delete({ where: { id: order.id } });
}
