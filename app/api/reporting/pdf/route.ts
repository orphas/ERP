import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeReportingData } from "@/lib/reporting";
import { getUniversalPdfLayoutSettings, htmlToPdfBuffer } from "@/lib/pdf";

export const runtime = "nodejs";

type ReportKind = "executive" | "statement" | "aging" | "sales" | "profitability";
type ReportLanguage = "en" | "fr";

type LayoutSettings = {
  backgroundUrl: string | null;
  headerSpacePx: number;
  footerSpacePx: number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtMoney(value: number, locale: string): string {
  return value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseDate(raw: string | null, fallback: Date): Date {
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

async function getLayoutSettings(): Promise<LayoutSettings> {
  const pdfLayout = await getUniversalPdfLayoutSettings();

  return {
    backgroundUrl: pdfLayout.backgroundUrl,
    headerSpacePx: pdfLayout.headerSpacePx,
    footerSpacePx: pdfLayout.footerSpacePx,
  };
}

function buildHtml(
  kind: ReportKind,
  startDate: Date,
  endDate: Date,
  data: Awaited<ReturnType<typeof computeReportingData>>,
  layout: LayoutSettings,
  lang: ReportLanguage
): string {
  const locale = lang === "fr" ? "fr-MA" : "en-GB";
  const t = (en: string, fr: string) => (lang === "fr" ? fr : en);
  const periodLabel = `${startDate.toLocaleDateString(locale)} - ${endDate.toLocaleDateString(locale)}`;

  const heading =
    kind === "statement"
      ? t("Statement of Account", "Releve de compte")
      : kind === "aging"
        ? t("Aging Summary", "Resume d'anciennete")
        : kind === "sales"
          ? t("Sales Performance", "Performance commerciale")
          : kind === "profitability"
            ? t("Profitability Report", "Rapport de rentabilite")
            : t("Executive Report", "Rapport executif");

  const metricRows = [
    [t("Sales Revenue", "Chiffre d'affaires"), fmtMoney(data.metrics.salesRevenue, locale)],
    [t("Pass-Through Charges", "Charges refacturables"), fmtMoney(data.metrics.thirdPartyRevenue, locale)],
    [t("Cost of Goods Sold", "Cout des marchandises vendues"), fmtMoney(data.metrics.cogs, locale)],
    [t("Gross Profit", "Marge brute"), fmtMoney(data.metrics.grossProfit, locale)],
    ["Gross Margin %", `${data.metrics.grossMarginPct.toFixed(2)}%`],
    [t("Accounts Receivable", "Comptes clients"), fmtMoney(data.metrics.receivables, locale)],
    [t("Paid", "Paye"), fmtMoney(data.metrics.collected, locale)],
  ];

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

  const statementRows = statementItems
    .map(
      (row) => {
        const dueDate = row.dueDate ? new Date(row.dueDate) : null;
        const isOverdue = !!dueDate && dueDate.getTime() < Date.now() && row.balance > 0;
        return `
      <tr>
        <td>${escapeHtml(row.customerName)}</td>
        <td>${escapeHtml(row.reference)}</td>
        <td>${new Date(row.date).toLocaleDateString(locale)}</td>
        <td>${row.dueDate ? new Date(row.dueDate).toLocaleDateString(locale) : "-"}</td>
        <td class="num">${fmtMoney(row.total, locale)}</td>
        <td class="num">${fmtMoney(row.paid, locale)}</td>
        <td class="num ${isOverdue ? "balance-overdue" : "balance-open"}">${fmtMoney(row.balance, locale)}</td>
      </tr>
    `;
      }
    )
    .join("");

  const statementTotalsRow = `
    <tr>
      <th colspan="4">${t("Total Outstanding", "Total du solde")}</th>
      <th class="num">${fmtMoney(statementTotals.total, locale)}</th>
      <th class="num">${fmtMoney(statementTotals.paid, locale)}</th>
      <th class="num">${fmtMoney(statementTotals.balance, locale)}</th>
    </tr>
  `;

  const agingRows = data.customerAging
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.customerName)}</td>
        <td class="num">${fmtMoney(row.current, locale)}</td>
        <td class="num">${fmtMoney(row.due30, locale)}</td>
        <td class="num">${fmtMoney(row.due60, locale)}</td>
        <td class="num">${fmtMoney(row.due90p, locale)}</td>
        <td class="num"><strong>${fmtMoney(row.totalOutstanding, locale)}</strong></td>
      </tr>
    `
    )
    .join("");

  const agingTotals = data.customerAging.reduce(
    (acc, row) => {
      acc.current += row.current;
      acc.due30 += row.due30;
      acc.due60 += row.due60;
      acc.due90p += row.due90p;
      acc.totalOutstanding += row.totalOutstanding;
      return acc;
    },
    { current: 0, due30: 0, due60: 0, due90p: 0, totalOutstanding: 0 }
  );

  const trendRows = data.salesTrend
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.period)}</td>
        <td class="num">${fmtMoney(row.salesRevenue, locale)}</td>
        <td class="num">${fmtMoney(row.thirdPartyRevenue, locale)}</td>
        <td class="num">${fmtMoney(row.cogs, locale)}</td>
        <td class="num">${fmtMoney(row.grossProfit, locale)}</td>
      </tr>
    `
    )
    .join("");

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
    body { font-family: Segoe UI, Arial, sans-serif; font-size: 11px; color: #111827; }
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
      padding: 0 32px;
    }
    h1 { margin: 0 0 6px 0; font-size: 20px; }
    .meta { margin-bottom: 14px; color: #4b5563; }
    .report-chip {
      display: inline-block;
      margin-bottom: 8px;
      padding: 3px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      font-size: 10px;
      color: #334155;
      background: #f8fafc;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-weight: 700;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; page-break-inside: auto; }
    .doc-body table { background: #ffffff; }
    thead { display: table-header-group; }
    tfoot { display: table-row-group; }
    tr, td, th { break-inside: avoid; page-break-inside: avoid; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; }
    th { background: #0f172a; color: #fff; text-align: left; }
    .num { text-align: right; }
    .section-title { margin: 16px 0 8px 0; font-size: 13px; font-weight: 700; }
    .section-card {
      border: 1px solid #d1d5db;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 14px;
      background: #ffffff;
    }
    .section-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid #e5e7eb;
      background: #f8fafc;
    }
    .section-card-title { margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; }
    .section-card-meta { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; }
    .status-pill {
      display: inline-block;
      min-width: 54px;
      text-align: center;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid transparent;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .status-pill.sent { color: #1d4ed8; background: #dbeafe; border-color: #93c5fd; }
    .status-pill.ok { color: #166534; background: #dcfce7; border-color: #86efac; }
    .status-pill.warn { color: #b45309; background: #fef3c7; border-color: #fcd34d; }
    .status-pill.draft { color: #475569; background: #e2e8f0; border-color: #cbd5e1; }
    .balance-open { color: #0f172a; font-weight: 700; }
    .balance-overdue { color: #b91c1c; font-weight: 800; }
    .aging-strip {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin: 0 0 10px 0;
    }
    .aging-box {
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 8px;
      background: #ffffff;
    }
    .aging-box .label { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
    .aging-box .value { font-size: 12px; font-weight: 800; color: #0f172a; }
  </style>
</head>
<body>
  <div class="letterhead-bg">${layout.backgroundUrl ? `<img src="${layout.backgroundUrl}" alt="" />` : ""}</div>
  <table class="page-frame" role="presentation" aria-hidden="true">
    <thead><tr><td><div class="page-spacer-top"></div></td></tr></thead>
    <tfoot><tr><td><div class="page-spacer-bottom"></div></td></tr></tfoot>
    <tbody><tr><td>
  <main class="doc-body">
    <h1>${escapeHtml(heading)}</h1>
    <div class="meta">${t("Period", "Periode")}: ${escapeHtml(periodLabel)}</div>

    ${(kind === "executive" || kind === "profitability") ? `
    <div class="section-title">${t("Financial Snapshot", "Synthese financiere")}</div>
    <table>
      <thead><tr><th>${t("Metric", "Indicateur")}</th><th class="num">${t("Value", "Valeur")}</th></tr></thead>
      <tbody>
        ${metricRows.map((row) => `<tr><td>${escapeHtml(row[0])}</td><td class="num">${escapeHtml(row[1])}</td></tr>`).join("")}
      </tbody>
    </table>` : ""}

    ${(kind === "statement" || kind === "executive") ? `
    <span class="report-chip">${t("Client Receivables", "Creances clients")}</span>
    <div class="section-card">
      <div class="section-card-head">
        <h2 class="section-card-title">${t("Statement of Account", "Releve de compte")}</h2>
      </div>
      <table>
        <thead><tr><th>${t("Customer", "Client")}</th><th>${t("Invoice", "Facture")}</th><th>${t("Invoice Date", "Date de facture")}</th><th>${t("Due Date", "Date d'echeance")}</th><th class="num">${t("Total", "Total")}</th><th class="num">${t("Paid", "Paye")}</th><th class="num">${t("Balance", "Solde")}</th></tr></thead>
        <tbody>${statementRows ? `${statementRows}${statementTotalsRow}` : `<tr><td colspan="7">${t("No data", "Aucune donnee")}</td></tr>`}</tbody>
      </table>
    </div>` : ""}

    ${(kind === "aging" || kind === "executive") ? `
    <span class="report-chip">${t("Credit Risk Distribution", "Repartition du risque credit")}</span>
    <div class="aging-strip">
      <div class="aging-box"><div class="label">${t("Current", "Courant")}</div><div class="value">${fmtMoney(agingTotals.current, locale)}</div></div>
      <div class="aging-box"><div class="label">${t("1-30 Days", "1-30 Jours")}</div><div class="value">${fmtMoney(agingTotals.due30, locale)}</div></div>
      <div class="aging-box"><div class="label">${t("31-60 Days", "31-60 Jours")}</div><div class="value">${fmtMoney(agingTotals.due60, locale)}</div></div>
      <div class="aging-box"><div class="label">${t("60+ Days", "60+ Jours")}</div><div class="value">${fmtMoney(agingTotals.due90p, locale)}</div></div>
      <div class="aging-box"><div class="label">${t("Total Outstanding", "Total du solde")}</div><div class="value">${fmtMoney(agingTotals.totalOutstanding, locale)}</div></div>
    </div>
    <div class="section-card">
      <div class="section-card-head">
        <h2 class="section-card-title">${t("Aging by Customer", "Anciennete par client")}</h2>
        <div class="section-card-meta">${t("Bucketed by due age", "Repartition par anciennete")}</div>
      </div>
      <table>
        <thead><tr><th>${t("Customer", "Client")}</th><th class="num">${t("Current", "Courant")}</th><th class="num">1-30</th><th class="num">31-60</th><th class="num">60+</th><th class="num">${t("Outstanding", "Solde")}</th></tr></thead>
        <tbody>${agingRows || `<tr><td colspan="6">${t("No data", "Aucune donnee")}</td></tr>`}</tbody>
      </table>
    </div>` : ""}

    ${(kind === "sales" || kind === "profitability" || kind === "executive") ? `
    <div class="section-title">${t("Sales Trend", "Tendance des ventes")}</div>
    <table>
      <thead><tr><th>${t("Period", "Periode")}</th><th class="num">${t("Sales Revenue", "Chiffre d'affaires")}</th><th class="num">${t("Pass-Through Charges", "Charges refacturables")}</th><th class="num">COGS</th><th class="num">${t("Gross Profit", "Marge brute")}</th></tr></thead>
      <tbody>${trendRows || `<tr><td colspan="5">${t("No data", "Aucune donnee")}</td></tr>`}</tbody>
    </table>` : ""}
  </main>
    </td></tr></tbody>
  </table>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  try {
    const now = new Date();
    const startDefault = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const endDefault = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const startDate = parseDate(req.nextUrl.searchParams.get("startDate"), startDefault);
    const endDate = parseDate(req.nextUrl.searchParams.get("endDate"), endDefault);
    const kindRaw = String(req.nextUrl.searchParams.get("kind") || "executive");
    const langRaw = String(req.nextUrl.searchParams.get("lang") || "en").toLowerCase();
    const lang = (langRaw === "fr" ? "fr" : "en") as ReportLanguage;
    const kind = (["executive", "statement", "aging", "sales", "profitability"].includes(kindRaw)
      ? kindRaw
      : "executive") as ReportKind;

    const customerIdRaw = req.nextUrl.searchParams.get("customerId");
    const customerId = customerIdRaw ? Number(customerIdRaw) : null;

    const data = await computeReportingData(prisma, {
      startDate,
      endDate,
      customerId: Number.isFinite(customerId || NaN) ? customerId : null,
    });

    const layout = await getLayoutSettings();
    const html = buildHtml(kind, startDate, endDate, data, layout, lang);
    const buffer = await htmlToPdfBuffer(html, {
      topPx: layout.headerSpacePx,
      bottomPx: layout.footerSpacePx,
      leftPx: 0,
      rightPx: 0,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="report-${kind}-${lang}-${startDate.toISOString().slice(0, 10)}-${endDate.toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate report PDF" }, { status: 500 });
  }
}
