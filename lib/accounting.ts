import { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

type AccountDef = {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  accountClass: string;
  description?: string;
};

type LedgerLine = {
  accountId: number;
  accountType: string;
  type: "debit" | "credit";
  amount: number;
};

const debitIncreaseTypes = ["asset", "expense"];
const creditIncreaseTypes = ["liability", "equity", "income"];

const accountDefinitions: Record<string, AccountDef> = {
  capital: { code: "1110", name: "Share Capital", type: "equity", accountClass: "1" },
  pettyCash: { code: "3110", name: "Petty Cash", type: "asset", accountClass: "3" },
  bankMad: { code: "3141", name: "Bank - MAD", type: "asset", accountClass: "3" },
  inventory: { code: "3200", name: "Inventory", type: "asset", accountClass: "3" },
  receivable: { code: "3410", name: "Accounts Receivable - Customers", type: "asset", accountClass: "3" },
  vatRecoverablePurchases: { code: "3455", name: "VAT Recoverable on Purchases", type: "asset", accountClass: "3" },
  vatRecoverableImports: { code: "3456", name: "VAT Recoverable on Imports", type: "asset", accountClass: "3" },
  payableSuppliers: { code: "4410", name: "Accounts Payable - Suppliers", type: "liability", accountClass: "4" },
  vatOutput: { code: "4455", name: "VAT Collected on Sales", type: "liability", accountClass: "4" },
  importVatClearing: { code: "4456", name: "Import VAT Clearing", type: "liability", accountClass: "4" },
  freightInAccrual: { code: "4480", name: "Freight and Import Charges Accrual", type: "liability", accountClass: "4" },
  cogs: { code: "6110", name: "Cost of Goods Sold", type: "expense", accountClass: "6" },
  salesRevenue: { code: "7110", name: "Sales Revenue", type: "income", accountClass: "7" },
  thirdPartyRebillingRevenue: { code: "7120", name: "Third-Party Charge Rebilling Revenue", type: "income", accountClass: "7" },
  fxGain: { code: "7550", name: "Foreign Exchange Gain", type: "income", accountClass: "7" },
  fxLoss: { code: "6550", name: "Foreign Exchange Loss", type: "expense", accountClass: "6" },
};

async function ensureOneAccount(tx: TxClient, def: AccountDef) {
  const existing = await tx.account.findUnique({ where: { code: def.code } });
  if (existing) return existing;
  return tx.account.create({
    data: {
      code: def.code,
      name: def.name,
      type: def.type,
      accountClass: def.accountClass,
      description: def.description,
      isActive: true,
    },
  });
}

export async function ensureCoreAccounts(tx: TxClient) {
  const keys = Object.keys(accountDefinitions) as Array<keyof typeof accountDefinitions>;
  const entries = await Promise.all(
    keys.map(async (key) => [key, await ensureOneAccount(tx, accountDefinitions[key])] as const)
  );
  return Object.fromEntries(entries) as Record<keyof typeof accountDefinitions, Awaited<ReturnType<typeof ensureOneAccount>>>;
}

export function ledgerDelta(accountType: string, lineType: "debit" | "credit", amount: number) {
  const normalizedType = accountType.toLowerCase();
  if (lineType === "debit") {
    return debitIncreaseTypes.includes(normalizedType) ? amount : -amount;
  }
  return creditIncreaseTypes.includes(normalizedType) ? amount : -amount;
}

export async function applyAccountBalanceDeltas(tx: TxClient, lines: LedgerLine[]) {
  const totalsByAccount = new Map<number, { accountType: string; delta: number }>();
  for (const line of lines) {
    if (!Number.isFinite(line.amount) || line.amount <= 0) continue;
    const delta = ledgerDelta(line.accountType, line.type, line.amount);
    const current = totalsByAccount.get(line.accountId);
    if (current) {
      current.delta += delta;
    } else {
      totalsByAccount.set(line.accountId, { accountType: line.accountType, delta });
    }
  }

  for (const [accountId, payload] of totalsByAccount.entries()) {
    const account = await tx.account.findUnique({ where: { id: accountId }, select: { balance: true } });
    if (!account) continue;
    await tx.account.update({
      where: { id: accountId },
      data: { balance: Number(account.balance) + payload.delta },
    });
  }
}
