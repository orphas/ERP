"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuthz } from "@/lib/useAuthz";

type InvoiceDetail = {
  id: number;
  reference: string;
  status: string;
  date: string;
  dueDate?: string;
  total: string;
  paidAmount: string;
  customer?: { name: string };
  items: Array<{ id: number; itemType?: string; description?: string; quantity: number; unitPrice: string; lineTotal: string; product?: { name: string } }>;
};

type FinanceAccount = {
  id: number;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuthz();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [status, setStatus] = useState("draft");
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/sales/invoices/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load invoice");
    setInvoice(data);
    setStatus(data.status || "draft");
    const remaining = Number(data.total || 0) - Number(data.paidAmount || 0);
    setPaymentAmount(String(remaining > 0 ? remaining : 0));
  }, [id]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load invoice"));
  }, [load]);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const res = await fetch("/api/finance/accounts");
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) return;
        const assets = data.filter(
          (acc: FinanceAccount) => acc.type?.toLowerCase() === "asset" && acc.isActive !== false
        );
        setAccounts(assets);
        if (assets.length > 0) {
          setPaymentAccountId((prev) => prev || String(assets[0].id));
        }
      } catch {
        // Ignore account preload failures and let payment API validate
      }
    };
    loadAccounts();
  }, []);

  const saveStatus = async () => {
    if (!can(`/api/sales/invoices/${id}`, "PUT")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/sales/invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to update invoice" }));
        throw new Error(data.error || "Failed to update invoice");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  };

  const pay = async () => {
    if (!can(`/api/sales/invoices/${id}/pay`, "POST")) return;
    if (!paymentAccountId) {
      setError("Please select the receiving finance account.");
      return;
    }
    try {
      const res = await fetch(`/api/sales/invoices/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(paymentAmount),
          paymentMethod,
          paymentAccountId: Number(paymentAccountId),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Payment failed" }));
        throw new Error(data.error || "Payment failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    }
  };

  if (!invoice) return <main className="card">Loading invoice...</main>;

  const remaining = Number(invoice.total || 0) - Number(invoice.paidAmount || 0);
  const paymentLocked = Number(invoice.paidAmount || 0) > 0 || invoice.status === "paid";

  return (
    <main className="space-y-6">
      <div className="page-header"><div><h1 className="page-title">Invoice {invoice.reference}</h1><p className="page-subtitle">Customer: {invoice.customer?.name || "-"}</p></div><div className="flex gap-2"><a href={`/api/print/invoice/${id}?lang=en`} target="_blank" rel="noreferrer" className="btn-secondary">Print EN</a><a href={`/api/print/invoice/${id}?lang=fr`} target="_blank" rel="noreferrer" className="btn-secondary">Print FR</a><Link href="/sales/invoices" className="btn-secondary">Back to Invoices</Link></div></div>
      {error && <div className="alert-error">{error}</div>}

      <section className="card grid gap-4 md:grid-cols-4">
        <div><div className="stat-label">Date</div><div>{new Date(invoice.date).toLocaleDateString()}</div></div>
        <div><div className="stat-label">Due Date</div><div>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "-"}</div></div>
        <div><div className="stat-label">Status</div><span className={`badge ${invoice.status === "paid" ? "badge-green" : "badge-amber"}`}>{invoice.status}</span></div>
        <div><div className="stat-label">Remaining</div><div className="text-amber-300 font-semibold">{remaining.toFixed(2)}</div></div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Invoice Items</h2>
        <div className="table-wrap"><table className="table"><thead><tr><th>Type</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead><tbody>{invoice.items.map((item) => (<tr key={item.id}><td>{item.itemType === "charge" ? <span className="badge badge-amber">third_party_expense</span> : "product"}</td><td>{item.product?.name || item.description || "-"}</td><td>{item.quantity}</td><td>{item.unitPrice}</td><td>{item.lineTotal}</td></tr>))}</tbody></table></div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white">Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="form-group"><label className="label">Status</label><select className="input" value={status} onChange={(e) => setStatus(e.target.value)} disabled={!can(`/api/sales/invoices/${id}`, "PUT")}><option value="draft">draft</option><option value="sent">sent</option><option value="paid">paid</option><option value="overdue">overdue</option><option value="cancelled">cancelled</option></select></div>
          <div className="form-group"><label className="label">Payment Amount</label><input className="input" type="number" step="0.01" min="0" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} disabled={!can(`/api/sales/invoices/${id}/pay`, "POST") || paymentLocked} /></div>
          <div className="form-group"><label className="label">Payment Received By</label><select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={!can(`/api/sales/invoices/${id}/pay`, "POST") || paymentLocked}><option value="bank_transfer">Bank Transfer</option><option value="cheque">Cheque</option></select></div>
          <div className="form-group"><label className="label">Receive To Account</label><select className="input" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)} disabled={!can(`/api/sales/invoices/${id}/pay`, "POST") || paymentLocked}><option value="">Select account</option>{accounts.map((account) => (<option key={account.id} value={account.id}>{account.code} - {account.name}</option>))}</select></div>
        </div>
        {paymentLocked && <div className="alert-info">This invoice already has a recorded payment. Multiple payments are disabled.</div>}
        <div className="flex gap-3 flex-wrap"><button className="btn-primary" onClick={saveStatus} disabled={saving || !can(`/api/sales/invoices/${id}`, "PUT")}>{saving ? "Saving..." : "Save Status"}</button><button className="btn-secondary" onClick={pay} disabled={!can(`/api/sales/invoices/${id}/pay`, "POST") || Number(paymentAmount) <= 0 || !paymentAccountId || paymentLocked}>Record Payment Received</button></div>
      </section>
    </main>
  );
}
