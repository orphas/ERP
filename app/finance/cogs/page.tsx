"use client";

import { useEffect, useState } from "react";

type Row = {
  invoiceId: number;
  reference: string;
  date: string;
  quantity: number;
  cogs: number;
};

export default function CogsPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    fetch("/api/finance/cogs?by=invoice")
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  }, []);

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cost of Goods Sold</h1>
          <p className="page-subtitle">Invoice-level COGS traceability from inventory batch consumption.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/finance/reports/pdf?kind=cogs" target="_blank" rel="noreferrer" className="btn-secondary">
            Print COGS Report
          </a>
        </div>
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">COGS by Invoice</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Quantity</th>
                <th>COGS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.invoiceId}>
                  <td className="font-medium">{row.reference}</td>
                  <td>{row.date ? new Date(row.date).toLocaleDateString() : "-"}</td>
                  <td>{Number(row.quantity || 0)}</td>
                  <td>{Number(row.cogs || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
