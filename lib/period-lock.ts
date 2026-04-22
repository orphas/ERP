import { PrismaClient } from "@prisma/client";

type ModuleName = "finance" | "inventory" | "hr" | "sales" | "procurement";

type MinimalClient = Pick<PrismaClient, "periodClose">;

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function isModuleClosed(
  client: MinimalClient,
  moduleName: ModuleName,
  forDate: Date
): Promise<boolean> {
  const row = await client.periodClose.findUnique({
    where: { month: monthStart(forDate) },
  });

  if (!row) return false;
  if (moduleName === "finance") return row.financeClosed;
  if (moduleName === "inventory") return row.inventoryClosed;
  if (moduleName === "hr") return row.hrClosed;
  if (moduleName === "sales") return row.salesClosed;
  return row.procurementClosed;
}

export function monthFromISO(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return monthStart(new Date());
  }
  return monthStart(d);
}
