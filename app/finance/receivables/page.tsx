"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  customerId: number;
  customerName: string;
  invoiceCount: number;
  invoiced: number;
  paid: number;
  balance: number;
  overdue: number;
};

export default function ReceivablesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("MAD");

  useEffect(() => {
    fetch("/api/finance/customers/summary")
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  }, []);

  useEffect(() => {
    fetch("/api/settings/company")
      .then((r) => r.json())
      .then((data) => setBaseCurrency(String(data?.currency || "MAD").toUpperCase()))
      .catch(() => setBaseCurrency("MAD"));
  }, []);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.invoiced += Number(row.invoiced || 0);
        acc.paid += Number(row.paid || 0);
        acc.balance += Number(row.balance || 0);
        acc.overdue += Number(row.overdue || 0);
        return acc;
      },
      { invoiced: 0, paid: 0, balance: 0, overdue: 0 }
    );
  }, [rows]);

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Receivables</h1>
          <p className="page-subtitle">Customer exposure, overdue amounts, and collection status. Amounts are shown in {baseCurrency}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/finance/reports/pdf?kind=receivables" target="_blank" rel="noreferrer" className="btn-secondary">
            Print Receivables Report
          </a>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="card-sm"><div className="stat-label">Gross Billed Amount</div><div className="stat-value text-cyan-300">{totals.invoiced.toFixed(2)}</div></div>
        <div className="card-sm"><div className="stat-label">Paid</div><div className="stat-value text-emerald-300">{totals.paid.toFixed(2)}</div></div>
        <div className="card-sm"><div className="stat-label">Outstanding Receivable Balance</div><div className="stat-value text-amber-300">{totals.balance.toFixed(2)}</div></div>
        <div className="card-sm"><div className="stat-label">Past Due Receivables</div><div className="stat-value text-rose-300">{totals.overdue.toFixed(2)}</div></div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Customer Receivable Ledger</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Invoices</th>
                <th>Gross Billed Amount</th>
                <th>Paid</th>
                <th>Outstanding Receivable Balance</th>
                <th>Past Due Receivables</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.customerId}>
                  <td className="font-medium">{row.customerName}</td>
                  <td>{row.invoiceCount}</td>
                  <td>{baseCurrency} {Number(row.invoiced || 0).toFixed(2)}</td>
                  <td>{baseCurrency} {Number(row.paid || 0).toFixed(2)}</td>
                  <td className="text-amber-300 font-semibold">{baseCurrency} {Number(row.balance || 0).toFixed(2)}</td>
                  <td className={Number(row.overdue || 0) > 0 ? "text-rose-300 font-semibold" : "text-slate-400"}>{baseCurrency} {Number(row.overdue || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th>{rows.reduce((sum, row) => sum + row.invoiceCount, 0)}</th>
                <th>{baseCurrency} {totals.invoiced.toFixed(2)}</th>
                <th>{baseCurrency} {totals.paid.toFixed(2)}</th>
                <th>{baseCurrency} {totals.balance.toFixed(2)}</th>
                <th>{baseCurrency} {totals.overdue.toFixed(2)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </main>
  );
}
