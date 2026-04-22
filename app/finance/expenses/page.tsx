"use client";

import { useEffect, useMemo, useState } from "react";

type PurchaseOrder = {
  id: number;
  reference: string;
  date: string;
  expenses?: Array<{ id: number; description: string; amount: string; total: string; supplier?: { name?: string } }>;
};

type Delivery = {
  id: number;
  reference: string;
  date: string;
  expenses?: Array<{ id: number; description: string; amount: string; supplier?: { name?: string } }>;
};

export default function ExpensesPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/procurement/orders").then((r) => r.json()),
      fetch("/api/sales/deliveries").then((r) => r.json()),
    ])
      .then(([poData, deliveryData]) => {
        setPurchaseOrders(Array.isArray(poData) ? poData : []);
        setDeliveries(Array.isArray(deliveryData) ? deliveryData : []);
      })
      .catch(() => {
        setPurchaseOrders([]);
        setDeliveries([]);
      });
  }, []);

  const rows = useMemo(() => {
    const poRows = purchaseOrders.flatMap((order) =>
      (order.expenses || []).map((expense) => ({
        source: "Purchase Order",
        reference: order.reference,
        date: order.date,
        supplier: expense.supplier?.name || "-",
        description: expense.description,
        amount: Number(expense.total || expense.amount || 0),
      }))
    );

    const deliveryRows = deliveries.flatMap((delivery) =>
      (delivery.expenses || []).map((expense) => ({
        source: "Delivery",
        reference: delivery.reference,
        date: delivery.date,
        supplier: expense.supplier?.name || "-",
        description: expense.description,
        amount: Number(expense.amount || 0),
      }))
    );

    return [...poRows, ...deliveryRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchaseOrders, deliveries]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.amount, 0), [rows]);

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Operational and landed-cost expenses across procurement and delivery flows.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/finance/reports/pdf?kind=expenses" target="_blank" rel="noreferrer" className="btn-secondary">
            Print Expenses Report
          </a>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card-sm"><div className="stat-label">Expense Lines</div><div className="stat-value text-violet-300">{rows.length}</div></div>
        <div className="card-sm"><div className="stat-label">Total Expenses</div><div className="stat-value text-rose-300">{total.toFixed(2)}</div></div>
        <div className="card-sm"><div className="stat-label">Average Line</div><div className="stat-value text-cyan-300">{rows.length ? (total / rows.length).toFixed(2) : "0.00"}</div></div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Expense Register</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Reference</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.source}-${row.reference}-${idx}`}>
                  <td><span className="badge badge-cyan">{row.source}</span></td>
                  <td className="font-medium">{row.reference}</td>
                  <td>{row.date ? new Date(row.date).toLocaleDateString() : "-"}</td>
                  <td>{row.supplier}</td>
                  <td>{row.description}</td>
                  <td>{row.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
