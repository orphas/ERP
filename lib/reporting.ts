import { PrismaClient } from "@prisma/client";

export type ReportingQuery = {
  startDate: Date;
  endDate: Date;
  customerId?: number | null;
};

export type ReportingData = {
  metrics: {
    invoices: number;
    customers: number;
    salesRevenue: number;
    thirdPartyRevenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPct: number;
    vatOutput: number;
    receivables: number;
    collected: number;
    inventoryValuation: number;
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
  };
  aging: {
    current: number;
    due30: number;
    due60: number;
    due90p: number;
  };
  customerAging: Array<{
    customerId: number;
    customerName: string;
    current: number;
    due30: number;
    due60: number;
    due90p: number;
    totalOutstanding: number;
  }>;
  statement: Array<{
    customerId: number;
    customerName: string;
    invoiceId: number;
    reference: string;
    date: string;
    dueDate: string | null;
    status: string;
    total: number;
    paid: number;
    balance: number;
  }>;
  salesTrend: Array<{
    period: string;
    salesRevenue: number;
    thirdPartyRevenue: number;
    cogs: number;
    grossProfit: number;
  }>;
  customers: Array<{ id: number; name: string }>;
};

function periodKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function computeReportingData(prisma: PrismaClient, query: ReportingQuery): Promise<ReportingData> {
  const whereDate = {
    gte: query.startDate,
    lte: query.endDate,
  };

  const [invoices, customers, batches, accounts] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        date: whereDate,
        ...(query.customerId ? { customerId: query.customerId } : {}),
      },
      include: {
        customer: true,
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
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.batch.findMany({
      select: { availableQuantity: true, landedUnitCost: true },
    }),
    prisma.account.findMany({
      where: { isActive: true },
      select: { type: true, balance: true },
    }),
  ]);

  const today = new Date();
  const aging = { current: 0, due30: 0, due60: 0, due90p: 0 };
  const customerAgingMap = new Map<number, ReportingData["customerAging"][number]>();
  const statement: ReportingData["statement"] = [];
  const trendMap = new Map<string, ReportingData["salesTrend"][number]>();

  let salesRevenue = 0;
  let thirdPartyRevenue = 0;
  let cogs = 0;
  let vatOutput = 0;
  let receivables = 0;
  let collected = 0;

  for (const invoice of invoices) {
    const customerId = Number(invoice.customerId);
    const customerName = invoice.customer?.name || `Customer #${customerId}`;
    const total = Number(invoice.total || 0);
    const paid = Number(invoice.paidAmount || 0);
    const balance = Math.max(total - paid, 0);

    const invoiceSalesRevenue = invoice.items
      .filter((line) => line.itemType !== "charge")
      .reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);

    const invoiceThirdPartyRevenue = invoice.items
      .filter((line) => line.itemType === "charge")
      .reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);

    const invoiceCogs = invoice.items.reduce((sum, line) => sum + Number(line.cogsAmount || 0), 0);

    salesRevenue += invoiceSalesRevenue;
    thirdPartyRevenue += invoiceThirdPartyRevenue;
    cogs += invoiceCogs;
    vatOutput += Number(invoice.vatAmount || 0);
    receivables += balance;
    collected += paid;

    const key = periodKey(new Date(invoice.date));
    const trend = trendMap.get(key) || {
      period: key,
      salesRevenue: 0,
      thirdPartyRevenue: 0,
      cogs: 0,
      grossProfit: 0,
    };
    trend.salesRevenue += invoiceSalesRevenue;
    trend.thirdPartyRevenue += invoiceThirdPartyRevenue;
    trend.cogs += invoiceCogs;
    trend.grossProfit = trend.salesRevenue - trend.cogs;
    trendMap.set(key, trend);

    statement.push({
      customerId,
      customerName,
      invoiceId: invoice.id,
      reference: invoice.reference,
      date: invoice.date.toISOString(),
      dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
      status: invoice.status,
      total,
      paid,
      balance,
    });

    if (balance <= 0) continue;

    const row =
      customerAgingMap.get(customerId) ||
      ({
        customerId,
        customerName,
        current: 0,
        due30: 0,
        due60: 0,
        due90p: 0,
        totalOutstanding: 0,
      } as ReportingData["customerAging"][number]);

    row.totalOutstanding += balance;

    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
    if (!dueDate || dueDate >= today) {
      aging.current += balance;
      row.current += balance;
    } else {
      const days = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 30) {
        aging.due30 += balance;
        row.due30 += balance;
      } else if (days <= 60) {
        aging.due60 += balance;
        row.due60 += balance;
      } else {
        aging.due90p += balance;
        row.due90p += balance;
      }
    }

    customerAgingMap.set(customerId, row);
  }

  const inventoryValuation = batches.reduce(
    (sum, batch) => sum + Number(batch.availableQuantity || 0) * Number(batch.landedUnitCost || 0),
    0
  );

  const totalIncome = accounts
    .filter((account) => account.type.toLowerCase() === "income")
    .reduce((sum, account) => sum + Number(account.balance || 0), 0);

  const totalExpense = accounts
    .filter((account) => account.type.toLowerCase() === "expense")
    .reduce((sum, account) => sum + Number(account.balance || 0), 0);

  const grossProfit = salesRevenue - cogs;
  const grossMarginPct = salesRevenue > 0 ? (grossProfit / salesRevenue) * 100 : 0;

  return {
    metrics: {
      invoices: invoices.length,
      customers: customers.length,
      salesRevenue,
      thirdPartyRevenue,
      cogs,
      grossProfit,
      grossMarginPct,
      vatOutput,
      receivables,
      collected,
      inventoryValuation,
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
    },
    aging,
    customerAging: Array.from(customerAgingMap.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding),
    statement: statement.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    salesTrend: Array.from(trendMap.values()).sort((a, b) => a.period.localeCompare(b.period)),
    customers,
  };
}
