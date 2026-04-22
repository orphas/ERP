"use client";

import { useEffect, useState } from "react";

type Row = {
  period: string;
  revenue: number;
  thirdPartyExpense: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
};

export default function ProfitabilityPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    fetch("/api/finance/profitability?by=month")
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  }, []);

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profitability Analysis</h1>
          <p className="page-subtitle">Monthly profitability trend based on revenue and recognized cost of goods sold.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/finance/reports/pdf?kind=profitability" target="_blank" rel="noreferrer" className="btn-secondary">
            Print Profitability Report
          </a>
        </div>
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Profitability by Month</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Revenue</th>
                <th>Pass-Through Charges</th>
                <th>COGS</th>
                <th>Gross Profit</th>
                <th>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.period}>
                  <td className="font-medium">{row.period}</td>
                  <td>{Number(row.revenue || 0).toFixed(2)}</td>
                  <td>{Number(row.thirdPartyExpense || 0).toFixed(2)}</td>
                  <td>{Number(row.cogs || 0).toFixed(2)}</td>
                  <td className={Number(row.grossProfit || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}>{Number(row.grossProfit || 0).toFixed(2)}</td>
                  <td>{Number(row.marginPct || 0).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
