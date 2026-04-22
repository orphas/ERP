import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        invoices: {
          select: {
            id: true,
            reference: true,
            date: true,
            dueDate: true,
            total: true,
            paidAmount: true,
            status: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const now = new Date();
    const summary = customers.map((customer) => {
      const totals = customer.invoices.reduce(
        (acc, invoice) => {
          const total = Number(invoice.total || 0);
          const paid = Number(invoice.paidAmount || 0);
          const balance = Math.max(total - paid, 0);
          const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
          const isOverdue = balance > 0 && dueDate && dueDate < now;

          acc.invoiced += total;
          acc.paid += paid;
          acc.balance += balance;
          if (isOverdue) acc.overdue += balance;

          return acc;
        },
        { invoiced: 0, paid: 0, balance: 0, overdue: 0 }
      );

      return {
        customerId: customer.id,
        customerName: customer.name,
        invoiceCount: customer.invoices.length,
        ...totals,
      };
    });

    return NextResponse.json(summary);
  } catch {
    return NextResponse.json({ error: "Failed to build customer account summary" }, { status: 500 });
  }
}
