import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const logs = await prisma.operationsLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return NextResponse.json(logs);
  } catch {
    return NextResponse.json({ error: "Failed to fetch operations logs" }, { status: 500 });
  }
}
