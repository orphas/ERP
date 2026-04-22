export type DoubleEntryLine = {
  type: "debit" | "credit";
  amount: number;
};

export function assertBalancedLines(lines: DoubleEntryLine[]): void {
  const debit = lines
    .filter((line) => line.type === "debit")
    .reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const credit = lines
    .filter((line) => line.type === "credit")
    .reduce((sum, line) => sum + Number(line.amount || 0), 0);

  if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
    throw new Error("Invalid debit/credit amounts");
  }

  if (Math.abs(debit - credit) > 0.000001) {
    throw new Error("Double-entry check failed: debits must equal credits");
  }
}
