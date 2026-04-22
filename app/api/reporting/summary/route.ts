import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeReportingData } from "@/lib/reporting";

function parseDate(raw: string | null, fallback: Date): Date {
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function GET(req: NextRequest) {
  try {
    const now = new Date();
    const startDefault = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const endDefault = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const startDate = parseDate(req.nextUrl.searchParams.get("startDate"), startDefault);
    const endDate = parseDate(req.nextUrl.searchParams.get("endDate"), endDefault);
    const customerIdRaw = req.nextUrl.searchParams.get("customerId");
    const customerId = customerIdRaw ? Number(customerIdRaw) : null;

    if (endDate < startDate) {
      return NextResponse.json({ error: "endDate must be greater than or equal to startDate" }, { status: 400 });
    }

    const data = await computeReportingData(prisma, {
      startDate,
      endDate,
      customerId: Number.isFinite(customerId || NaN) ? customerId : null,
    });

    return NextResponse.json({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ...data,
    });
  } catch {
    return NextResponse.json({ error: "Failed to build reporting summary" }, { status: 500 });
  }
}
