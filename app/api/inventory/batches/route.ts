import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const productId = req.nextUrl.searchParams.get("productId");
    const warehouseId = req.nextUrl.searchParams.get("warehouseId");

    const where: { productId?: number; warehouseId?: number } = {};
    if (productId) {
      where.productId = Number(productId);
    }
    if (warehouseId) {
      where.warehouseId = Number(warehouseId);
    }

    const batches = await prisma.batch.findMany({
      where,
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(batches);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch batches" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    if (
      !data?.productId ||
      !data?.warehouseId ||
      !data?.batchNumber ||
      data?.quantity === undefined ||
      data?.availableQuantity === undefined ||
      data?.landedUnitCost === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "productId, warehouseId, batchNumber, quantity, availableQuantity, landedUnitCost are required",
        },
        { status: 400 }
      );
    }

    const batch = await prisma.batch.create({
      data: {
        ...data,
        productId: Number(data.productId),
        warehouseId: Number(data.warehouseId),
        quantity: Number(data.quantity),
        availableQuantity: Number(data.availableQuantity),
        landedUnitCost: Number(data.landedUnitCost),
      },
    });
    return NextResponse.json(batch, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create batch" }, { status: 500 });
  }
}
