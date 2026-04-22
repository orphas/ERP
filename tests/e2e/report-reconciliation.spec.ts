import { expect, test } from "@playwright/test";

type ReportPeriod = {
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

type ReportResponse = {
  periods: ReportPeriod[];
  totals: {
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
  controls: {
    payableThirdPartyAccrualBalance: number;
  };
};

function closeEnough(a: number, b: number, epsilon = 0.02) {
  return Math.abs(a - b) <= epsilon;
}

test.describe("Reporting reconciliation", () => {
  test("excel-template report totals reconcile with period sums and formulas", async ({ request }) => {
    const login = await request.post("/api/auth/login", {
      data: { username: "admin", password: "admin123" },
    });
    expect(login.ok()).toBeTruthy();

    const res = await request.get("/api/reporting/excel-template");
    expect(res.ok()).toBeTruthy();
    const report = (await res.json()) as ReportResponse;

    const periodSalesRevenue = report.periods.reduce((sum, row) => sum + Number(row.salesRevenue || 0), 0);
    const periodThirdPartyExpense = report.periods.reduce((sum, row) => sum + Number(row.thirdPartyExpense || 0), 0);
    const periodCogs = report.periods.reduce((sum, row) => sum + Number(row.cogs || 0), 0);
    const periodGrossProfit = report.periods.reduce((sum, row) => sum + Number(row.grossProfit || 0), 0);
    const periodVatOutput = report.periods.reduce((sum, row) => sum + Number(row.vatOutput || 0), 0);
    const periodInvoicedTotal = report.periods.reduce((sum, row) => sum + Number(row.invoicedTotal || 0), 0);
    const periodPaidTotal = report.periods.reduce((sum, row) => sum + Number(row.paidTotal || 0), 0);
    const periodReceivableBalance = report.periods.reduce((sum, row) => sum + Number(row.receivableBalance || 0), 0);

    expect(closeEnough(report.totals.salesRevenue, periodSalesRevenue)).toBeTruthy();
    expect(closeEnough(report.totals.thirdPartyExpense, periodThirdPartyExpense)).toBeTruthy();
    expect(closeEnough(report.totals.cogs, periodCogs)).toBeTruthy();
    expect(closeEnough(report.totals.grossProfit, periodGrossProfit)).toBeTruthy();
    expect(closeEnough(report.totals.vatOutput, periodVatOutput)).toBeTruthy();
    expect(closeEnough(report.totals.invoicedTotal, periodInvoicedTotal)).toBeTruthy();
    expect(closeEnough(report.totals.paidTotal, periodPaidTotal)).toBeTruthy();
    expect(closeEnough(report.totals.receivableBalance, periodReceivableBalance)).toBeTruthy();

    const computedGrossProfit = Number(report.totals.salesRevenue) - Number(report.totals.cogs);
    expect(closeEnough(report.totals.grossProfit, computedGrossProfit)).toBeTruthy();

    const computedMargin = Number(report.totals.salesRevenue) > 0
      ? (computedGrossProfit / Number(report.totals.salesRevenue)) * 100
      : 0;
    expect(closeEnough(report.totals.grossMarginPct, computedMargin)).toBeTruthy();

    expect(Number.isFinite(Number(report.controls.payableThirdPartyAccrualBalance))).toBeTruthy();
  });
});
