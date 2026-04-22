import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/ops-log";

export const runtime = "nodejs";

const allowedAssets = new Set([
  "letterhead",
  "signature",
  "stamp",
  "template_quote",
  "template_order",
  "template_invoice",
  "template_delivery",
  "template_purchase_order",
  "template_payroll",
  "template_journal",
]);
const allowedExt = new Set(["png", "jpg", "jpeg", "webp"]);

function mapAssetToField(asset: string):
  | "pdfLetterheadUrl"
  | "pdfSignatureUrl"
  | "pdfStampUrl"
  | "quoteTemplateUrl"
  | "orderTemplateUrl"
  | "invoiceTemplateUrl"
  | "deliveryTemplateUrl"
  | "purchaseOrderTemplateUrl"
  | "payrollTemplateUrl"
  | "journalTemplateUrl" {
  if (asset === "signature") return "pdfSignatureUrl";
  if (asset === "stamp") return "pdfStampUrl";
  if (asset === "template_quote") return "quoteTemplateUrl";
  if (asset === "template_order") return "orderTemplateUrl";
  if (asset === "template_invoice") return "invoiceTemplateUrl";
  if (asset === "template_delivery") return "deliveryTemplateUrl";
  if (asset === "template_purchase_order") return "purchaseOrderTemplateUrl";
  if (asset === "template_payroll") return "payrollTemplateUrl";
  if (asset === "template_journal") return "journalTemplateUrl";
  return "pdfLetterheadUrl";
}

export async function POST(req: NextRequest) {
  try {
    const asset = String(req.nextUrl.searchParams.get("asset") || "").toLowerCase();
    if (!allowedAssets.has(asset)) {
      return NextResponse.json({ error: "Invalid asset type" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedExt.has(ext)) {
      return NextResponse.json({ error: "Unsupported file type. Use PNG, JPG, JPEG, or WEBP." }, { status: 400 });
    }

    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "File too large. Maximum size is 8MB." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const safeBase = `${asset}-${timestamp}`;
    const filename = `${safeBase}.${ext}`;

    const relativeDir = path.join("uploads", "company-branding");
    const outputDir = path.join(process.cwd(), "public", relativeDir);
    await fs.mkdir(outputDir, { recursive: true });

    const fullPath = path.join(outputDir, filename);
    await fs.writeFile(fullPath, bytes);

    const publicUrl = `/${relativeDir.replace(/\\/g, "/")}/${filename}`;
    const field = mapAssetToField(asset);

    const settings = await prisma.companySettings.upsert({
      where: { id: 1 },
      update: {
        [field]: publicUrl,
      },
      create: {
        id: 1,
        companyName: "Sahara Global Industrial Chemicals & Resins (SGICR)",
        [field]: publicUrl,
      },
    });

    await logOperation({
      action: "SETTINGS_ASSET_UPLOADED",
      entityType: "CompanySettings",
      entityId: settings.id,
      details: `${asset} image uploaded`,
    });

    return NextResponse.json({ url: publicUrl, field });
  } catch {
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
