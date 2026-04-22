import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { monthFromISO } from "@/lib/period-lock";
import { logOperation } from "@/lib/ops-log";

export async function GET(req: NextRequest) {
  try {
    const monthParam = req.nextUrl.searchParams.get("month");

    if (monthParam) {
      const month = monthFromISO(monthParam);
      const row = await prisma.periodClose.findUnique({ where: { month } });
      return NextResponse.json(row);
    }

    const rows = await prisma.periodClose.findMany({
      orderBy: { month: "desc" },
      take: 24,
    });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Failed to fetch period close records" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const month = monthFromISO(String(data.month || new Date().toISOString()));

    const updated = await prisma.periodClose.upsert({
      where: { month },
      update: {
        financeClosed: Boolean(data.financeClosed),
        inventoryClosed: Boolean(data.inventoryClosed),
        hrClosed: Boolean(data.hrClosed),
        salesClosed: Boolean(data.salesClosed),
        procurementClosed: Boolean(data.procurementClosed),
        notes: data.notes ? String(data.notes) : null,
        closedByRole: data.closedByRole ? String(data.closedByRole) : null,
      },
      create: {
        month,
        financeClosed: Boolean(data.financeClosed),
        inventoryClosed: Boolean(data.inventoryClosed),
        hrClosed: Boolean(data.hrClosed),
        salesClosed: Boolean(data.salesClosed),
        procurementClosed: Boolean(data.procurementClosed),
        notes: data.notes ? String(data.notes) : null,
        closedByRole: data.closedByRole ? String(data.closedByRole) : null,
      },
    });

    await logOperation({
      action: "PERIOD_CLOSE_UPDATED",
      entityType: "PeriodClose",
      entityId: updated.id,
      details: `Period close checklist updated for ${updated.month.toISOString().slice(0, 7)}`,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update period close" }, { status: 500 });
  }
}
