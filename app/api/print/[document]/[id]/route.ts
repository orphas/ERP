import { NextRequest, NextResponse } from "next/server";
import { promises as fsAsync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { buildDocumentHtml, htmlToPdfBuffer, PdfDocumentModel, PdfLine, PdfSettings, PdfLanguage } from "@/lib/pdf";
import { logOperation } from "@/lib/ops-log";

export const runtime = "nodejs";

/**
 * Convert a public-relative URL (/uploads/...) to a base64 data URI by reading
 * the file directly from disk. This ensures Puppeteer can always display the
 * image regardless of network availability.
 */
async function assetUrlToDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (String(url).startsWith("data:")) return url;
  // Strip origin if it crept in
  const relativePath = String(url).replace(/^https?:\/\/[^/]+/, "");
  if (!relativePath.startsWith("/")) return url;
  try {
    const fsPath = path.join(process.cwd(), "public", relativePath);
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
    return url; // fall back to URL if file not accessible
  }
}

type RouteParams = { document: string; id: string };

function parseId(raw: string): number | null {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

function toLines(items: Array<{ description?: string | null; product?: { name?: string | null; unit?: { code?: string | null; name?: string | null } | null } | null; quantity?: number | null; unitPrice?: unknown; lineTotal?: unknown }>): PdfLine[] {
  return items.map((item) => ({
    description:
      item.product?.name
        ? `${item.product.name}${item.product?.unit?.code ? ` (${item.product.unit.code})` : item.product?.unit?.name ? ` (${item.product.unit.name})` : ""}`
        : item.description || "Item",
    quantity: item.quantity ?? 0,
    unitPrice: num(item.unitPrice),
    lineTotal: num(item.lineTotal),
  }));
}

function toRelativeAssetPath(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;
  // Strip any origin prefix — keep just the /public-relative path
  return raw.replace(/^https?:\/\/[^/]+/, "") || null;
}

async function getSettings(): Promise<PdfSettings> {
  const settings =
    (await prisma.companySettings.findUnique({ where: { id: 1 } })) ||
    (await prisma.companySettings.create({
      data: {
        id: 1,
        companyName: "Sahara Global Industrial Chemicals & Resins (SGICR)",
        pdfHeaderSpacePx: 72,
        pdfFooterSpacePx: 56,
      },
    }));

  return {
    companyName: settings.companyName,
    companyEmail: settings.companyEmail,
    companyPhone: settings.companyPhone,
    address: settings.address,
    currency: settings.currency || "MAD",
    pdfLetterheadUrl: settings.pdfLetterheadUrl,
    pdfSignatureUrl: settings.pdfSignatureUrl,
    pdfStampUrl: settings.pdfStampUrl,
    pdfHeaderSpacePx: Number(settings.pdfHeaderSpacePx ?? 72),
    pdfFooterSpacePx: Number(settings.pdfFooterSpacePx ?? 56),
  };
}

function parseLanguage(req: NextRequest): PdfLanguage {
  const lang = req.nextUrl.searchParams.get("lang");
  return lang === "fr" ? "fr" : "en";
}

async function buildModel(documentType: string, id: number): Promise<PdfDocumentModel | null> {
  if (documentType === "quote") {
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { customer: true, items: { include: { product: { include: { unit: true } } } } },
    });
    if (!quote) return null;
    return {
      title: "Sales Quote",
      titleFr: "Devis client",
      reference: quote.reference,
      date: quote.date,
      status: quote.status,
      partyLabel: "Customer",
      partyLabelFr: "Client",
      partyName: quote.customer?.name || "-",
      subtitle: `Validity: ${quote.validityDays} days`,
      subtitleFr: `Validite: ${quote.validityDays} jours`,
      notes: quote.notes,
      lines: toLines(quote.items),
      subtotal: num(quote.subtotal),
      vatAmount: num(quote.vatAmount),
      total: num(quote.total),
    };
  }

  if (documentType === "order") {
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: { customer: true, items: { include: { product: { include: { unit: true } } } } },
    });
    if (!order) return null;
    return {
      title: "Sales Order",
      titleFr: "Bon de commande client",
      reference: order.reference,
      date: order.date,
      status: order.status,
      partyLabel: "Customer",
      partyLabelFr: "Client",
      partyName: order.customer?.name || "-",
      subtitle: `Credit Term: ${order.creditTermDays} days`,
      subtitleFr: `Delai de credit: ${order.creditTermDays} jours`,
      lines: toLines(order.items),
      subtotal: num(order.subtotal),
      vatAmount: num(order.vatAmount),
      total: num(order.total),
    };
  }

  if (documentType === "invoice") {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { customer: true, items: { include: { product: { include: { unit: true } } } } },
    });
    if (!invoice) return null;
    return {
      title: "Tax Invoice",
      titleFr: "Facture",
      reference: invoice.reference,
      date: invoice.date,
      status: invoice.status,
      partyLabel: "Customer",
      partyLabelFr: "Client",
      partyName: invoice.customer?.name || "-",
      subtitle: invoice.dueDate ? `Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}` : undefined,
      subtitleFr: invoice.dueDate ? `Date d'echeance: ${new Date(invoice.dueDate).toLocaleDateString()}` : undefined,
      lines: toLines(invoice.items),
      subtotal: num(invoice.subtotal),
      vatAmount: num(invoice.vatAmount),
      total: num(invoice.total),
      paidAmount: num(invoice.paidAmount),
    };
  }

  if (documentType === "delivery") {
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: { order: { include: { customer: true, items: { include: { product: { include: { unit: true } } } } } }, items: true },
    });
    if (!delivery) return null;

    const lines: PdfLine[] = delivery.items.map((line) => {
      const orderItem = delivery.order?.items.find((item) => item.id === line.orderId);
      const productLabel = orderItem?.product?.name || `Order Item #${line.orderId}`;
      const unitSuffix = orderItem?.product?.unit?.code ? ` (${orderItem.product.unit.code})` : orderItem?.product?.unit?.name ? ` (${orderItem.product.unit.name})` : "";
      return {
      description: `${productLabel}${unitSuffix}`,
      quantity: line.quantity,
      unitPrice: null,
      lineTotal: null,
      };
    });

    return {
      title: "Delivery Note",
      titleFr: "Bon de livraison",
      reference: delivery.reference,
      date: delivery.date,
      status: delivery.status,
      partyLabel: "Customer",
      partyLabelFr: "Client",
      partyName: delivery.order?.customer?.name || "-",
      subtitle: `Carrier: ${delivery.carrier || "-"} | Waybill: ${delivery.waybill || "-"}`,
      subtitleFr: `Transporteur: ${delivery.carrier || "-"} | Lettre de transport: ${delivery.waybill || "-"}`,
      lines,
      notes: delivery.order ? `Sales Order: ${delivery.order.reference}` : null,
      notesFr: delivery.order ? `Commande client: ${delivery.order.reference}` : null,
    };
  }

  if (documentType === "purchase-order") {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, items: { include: { product: { include: { unit: true } } } }, expenses: { include: { supplier: true } } },
    });
    if (!po) return null;
    const expenseLines: PdfLine[] = (po.expenses || []).map((expense) => ({
      description: `${expense.description} (${expense.supplier?.name || "Service Supplier"})`,
      quantity: 1,
      unitPrice: num(expense.amount),
      lineTotal: num(expense.total),
    }));
    return {
      title: "Purchase Order",
      titleFr: "Bon de commande fournisseur",
      reference: po.reference,
      date: po.date,
      status: po.status,
      partyLabel: "Supplier",
      partyLabelFr: "Fournisseur",
      partyName: po.supplier?.name || "-",
      subtitle:
        po.purchaseType === "import"
          ? `Type: Import | Origin: ${po.originCountry || "-"} | Incoterm: ${po.incoterm || "-"}`
          : "Type: Local Purchase",
      subtitleFr:
        po.purchaseType === "import"
          ? `Type: Import | Origine: ${po.originCountry || "-"} | Incoterm: ${po.incoterm || "-"}`
          : "Type: Achat local",
      lines: [...toLines(po.items), ...expenseLines],
      subtotal: num(po.subtotal),
      vatAmount: num(po.vatAmount) + num(po.expenseVatAmount),
      total: num(po.total),
      currency: po.currency || "MAD",
    };
  }

  if (documentType === "payroll") {
    const payroll = await prisma.payroll.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!payroll) return null;

    const lines: PdfLine[] = [
      { description: "Base Salary", quantity: 1, unitPrice: num(payroll.baseSalary), lineTotal: num(payroll.baseSalary) },
      { description: "Bonuses", quantity: 1, unitPrice: num(payroll.bonuses), lineTotal: num(payroll.bonuses) },
      { description: "Deductions", quantity: 1, unitPrice: -num(payroll.deductions), lineTotal: -num(payroll.deductions) },
    ];

    return {
      title: "Payroll Slip",
      titleFr: "Bulletin de paie",
      reference: payroll.reference || `PAY-${payroll.id}`,
      date: payroll.month,
      status: payroll.status,
      partyLabel: "Employee",
      partyLabelFr: "Employe",
      partyName: `${payroll.employee.firstName} ${payroll.employee.lastName}`,
      lines,
      total: num(payroll.netPay),
    };
  }

  if (documentType === "journal") {
    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: { include: { account: true } } },
    });
    if (!entry) return null;

    const lines: PdfLine[] = entry.lines.map((line) => ({
      description: `${line.account.code} - ${line.account.name} (${line.type})`,
      quantity: 1,
      unitPrice: num(line.amount),
      lineTotal: num(line.amount),
    }));

    const debit = entry.lines
      .filter((line) => line.type === "debit")
      .reduce((sum, line) => sum + num(line.amount), 0);

    return {
      title: "Journal Entry",
      titleFr: "Ecriture comptable",
      reference: entry.reference,
      date: entry.date,
      status: entry.isPosted ? "posted" : "draft",
      subtitle: `Type: ${entry.journalType}`,
      subtitleFr: `Type: ${entry.journalType}`,
      notes: entry.description,
      lines,
      total: debit,
    };
  }

  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<RouteParams> }) {
  try {
    const lang = parseLanguage(req);
    const { document, id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const model = await buildModel(document, id);
    if (!model) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const settingsRaw = await getSettings();
    const [letterheadDataUri, signatureDataUri, stampDataUri] = await Promise.all([
      assetUrlToDataUri(toRelativeAssetPath(settingsRaw.pdfLetterheadUrl)),
      assetUrlToDataUri(toRelativeAssetPath(settingsRaw.pdfSignatureUrl)),
      assetUrlToDataUri(toRelativeAssetPath(settingsRaw.pdfStampUrl)),
    ]);
    const settings: PdfSettings = {
      ...settingsRaw,
      pdfLetterheadUrl: letterheadDataUri,
      pdfSignatureUrl: signatureDataUri,
      pdfStampUrl: stampDataUri,
    };
    const company = await prisma.companySettings.findUnique({ where: { id: 1 } });
    const globalTermsEn = company?.printTermsEn ? String(company.printTermsEn) : "";
    const globalTermsFr = company?.printTermsFr ? String(company.printTermsFr) : "";

    const [qtDataUri, soDataUri, invDataUri, dlDataUri, poDataUri, prDataUri, jeDataUri] = await Promise.all([
      assetUrlToDataUri(toRelativeAssetPath(company?.quoteTemplateUrl)),
      assetUrlToDataUri(toRelativeAssetPath(company?.orderTemplateUrl)),
      assetUrlToDataUri(toRelativeAssetPath(company?.invoiceTemplateUrl)),
      assetUrlToDataUri(toRelativeAssetPath(company?.deliveryTemplateUrl)),
      assetUrlToDataUri(toRelativeAssetPath(company?.purchaseOrderTemplateUrl)),
      assetUrlToDataUri(toRelativeAssetPath(company?.payrollTemplateUrl)),
      assetUrlToDataUri(toRelativeAssetPath(company?.journalTemplateUrl)),
    ]);

    const templateMap: Record<string, string | null> = {
      quote: qtDataUri,
      order: soDataUri,
      invoice: invDataUri,
      delivery: dlDataUri,
      "purchase-order": poDataUri,
      payroll: prDataUri,
      journal: jeDataUri,
    };

    const html = buildDocumentHtml(settings, {
      ...model,
      notes: model.notes ? [model.notes, globalTermsEn].filter(Boolean).join("\n\n") : globalTermsEn || null,
      notesFr: model.notesFr ? [model.notesFr, globalTermsFr].filter(Boolean).join("\n\n") : globalTermsFr || null,
    }, {
      language: lang,
      footerEn: company?.printFooterEn,
      footerFr: company?.printFooterFr,
      showSignature: company?.showSignatureOnPrint ?? true,
      showStamp: company?.showStampOnPrint ?? true,
      showNotes: true,
      backgroundUrl: templateMap[document] || settings.pdfLetterheadUrl,
    });
    const buffer = await htmlToPdfBuffer(html, {
      topPx: settings.pdfHeaderSpacePx,
      bottomPx: settings.pdfFooterSpacePx,
    });

    await logOperation({
      action: "PDF_PRINTED",
      entityType: document,
      entityId: id,
      details: `Generated PDF for ${document} ${model.reference}`,
    });

    const filename = `${document}-${lang}-${model.reference}.pdf`.replace(/\s+/g, "-").toLowerCase();

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate document PDF" }, { status: 500 });
  }
}
