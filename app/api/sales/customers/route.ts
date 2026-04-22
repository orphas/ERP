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

    const customers = await prisma.customer.findMany({
      where,
      include: {
        _count: {
          select: {
            quotes: true,
            salesOrders: true,
            invoices: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(customers);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data?.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const customer = await prisma.customer.create({ data });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}

