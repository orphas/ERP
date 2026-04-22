import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const [
      products,
      customers,
      employees,
      accounts,
      suppliers,
      quotes,
      orders,
      invoices,
      purchaseOrders,
      pendingInvoices,
      paidRevenue,
      productStock,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.customer.count(),
      prisma.employee.count(),
      prisma.account.count(),
      prisma.supplier.count(),
      prisma.quote.count(),
      prisma.salesOrder.count(),
      prisma.invoice.count(),
      prisma.purchaseOrder.count(),
      prisma.invoice.count({
        where: {
          status: { in: ["sent", "overdue"] },
        },
      }),
      prisma.invoice.aggregate({
        where: { status: "paid" },
        _sum: { total: true },
      }),
      prisma.product.findMany({
        include: {
          batches: {
            select: { id: true, availableQuantity: true },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const lowStockProducts = productStock.filter((product) =>
      product.batches.some((batch) => Number(batch.availableQuantity) <= product.minStockThreshold)
    );

    return NextResponse.json({
      products,
      customers,
      employees,
      accounts,
      suppliers,
      quotes,
      orders,
      invoices,
      purchaseOrders,
      pendingInvoices,
      totalRevenue: Number(paidRevenue._sum.total ?? 0),
      lowStockProducts,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 });
  }
}
