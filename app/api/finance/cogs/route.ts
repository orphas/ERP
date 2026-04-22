import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const by = req.nextUrl.searchParams.get("by") === "batch" ? "batch" : "invoice";

    const usage = await prisma.invoiceBatchUsage.findMany({
      include: {
        invoice: { select: { id: true, reference: true, date: true } },
        batch: { select: { id: true, batchNumber: true } },
        product: { select: { id: true, name: true, sku: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (by === "batch") {
      const byBatch = new Map<number, {
        batchId: number;
        batchNumber: string;
        productId: number;
        productName: string;
        sku: string;
        quantity: number;
        cogs: number;
      }>();

      for (const row of usage) {
        const existing = byBatch.get(row.batchId) || {
          batchId: row.batchId,
          batchNumber: row.batch.batchNumber,
          productId: row.productId,
          productName: row.product.name,
          sku: row.product.sku,
          quantity: 0,
          cogs: 0,
        };
        existing.quantity += Number(row.quantity || 0);
        existing.cogs += Number(row.totalCost || 0);
        byBatch.set(row.batchId, existing);
      }

      return NextResponse.json(Array.from(byBatch.values()).sort((a, b) => b.cogs - a.cogs));
    }

    const byInvoice = new Map<number, {
      invoiceId: number;
      reference: string;
      date: Date;
      quantity: number;
      cogs: number;
    }>();

    for (const row of usage) {
      const existing = byInvoice.get(row.invoiceId) || {
        invoiceId: row.invoiceId,
        reference: row.invoice.reference,
        date: row.invoice.date,
        quantity: 0,
        cogs: 0,
      };
      existing.quantity += Number(row.quantity || 0);
      existing.cogs += Number(row.totalCost || 0);
      byInvoice.set(row.invoiceId, existing);
    }

    return NextResponse.json(
      Array.from(byInvoice.values())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((row) => ({
          ...row,
          date: new Date(row.date).toISOString(),
        }))
    );
  } catch {
    return NextResponse.json({ error: "Failed to build COGS report" }, { status: 500 });
  }
}
