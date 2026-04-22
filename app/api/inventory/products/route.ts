import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        unit: true,
        _count: { select: { batches: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    if (!data?.name || !data?.sku || !data?.categoryId || data?.price === undefined) {
      return NextResponse.json(
        { error: "name, sku, categoryId and price are required" },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        categoryId: Number(data.categoryId),
        price: Number(data.price),
        cost: data.cost !== undefined ? Number(data.cost) : undefined,
        unitId: data.unitId !== undefined && data.unitId !== null ? Number(data.unitId) : null,
        minStockThreshold:
          data.minStockThreshold !== undefined ? Number(data.minStockThreshold) : undefined,
      },
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
