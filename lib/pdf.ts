import puppeteer from "puppeteer";
import { promises as fsAsync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

let browserPromise: ReturnType<typeof puppeteer.launch> | null = null;

async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  // If Chromium exits, force a clean relaunch on next request.
  browser.on("disconnected", () => {
    browserPromise = null;
  });

  return browser;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeCssUrl(value: string): string {
  return value.replace(/['\\\n\r]/g, (char) => {
    if (char === "'") return "\\'";
    if (char === "\\") return "\\\\";
    return "";
  });
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function formatMoney(value: number, currency: string): string {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchBrowser();
  }

  const browser = await browserPromise;
  if (!browser.isConnected()) {
    browserPromise = launchBrowser();
    return browserPromise;
  }

  return browser;
}

export type PdfSettings = {
  companyName: string;
  companyEmail?: string | null;
  companyPhone?: string | null;
  address?: string | null;
  currency: string;
  pdfLetterheadUrl?: string | null;
  pdfSignatureUrl?: string | null;
  pdfStampUrl?: string | null;
  pdfHeaderSpacePx: number;
  pdfFooterSpacePx: number;
};

export type PdfLine = {
  description: string;
  quantity?: number | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
};

export type PdfDocumentModel = {
  title: string;
  titleFr?: string;
  currency?: string;
  reference: string;
  date: string | Date;
  status?: string;
  partyLabel?: string;
  partyLabelFr?: string;
  partyName?: string;
  subtitle?: string;
  subtitleFr?: string;
  notes?: string | null;
  notesFr?: string | null;
  lines: PdfLine[];
  subtotal?: number | null;
  vatAmount?: number | null;
  total?: number | null;
  paidAmount?: number | null;
};

export type PdfLanguage = "en" | "fr";

export type PdfRenderOptions = {
  language: PdfLanguage;
  footerEn?: string | null;
  footerFr?: string | null;
  showNotes?: boolean;
  showSignature?: boolean;
  showStamp?: boolean;
  backgroundUrl?: string | null;
};

export type UniversalPdfLayoutSettings = {
  backgroundUrl: string | null;
  headerSpacePx: number;
  footerSpacePx: number;
  baseCurrency: string;
};

function toRelativeAssetPath(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;
  return raw.replace(/^https?:\/\/[^/]+/, "") || null;
}

async function assetUrlToDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (String(url).startsWith("data:")) return url;
  const relativePath = String(url).replace(/^https?:\/\/[^/]+/, "");
  if (!relativePath.startsWith("/")) return url;

  try {
    const safeRelative = relativePath.replace(/^\/+/, "");
    const fsPath = path.join(process.cwd(), "public", safeRelative);
    const buffer = await fsAsync.readFile(fsPath);
    const ext = path.extname(fsPath).slice(1).toLowerCase();
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
    };
    const mime = mimeMap[ext] || "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return url;
  }
}

export async function getUniversalPdfLayoutSettings(): Promise<UniversalPdfLayoutSettings> {
  const company = await prisma.companySettings.findUnique({ where: { id: 1 } });
  // Match invoice print behavior: prefer the invoice template, then fallback to generic letterhead.
  const backgroundSource = company?.invoiceTemplateUrl || company?.pdfLetterheadUrl;
  const backgroundUrl = await assetUrlToDataUri(toRelativeAssetPath(backgroundSource));

  const headerSpacePx = Number(company?.pdfHeaderSpacePx ?? 140);
  const footerSpacePx = Number(company?.pdfFooterSpacePx ?? 56);

  return {
    backgroundUrl,
    headerSpacePx: Number.isFinite(headerSpacePx) ? Math.max(0, headerSpacePx) : 140,
    footerSpacePx: Number.isFinite(footerSpacePx) ? Math.max(0, footerSpacePx) : 56,
    baseCurrency: String(company?.currency || "MAD").toUpperCase(),
  };
}

