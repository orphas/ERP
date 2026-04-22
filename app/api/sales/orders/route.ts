import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDocumentReference } from "@/lib/doc-ref";
import { isModuleClosed } from "@/lib/period-lock";

export async function GET() {
  try {
    const orders = await prisma.salesOrder.findMany({
      include: {
        customer: true,
        items: { include: { product: true } },
        _count: {
          select: {
            invoices: true,
            deliveries: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (await isModuleClosed(prisma, "sales", new Date())) {
      return NextResponse.json({ error: "Sales period is closed for this month" }, { status: 423 });
    }

    const body = await req.json();
    const { customerId, creditTermDays, vatRate, notes, items } = body;

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "customerId and at least one item are required" },
        { status: 400 }
      );
    }

    const normalizedItems = items.map((item: { productId: number; quantity: number; unitPrice: number }) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      return {
        productId: Number(item.productId),
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice,
      };
    });

    const subtotal = normalizedItems.reduce((sum: number, item: { lineTotal: number }) => sum + item.lineTotal, 0);
    const vatRateNumber = Number(vatRate ?? 20);
    const vatAmount = subtotal * (vatRateNumber / 100);
    const total = subtotal + vatAmount;

    const order = await prisma.$transaction(async (tx) => {
      const reference = await generateDocumentReference(tx, "order");
      return tx.salesOrder.create({
        data: {
          customerId: Number(customerId),
          reference,
          creditTermDays: Number(creditTermDays ?? 30),
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
          items: { include: { product: true } },
        },
      });
    });

    if (notes) {
      await prisma.operationsLog.create({
        data: {
          action: "order_note",
          entityType: "sales_order",
          entityId: order.id,
          details: notes,
        },
      });
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
