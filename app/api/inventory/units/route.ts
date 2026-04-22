import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const units = await prisma.unitOfMeasure.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(units);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch units" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    if (!data?.name || !data?.code) {
      return NextResponse.json({ error: "name and code are required" }, { status: 400 });
    }

    const unit = await prisma.unitOfMeasure.create({ data });
    return NextResponse.json(unit, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create unit" }, { status: 500 });
  }
}
