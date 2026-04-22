import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeReportingData } from "@/lib/reporting";

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function monthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export async function GET() {
  try {
    const snapshots = await prisma.reportSnapshot.findMany({
      where: { type: "monthly" },
      orderBy: { periodStart: "desc" },
      take: 24,
    });
    return NextResponse.json(snapshots);
  } catch {
    return NextResponse.json({ error: "Failed to fetch monthly reports" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const monthParam = req.nextUrl.searchParams.get("month");
    const auto = req.nextUrl.searchParams.get("auto") === "true";

    let target: Date;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split("-").map(Number);
      target = new Date(y, m - 1, 1);
    } else {
      const now = new Date();
      target = auto ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const startDate = monthStart(target);
    const endDate = monthEnd(target);

    const existing = await prisma.reportSnapshot.findFirst({
      where: {
        type: "monthly",
        periodStart: startDate,
        periodEnd: endDate,
      },
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    const data = await computeReportingData(prisma, { startDate, endDate, customerId: null });

    const created = await prisma.reportSnapshot.create({
      data: {
        type: "monthly",
        periodStart: startDate,
        periodEnd: endDate,
        payload: data as unknown as object,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to generate monthly report snapshot" }, { status: 500 });
  }
}
