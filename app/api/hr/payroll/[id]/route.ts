import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const payroll = await prisma.payroll.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!payroll) {
      return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
    }

    return NextResponse.json(payroll);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch payroll" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const payroll = await prisma.payroll.findUnique({ where: { id } });
    if (!payroll) {
      return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
    }
    if (payroll.status !== "draft") {
      return NextResponse.json({ error: "Only draft payroll can be updated" }, { status: 400 });
    }

    const data = await req.json();
    const bonuses = data.bonuses !== undefined ? Number(data.bonuses) : Number(payroll.bonuses);
    const deductions =
      data.deductions !== undefined ? Number(data.deductions) : Number(payroll.deductions);
    const netPay = data.netPay !== undefined ? Number(data.netPay) : Number(payroll.baseSalary) + bonuses - deductions;

    const updated = await prisma.payroll.update({
      where: { id },
      data: {
        bonuses,
        deductions,
        netPay,
      },
      include: { employee: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update payroll" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const payroll = await prisma.payroll.findUnique({ where: { id }, select: { id: true } });
    if (!payroll) {
      return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
    }

    await prisma.payroll.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete payroll" }, { status: 500 });
  }
}
