import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function keyFor(date: Date, by: "year" | "month") {
  if (by === "year") return `${date.getFullYear()}`;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const by = req.nextUrl.searchParams.get("by") === "month" ? "month" : "year";
    const start = req.nextUrl.searchParams.get("start");
    const end = req.nextUrl.searchParams.get("end");

    const where: { gte?: Date; lte?: Date } = {};
    if (start) {
      const parsed = new Date(start);
      if (!Number.isNaN(parsed.getTime())) where.gte = parsed;
    }
    if (end) {
      const parsed = new Date(end);
      if (!Number.isNaN(parsed.getTime())) where.lte = parsed;
    }

    const invoices = await prisma.invoice.findMany({
      where: Object.keys(where).length > 0 ? { date: where } : undefined,
      include: {
        items: {
          select: {
            lineTotal: true,
            cogsAmount: true,
            itemType: true,
          },
        },
      },
      orderBy: { date: "asc" },
    });

    const grouped = new Map<string, { revenue: number; thirdPartyExpense: number; cogs: number; grossProfit: number; marginPct: number }>();

    for (const invoice of invoices) {
      const key = keyFor(new Date(invoice.date), by);
      const current = grouped.get(key) || { revenue: 0, thirdPartyExpense: 0, cogs: 0, grossProfit: 0, marginPct: 0 };
      const revenue = invoice.items
        .filter((line) => line.itemType !== "charge")
        .reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
      const thirdPartyExpense = invoice.items
        .filter((line) => line.itemType === "charge")
        .reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
      const cogs = invoice.items.reduce((sum, line) => sum + Number(line.cogsAmount || 0), 0);

      current.revenue += revenue;
      current.thirdPartyExpense += thirdPartyExpense;
      current.cogs += cogs;
      current.grossProfit = current.revenue - current.cogs;
      current.marginPct = current.revenue > 0 ? (current.grossProfit / current.revenue) * 100 : 0;
      grouped.set(key, current);
    }

    const rows = Array.from(grouped.entries())
      .map(([period, value]) => ({
        period,
        ...value,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Failed to build profitability report" }, { status: 500 });
  }
}
