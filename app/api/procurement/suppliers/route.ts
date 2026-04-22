import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeCurrency(value: unknown): string {
  const currency = String(value || "MAD").trim().toUpperCase();
  return currency || "MAD";
}

export async function GET() {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(suppliers);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data?.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const supplier = await prisma.supplier.create({
      data: {
        ...data,
        defaultCurrency: normalizeCurrency(data.defaultCurrency),
      },
    });
    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}

