"use client";

import { useEffect, useMemo, useState } from "react";

type Order = {
  id: number;
  reference: string;
  date: string;
  status: string;
  total: string;
  paidAmount: string;
  currency?: string;
  exchangeRate?: string | number | null;
  supplier?: { name?: string };
};

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fxToMad(order: Order): number {
  const currency = String(order.currency || "MAD").toUpperCase();
  if (currency === "MAD") return 1;
  const fx = num(order.exchangeRate);
  return fx > 0 ? fx : 0;
}

function totalInMad(order: Order): number {
  const total = num(order.total);
  const fx = fxToMad(order);
  return fx > 0 ? total * fx : 0;
}

function totalInUsd(order: Order, usdToMadRate: number): number {
  const currency = String(order.currency || "MAD").toUpperCase();
  const total = num(order.total);
  if (currency === "USD") return total;
  const madAmount = totalInMad(order);
  return usdToMadRate > 0 ? madAmount / usdToMadRate : 0;
}

export default function PayablesPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetch("/api/procurement/orders")
      .then((r) => r.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]));
  }, []);

  const usdToMadRate = useMemo(() => {
    const usdOrder = orders.find((order) => String(order.currency || "MAD").toUpperCase() === "USD" && fxToMad(order) > 0);
    return usdOrder ? fxToMad(usdOrder) : 10;
  }, [orders]);

  const totals = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        const total = Number(order.total || 0);
        const paid = Number(order.paidAmount || 0);
        const balance = Math.max(total - paid, 0);
        acc.total += total;
        acc.paid += paid;
        acc.balance += balance;
        acc.totalMad += totalInMad(order);
        acc.totalUsd += totalInUsd(order, usdToMadRate);
        return acc;
      },
      { total: 0, paid: 0, balance: 0, totalMad: 0, totalUsd: 0 }
    );
  }, [orders, usdToMadRate]);

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payables</h1>
          <p className="page-subtitle">Supplier liabilities and open payment obligations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/finance/reports/pdf?kind=payables" target="_blank" rel="noreferrer" className="btn-secondary">
            Print Payables Report
          </a>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card-sm"><div className="stat-label">Total Purchase Value (Document Currency)</div><div className="stat-value text-cyan-300">{totals.total.toFixed(2)}</div></div>
        <div className="card-sm"><div className="stat-label">Settled Amount</div><div className="stat-value text-emerald-300">{totals.paid.toFixed(2)}</div></div>
        <div className="card-sm"><div className="stat-label">Outstanding Liability</div><div className="stat-value text-amber-300">{totals.balance.toFixed(2)}</div></div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Supplier Payable Register</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>PO Reference</th>
                <th>Supplier</th>
                <th>Date</th>
                <th>Exchange Rate (to MAD)</th>
                <th>Total (Document Currency)</th>
                <th>Total (MAD)</th>
                <th>Total (USD)</th>
                <th>Settled Amount</th>
                <th>Outstanding Liability</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const total = Number(order.total || 0);
                const paid = Number(order.paidAmount || 0);
                const outstanding = Math.max(total - paid, 0);
                const currency = String(order.currency || "MAD").toUpperCase();
                const fx = fxToMad(order);
                const madAmount = totalInMad(order);
                const usdAmount = totalInUsd(order, usdToMadRate);
                return (
                  <tr key={order.id}>
                    <td className="font-medium">{order.reference}</td>
                    <td>{order.supplier?.name || "-"}</td>
                    <td>{order.date ? new Date(order.date).toLocaleDateString() : "-"}</td>
                    <td>{currency === "MAD" ? "-" : (fx > 0 ? fx.toFixed(4) : "-")}</td>
                    <td>{currency} {total.toFixed(2)}</td>
                    <td>MAD {madAmount.toFixed(2)}</td>
                    <td>USD {usdAmount.toFixed(2)}</td>
                    <td>{currency} {paid.toFixed(2)}</td>
                    <td className={outstanding > 0 ? "text-amber-300 font-semibold" : "text-slate-400"}>{currency} {outstanding.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th>-</th>
                <th>-</th>
                <th>-</th>
                <th>-</th>
                <th>{totals.total.toFixed(2)}</th>
                <th>MAD {totals.totalMad.toFixed(2)}</th>
                <th>USD {totals.totalUsd.toFixed(2)}</th>
                <th>{totals.paid.toFixed(2)}</th>
                <th>{totals.balance.toFixed(2)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </main>
  );
}
