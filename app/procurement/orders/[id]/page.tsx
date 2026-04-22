"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuthz } from "@/lib/useAuthz";

type PurchaseOrderDetail = {
  id: number;
  reference: string;
  currency?: string;
  purchaseType?: string;
  incoterm?: string;
  originCountry?: string;
  expectedPort?: string;
  customsReference?: string;
  exchangeRate?: string;
  status: string;
  date: string;
  subtotal: string;
  vatAmount: string;
  total: string;
  supplier?: { name: string };
  items: Array<{ id: number; itemType?: string; description?: string; quantity: number; receivedQty: string; unitPrice: string; lineTotal: string; product?: { name: string } }>;
  expenses?: Array<{ id: number; description: string; externalRef?: string; amount: string; vatRate: string; vatAmount: string; total: string; supplier?: { name: string } }>;
};

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuthz();
  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null);
  const [status, setStatus] = useState("draft");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/procurement/orders/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load order");
    setOrder(data);
    setStatus(data.status || "draft");
  }, [id]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load order"));
  }, [load]);

  const saveStatus = async () => {
    if (!can(`/api/procurement/orders/${id}`, "PUT")) return;
    try {
      const res = await fetch(`/api/procurement/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to update order" }));
        throw new Error(data.error || "Failed to update order");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order");
    }
  };

  const receiveRemaining = async () => {
    if (!order || !can(`/api/procurement/orders/${id}/receive`, "POST")) return;

    try {
      const items = order.items
        .map((item) => {
          const remaining = item.quantity - Number(item.receivedQty || 0);
          return { itemId: item.id, receivedQty: remaining > 0 ? remaining : 0 };
        })
        .filter((item) => item.receivedQty > 0);

      if (items.length === 0) {
        throw new Error("No remaining items to receive");
      }

      const res = await fetch(`/api/procurement/orders/${id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to receive items" }));
        throw new Error(data.error || "Failed to receive items");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to receive items");
    }
  };

  if (!order) return <main className="card">Loading purchase order...</main>;
  const currency = (order.currency || "MAD").toUpperCase();

  return (
    <main className="space-y-6">
      <div className="page-header"><div><h1 className="page-title">Purchase Order {order.reference}</h1><p className="page-subtitle">Supplier: {order.supplier?.name || "-"}</p></div><div className="flex gap-2"><a href={`/api/print/purchase-order/${id}?lang=en`} target="_blank" rel="noreferrer" className="btn-secondary">Print EN</a><a href={`/api/print/purchase-order/${id}?lang=fr`} target="_blank" rel="noreferrer" className="btn-secondary">Print FR</a><Link href="/procurement/orders" className="btn-secondary">Back to Purchase Orders</Link></div></div>
      {error && <div className="alert-error">{error}</div>}

      <section className="card grid gap-4 md:grid-cols-4">
        <div><div className="stat-label">Date</div><div>{new Date(order.date).toLocaleDateString()}</div></div>
        <div><div className="stat-label">Type</div><div>{order.purchaseType || "local"}</div></div>
        <div><div className="stat-label">Status</div><span className={`badge ${order.status === "received" ? "badge-green" : "badge-amber"}`}>{order.status}</span></div>
        <div><div className="stat-label">Currency</div><div>{currency}</div></div>
        <div><div className="stat-label">Subtotal</div><div>{currency} {order.subtotal}</div></div>
        <div><div className="stat-label">VAT</div><div>{currency} {order.vatAmount}</div></div>
        <div><div className="stat-label">Total</div><div className="text-emerald-300 font-semibold">{currency} {order.total}</div></div>
      </section>

      {order.purchaseType === "import" && (
        <section className="card grid gap-4 md:grid-cols-3">
          <div><div className="stat-label">Origin Country</div><div>{order.originCountry || "-"}</div></div>
          <div><div className="stat-label">Incoterm</div><div>{order.incoterm || "-"}</div></div>
          <div><div className="stat-label">Expected Port</div><div>{order.expectedPort || "-"}</div></div>
          <div><div className="stat-label">Customs Ref</div><div>{order.customsReference || "-"}</div></div>
          <div><div className="stat-label">Exchange Rate</div><div>{order.exchangeRate || "-"}</div></div>
        </section>
      )}

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Products</h2>
        <div className="table-wrap"><table className="table"><thead><tr><th>Description</th><th>Ordered</th><th>Received</th><th>Unit Price</th><th>Line Total</th></tr></thead><tbody>{order.items.map((item) => (<tr key={item.id}><td>{item.product?.name || item.description || "-"}</td><td>{item.quantity}</td><td>{item.receivedQty}</td><td>{currency} {item.unitPrice}</td><td>{currency} {item.lineTotal}</td></tr>))}</tbody></table></div>
      </section>

      {order.expenses && order.expenses.length > 0 && (
        <section className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Additional Expenses</h2>
          <p className="text-xs text-slate-400 mb-3">Pass-through charges (freight, customs, brokerage, port fees) linked to this PO. <strong>Supplier Invoice #</strong> is the reference from that expense supplier&#39;s own invoice to you.</p>
          <div className="table-wrap"><table className="table"><thead><tr><th>Expense Supplier</th><th>Description</th><th>Supplier Invoice #</th><th>Amount</th><th>VAT%</th><th>VAT</th><th>Total</th></tr></thead><tbody>{order.expenses.map((expense) => (<tr key={expense.id}><td>{expense.supplier?.name || "-"}</td><td>{expense.description}</td><td className="font-medium">{expense.externalRef || <span className="text-slate-500">—</span>}</td><td>{currency} {expense.amount}</td><td>{expense.vatRate}</td><td>{currency} {expense.vatAmount}</td><td>{currency} {expense.total}</td></tr>))}</tbody></table></div>
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white">Actions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="form-group"><label className="label">Status</label><select className="input" value={status} onChange={(e) => setStatus(e.target.value)} disabled={!can(`/api/procurement/orders/${id}`, "PUT")}><option value="draft">draft</option><option value="sent">sent</option><option value="confirmed">confirmed</option><option value="received">received</option><option value="cancelled">cancelled</option></select></div>
        </div>
        <div className="flex gap-3 flex-wrap"><button className="btn-primary" onClick={saveStatus} disabled={!can(`/api/procurement/orders/${id}`, "PUT")}>Save Status</button><button className="btn-secondary" onClick={receiveRemaining} disabled={!can(`/api/procurement/orders/${id}/receive`, "POST")}>Receive Remaining</button></div>
      </section>
    </main>
  );
}
