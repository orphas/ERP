import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/ops-log";
import { isModuleClosed } from "@/lib/period-lock";
import { generateDocumentReference } from "@/lib/doc-ref";
import { assertBalancedLines } from "@/lib/double-entry";

const debitIncreaseTypes = ["asset", "expense"];
const creditIncreaseTypes = ["liability", "equity", "income"];

function ledgerDelta(accountType: string, lineType: "debit" | "credit", amount: number) {
  if (lineType === "debit") {
    return debitIncreaseTypes.includes(accountType) ? amount : -amount;
  }
  return creditIncreaseTypes.includes(accountType) ? amount : -amount;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json().catch(() => ({}));
    const paymentMethod = String(body?.paymentMethod || "").toLowerCase();
    const paymentAccountId = Number(body?.paymentAccountId);

    if (paymentMethod !== "cheque" && paymentMethod !== "bank_transfer") {
      return NextResponse.json({ error: "paymentMethod must be cheque or bank_transfer" }, { status: 400 });
    }
    if (!Number.isFinite(paymentAccountId) || paymentAccountId <= 0) {
      return NextResponse.json({ error: "paymentAccountId is required" }, { status: 400 });
    }

    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const payroll = await prisma.payroll.findUnique({ where: { id }, select: { id: true, month: true } });
    if (!payroll) {
      return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
    }

    if (await isModuleClosed(prisma, "hr", new Date(payroll.month))) {
      return NextResponse.json({ error: "HR period is closed for this month" }, { status: 423 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const fullPayroll = await tx.payroll.findUnique({ where: { id }, include: { employee: true } });
      if (!fullPayroll) throw new Error("Payroll not found");
      if (fullPayroll.status !== "approved") {
        throw new Error("Only approved payroll can be paid");
      }

      const amount = Number(fullPayroll.netPay);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Payroll net pay must be greater than 0");
      }

      const bankOrCash = await tx.account.findUnique({ where: { id: paymentAccountId } });
      if (!bankOrCash || bankOrCash.isActive === false) {
        throw new Error("Invalid payment account");
      }
      if (bankOrCash.type.toLowerCase() !== "asset") {
        throw new Error("Payment account must be an asset account (bank/cash)");
      }

      let payrollExpense = await tx.account.findFirst({
        where: {
          type: "expense",
          OR: [{ code: "6410" }, { name: { contains: "Payroll" } }, { name: { contains: "Salary" } }],
        },
      });
      if (!payrollExpense) {
        payrollExpense = await tx.account.create({
          data: {
            code: "6410",
            name: "Payroll Expense",
            type: "expense",
            accountClass: "6",
            description: "Auto-created payroll expense account",
          },
        });
      }

      const journalLines = [
        {
          accountId: payrollExpense.id,
          type: "debit" as const,
          amount,
          description: `Payroll expense ${fullPayroll.id}`,
        },
        {
          accountId: bankOrCash.id,
          type: "credit" as const,
          amount,
          description: `Payroll paid via ${paymentMethod}`,
        },
      ];
      assertBalancedLines(journalLines.map((line) => ({ type: line.type, amount: line.amount })));

      const reference = await generateDocumentReference(tx, "journal");
      await tx.journalEntry.create({
        data: {
          reference,
          date: new Date(),
          journalType: paymentMethod === "cheque" ? "bank" : "bank",
          description: `Payroll payment #${fullPayroll.id} for ${fullPayroll.employee.firstName} ${fullPayroll.employee.lastName}`,
          isPosted: true,
          lines: {
            create: journalLines,
          },
        },
      });

      await tx.account.update({
        where: { id: payrollExpense.id },
        data: { balance: Number(payrollExpense.balance) + ledgerDelta(payrollExpense.type.toLowerCase(), "debit", amount) },
      });
      await tx.account.update({
        where: { id: bankOrCash.id },
        data: { balance: Number(bankOrCash.balance) + ledgerDelta(bankOrCash.type.toLowerCase(), "credit", amount) },
      });

      return tx.payroll.update({
        where: { id },
        data: { status: "paid" },
        include: { employee: true },
      });
    });

    await logOperation({
      action: "PAYROLL_PAID",
      entityType: "Payroll",
      entityId: updated.id,
      details: `Payroll ${updated.id} marked paid for ${updated.employee.firstName} ${updated.employee.lastName} via ${paymentMethod} (account ${paymentAccountId})`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("Only approved payroll") ||
        error.message.includes("Invalid payment account") ||
        error.message.includes("must be an asset") ||
        error.message.includes("must be greater than 0") ||
        error.message.includes("Double-entry check failed")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    return NextResponse.json({ error: "Failed to pay payroll" }, { status: 500 });
  }
}
