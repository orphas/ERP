import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        parent: true,
        _count: {
          select: {
            children: true,
            journalLines: true,
          },
        },
      },
      orderBy: { code: "asc" },
    });
    return NextResponse.json(accounts);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data?.code || !data?.name || !data?.type) {
      return NextResponse.json({ error: "code, name and type are required" }, { status: 400 });
    }

    const account = await prisma.account.create({ data });
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}

