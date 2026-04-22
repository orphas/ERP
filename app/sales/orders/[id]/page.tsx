"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuthz } from "@/lib/useAuthz";

type OrderDetail = {
  id: number;
  reference: string;
  status: string;
  date: string;
  creditTermDays: number;
  subtotal: string;
  vatAmount: string;
  total: string;
  customer?: { name: string };
  items: Array<{ id: number; quantity: number; unitPrice: string; lineTotal: string; product?: { name: string } }>;
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuthz();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [status, setStatus] = useState("pending");
  const [creditTermDays, setCreditTermDays] = useState("30");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/sales/orders/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load order");
    setOrder(data);
    setStatus(data.status || "pending");
    setCreditTermDays(String(data.creditTermDays ?? 30));
  }, [id]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load order"));
  }, [load]);

  const save = async () => {
    if (!can(`/api/sales/orders/${id}`, "PUT")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/sales/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, creditTermDays: Number(creditTermDays) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to save order" }));
        throw new Error(data.error || "Failed to save order");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save order");
    } finally {
      setSaving(false);
    }
  };

  const createInvoice = async () => {
    if (!can(`/api/sales/orders/${id}/invoice`, "POST")) return;
    try {
      const res = await fetch(`/api/sales/orders/${id}/invoice`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create invoice" }));
        throw new Error(data.error || "Failed to create invoice");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice");
    }
  };

  if (!order) return <main className="card">Loading order...</main>;

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div><h1 className="page-title">Order {order.reference}</h1><p className="page-subtitle">Customer: {order.customer?.name || "-"}</p></div>
        <div className="flex gap-2">
          <a href={`/api/print/order/${id}?lang=en`} target="_blank" rel="noreferrer" className="btn-secondary">Print EN</a>
          <a href={`/api/print/order/${id}?lang=fr`} target="_blank" rel="noreferrer" className="btn-secondary">Print FR</a>
          <Link href="/sales/orders" className="btn-secondary">Back to Orders</Link>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <section className="card grid gap-4 md:grid-cols-4">
        <div><div className="stat-label">Date</div><div>{new Date(order.date).toLocaleDateString()}</div></div>
        <div><div className="stat-label">Status</div><span className="badge badge-blue">{order.status}</span></div>
        <div><div className="stat-label">Credit Term</div><div>{order.creditTermDays} days</div></div>
        <div><div className="stat-label">Total</div><div className="text-emerald-300 font-semibold">{order.total}</div></div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Order Items</h2>
        <div className="table-wrap"><table className="table"><thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead><tbody>{order.items.map((item) => (<tr key={item.id}><td>{item.product?.name || "-"}</td><td>{item.quantity}</td><td>{item.unitPrice}</td><td>{item.lineTotal}</td></tr>))}</tbody></table></div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white">Actions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="form-group"><label className="label">Status</label><select className="input" value={status} onChange={(e) => setStatus(e.target.value)} disabled={!can(`/api/sales/orders/${id}`, "PUT")}><option value="pending">pending</option><option value="confirmed">confirmed</option><option value="shipped">shipped</option><option value="delivered">delivered</option><option value="cancelled">cancelled</option></select></div>
          <div className="form-group"><label className="label">Credit Term Days</label><input className="input" type="number" min="1" value={creditTermDays} onChange={(e) => setCreditTermDays(e.target.value)} disabled={!can(`/api/sales/orders/${id}`, "PUT")} /></div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" onClick={save} disabled={saving || !can(`/api/sales/orders/${id}`, "PUT")}>{saving ? "Saving..." : "Save Order"}</button>
          <button className="btn-secondary" onClick={createInvoice} disabled={!can(`/api/sales/orders/${id}/invoice`, "POST")}>Create Invoice</button>
        </div>
      </section>
    </main>
  );
}