export function buildDocumentHtml(settings: PdfSettings, model: PdfDocumentModel, options: PdfRenderOptions): string {
  const isFr = options.language === "fr";
  const t = (en: string, fr: string) => (isFr ? fr : en);
  const title = isFr ? model.titleFr || model.title : model.title;
  const partyLabel = isFr ? model.partyLabelFr || model.partyLabel : model.partyLabel;
  const subtitle = isFr ? model.subtitleFr || model.subtitle : model.subtitle;
  const notes = isFr ? model.notesFr || model.notes : model.notes;
  const footer = isFr ? options.footerFr || "Genere par ERP SGICR" : options.footerEn || "Generated by ERP SGICR";
  const docCurrency = String(model.currency || settings.currency || "MAD").toUpperCase();
  const status = String(model.status || "draft").toLowerCase();
  const statusLabel = model.status ? escapeHtml(String(model.status).toUpperCase()) : "";
  const statusColor =
    status.includes("paid") || status.includes("posted") || status.includes("approved") || status.includes("delivered")
      ? "#166534"
      : status.includes("pending") || status.includes("draft")
        ? "#92400e"
        : "#334155";
  const statusBg =
    status.includes("paid") || status.includes("posted") || status.includes("approved") || status.includes("delivered")
      ? "#dcfce7"
      : status.includes("pending") || status.includes("draft")
        ? "#fef3c7"
        : "#e2e8f0";

  const backgroundUrl = options.backgroundUrl || settings.pdfLetterheadUrl;
  // Letterhead covers the full physical page. Per-page header/footer safe
  // zones are reserved with repeating spacers in a page frame table.
  const bgCss = backgroundUrl
    ? `.letterhead-bg { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0; }
       .letterhead-bg img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: top center; display: block; }`
    : `.letterhead-bg { display: none; }`;
  const headerPx = Math.max(0, settings.pdfHeaderSpacePx);
  const footerPx = Math.max(0, settings.pdfFooterSpacePx);

  const rows = model.lines
    .map(
      (line) => `
        <tr>
          <td>${escapeHtml(line.description)}</td>
          <td class="num">${line.quantity ?? "-"}</td>
          <td class="num">${line.unitPrice !== null && line.unitPrice !== undefined ? formatMoney(line.unitPrice, docCurrency) : "-"}</td>
          <td class="num">${line.lineTotal !== null && line.lineTotal !== undefined ? formatMoney(line.lineTotal, docCurrency) : "-"}</td>
        </tr>
      `
    )
    .join("");

  const totals = [
    model.subtotal !== null && model.subtotal !== undefined
      ? `<div class="totals-row"><span>${t("Subtotal", "Sous-total")}</span><strong>${formatMoney(model.subtotal, docCurrency)}</strong></div>`
      : "",
    model.vatAmount !== null && model.vatAmount !== undefined
      ? `<div class="totals-row"><span>${t("VAT", "TVA")}</span><strong>${formatMoney(model.vatAmount, docCurrency)}</strong></div>`
      : "",
    model.total !== null && model.total !== undefined
      ? `<div class="totals-row total"><span>${t("Total", "Total")}</span><strong>${formatMoney(model.total, docCurrency)}</strong></div>`
      : "",
    model.paidAmount !== null && model.paidAmount !== undefined
      ? `<div class="totals-row paid"><span>${t("Paid", "Paye")}</span><strong>${formatMoney(model.paidAmount, docCurrency)}</strong></div>`
      : "",
  ].join("");

  // No system-generated header — the uploaded letterhead provides its own header/footer.

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)} ${escapeHtml(model.reference)}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    * { box-sizing: border-box; }
    html, body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      margin: 0;
      padding: 0;
    }
    body {
      color: #111827;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 11.5px;
      line-height: 1.5;
      background: #ffffff;
    }

    /* === LETTERHEAD BACKGROUND === */
    ${bgCss}

    /* === DOCUMENT CONTENT ===
       Per-page safe zones are handled by repeating table header/footer spacers. */
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
    .page-spacer-top { height: ${headerPx}px; }
    .page-spacer-bottom { height: ${footerPx}px; }
    .doc-body {
      padding: 0 48px;
    }

    /* Document title block */
    .doc-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 2px solid #111827;
    }
    .doc-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #111827;
      margin: 0 0 2px 0;
      text-transform: uppercase;
    }
    .doc-ref {
      font-size: 11px;
      color: #6b7280;
    }
    .doc-status {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      background: ${statusBg};
      color: ${statusColor};
      border: 1px solid ${statusColor}44;
      white-space: nowrap;
    }

    /* Meta info grid */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .meta-table td {
      padding: 6px 8px;
      font-size: 11px;
      border: 1px solid #e5e7eb;
      vertical-align: top;
    }
    .meta-table td.label {
      width: 22%;
      background: #f9fafb;
      font-weight: 600;
      color: #374151;
      white-space: nowrap;
    }
    .meta-table td.value {
      color: #111827;
    }

    /* Line items table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      page-break-inside: auto;
    }
    .items-table thead { display: table-header-group; }
    .items-table tr { break-inside: avoid; page-break-inside: avoid; }
    .items-table th {
      background: #111827;
      color: #ffffff;
      padding: 7px 8px;
      text-align: left;
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .items-table td {
      padding: 7px 8px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 11px;
      color: #1f2937;
      vertical-align: top;
    }
    .items-table tbody tr:nth-child(even) td {
      background: #f9fafb;
    }
    .items-table .num { text-align: right; }

    /* Totals block */
    .totals-block {
      margin-left: auto;
      width: 220px;
      margin-top: 4px;
      margin-bottom: 14px;
      border: 1px solid #e5e7eb;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 10px;
      font-size: 11px;
      border-bottom: 1px solid #e5e7eb;
      color: #374151;
    }
    .totals-row:last-child { border-bottom: none; }
    .totals-row.total {
      background: #111827;
      color: #ffffff;
      font-weight: 700;
      font-size: 12px;
    }
    .totals-row.paid {
      background: #f0fdf4;
      color: #166534;
      font-weight: 600;
    }

    /* Notes section */
    .notes-section {
      margin-top: 10px;
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
      border-left: 3px solid #111827;
      background: #f9fafb;
      font-size: 10.5px;
      color: #374151;
      white-space: pre-wrap;
    }
    .notes-section strong { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; }

    /* Signatures */
    .sig-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 20px;
      padding-top: 10px;
    }
    .sig-box {
      border-top: 1px solid #111827;
      padding-top: 6px;
      min-height: 60px;
    }
    .sig-box img {
      max-height: 50px;
      max-width: 140px;
      display: block;
      margin-bottom: 4px;
    }
    .sig-label {
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
    }
  </style>
