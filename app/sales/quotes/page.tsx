"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthz } from "@/lib/useAuthz";
import UniversalListActions from "@/components/ui/UniversalListActions";
import DataTable, { DataColumn } from "@/components/ui/DataTable";

type Customer = { id: number; name: string };
type Product = { id: number; name: string; price: string };
type Quote = {
  id: number;
  reference: string;
  status: string;
  total: string;
  customer: Customer;
  items: Array<{ id: number; quantity: number; product: Product }>;
};
type QuoteWithMeta = Quote & {
  subtotal?: string;
  vatAmount?: string;
  vatRate?: string;
  createdAt?: string;
  date?: string;
};

type QuoteLine = {
  key: number;
  productId: string;
  quantity: string;
  unitPrice: string;
};

export default function QuotesPage() {
  const { can } = useAuthz();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [vatRate, setVatRate] = useState("20");
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([{ key: Date.now(), productId: "", quantity: "1", unitPrice: "0" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const [q, c, p] = await Promise.all([
      fetch("/api/sales/quotes").then((r) => r.json()),
      fetch("/api/sales/customers").then((r) => r.json()),
      fetch("/api/inventory/products").then((r) => r.json()),
    ]);
    setQuotes(Array.isArray(q) ? q : []);
    setCustomers(Array.isArray(c) ? c : []);
    setProducts(Array.isArray(p) ? p : []);
  };

  useEffect(() => {
    load();
  }, []);

  const updateLine = (key: number, patch: Partial<QuoteLine>) => {
    setQuoteLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        if (patch.productId !== undefined) {
          const product = products.find((p) => p.id === Number(patch.productId));
          if (product) next.unitPrice = String(Number(product.price || 0));
        }
        return next;
      })
    );
  };

  const addLine = () => {
    setQuoteLines((current) => [...current, { key: Date.now() + Math.floor(Math.random() * 1000), productId: "", quantity: "1", unitPrice: "0" }]);
  };

  const removeLine = (key: number) => {
    setQuoteLines((current) => (current.length <= 1 ? current : current.filter((line) => line.key !== key)));
  };

  const subtotal = quoteLines.reduce((sum, line) => {
    const qty = Number(line.quantity || 0);
    const unitPrice = Number(line.unitPrice || 0);
    return sum + (Number.isFinite(qty) && Number.isFinite(unitPrice) ? qty * unitPrice : 0);
  }, 0);
  const vatAmount = subtotal * (Number(vatRate || 0) / 100);
  const total = subtotal + vatAmount;

  const createQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const normalizedItems = quoteLines
        .map((line) => ({
          productId: Number(line.productId),
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
        }))
        .filter(
          (line) =>
            Number.isInteger(line.productId) &&
            line.productId > 0 &&
            Number.isFinite(line.quantity) &&
            line.quantity > 0 &&
            Number.isFinite(line.unitPrice) &&
            line.unitPrice >= 0
        );

      if (!customerId) throw new Error("Select customer");
      if (normalizedItems.length === 0) throw new Error("Add at least one valid quote item");

      const res = await fetch("/api/sales/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: Number(customerId),
          vatRate: Number(vatRate || 20),
          items: normalizedItems,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create quote" }));
        throw new Error(data.error || "Failed to create quote");
      }

      setCustomerId("");
  setVatRate("20");
  setQuoteLines([{ key: Date.now(), productId: "", quantity: "1", unitPrice: "0" }]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quote");
    } finally {
      setSaving(false);
    }
  };

  const convert = async (id: number) => {
    if (!can("/api/sales/quotes", "POST")) return;
    try {
      const res = await fetch(`/api/sales/quotes/${id}/convert`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Conversion failed" }));
        throw new Error(data.error || "Conversion failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
    }
  };

  const deleteQuote = async (id: number) => {
    if (!can(`/api/sales/quotes/${id}`, "DELETE")) return;
    try {
      const res = await fetch(`/api/sales/quotes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to delete quote" }));
        throw new Error(data.error || "Failed to delete quote");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete quote");
    }
  };

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Quotes</h1>
          <p className="page-subtitle">Create quotes and convert accepted quotes into sales orders.</p>
        </div>
        <a href="#new-sales-quote" className="btn-primary">+ Add Quote</a>
      </div>

      <section id="new-sales-quote" className="card">
        <h2 className="text-lg font-semibold text-white mb-4">New Quote</h2>
        {error && <div className="alert-error mb-4">{error}</div>}
        <form onSubmit={createQuote} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="form-group">
              <label className="label">Customer</label>
              <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="label">VAT Rate (%)</label>
              <input className="input" type="number" min="0" step="0.01" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Client Price Mode</label>
              <input className="input" value="Per-line custom price" readOnly />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Quote Lines</h3>
              <button type="button" className="btn-secondary btn-sm" onClick={addLine}>+ Add Item Line</button>
            </div>

            {quoteLines.map((line) => {
              const lineTotal = Number(line.quantity || 0) * Number(line.unitPrice || 0);
              return (
                <div key={line.key} className="grid gap-2 md:grid-cols-5 items-end">
                  <div className="form-group md:col-span-2">
                    <label className="label">Product</label>
                    <select
                      className="input"
                      value={line.productId}
                      onChange={(e) => updateLine(line.key, { productId: e.target.value })}
                      required
                    >
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Quantity</label>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Unit Price</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Line Total</label>
                    <div className="input flex items-center justify-between">
                      <span>{Number.isFinite(lineTotal) ? lineTotal.toFixed(2) : "0.00"}</span>
                      <button type="button" className="btn-danger btn-xs" onClick={() => removeLine(line.key)} disabled={quoteLines.length === 1}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="input">Subtotal: {subtotal.toFixed(2)}</div>
            <div className="input">VAT: {vatAmount.toFixed(2)}</div>
            <div className="input font-semibold text-emerald-300">Total: {total.toFixed(2)}</div>
          </div>

          <div>
            <button className="btn-primary" disabled={saving || !can("/api/sales/quotes", "POST")}>
              {saving ? "Creating..." : "Create Quote"}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Quote Register</h2>
        {(() => {
          const fmt = (v: string | number | null | undefined) => Number(v || 0).toFixed(2);
          const fmtDate = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString() : "-";
          const quoteCols: DataColumn<QuoteWithMeta>[] = [
            {
              key: "reference", label: "Quote #", sortable: true,
              getValue: (r) => r.reference,
              render: (r) => <Link href={`/sales/quotes/${r.id}`} className="font-medium text-cyan-300 hover:text-cyan-200">{r.reference}</Link>,
            },
            {
              key: "customer", label: "Customer", sortable: true,
              getValue: (r) => r.customer?.name || "",
              render: (r) => r.customer?.name || "-",
            },
            {
              key: "status", label: "Status", sortable: true,
              getValue: (r) => r.status,
              render: (r) => {
                const cls = r.status === "accepted" ? "badge-green" : r.status === "rejected" ? "badge-red" : r.status === "expired" ? "badge-slate" : "badge-amber";
                return <span className={`badge ${cls}`}>{r.status}</span>;
              },
            },
            {
              key: "lineCount", label: "Lines", sortable: true,
              getValue: (r) => r.items?.length ?? 0,
              render: (r) => r.items?.length ?? 0,
            },
            {
              key: "subtotal", label: "Subtotal HT", defaultVisible: false, sortable: true,
              getValue: (r) => Number(r.subtotal ?? 0),
              render: (r) => fmt(r.subtotal),
            },
            {
              key: "vatRate", label: "VAT %", defaultVisible: false, sortable: true,
              getValue: (r) => Number(r.vatRate ?? 20),
              render: (r) => `${Number(r.vatRate ?? 20).toFixed(1)}%`,
            },
            {
              key: "vatAmount", label: "VAT Amount", defaultVisible: false, sortable: true,
              getValue: (r) => Number(r.vatAmount ?? 0),
              render: (r) => fmt(r.vatAmount),
            },
            {
              key: "total", label: "Total TTC", sortable: true,
              getValue: (r) => Number(r.total),
              render: (r) => <span className="font-semibold text-cyan-200">{fmt(r.total)}</span>,
            },
            {
              key: "date", label: "Date", defaultVisible: false, sortable: true,
              getValue: (r) => r.date || r.createdAt || "",
              render: (r) => fmtDate(r.date || r.createdAt),
            },
            {
              key: "actions", label: "Actions", sortable: false,
              render: (quote) => (
                <UniversalListActions
                  id={quote.id}
                  deleteLabel="quotation"
                  viewHref={`/sales/quotes/${quote.id}`}
                  printDocument="quote"
                  canDelete={can(`/api/sales/quotes/${quote.id}`, "DELETE")}
                  onDelete={deleteQuote}
                >
                  {quote.status !== "accepted" && can(`/api/sales/quotes/${quote.id}/convert`, "POST") && (
                    <button className="btn-primary btn-xs" onClick={() => convert(quote.id)}>
                      Convert to Order
                    </button>
                  )}
                </UniversalListActions>
              ),
            },
          ];
          return <DataTable columns={quoteCols} rows={quotes as QuoteWithMeta[]} rowKey={(r) => r.id} maxHeight="72vh" emptyMessage="No quotes found." preferencesKey="sales.quotes.register" />;
        })()}
      </section>
    </main>
  );
}
