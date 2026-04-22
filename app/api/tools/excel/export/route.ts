import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/\"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  try {
    const entity = (req.nextUrl.searchParams.get("entity") || "").toLowerCase();

    let filename = "export.csv";
    let rows: Array<Record<string, unknown>> = [];

    if (entity === "products") {
      const products = await prisma.product.findMany({ include: { category: true }, orderBy: { id: "asc" } });
      rows = products.map((p) => ({
        sku: p.sku,
        name: p.name,
        category: p.category?.name || "",
        price: String(p.price),
        cost: String(p.cost),
        minStockThreshold: p.minStockThreshold,
        isActive: p.isActive,
      }));
      filename = "products.csv";
    } else if (entity === "customers") {
      const customers = await prisma.customer.findMany({ orderBy: { id: "asc" } });
      rows = customers.map((c) => ({
        name: c.name,
        email: c.email || "",
        phone: c.phone || "",
        address: c.address || "",
        pricingTier: c.pricingTier,
        defaultCreditTermDays: c.defaultCreditTermDays,
        isActive: c.isActive,
      }));
      filename = "customers.csv";
    } else if (entity === "suppliers") {
      const suppliers = await prisma.supplier.findMany({ orderBy: { id: "asc" } });
      rows = suppliers.map((s) => ({
        name: s.name,
        defaultCurrency: s.defaultCurrency,
        email: s.email || "",
        phone: s.phone || "",
        address: s.address || "",
        ice: s.ice || "",
        ifCode: s.ifCode || "",
        rc: s.rc || "",
        isActive: s.isActive,
      }));
      filename = "suppliers.csv";
    } else if (entity === "employees") {
      const employees = await prisma.employee.findMany({ orderBy: { id: "asc" } });
      rows = employees.map((e) => ({
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone || "",
        department: e.department || "",
        position: e.position || "",
        hireDate: new Date(e.hireDate).toISOString().slice(0, 10),
        salary: String(e.salary),
        isActive: e.isActive,
      }));
      filename = "employees.csv";
    } else if (entity === "accounts") {
      const accounts = await prisma.account.findMany({ orderBy: { code: "asc" } });
      rows = accounts.map((a) => ({
        code: a.code,
        name: a.name,
        type: a.type,
        accountClass: a.accountClass || "",
        balance: String(a.balance),
        isActive: a.isActive,
      }));
      filename = "accounts.csv";
    } else {
      return NextResponse.json({ error: "Unsupported entity for export" }, { status: 400 });
    }

    const csv = rowsToCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
