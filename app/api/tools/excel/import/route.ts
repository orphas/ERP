import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function toBool(value: string, fallback = true): boolean {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return fallback;
  return !(v === "false" || v === "0" || v === "no");
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const entity = String(form.get("entity") || "").toLowerCase();
    const file = form.get("file");

    if (!entity || !(file instanceof File)) {
      return NextResponse.json({ error: "entity and csv file are required" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV contains no data rows" }, { status: 400 });
    }

    let imported = 0;
    const errors: string[] = [];

    if (entity === "products") {
      for (const row of rows) {
        try {
          const sku = String(row.sku || "").trim();
          const name = String(row.name || "").trim();
          const categoryName = String(row.category || "General").trim() || "General";
          const price = Number(row.price || 0);
          const cost = Number(row.cost || 0);
          const minStockThreshold = Number(row.minStockThreshold || 10);

          if (!sku || !name || price < 0) throw new Error("Missing sku/name or invalid price");

          const category = await prisma.category.upsert({
            where: { name: categoryName },
            update: {},
            create: { name: categoryName },
          });

          await prisma.product.upsert({
            where: { sku },
            update: {
              name,
              categoryId: category.id,
              price,
              cost: Number.isFinite(cost) ? cost : 0,
              minStockThreshold: Number.isFinite(minStockThreshold) ? Math.max(0, Math.floor(minStockThreshold)) : 10,
              isActive: toBool(row.isActive, true),
            },
            create: {
              sku,
              name,
              categoryId: category.id,
              price,
              cost: Number.isFinite(cost) ? cost : 0,
              minStockThreshold: Number.isFinite(minStockThreshold) ? Math.max(0, Math.floor(minStockThreshold)) : 10,
              isActive: toBool(row.isActive, true),
            },
          });
          imported++;
        } catch (e) {
          errors.push(`products:${row.sku || row.name || "row"} -> ${(e as Error).message}`);
        }
      }
    } else if (entity === "customers") {
      for (const row of rows) {
        try {
          const name = String(row.name || "").trim();
          if (!name) throw new Error("name is required");
          await prisma.customer.create({
            data: {
              name,
              email: row.email || null,
              phone: row.phone || null,
              address: row.address || null,
              pricingTier: row.pricingTier || "standard",
              defaultCreditTermDays: Number.isFinite(Number(row.defaultCreditTermDays)) ? Math.max(0, Math.floor(Number(row.defaultCreditTermDays))) : 30,
              isActive: toBool(row.isActive, true),
            },
          });
          imported++;
        } catch (e) {
          errors.push(`customers:${row.name || "row"} -> ${(e as Error).message}`);
        }
      }
    } else if (entity === "suppliers") {
      for (const row of rows) {
        try {
          const name = String(row.name || "").trim();
          if (!name) throw new Error("name is required");
          await prisma.supplier.create({
            data: {
              name,
              defaultCurrency: String(row.defaultCurrency || "MAD").trim().toUpperCase() || "MAD",
              email: row.email || null,
              phone: row.phone || null,
              address: row.address || null,
              ice: row.ice || null,
              ifCode: row.ifCode || null,
              rc: row.rc || null,
              isActive: toBool(row.isActive, true),
            },
          });
          imported++;
        } catch (e) {
          errors.push(`suppliers:${row.name || "row"} -> ${(e as Error).message}`);
        }
      }
    } else if (entity === "employees") {
      for (const row of rows) {
        try {
          const email = String(row.email || "").trim();
          const firstName = String(row.firstName || "").trim();
          const lastName = String(row.lastName || "").trim();
          const salary = Number(row.salary || 0);
          const hireDate = row.hireDate ? new Date(row.hireDate) : new Date();

          if (!email || !firstName || !lastName) throw new Error("firstName, lastName, email required");

          await prisma.employee.upsert({
            where: { email },
            update: {
              firstName,
              lastName,
              phone: row.phone || null,
              department: row.department || null,
              position: row.position || null,
              hireDate,
              salary: Number.isFinite(salary) ? salary : 0,
              isActive: toBool(row.isActive, true),
            },
            create: {
              firstName,
              lastName,
              email,
              phone: row.phone || null,
              department: row.department || null,
              position: row.position || null,
              hireDate,
              salary: Number.isFinite(salary) ? salary : 0,
              isActive: toBool(row.isActive, true),
            },
          });
          imported++;
        } catch (e) {
          errors.push(`employees:${row.email || "row"} -> ${(e as Error).message}`);
        }
      }
    } else if (entity === "accounts") {
      for (const row of rows) {
        try {
          const code = String(row.code || "").trim();
          const name = String(row.name || "").trim();
          const type = String(row.type || "").trim().toLowerCase();
          const balance = Number(row.balance || 0);
          if (!code || !name || !type) throw new Error("code, name, type required");

          await prisma.account.upsert({
            where: { code },
            update: {
              name,
              type,
              accountClass: row.accountClass || null,
              balance: Number.isFinite(balance) ? balance : 0,
              isActive: toBool(row.isActive, true),
            },
            create: {
              code,
              name,
              type,
              accountClass: row.accountClass || null,
              balance: Number.isFinite(balance) ? balance : 0,
              isActive: toBool(row.isActive, true),
            },
          });
          imported++;
        } catch (e) {
          errors.push(`accounts:${row.code || "row"} -> ${(e as Error).message}`);
        }
      }
    } else {
      return NextResponse.json({ error: "Unsupported entity for import" }, { status: 400 });
    }

    return NextResponse.json({ imported, errors, totalRows: rows.length });
  } catch {
    return NextResponse.json({ error: "Failed to import CSV" }, { status: 500 });
  }
}
