import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteDeliveryCascadeTx } from "@/lib/delete-cascade";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        order: true,
        items: true,
        expenses: {
          include: { supplier: true },
        },
      },
    });
    if (!delivery) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    }

    return NextResponse.json(delivery);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch delivery" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const exists = await prisma.delivery.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    }

    const data = await req.json();
    const delivery = await prisma.delivery.update({
      where: { id },
      data: {
        status: data.status,
        waybill: data.waybill,
        carrier: data.carrier,
      },
    });
    return NextResponse.json(delivery);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update delivery" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const delivery = await prisma.delivery.findUnique({ where: { id }, select: { id: true } });
    if (!delivery) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await deleteDeliveryCascadeTx(tx, id);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete delivery" }, { status: 500 });
  }
}
