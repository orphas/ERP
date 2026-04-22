"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuthz } from "@/lib/useAuthz";

type QuoteDetail = {
  id: number;
  reference: string;
  status: string;
  date: string;
  validityDays: number;
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  total: string;
  notes?: string;
  customer?: { name: string; email?: string };
  items: Array<{ id: number; quantity: number; unitPrice: string; lineTotal: string; product?: { name: string } }>;
};

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuthz();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/sales/quotes/${id}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load quote");
    }
    setQuote(data);
    setStatus(data.status || "draft");
    setNotes(data.notes || "");
  }, [id]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load quote"));
  }, [load]);

  const save = async () => {
    if (!can(`/api/sales/quotes/${id}`, "PUT")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/sales/quotes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to save quote" }));
        throw new Error(data.error || "Failed to save quote");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save quote");
    } finally {
      setSaving(false);
    }
  };

  const convert = async () => {
    if (!can(`/api/sales/quotes/${id}/convert`, "POST")) return;
    try {
      const res = await fetch(`/api/sales/quotes/${id}/convert`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to convert quote" }));
        throw new Error(data.error || "Failed to convert quote");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert quote");
    }
  };

  if (!quote) {
    return <main className="card">Loading quote...</main>;
  }

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quote {quote.reference}</h1>
          <p className="page-subtitle">Customer: {quote.customer?.name || "-"}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/print/quote/${id}?lang=en`} target="_blank" rel="noreferrer" className="btn-secondary">Print EN</a>
          <a href={`/api/print/quote/${id}?lang=fr`} target="_blank" rel="noreferrer" className="btn-secondary">Print FR</a>
          <Link href="/sales/quotes" className="btn-secondary">Back to Quotes</Link>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <section className="card grid gap-4 md:grid-cols-4">
        <div><div className="stat-label">Date</div><div className="text-slate-200">{new Date(quote.date).toLocaleDateString()}</div></div>
        <div><div className="stat-label">Status</div><span className="badge badge-amber">{quote.status}</span></div>
        <div><div className="stat-label">Subtotal</div><div className="text-slate-200">{quote.subtotal}</div></div>
        <div><div className="stat-label">Total</div><div className="text-emerald-300 font-semibold">{quote.total}</div></div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Quote Items</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead>
            <tbody>
              {quote.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product?.name || "-"}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unitPrice}</td>
                  <td>{item.lineTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white">Actions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="form-group">
            <label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} disabled={!can(`/api/sales/quotes/${id}`, "PUT")}>
              <option value="draft">draft</option>
              <option value="sent">sent</option>
              <option value="accepted">accepted</option>
              <option value="rejected">rejected</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">Notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!can(`/api/sales/quotes/${id}`, "PUT")} />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" onClick={save} disabled={saving || !can(`/api/sales/quotes/${id}`, "PUT")}>{saving ? "Saving..." : "Save Quote"}</button>
          {quote.status !== "accepted" && (
            <button className="btn-secondary" onClick={convert} disabled={!can(`/api/sales/quotes/${id}/convert`, "POST")}>
              Convert to Order
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
