import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const batch = await prisma.batch.findUnique({ where: { id } });
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    return NextResponse.json(batch);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch batch" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const exists = await prisma.batch.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const data = await req.json();
    const batch = await prisma.batch.update({
      where: { id },
      data: {
        ...data,
        productId: data.productId !== undefined ? Number(data.productId) : undefined,
        warehouseId: data.warehouseId !== undefined ? Number(data.warehouseId) : undefined,
        quantity: data.quantity !== undefined ? Number(data.quantity) : undefined,
        availableQuantity:
          data.availableQuantity !== undefined ? Number(data.availableQuantity) : undefined,
        landedUnitCost: data.landedUnitCost !== undefined ? Number(data.landedUnitCost) : undefined,
      },
    });
    return NextResponse.json(batch);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update batch" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const exists = await prisma.batch.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    await prisma.batch.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete batch" }, { status: 500 });
  }
}
