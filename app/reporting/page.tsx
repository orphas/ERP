"use client";

import { useEffect, useMemo, useState } from "react";

type Preset = "month" | "quarter" | "biannual" | "annual" | "last_year" | "year_before" | "custom";
type ReportKind = "executive" | "statement" | "aging" | "sales" | "profitability";

type SummaryResponse = {
  startDate: string;
  endDate: string;
  metrics: {
    invoices: number;
    customers: number;
    salesRevenue: number;
    thirdPartyRevenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPct: number;
    vatOutput: number;
    receivables: number;
    collected: number;
    inventoryValuation: number;
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
  };
  aging: {
    current: number;
    due30: number;
    due60: number;
    due90p: number;
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
    customerId: number;
    customerName: string;
    invoiceId: number;
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
  customers: Array<{ id: number; name: string }>;
};

type MonthlySnapshot = {
  id: number;
  type: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
};

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getPresetRange(preset: Preset): { startDate: Date; endDate: Date } {
  const now = new Date();
  if (preset === "month") {
    return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
  }
  if (preset === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const startDate = new Date(now.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0);
    const endDate = new Date(now.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);
    return { startDate, endDate };
  }
  if (preset === "biannual") {
    const startMonth = now.getMonth() < 6 ? 0 : 6;
    const startDate = new Date(now.getFullYear(), startMonth, 1, 0, 0, 0, 0);
    const endDate = new Date(now.getFullYear(), startMonth + 6, 0, 23, 59, 59, 999);
    return { startDate, endDate };
  }
  if (preset === "annual") {
    return {
      startDate: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
      endDate: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }
  if (preset === "last_year") {
    const year = now.getFullYear() - 1;
    return {
      startDate: new Date(year, 0, 1, 0, 0, 0, 0),
      endDate: new Date(year, 11, 31, 23, 59, 59, 999),
    };
  }
  const year = now.getFullYear() - 2;
  return {
    startDate: new Date(year, 0, 1, 0, 0, 0, 0),
    endDate: new Date(year, 11, 31, 23, 59, 59, 999),
  };
}

function money(value: number): string {
  return value.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReportingPage() {
  const [preset, setPreset] = useState<Preset>("month");
  const [reportKind, setReportKind] = useState<ReportKind>("executive");
  const [customerId, setCustomerId] = useState<string>("");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dateRange = useMemo(() => {
    if (preset === "custom") {
      const customStart = customStartDate ? new Date(customStartDate) : startOfMonth(new Date());
      const customEnd = customEndDate ? new Date(customEndDate) : endOfMonth(new Date());
      return { startDate: customStart, endDate: customEnd };
    }
    return getPresetRange(preset);
  }, [preset, customStartDate, customEndDate]);

  const periodLabel = useMemo(
    () => `${toIsoDate(dateRange.startDate)} to ${toIsoDate(dateRange.endDate)}`,
    [dateRange.startDate, dateRange.endDate]
  );

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("startDate", dateRange.startDate.toISOString());
    params.set("endDate", dateRange.endDate.toISOString());
    if (customerId) params.set("customerId", customerId);
    return params;
  }, [dateRange.startDate, dateRange.endDate, customerId]);

  const loadSummary = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/reporting/summary?${query.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load reporting summary");
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reporting summary");
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlySnapshots = async () => {
    const res = await fetch("/api/reporting/monthly");
    const data = await res.json();
    setSnapshots(Array.isArray(data) ? data : []);
  };

  const autoGenerateMonthly = async () => {
    await fetch("/api/reporting/monthly?auto=true", { method: "POST" });
    await loadMonthlySnapshots();
  };

  const generateCurrentMonthly = async () => {
    await fetch("/api/reporting/monthly", { method: "POST" });
    await loadMonthlySnapshots();
  };

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    autoGenerateMonthly();
    loadMonthlySnapshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pdfHref = useMemo(() => `/api/reporting/pdf?kind=${reportKind}&${query.toString()}`, [reportKind, query]);
  const statementPdfHrefEn = useMemo(() => `/api/reporting/pdf?kind=statement&lang=en&${query.toString()}`, [query]);
  const statementPdfHrefFr = useMemo(() => `/api/reporting/pdf?kind=statement&lang=fr&${query.toString()}`, [query]);
  const agingPdfHrefEn = useMemo(() => `/api/reporting/pdf?kind=aging&lang=en&${query.toString()}`, [query]);
  const agingPdfHrefFr = useMemo(() => `/api/reporting/pdf?kind=aging&lang=fr&${query.toString()}`, [query]);

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Professional Reporting Center</h1>
          <p className="page-subtitle">Generate print-ready management reports with strict period controls and automatic monthly snapshots.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary" href={pdfHref} target="_blank" rel="noreferrer">Generate Report PDF</a>
          <a className="btn-secondary" href={statementPdfHrefEn} target="_blank" rel="noreferrer">Statement PDF EN</a>
          <a className="btn-secondary" href={statementPdfHrefFr} target="_blank" rel="noreferrer">Statement PDF FR</a>
          <a className="btn-secondary" href={agingPdfHrefEn} target="_blank" rel="noreferrer">Aging PDF EN</a>
          <a className="btn-secondary" href={agingPdfHrefFr} target="_blank" rel="noreferrer">Aging PDF FR</a>
          <button type="button" className="btn-primary" onClick={() => window.print()}>Print Screen</button>
        </div>
      </div>

      <section className="card grid gap-3 md:grid-cols-5 items-end">
        <div className="form-group">
          <label className="label">Report Type</label>
          <select className="input" value={reportKind} onChange={(e) => setReportKind(e.target.value as ReportKind)}>
            <option value="executive">Executive</option>
            <option value="profitability">Profitability</option>
            <option value="sales">Sales Performance</option>
            <option value="statement">Statement of Account</option>
            <option value="aging">Aging Summary</option>
          </select>
        </div>

        <div className="form-group">
          <label className="label">Timeframe</label>
          <select className="input" value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="biannual">Biannual</option>
            <option value="annual">Annual</option>
            <option value="last_year">Last Year</option>
            <option value="year_before">Year Before</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div className="form-group">
          <label className="label">Customer Filter</label>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">All customers</option>
            {(summary?.customers || []).map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </select>
        </div>

        {preset === "custom" && (
          <>
            <div className="form-group">
              <label className="label">Start Date</label>
              <input className="input" type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">End Date</label>
              <input className="input" type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
            </div>
          </>
        )}

        <div className="form-group">
          <label className="label">Resolved Period</label>
          <input
            className="input"
            readOnly
            value={periodLabel}
          />
        </div>
      </section>

      <section className="card grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-white/15 bg-black/20 p-4">
          <p className="text-xs text-slate-400 mb-2">Statement of Account PDF</p>
          <p className="text-sm text-slate-200 mb-3">Uses current filters and timeframe: {periodLabel}</p>
          <div className="flex flex-wrap gap-2">
            <a className="btn-secondary" href={statementPdfHrefEn} target="_blank" rel="noreferrer">Print Statement EN</a>
            <a className="btn-secondary" href={statementPdfHrefFr} target="_blank" rel="noreferrer">Print Statement FR</a>
          </div>
        </div>
        <div className="rounded-lg border border-white/15 bg-black/20 p-4">
          <p className="text-xs text-slate-400 mb-2">Aging Summary PDF</p>
          <p className="text-sm text-slate-200 mb-3">Uses current filters and timeframe: {periodLabel}</p>
          <div className="flex flex-wrap gap-2">
            <a className="btn-secondary" href={agingPdfHrefEn} target="_blank" rel="noreferrer">Print Aging EN</a>
            <a className="btn-secondary" href={agingPdfHrefFr} target="_blank" rel="noreferrer">Print Aging FR</a>
          </div>
        </div>
      </section>

      {error && <div className="alert-error">{error}</div>}

      <section className="card grid gap-3 md:grid-cols-4">
        <div className="kpi-card"><div className="stat-label">Sales Revenue</div><div className="text-emerald-300 text-xl font-bold">{loading || !summary ? "-" : `${money(summary.metrics.salesRevenue)} MAD`}</div></div>
        <div className="kpi-card"><div className="stat-label">Gross Profit</div><div className="text-cyan-300 text-xl font-bold">{loading || !summary ? "-" : `${money(summary.metrics.grossProfit)} MAD`}</div></div>
        <div className="kpi-card"><div className="stat-label">Receivables</div><div className="text-amber-300 text-xl font-bold">{loading || !summary ? "-" : `${money(summary.metrics.receivables)} MAD`}</div></div>
        <div className="kpi-card"><div className="stat-label">Net Profit</div><div className="text-violet-300 text-xl font-bold">{loading || !summary ? "-" : `${money(summary.metrics.netProfit)} MAD`}</div></div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-3">Customer Aging Summary</h2>
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
        <h2 className="text-lg font-semibold text-white mb-3">Statement of Account</h2>
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
                  <td>{row.reference}</td>
                  <td>{new Date(row.date).toLocaleDateString()}</td>
                  <td>{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "-"}</td>
                  <td>{money(row.total)}</td>
                  <td>{money(row.paid)}</td>
                  <td className="font-semibold">{money(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Monthly Automatic Reports</h2>
          <button type="button" className="btn-primary" onClick={generateCurrentMonthly}>Generate This Month Snapshot</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Period Start</th>
                <th>Period End</th>
                <th>Generated At</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td>{snapshot.id}</td>
                  <td>{new Date(snapshot.periodStart).toLocaleDateString()}</td>
                  <td>{new Date(snapshot.periodEnd).toLocaleDateString()}</td>
                  <td>{new Date(snapshot.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
