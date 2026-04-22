import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDocumentReference } from "@/lib/doc-ref";
import { isModuleClosed } from "@/lib/period-lock";

export async function GET() {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
        expenses: {
          include: {
            supplier: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch purchase orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (await isModuleClosed(prisma, "procurement", new Date())) {
      return NextResponse.json({ error: "Procurement period is closed for this month" }, { status: 423 });
    }

    const body = await req.json();
    const { supplierId, vatRate, items, expenses, purchaseType, incoterm, originCountry, expectedPort, customsReference, exchangeRate } = body;
    const normalizedType = String(purchaseType || "local").toLowerCase() === "import" ? "import" : "local";

    if (!supplierId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "supplierId and at least one item are required" },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.findUnique({ where: { id: Number(supplierId) } });
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const orderCurrency = String(supplier.defaultCurrency || "MAD").toUpperCase();
    const fxRate = exchangeRate !== null && exchangeRate !== undefined && String(exchangeRate).trim() !== "" ? Number(exchangeRate) : null;
    if (orderCurrency !== "MAD" && (!Number.isFinite(fxRate) || Number(fxRate) <= 0)) {
      return NextResponse.json({ error: `Exchange rate to MAD is required for ${orderCurrency} purchase orders` }, { status: 400 });
    }

    const normalizedItems = items
      .map((item: { productId?: number; quantity?: number; unitPrice?: number }) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        const productId = item.productId ? Number(item.productId) : null;

        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
          return null;
        }
        if (!productId) return null;

        return {
          itemType: "product",
          productId,
          description: null,
          quantity,
          unitPrice,
          lineTotal: quantity * unitPrice,
          receivedQty: 0,
        };
      })
      .filter((item): item is { itemType: string; productId: number | null; description: string | null; quantity: number; unitPrice: number; lineTotal: number; receivedQty: number } => Boolean(item));

    if (normalizedItems.length === 0) {
      return NextResponse.json({ error: "Add at least one valid product line" }, { status: 400 });
    }

    const normalizedExpenses = (Array.isArray(expenses) ? expenses : [])
      .map((expense: { supplierId?: number; description?: string; externalRef?: string; amount?: number; vatRate?: number }) => {
        const expenseSupplierId = Number(expense.supplierId);
        const description = String(expense.description || "").trim();
        const externalRef = String(expense.externalRef || "").trim() || null;
        const amount = Number(expense.amount);
        const expenseVatRate = Number(expense.vatRate ?? 0);
        if (!expenseSupplierId || !description || !Number.isFinite(amount) || amount < 0) {
          return null;
        }
        const expenseVatAmount = amount * (expenseVatRate / 100);
        return {
          supplierId: expenseSupplierId,
          description,
          externalRef,
          amount,
          vatRate: expenseVatRate,
          vatAmount: expenseVatAmount,
          total: amount + expenseVatAmount,
        };
      })
      .filter(
        (expense): expense is { supplierId: number; description: string; externalRef: string | null; amount: number; vatRate: number; vatAmount: number; total: number } =>
          Boolean(expense)
      );

    const productSubtotal = normalizedItems.reduce((sum: number, item: { lineTotal: number }) => sum + item.lineTotal, 0);
    const expenseSubtotal = normalizedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const vatRateNumber = Number(vatRate ?? 20);
    const vatAmount = productSubtotal * (vatRateNumber / 100);
    const expenseVatAmount = normalizedExpenses.reduce((sum, expense) => sum + expense.vatAmount, 0);
    const subtotal = productSubtotal + expenseSubtotal;
    const total = subtotal + vatAmount + expenseVatAmount;

    if (normalizedType === "import" && !originCountry) {
      return NextResponse.json({ error: "originCountry is required for import purchase orders" }, { status: 400 });
    }

    const order = await prisma.$transaction(async (tx) => {
      const reference = await generateDocumentReference(tx, "purchaseOrder");
      return tx.purchaseOrder.create({
        data: {
          supplierId: Number(supplierId),
          currency: orderCurrency,
          reference,
          purchaseType: normalizedType,
          incoterm: normalizedType === "import" ? String(incoterm || "") || null : null,
          originCountry: normalizedType === "import" ? String(originCountry || "") || null : null,
          expectedPort: normalizedType === "import" ? String(expectedPort || "") || null : null,
          customsReference: normalizedType === "import" ? String(customsReference || "") || null : null,
          exchangeRate: fxRate,
          productSubtotal,
          expenseSubtotal,
          expenseVatAmount,
          vatRate: vatRateNumber,
          subtotal,
          vatAmount,
          total,
          items: {
            create: normalizedItems,
          },
          expenses: {
            create: normalizedExpenses,
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
          expenses: {
            include: {
              supplier: true,
            },
          },
        },
      });
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create purchase order" }, { status: 500 });
  }
}
