"use client";

import { useEffect, useMemo, useState } from "react";

type SummaryResponse = {
  startDate: string;
  endDate: string;
  metrics: {
    salesRevenue: number;
    grossProfit: number;
    receivables: number;
    collected: number;
  };
  customerAging: Array<{
    customerId: number;
    customerName: string;
    current: number;
    due30: number;
    due60: number;
    due90p: number;
    totalOutstanding: number;
  }>;
  statement: Array<{
    invoiceId: number;
    customerName: string;
    reference: string;
    date: string;
    dueDate: string | null;
    status: string;
    total: number;
    paid: number;
    balance: number;
  }>;
  salesTrend: Array<{
    period: string;
    salesRevenue: number;
    thirdPartyRevenue: number;
    cogs: number;
    grossProfit: number;
  }>;
};

function asDateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function money(value: number): string {
  return value.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvoiceSummaryPage() {
  const now = new Date();
  const [startDate, setStartDate] = useState(asDateInputValue(new Date(now.getFullYear(), 0, 1)));
  const [endDate, setEndDate] = useState(asDateInputValue(new Date(now.getFullYear(), 11, 31)));
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("startDate", new Date(startDate).toISOString());
    params.set("endDate", new Date(endDate).toISOString());
    return params;
  }, [startDate, endDate]);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    fetch(`/api/reporting/summary?${query.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!canceled) setSummary(data && !data.error ? data : null);
      })
      .catch(() => {
        if (!canceled) setSummary(null);
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [query]);

  const printHref = `/api/finance/reports/pdf?kind=invoice-summary&${query.toString()}`;

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoice Summary</h1>
          <p className="page-subtitle">Statement of Account, Aging by Customer, and Sales Trend in the same structure as official invoice summary reports.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40">
            <label className="label">Start Date</label>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="min-w-40">
            <label className="label">End Date</label>
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <a href={printHref} target="_blank" rel="noreferrer" className="btn-secondary">
            Print Invoice Summary Report
          </a>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="card-sm">
          <div className="stat-label">Sales Revenue</div>
          <div className="stat-value text-cyan-300">{loading || !summary ? "-" : money(summary.metrics.salesRevenue)}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Gross Profit</div>
          <div className="stat-value text-emerald-300">{loading || !summary ? "-" : money(summary.metrics.grossProfit)}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Receivables</div>
          <div className="stat-value text-amber-300">{loading || !summary ? "-" : money(summary.metrics.receivables)}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Paid</div>
          <div className="stat-value text-violet-300">{loading || !summary ? "-" : money(summary.metrics.collected)}</div>
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Statement of Account</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Invoice</th>
                <th>Invoice Date</th>
                <th>Due Date</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.statement || []).map((row) => (
                <tr key={row.invoiceId}>
                  <td>{row.customerName}</td>
                  <td className="font-medium">{row.reference}</td>
                  <td>{new Date(row.date).toLocaleDateString()}</td>
                  <td>{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "-"}</td>
                  <td>{money(row.total)}</td>
                  <td>{money(row.paid)}</td>
                  <td className="font-semibold text-amber-300">{money(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Aging by Customer</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Current</th>
                <th>1-30</th>
                <th>31-60</th>
                <th>60+</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.customerAging || []).map((row) => (
                <tr key={row.customerId}>
                  <td>{row.customerName}</td>
                  <td>{money(row.current)}</td>
                  <td>{money(row.due30)}</td>
                  <td>{money(row.due60)}</td>
                  <td>{money(row.due90p)}</td>
                  <td className="font-semibold">{money(row.totalOutstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Sales Trend</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Sales Revenue</th>
                <th>Pass-Through Charges</th>
                <th>COGS</th>
                <th>Gross Profit</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.salesTrend || []).map((row) => (
                <tr key={row.period}>
                  <td className="font-medium">{row.period}</td>
                  <td>{money(row.salesRevenue)}</td>
                  <td>{money(row.thirdPartyRevenue)}</td>
                  <td>{money(row.cogs)}</td>
                  <td className={row.grossProfit >= 0 ? "text-emerald-300" : "text-rose-300"}>{money(row.grossProfit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
