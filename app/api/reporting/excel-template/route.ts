import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type PeriodRow = {
  period: string;
  salesRevenue: number;
  thirdPartyExpense: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  vatOutput: number;
  invoicedTotal: number;
  paidTotal: number;
  receivableBalance: number;
};

export async function GET() {
  try {
    const [invoices, account4480] = await Promise.all([
      prisma.invoice.findMany({
        include: {
          items: {
            select: {
              itemType: true,
              lineTotal: true,
              cogsAmount: true,
            },
          },
        },
        orderBy: { date: "asc" },
      }),
      prisma.account.findUnique({
        where: { code: "4480" },
        select: { balance: true },
      }),
    ]);

    const periodMap = new Map<string, PeriodRow>();

    for (const invoice of invoices) {
      const key = monthKey(new Date(invoice.date));
      const current =
        periodMap.get(key) ||
        {
          period: key,
          salesRevenue: 0,
          thirdPartyExpense: 0,
          cogs: 0,
          grossProfit: 0,
          grossMarginPct: 0,
          vatOutput: 0,
          invoicedTotal: 0,
          paidTotal: 0,
          receivableBalance: 0,
        };

      const salesRevenue = invoice.items
        .filter((line) => line.itemType !== "charge")
        .reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
      const thirdPartyExpense = invoice.items
        .filter((line) => line.itemType === "charge")
        .reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
      const cogs = invoice.items.reduce((sum, line) => sum + Number(line.cogsAmount || 0), 0);
      const invoicedTotal = Number(invoice.total || 0);
      const paidTotal = Number(invoice.paidAmount || 0);
      const receivableBalance = Math.max(invoicedTotal - paidTotal, 0);

      current.salesRevenue += salesRevenue;
      current.thirdPartyExpense += thirdPartyExpense;
      current.cogs += cogs;
      current.vatOutput += Number(invoice.vatAmount || 0);
      current.invoicedTotal += invoicedTotal;
      current.paidTotal += paidTotal;
      current.receivableBalance += receivableBalance;
      current.grossProfit = current.salesRevenue - current.cogs;
      current.grossMarginPct =
        current.salesRevenue > 0 ? (current.grossProfit / current.salesRevenue) * 100 : 0;

      periodMap.set(key, current);
    }

    const periods = Array.from(periodMap.values()).sort((a, b) => a.period.localeCompare(b.period));

    const totals = periods.reduce(
      (acc, row) => {
        acc.salesRevenue += row.salesRevenue;
        acc.thirdPartyExpense += row.thirdPartyExpense;
        acc.cogs += row.cogs;
        acc.grossProfit += row.grossProfit;
        acc.vatOutput += row.vatOutput;
        acc.invoicedTotal += row.invoicedTotal;
        acc.paidTotal += row.paidTotal;
        acc.receivableBalance += row.receivableBalance;
        return acc;
      },
      {
        salesRevenue: 0,
        thirdPartyExpense: 0,
        cogs: 0,
        grossProfit: 0,
        grossMarginPct: 0,
        vatOutput: 0,
        invoicedTotal: 0,
        paidTotal: 0,
        receivableBalance: 0,
      }
    );

    totals.grossMarginPct = totals.salesRevenue > 0 ? (totals.grossProfit / totals.salesRevenue) * 100 : 0;

    return NextResponse.json({
      periods,
      totals,
      controls: {
        payableThirdPartyAccrualBalance: Number(account4480?.balance || 0),
        formulaNotes: {
          salesRevenue: "Sum of invoice product lines only (itemType != charge)",
          thirdPartyExpense: "Sum of invoice charge lines (itemType = charge)",
          cogs: "Sum of invoice item cogsAmount",
          grossProfit: "salesRevenue - cogs",
          receivableBalance: "sum(max(invoice.total - invoice.paidAmount, 0))",
        },
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to build excel template report" }, { status: 500 });
  }
}
