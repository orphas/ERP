import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDocumentReference } from "@/lib/doc-ref";
import { isModuleClosed } from "@/lib/period-lock";
import { assertBalancedLines } from "@/lib/double-entry";

export async function GET() {
  try {
    const entries = await prisma.journalEntry.findMany({
      include: {
        lines: {
          include: { account: true },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(entries);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch journal entries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { journalType, description, date, lines } = body;
    const postingDate = date ? new Date(date) : new Date();

    if (await isModuleClosed(prisma, "finance", postingDate)) {
      return NextResponse.json({ error: "Finance period is closed for this month" }, { status: 423 });
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "At least one line is required" }, { status: 400 });
    }

    const normalizedLines = lines.map(
      (line: { accountId: number; type: string; amount: number; description?: string }) => ({
        accountId: Number(line.accountId),
        type: line.type,
        amount: Number(line.amount),
        description: line.description ?? null,
      })
    );

    assertBalancedLines(
      normalizedLines.map((line: { type: string; amount: number }) => ({
        type: line.type as "debit" | "credit",
        amount: line.amount,
      }))
    );

    const entry = await prisma.$transaction(async (tx) => {
      const reference = await generateDocumentReference(tx, "journal");
      return tx.journalEntry.create({
        data: {
          reference,
          journalType: journalType ?? "general",
          description: description ?? null,
          date: postingDate,
          lines: {
            create: normalizedLines,
          },
        },
        include: {
          lines: {
            include: { account: true },
          },
        },
      });
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Double-entry check failed")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create journal entry" }, { status: 500 });
  }
}
