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
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json();
    const amount = Number(body?.amount);
    const paymentMethod = String(body?.paymentMethod || "").toLowerCase();
    const paymentAccountId = Number(body?.paymentAccountId);
    const paidDate = body?.paidDate ? new Date(body.paidDate) : new Date();

    if (await isModuleClosed(prisma, "finance", paidDate)) {
      return NextResponse.json({ error: "Finance period is closed for this month" }, { status: 423 });
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "amount must be greater than 0" }, { status: 400 });
    }

    if (paymentMethod !== "cheque" && paymentMethod !== "bank_transfer") {
      return NextResponse.json({ error: "paymentMethod must be cheque or bank_transfer" }, { status: 400 });
    }

    if (!Number.isFinite(paymentAccountId) || paymentAccountId <= 0) {
      return NextResponse.json({ error: "paymentAccountId is required" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (Number(invoice.paidAmount) > 0 || invoice.status === "paid") {
      return NextResponse.json({ error: "Multiple payments are not allowed for a single invoice" }, { status: 400 });
    }

    const remaining = Number(invoice.total) - Number(invoice.paidAmount);
    if (Math.abs(amount - remaining) > 0.000001) {
      return NextResponse.json({ error: `Invoice must be paid in one payment. Required amount: ${remaining.toFixed(2)}` }, { status: 400 });
    }

    const newPaidAmount = Number(invoice.paidAmount) + amount;
    const total = Number(invoice.total);
    if (newPaidAmount - total > 0.000001) {
      return NextResponse.json({ error: "Payment exceeds invoice remaining balance" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const incomingAccount = await tx.account.findUnique({ where: { id: paymentAccountId } });
      if (!incomingAccount || incomingAccount.isActive === false) {
        throw new Error("Invalid receiving account");
      }
      if (incomingAccount.type.toLowerCase() !== "asset") {
        throw new Error("Receiving account must be an asset account (bank/cash)");
      }

      let receivableAccount = await tx.account.findFirst({
        where: {
          type: "asset",
          OR: [
            { code: "3410" },
            { name: { contains: "Receivable" } },
            { name: { contains: "Customer" } },
          ],
        },
      });

      if (!receivableAccount) {
        receivableAccount = await tx.account.create({
          data: {
            code: "3410",
            name: "Accounts Receivable - Customers",
            type: "asset",
            accountClass: "3",
            description: "Auto-created for invoice payment postings",
          },
        });
      }

      const newStatus = "paid";
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
          paidDate: newStatus === "paid" ? paidDate : invoice.paidDate,
        },
      });

      const journalLines = [
        {
          accountId: incomingAccount.id,
          type: "debit" as const,
          amount,
          description: `Payment received for invoice ${invoice.reference}`,
        },
        {
          accountId: receivableAccount.id,
          type: "credit" as const,
          amount,
          description: `Invoice receivable settlement ${invoice.reference}`,
        },
      ];
      assertBalancedLines(journalLines.map((line) => ({ type: line.type, amount: line.amount })));

      const reference = await generateDocumentReference(tx, "journal");
      await tx.journalEntry.create({
        data: {
          reference,
          date: paidDate,
          journalType: paymentMethod === "cheque" ? "bank" : "bank",
          description: `Invoice ${invoice.reference} payment (${paymentMethod === "cheque" ? "Cheque" : "Bank transfer"})`,
          isPosted: true,
          lines: {
            create: journalLines,
          },
        },
      });

      const incomingDelta = ledgerDelta(incomingAccount.type.toLowerCase(), "debit", amount);
      const receivableDelta = ledgerDelta(receivableAccount.type.toLowerCase(), "credit", amount);

      await tx.account.update({
        where: { id: incomingAccount.id },
        data: { balance: Number(incomingAccount.balance) + incomingDelta },
      });
      await tx.account.update({
        where: { id: receivableAccount.id },
        data: { balance: Number(receivableAccount.balance) + receivableDelta },
      });

      return updatedInvoice;
    });

    await logOperation({
      action: "INVOICE_PAYMENT",
      entityType: "Invoice",
      entityId: updated.id,
      details: `Payment recorded: ${amount} on invoice ${updated.reference} via ${paymentMethod} to account ${paymentAccountId}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Invalid receiving account") || error.message.includes("Receiving account must")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}
