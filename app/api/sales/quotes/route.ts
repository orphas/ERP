import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDocumentReference } from "@/lib/doc-ref";
import { isModuleClosed } from "@/lib/period-lock";

export async function GET() {
  try {
    const quotes = await prisma.quote.findMany({
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(quotes);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch quotes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (await isModuleClosed(prisma, "sales", new Date())) {
      return NextResponse.json({ error: "Sales period is closed for this month" }, { status: 423 });
    }

    const body = await req.json();
    const { customerId, validityDays, vatRate, notes, items } = body;

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "customerId and at least one item are required" },
        { status: 400 }
      );
    }

    const normalizedItems = items
      .map((item: { productId: number; quantity: number; unitPrice: number }) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        return {
          productId: Number(item.productId),
          quantity,
          unitPrice,
          lineTotal: quantity * unitPrice,
        };
      })
      .filter(
        (item) =>
          Number.isInteger(item.productId) &&
          item.productId > 0 &&
          Number.isFinite(item.quantity) &&
          item.quantity > 0 &&
          Number.isFinite(item.unitPrice) &&
          item.unitPrice >= 0
      );

    if (normalizedItems.length === 0) {
      return NextResponse.json({ error: "No valid quote items submitted" }, { status: 400 });
    }

    const subtotal = normalizedItems.reduce((sum: number, item: { lineTotal: number }) => sum + item.lineTotal, 0);
    const vatRateNumber = Number(vatRate ?? 20);
    const vatAmount = subtotal * (vatRateNumber / 100);
    const total = subtotal + vatAmount;

    const quote = await prisma.$transaction(async (tx) => {
      const reference = await generateDocumentReference(tx, "quote");
      const created = await tx.quote.create({
        data: {
          customerId: Number(customerId),
          reference,
          validityDays: Number(validityDays ?? 30),
          vatRate: vatRateNumber,
          subtotal,
          vatAmount,
          total,
          notes: notes ?? null,
          items: {
            create: normalizedItems,
          },
        },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      });

      return created;
    });

    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create quote" }, { status: 500 });
  }
}
