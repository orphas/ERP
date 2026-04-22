import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const isActive = req.nextUrl.searchParams.get("isActive");
    const where =
      isActive === null
        ? undefined
        : {
            isActive: isActive === "true",
          };

    const warehouses = await prisma.warehouse.findMany({
      where,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(warehouses);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch warehouses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    if (!data?.name || !data?.code) {
      return NextResponse.json({ error: "name and code are required" }, { status: 400 });
    }

    const warehouse = await prisma.warehouse.create({ data });
    return NextResponse.json(warehouse, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create warehouse" }, { status: 500 });
  }
}
