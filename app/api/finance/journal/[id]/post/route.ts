import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/ops-log";
import { isModuleClosed } from "@/lib/period-lock";
import { assertBalancedLines } from "@/lib/double-entry";

const debitIncreaseTypes = ["asset", "expense"];
const creditIncreaseTypes = ["liability", "equity", "income"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!entry) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
    }
    if (entry.isPosted) {
      return NextResponse.json({ error: "Journal entry already posted" }, { status: 400 });
    }

    if (await isModuleClosed(prisma, "finance", new Date(entry.date))) {
      return NextResponse.json({ error: "Finance period is closed for this month" }, { status: 423 });
    }

    assertBalancedLines(
      entry.lines.map((line) => ({
        type: line.type as "debit" | "credit",
        amount: Number(line.amount),
      }))
    );

    const posted = await prisma.$transaction(async (tx) => {
      for (const line of entry.lines) {
        const account = await tx.account.findUnique({ where: { id: line.accountId } });
        if (!account) {
          throw new Error(`Account ${line.accountId} not found`);
        }

        const amount = Number(line.amount);
        const accountType = account.type.toLowerCase();
        let delta = 0;

        if (line.type === "debit") {
          delta = debitIncreaseTypes.includes(accountType) ? amount : -amount;
        } else {
          delta = creditIncreaseTypes.includes(accountType) ? amount : -amount;
        }

        await tx.account.update({
          where: { id: account.id },
          data: {
            balance: Number(account.balance) + delta,
          },
        });
      }

      return tx.journalEntry.update({
        where: { id: entry.id },
        data: { isPosted: true },
        include: {
          lines: {
            include: { account: true },
          },
        },
      });
    });

    await logOperation({
      action: "JOURNAL_POSTED",
      entityType: "JournalEntry",
      entityId: posted.id,
      details: `Journal entry ${posted.reference} posted to ledger`,
    });

    return NextResponse.json(posted);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Double-entry check failed")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to post journal entry" }, { status: 500 });
  }
}
