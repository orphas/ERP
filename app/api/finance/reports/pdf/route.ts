import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUniversalPdfLayoutSettings, htmlToPdfBuffer } from "@/lib/pdf";
import { computeReportingData } from "@/lib/reporting";

export const runtime = "nodejs";

type ReportKind = "receivables" | "payables" | "invoice-summary" | "expenses" | "profitability" | "cogs";

type LayoutSettings = {
  backgroundUrl: string | null;
  headerSpacePx: number;
  footerSpacePx: number;
  baseCurrency: string;
  usdToMadRate: number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtMoney(value: number): string {
  return value.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-MA");
}

function parseDate(raw: string | null, fallback: Date): Date {
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

async function getLayoutSettings(): Promise<LayoutSettings> {
  const pdfLayout = await getUniversalPdfLayoutSettings();
  const usdOrder = await prisma.purchaseOrder.findFirst({
    where: {
      currency: "USD",
      exchangeRate: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { exchangeRate: true },
  });

  const usdToMadRate = Number(usdOrder?.exchangeRate || 10);

  return {
    backgroundUrl: pdfLayout.backgroundUrl,
    headerSpacePx: pdfLayout.headerSpacePx,
    footerSpacePx: pdfLayout.footerSpacePx,
    baseCurrency: pdfLayout.baseCurrency,
    usdToMadRate: Number.isFinite(usdToMadRate) && usdToMadRate > 0 ? usdToMadRate : 10,
  };
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function orderFxToMad(order: { currency?: string | null; exchangeRate?: unknown }): number {
  const currency = String(order.currency || "MAD").toUpperCase();
  if (currency === "MAD") return 1;
  const fx = num(order.exchangeRate);
  return fx > 0 ? fx : 0;
}

function orderTotalMad(order: { total?: unknown; currency?: string | null; exchangeRate?: unknown }): number {
  const total = num(order.total);
  const fx = orderFxToMad(order);
  return fx > 0 ? total * fx : 0;
}

function orderTotalUsd(order: { total?: unknown; currency?: string | null; exchangeRate?: unknown }, usdToMadRate: number): number {
  const currency = String(order.currency || "MAD").toUpperCase();
  const total = num(order.total);
  if (currency === "USD") return total;
  const madAmount = orderTotalMad(order);
  return usdToMadRate > 0 ? madAmount / usdToMadRate : 0;
}

function shell(title: string, periodLabel: string, sections: string, layout: LayoutSettings): string {
  const bgCss = layout.backgroundUrl
    ? `.letterhead-bg {
         position: fixed;
         top: 0;
         right: 0;
         bottom: 0;
         left: 0;
         z-index: 0;
       }
       .letterhead-bg img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: top center; display: block; opacity: 1; filter: none; }`
    : `.letterhead-bg { display: none; }`;

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; font-size: 11px; }
    ${bgCss}
    .page-frame {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      position: relative;
      z-index: 1;
    }
    .page-frame thead { display: table-header-group; }
    .page-frame tfoot { display: table-footer-group; }
    .page-frame > thead > tr > td,
    .page-frame > tfoot > tr > td,
    .page-frame > tbody > tr > td {
      border: none;
      padding: 0;
    }
    .page-spacer-top { height: ${layout.headerSpacePx}px; }
    .page-spacer-bottom { height: ${layout.footerSpacePx}px; }
    .doc-body {
      padding: 0 34px;
    }
    h1 { margin: 0; font-size: 20px; }
    .subtitle { margin: 4px 0 14px; color: #475569; font-size: 11px; }
    .meta { margin: 0 0 14px; color: #334155; font-size: 11px; }
    .section { margin-top: 14px; }
    .section-title { margin: 0 0 8px; font-size: 13px; font-weight: 700; break-after: avoid; page-break-after: avoid; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; page-break-inside: auto; }
    thead { display: table-header-group; }
    tr, td, th { break-inside: avoid; page-break-inside: avoid; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 7px; }
    th { background: #0f172a; color: #f8fafc; text-align: left; }
    td.num, th.num { text-align: right; }
    tr.summary-row th, tr.summary-row td { background: #0f172a; color: #f8fafc; font-weight: 700; border-top: 1px solid #1e293b; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; background: #ffffff; }
    .kpi-label { color: #475569; font-size: 10px; margin-bottom: 4px; }
    .kpi-value { font-size: 14px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="letterhead-bg">${layout.backgroundUrl ? `<img src="${layout.backgroundUrl}" alt="" />` : ""}</div>
  <table class="page-frame" role="presentation" aria-hidden="true">
    <thead><tr><td><div class="page-spacer-top"></div></td></tr></thead>
    <tfoot><tr><td><div class="page-spacer-bottom"></div></td></tr></tfoot>
    <tbody><tr><td>
  <main class="doc-body">
    <h1>${escapeHtml(title)}</h1>
    <p class="subtitle">ERP SGICR - Finance Management Report</p>
    <p class="meta">Period: ${escapeHtml(periodLabel)} | Generated: ${escapeHtml(new Date().toLocaleString("fr-MA"))}</p>
    ${sections}
  </main>
    </td></tr></tbody>
  </table>
</body>
</html>`;
}

function sectionTable(
  title: string,
  headers: Array<{ label: string; numeric?: boolean }>,
  rows: string,
  footerRows = ""
): string {
  const thead = headers
    .map((h) => `<th${h.numeric ? ' class="num"' : ""}>${escapeHtml(h.label)}</th>`)
    .join("");

  const body = rows || `<tr><td colspan="${headers.length}">No data</td></tr>`;

  return `<section class="section">
    <h2 class="section-title">${escapeHtml(title)}</h2>
    <table>
      <thead><tr>${thead}</tr></thead>
      <tbody>${body}${footerRows}</tbody>
    </table>
  </section>`;
}

async function buildReceivablesHtml(startDate: Date, endDate: Date, layout: LayoutSettings): Promise<string> {
  const customers = await prisma.customer.findMany({
    include: {
      invoices: {
        where: { date: { gte: startDate, lte: endDate } },
        select: { total: true, paidAmount: true, dueDate: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const rows = customers.map((customer) => {
    let invoiced = 0;
    let paid = 0;
    let balance = 0;
    let overdue = 0;

    for (const invoice of customer.invoices) {
      const total = Number(invoice.total || 0);
      const paidAmount = Number(invoice.paidAmount || 0);
      const open = Math.max(total - paidAmount, 0);
      invoiced += total;
      paid += paidAmount;
      balance += open;
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
      if (open > 0 && dueDate && dueDate < now) overdue += open;
    }

    return {
      customer: customer.name,
      balance,
       invoiceCount: customer.invoices.length,
      overdue,
    };
    }).filter(row => row.balance > 0);

  const totals = rows.reduce(
    (acc, row) => {
      acc.balance += row.balance;
      acc.overdue += row.overdue;
       acc.invoiceCount += row.invoiceCount;
      return acc;
     },
     { balance: 0, overdue: 0, invoiceCount: 0 }
  );

  const kpis = `<section class="section">
    <div class="kpi-grid">
       <div class="kpi"><div class="kpi-label">Total Outstanding Receivables</div><div class="kpi-value">${fmtMoney(totals.balance)}</div></div>
       <div class="kpi"><div class="kpi-label">Overdue Amount</div><div class="kpi-value">${fmtMoney(totals.overdue)}</div></div>
       <div class="kpi"><div class="kpi-label">Overdue Percentage</div><div class="kpi-value">${totals.balance > 0 ? ((totals.overdue / totals.balance) * 100).toFixed(1) : "0.0"}%</div></div>
       <div class="kpi"><div class="kpi-label">Customer Count</div><div class="kpi-value">${rows.length}</div></div>
    </div>
  </section>`;

  const bodyRows = rows
     .map((row) => {
       const percent = totals.balance > 0 ? ((row.balance / totals.balance) * 100).toFixed(1) : "0.0";
       return `<tr>
         <td>${escapeHtml(row.customer)}</td>
         <td class="num">${layout.baseCurrency} ${fmtMoney(row.balance)}</td>
         <td class="num">${layout.baseCurrency} ${fmtMoney(row.overdue)}</td>
         <td class="num">${row.invoiceCount}</td>
         <td class="num">${percent}%</td>
      </tr>`
     })
    .join("");

  const footerRows = `<tr class="summary-row">
    <th>Total</th>
    <th class="num">${escapeHtml(layout.baseCurrency)} ${fmtMoney(totals.balance)}</th>
    <th class="num">${escapeHtml(layout.baseCurrency)} ${fmtMoney(totals.overdue)}</th>
     <th class="num">${totals.invoiceCount}</th>
     <th class="num">100.0%</th>
  </tr>`;

  return shell(
    "Receivables Report",
    `${fmtDate(startDate)} - ${fmtDate(endDate)}`,
    `${kpis}${sectionTable(
       "Customer Receivable Summary",
      [
        { label: "Customer" },
         { label: `Outstanding Balance (${layout.baseCurrency})`, numeric: true },
         { label: `Overdue Amount (${layout.baseCurrency})`, numeric: true },
         { label: "Invoice Count", numeric: true },
         { label: "% of Total", numeric: true },
      ],
      bodyRows,
      footerRows
    )}`,
    layout
  );
}

async function buildPayablesHtml(startDate: Date, endDate: Date, layout: LayoutSettings): Promise<string> {
  const orders = await prisma.purchaseOrder.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    include: { supplier: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  const pendingOrders = orders.filter((order) => {
    const total = Number(order.total || 0);
    const paid = Number(order.paidAmount || 0);
    return Math.max(total - paid, 0) > 0;
  });

  const totals = orders.reduce(
    (acc, order) => {
      const total = Number(order.total || 0);
      const paid = Number(order.paidAmount || 0);
      acc.total += total;
      acc.paid += paid;
      acc.balance += Math.max(total - paid, 0);
      return acc;
    },
    { total: 0, paid: 0, balance: 0 }
  );

  const kpis = `<section class="section">
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Total Purchase Value</div><div class="kpi-value">${fmtMoney(totals.total)}</div></div>
      <div class="kpi"><div class="kpi-label">Settled Amount</div><div class="kpi-value">${fmtMoney(totals.paid)}</div></div>
      <div class="kpi"><div class="kpi-label">Outstanding Liability</div><div class="kpi-value">${fmtMoney(totals.balance)}</div></div>
      <div class="kpi"><div class="kpi-label">Pending PO Count</div><div class="kpi-value">${pendingOrders.length}</div></div>
    </div>
  </section>`;

  const bodyRows = pendingOrders
    .map((order) => {
      const total = Number(order.total || 0);
      const paid = Number(order.paidAmount || 0);
      const outstanding = Math.max(total - paid, 0);
      const currency = String(order.currency || "MAD").toUpperCase();
      return `<tr>
        <td>${escapeHtml(order.reference)}</td>
        <td>${escapeHtml(order.supplier?.name || "-")}</td>
        <td>${fmtDate(order.date)}</td>
        <td class="num">${escapeHtml(currency)} ${fmtMoney(total)}</td>
        <td class="num">${escapeHtml(currency)} ${fmtMoney(paid)}</td>
        <td class="num">${escapeHtml(currency)} ${fmtMoney(outstanding)}</td>
      </tr>`;
    })
    .join("");

  const footerRows = `<tr class="summary-row">
    <th>Total</th>
    <th>-</th>
    <th>-</th>
    <th class="num">${fmtMoney(totals.total)}</th>
    <th class="num">${fmtMoney(totals.paid)}</th>
    <th class="num">${fmtMoney(totals.balance)}</th>
  </tr>`;

  return shell(
    "Payables Report",
    `${fmtDate(startDate)} - ${fmtDate(endDate)}`,
    `${kpis}${sectionTable(
       "Pending Payables Summary",
      [
        { label: "PO Reference" },
        { label: "Supplier" },
         { label: "Date" },
        { label: "Total (Document Currency)", numeric: true },
        { label: "Settled Amount", numeric: true },
        { label: "Outstanding Liability", numeric: true },
      ],
      bodyRows,
      footerRows
    )}`,
    layout
  );
}

async function buildInvoiceSummaryHtml(startDate: Date, endDate: Date, layout: LayoutSettings): Promise<string> {
  const data = await computeReportingData(prisma, { startDate, endDate });

  const statementItems = data.statement.filter((row) => row.balance > 0);
  const statementTotals = statementItems.reduce(
    (acc, row) => {
      acc.total += row.total;
      acc.paid += row.paid;
      acc.balance += row.balance;
      return acc;
    },
    { total: 0, paid: 0, balance: 0 }
  );

  const kpis = `<section class="section">
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Sales Revenue</div><div class="kpi-value">${fmtMoney(data.metrics.salesRevenue)}</div></div>
      <div class="kpi"><div class="kpi-label">Gross Profit</div><div class="kpi-value">${fmtMoney(data.metrics.grossProfit)}</div></div>
      <div class="kpi"><div class="kpi-label">Accounts Receivable</div><div class="kpi-value">${fmtMoney(data.metrics.receivables)}</div></div>
      <div class="kpi"><div class="kpi-label">Paid</div><div class="kpi-value">${fmtMoney(data.metrics.collected)}</div></div>
    </div>
  </section>`;

  const statementRows = statementItems
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.customerName)}</td>
        <td>${escapeHtml(row.reference)}</td>
        <td>${fmtDate(row.date)}</td>
        <td>${fmtDate(row.dueDate)}</td>
        <td class="num">${fmtMoney(row.total)}</td>
        <td class="num">${fmtMoney(row.paid)}</td>
        <td class="num">${fmtMoney(row.balance)}</td>
      </tr>`
    )
    .join("");

  const statementFooterRows = `<tr class="summary-row">
    <th colspan="4">Total Outstanding</th>
    <th class="num">${fmtMoney(statementTotals.total)}</th>
    <th class="num">${fmtMoney(statementTotals.paid)}</th>
    <th class="num">${fmtMoney(statementTotals.balance)}</th>
  </tr>`;

  const agingRows = data.customerAging
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.customerName)}</td>
        <td class="num">${fmtMoney(row.current)}</td>
        <td class="num">${fmtMoney(row.due30)}</td>
        <td class="num">${fmtMoney(row.due60)}</td>
        <td class="num">${fmtMoney(row.due90p)}</td>
        <td class="num">${fmtMoney(row.totalOutstanding)}</td>
      </tr>`
    )
    .join("");

  const trendRows = data.salesTrend
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.period)}</td>
        <td class="num">${fmtMoney(row.salesRevenue)}</td>
        <td class="num">${fmtMoney(row.thirdPartyRevenue)}</td>
        <td class="num">${fmtMoney(row.cogs)}</td>
        <td class="num">${fmtMoney(row.grossProfit)}</td>
      </tr>`
    )
    .join("");

  return shell(
    "Invoice Summary Report",
    `${fmtDate(startDate)} - ${fmtDate(endDate)}`,
    `${kpis}
    ${sectionTable(
      "Statement of Account",
      [
        { label: "Customer" },
        { label: "Invoice" },
        { label: "Invoice Date" },
        { label: "Due Date" },
        { label: "Total", numeric: true },
        { label: "Paid", numeric: true },
        { label: "Balance", numeric: true },
      ],
      statementRows,
      statementFooterRows
    )}
    ${sectionTable(
      "Aging by Customer",
      [
        { label: "Customer" },
        { label: "Current", numeric: true },
        { label: "1-30", numeric: true },
        { label: "31-60", numeric: true },
        { label: "60+", numeric: true },
        { label: "Outstanding", numeric: true },
      ],
      agingRows
    )}
    ${sectionTable(
      "Sales Trend",
      [
        { label: "Period" },
        { label: "Sales Revenue", numeric: true },
        { label: "Pass-Through Charges", numeric: true },
        { label: "COGS", numeric: true },
        { label: "Gross Profit", numeric: true },
      ],
      trendRows
    )}`,
    layout
  );
}

async function buildExpensesHtml(startDate: Date, endDate: Date, layout: LayoutSettings): Promise<string> {
  const [purchaseExpenses, deliveryExpenses] = await Promise.all([
    prisma.purchaseOrderExpense.findMany({
      where: { order: { date: { gte: startDate, lte: endDate } } },
      include: {
        order: { select: { reference: true, date: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.deliveryExpense.findMany({
      where: { delivery: { date: { gte: startDate, lte: endDate } } },
      include: {
        delivery: { select: { reference: true, date: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows = [
    ...purchaseExpenses.map((expense) => ({
      source: "Purchase Order",
      reference: expense.order.reference,
      date: expense.order.date,
      supplier: expense.supplier?.name || "-",
      description: expense.description,
      amount: Number(expense.total || expense.amount || 0),
    })),
    ...deliveryExpenses.map((expense) => ({
      source: "Delivery",
      reference: expense.delivery.reference,
      date: expense.delivery.date,
      supplier: expense.supplier?.name || "-",
      description: expense.description,
      amount: Number(expense.amount || 0),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  const kpis = `<section class="section">
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Expense Line Count</div><div class="kpi-value">${rows.length}</div></div>
      <div class="kpi"><div class="kpi-label">Total Operating Expenses</div><div class="kpi-value">${fmtMoney(total)}</div></div>
      <div class="kpi"><div class="kpi-label">Average Expense Line</div><div class="kpi-value">${fmtMoney(rows.length ? total / rows.length : 0)}</div></div>
      <div class="kpi"><div class="kpi-label">Reporting Period Start</div><div class="kpi-value">${escapeHtml(fmtDate(startDate))}</div></div>
    </div>
  </section>`;

  const bodyRows = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.source)}</td>
        <td>${escapeHtml(row.reference)}</td>
        <td>${fmtDate(row.date)}</td>
        <td>${escapeHtml(row.supplier)}</td>
        <td>${escapeHtml(row.description)}</td>
        <td class="num">${fmtMoney(row.amount)}</td>
      </tr>`
    )
    .join("");

  return shell(
    "Expenses Report",
    `${fmtDate(startDate)} - ${fmtDate(endDate)}`,
    `${kpis}${sectionTable(
      "Expense Register",
      [
        { label: "Source" },
        { label: "Reference" },
        { label: "Date" },
        { label: "Supplier" },
        { label: "Description" },
        { label: "Amount", numeric: true },
      ],
      bodyRows
    )}`,
    layout
  );
}

async function buildProfitabilityHtml(startDate: Date, endDate: Date, layout: LayoutSettings): Promise<string> {
  const invoices = await prisma.invoice.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    include: { items: { select: { lineTotal: true, cogsAmount: true, itemType: true } } },
    orderBy: { date: "asc" },
  });

  const grouped = new Map<string, { revenue: number; thirdPartyExpense: number; cogs: number; grossProfit: number; marginPct: number }>();

  for (const invoice of invoices) {
    const date = new Date(invoice.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const current = grouped.get(key) || { revenue: 0, thirdPartyExpense: 0, cogs: 0, grossProfit: 0, marginPct: 0 };
    const revenue = invoice.items.filter((line) => line.itemType !== "charge").reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
    const thirdPartyExpense = invoice.items.filter((line) => line.itemType === "charge").reduce((sum, line) => sum + Number(line.lineTotal || 0), 0);
    const cogs = invoice.items.reduce((sum, line) => sum + Number(line.cogsAmount || 0), 0);

    current.revenue += revenue;
    current.thirdPartyExpense += thirdPartyExpense;
    current.cogs += cogs;
    current.grossProfit = current.revenue - current.cogs;
    current.marginPct = current.revenue > 0 ? (current.grossProfit / current.revenue) * 100 : 0;
    grouped.set(key, current);
  }

  const rows = Array.from(grouped.entries())
    .map(([period, value]) => ({ period, ...value }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const bodyRows = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.period)}</td>
        <td class="num">${fmtMoney(row.revenue)}</td>
        <td class="num">${fmtMoney(row.thirdPartyExpense)}</td>
        <td class="num">${fmtMoney(row.cogs)}</td>
        <td class="num">${fmtMoney(row.grossProfit)}</td>
        <td class="num">${row.marginPct.toFixed(2)}%</td>
      </tr>`
    )
    .join("");

  return shell(
    "Profitability Report",
    `${fmtDate(startDate)} - ${fmtDate(endDate)}`,
    sectionTable(
      "Profitability by Month",
      [
        { label: "Period" },
        { label: "Revenue", numeric: true },
        { label: "Pass-Through Charges", numeric: true },
        { label: "COGS", numeric: true },
        { label: "Gross Profit", numeric: true },
        { label: "Gross Margin %", numeric: true },
      ],
      bodyRows
    ),
    layout
  );
}

async function buildCogsHtml(startDate: Date, endDate: Date, layout: LayoutSettings): Promise<string> {
  const usage = await prisma.invoiceBatchUsage.findMany({
    where: { invoice: { date: { gte: startDate, lte: endDate } } },
    include: {
      invoice: { select: { id: true, reference: true, date: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const byInvoice = new Map<number, { reference: string; date: Date; quantity: number; cogs: number }>();
  for (const row of usage) {
    const current = byInvoice.get(row.invoiceId) || {
      reference: row.invoice.reference,
      date: row.invoice.date,
      quantity: 0,
      cogs: 0,
    };
    current.quantity += Number(row.quantity || 0);
    current.cogs += Number(row.totalCost || 0);
    byInvoice.set(row.invoiceId, current);
  }

  const rows = Array.from(byInvoice.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  const totalCogs = rows.reduce((sum, row) => sum + row.cogs, 0);

  const kpis = `<section class="section">
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Invoice Count</div><div class="kpi-value">${rows.length}</div></div>
      <div class="kpi"><div class="kpi-label">Total Quantity</div><div class="kpi-value">${rows.reduce((sum, row) => sum + row.quantity, 0)}</div></div>
      <div class="kpi"><div class="kpi-label">Total Recognized COGS</div><div class="kpi-value">${fmtMoney(totalCogs)}</div></div>
      <div class="kpi"><div class="kpi-label">Average COGS per Invoice</div><div class="kpi-value">${fmtMoney(rows.length ? totalCogs / rows.length : 0)}</div></div>
    </div>
  </section>`;

  const bodyRows = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.reference)}</td>
        <td>${fmtDate(row.date)}</td>
        <td class="num">${row.quantity}</td>
        <td class="num">${fmtMoney(row.cogs)}</td>
      </tr>`
    )
    .join("");

  return shell(
    "Cost of Goods Sold Report",
    `${fmtDate(startDate)} - ${fmtDate(endDate)}`,
    `${kpis}${sectionTable(
      "COGS by Invoice",
      [
        { label: "Invoice" },
        { label: "Date" },
        { label: "Quantity", numeric: true },
        { label: "COGS", numeric: true },
      ],
      bodyRows
    )}`,
    layout
  );
}

export async function GET(req: NextRequest) {
  try {
    const now = new Date();
    const startDefault = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const endDefault = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const startDate = parseDate(req.nextUrl.searchParams.get("startDate"), startDefault);
    const endDate = parseDate(req.nextUrl.searchParams.get("endDate"), endDefault);
    const kindRaw = String(req.nextUrl.searchParams.get("kind") || "invoice-summary");

    const kind = (["receivables", "payables", "invoice-summary", "expenses", "profitability", "cogs"].includes(kindRaw)
      ? kindRaw
      : "invoice-summary") as ReportKind;

    const layout = await getLayoutSettings();

    const html =
      kind === "receivables"
        ? await buildReceivablesHtml(startDate, endDate, layout)
        : kind === "payables"
          ? await buildPayablesHtml(startDate, endDate, layout)
          : kind === "expenses"
            ? await buildExpensesHtml(startDate, endDate, layout)
            : kind === "profitability"
              ? await buildProfitabilityHtml(startDate, endDate, layout)
              : kind === "cogs"
                ? await buildCogsHtml(startDate, endDate, layout)
                : await buildInvoiceSummaryHtml(startDate, endDate, layout);

    const pdf = await htmlToPdfBuffer(html, {
      topPx: layout.headerSpacePx,
      bottomPx: layout.footerSpacePx,
      leftPx: 0,
      rightPx: 0,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="finance-${kind}-${startDate.toISOString().slice(0, 10)}-${endDate.toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate finance report PDF" }, { status: 500 });
  }
}
