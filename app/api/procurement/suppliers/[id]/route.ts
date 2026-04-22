import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deletePurchaseOrderCascadeTx } from "@/lib/delete-cascade";

function normalizeCurrency(value: unknown): string {
  const currency = String(value || "MAD").trim().toUpperCase();
  return currency || "MAD";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            items: true,
          },
        },
      },
    });
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    return NextResponse.json(supplier);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch supplier" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const exists = await prisma.supplier.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const data = await req.json();
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...data,
        defaultCurrency: data.defaultCurrency !== undefined ? normalizeCurrency(data.defaultCurrency) : undefined,
      },
    });
    return NextResponse.json(supplier);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        orders: { select: { id: true } },
      },
    });
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      for (const order of supplier.orders) {
        await deletePurchaseOrderCascadeTx(tx, order.id);
      }
      await tx.supplier.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete supplier" }, { status: 500 });
  }
}