</head>
<body>
  ${backgroundUrl ? `<div class="letterhead-bg"><img src="${backgroundUrl}" alt="" /></div>` : ""}

  <table class="page-frame" role="presentation" aria-hidden="true">
    <thead><tr><td><div class="page-spacer-top"></div></td></tr></thead>
    <tfoot><tr><td><div class="page-spacer-bottom"></div></td></tr></tfoot>
    <tbody><tr><td>
  <main class="doc-body">
    <div class="doc-title-row">
      <div>
        <h1 class="doc-title">${escapeHtml(title)}</h1>
        <div class="doc-ref">${escapeHtml(model.reference)} &mdash; ${escapeHtml(formatDate(model.date))}</div>
      </div>
      ${statusLabel ? `<div class="doc-status">${statusLabel}</div>` : ""}
    </div>

    <table class="meta-table">
      <tbody>
        ${partyLabel && model.partyName ? `<tr><td class="label">${escapeHtml(partyLabel)}</td><td class="value">${escapeHtml(model.partyName)}</td></tr>` : ""}
        ${subtitle ? `<tr><td class="label">${t("Details", "Details")}</td><td class="value">${escapeHtml(subtitle)}</td></tr>` : ""}
        <tr><td class="label">${t("Currency", "Devise")}</td><td class="value">${escapeHtml(docCurrency)}</td></tr>
      </tbody>
    </table>

    <table class="items-table">
      <thead>
        <tr>
          <th>${t("Description", "Description")}</th>
          <th class="num">${t("Qty", "Qte")}</th>
          <th class="num">${t("Unit Price", "Prix unitaire")} (${escapeHtml(docCurrency)})</th>
          <th class="num">${t("Line Total", "Total ligne")} (${escapeHtml(docCurrency)})</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="4" style="padding:10px;color:#6b7280;">${t("No line items.", "Aucune ligne.")}</td></tr>`}
      </tbody>
    </table>

    ${totals ? `<div class="totals-block">${totals}</div>` : ""}

    ${options.showNotes !== false && notes ? `<div class="notes-section"><strong>${t("Notes & Terms", "Notes et conditions")}:</strong><br/>${escapeHtml(notes)}</div>` : ""}

    <div class="sig-row">
      <div class="sig-box">
        ${options.showSignature !== false && settings.pdfSignatureUrl ? `<img src="${settings.pdfSignatureUrl}" alt="" />` : ""}
        <div class="sig-label">${t("Authorized Signature", "Signature autorisee")}</div>
      </div>
      <div class="sig-box" style="text-align:right;">
        ${options.showStamp !== false && settings.pdfStampUrl ? `<img src="${settings.pdfStampUrl}" alt="" style="margin-left:auto;" />` : ""}
        <div class="sig-label">${t("Company Stamp", "Cachet de l'entreprise")}</div>
      </div>
    </div>
  </main>
    </td></tr></tbody>
  </table>
</body>
</html>`;
}

export async function htmlToPdfBuffer(
  html: string,
  margins?: { topPx?: number; rightPx?: number; bottomPx?: number; leftPx?: number }
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");
    await page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.all(
        images.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              })
        )
      );
    });
    const bytes = await page.pdf({
      format: "A4",
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: true,
      // Footer template with page numbers above footer text (X/Y format)
      footerTemplate: `
        <div style="width: 100%; display: flex; flex-direction: column; align-items: center; font-size: 10px; color: #6b7280; height: 100%; padding: 0 8px; justify-content: flex-start;">
          <div style="text-align: center; padding: 4px 0; border-top: 1px solid #e5e7eb;">
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>
        </div>
      `,
      // Keep @page at margin:0 for full-bleed letterhead, and reserve per-page
      // content space here so page 2+ header/footer spacing is consistent.
      margin: {
        top: `${Math.max(0, margins?.topPx ?? 0)}px`,
        right: `${Math.max(0, margins?.rightPx ?? 0)}px`,
        bottom: `${Math.max(0, Math.max(40, margins?.bottomPx ?? 0))}px`,
        left: `${Math.max(0, margins?.leftPx ?? 0)}px`,
      },
    });
    return Buffer.from(bytes);
  } finally {
    await page.close();
  }
}
