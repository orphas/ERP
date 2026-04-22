import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/ops-log";
import { isModuleClosed } from "@/lib/period-lock";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const payroll = await prisma.payroll.findUnique({ where: { id }, select: { id: true, month: true } });
    if (!payroll) {
      return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
    }

    if (await isModuleClosed(prisma, "hr", new Date(payroll.month))) {
      return NextResponse.json({ error: "HR period is closed for this month" }, { status: 423 });
    }

    const updated = await prisma.payroll.update({
      where: { id },
      data: { status: "approved" },
      include: { employee: true },
    });

    await logOperation({
      action: "PAYROLL_APPROVED",
      entityType: "Payroll",
      entityId: updated.id,
      details: `Payroll ${updated.id} approved for ${updated.employee.firstName} ${updated.employee.lastName}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Failed to approve payroll" }, { status: 500 });
  }
}
