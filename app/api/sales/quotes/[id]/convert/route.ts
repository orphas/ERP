import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/ops-log";
import { generateDocumentReference } from "@/lib/doc-ref";
import { isModuleClosed } from "@/lib/period-lock";

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

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });
    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const order = await prisma.$transaction(async (tx) => {
      const reference = await generateDocumentReference(tx, "order");
      const createdOrder = await tx.salesOrder.create({
        data: {
          customerId: quote.customerId,
          quoteId: quote.id,
          reference,
          subtotal: Number(quote.subtotal),
          vatRate: Number(quote.vatRate),
          vatAmount: Number(quote.vatAmount),
          total: Number(quote.total),
          items: {
            create: quote.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice),
              lineTotal: Number(item.lineTotal),
            })),
          },
        },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      });

      await tx.quote.update({ where: { id: quote.id }, data: { status: "accepted" } });
      return createdOrder;
    });

    await logOperation({
      action: "QUOTE_CONVERTED",
      entityType: "SalesOrder",
      entityId: order.id,
      details: `Quote ${quote.reference} converted to order ${order.reference}`,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to convert quote" }, { status: 500 });
  }
}
