"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type CloseRecord = {
  month: string;
  financeClosed: boolean;
  inventoryClosed: boolean;
  hrClosed: boolean;
  salesClosed: boolean;
  procurementClosed: boolean;
  notes?: string | null;
};

const monthNow = new Date().toISOString().slice(0, 7);

export default function PeriodClosePage() {
  const [month, setMonth] = useState(monthNow);
  const [record, setRecord] = useState<CloseRecord>({
    month: `${monthNow}-01`,
    financeClosed: false,
    inventoryClosed: false,
    hrClosed: false,
    salesClosed: false,
    procurementClosed: false,
    notes: "",
  });
  const [history, setHistory] = useState<CloseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [currentRes, historyRes] = await Promise.all([
        fetch(`/api/operations/period-close?month=${month}-01`),
        fetch("/api/operations/period-close"),
      ]);
      const current = await currentRes.json();
      const historyData = await historyRes.json();

      setRecord(
        current || {
          month: `${month}-01`,
          financeClosed: false,
          inventoryClosed: false,
          hrClosed: false,
          salesClosed: false,
          procurementClosed: false,
          notes: "",
        }
      );
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch {
      setError("Could not load period close checklist.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (key: keyof CloseRecord) => {
    setRecord((prev) => ({ ...prev, [key]: !prev[key as keyof CloseRecord] } as CloseRecord));
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/operations/period-close", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...record,
          month: `${month}-01`,
          closedByRole: "manager",
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(payload.error || "Save failed");
      }
      setMessage("Period close checklist saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-6">
      <section className="card">
        <div className="page-header mb-0">
          <div>
            <h1 className="page-title">Monthly Close Checklist</h1>
            <p className="page-subtitle">Lock modules after monthly close to prevent late transactional changes.</p>
          </div>
          <Link href="/operations" className="btn-secondary">Back to Operations</Link>
        </div>
      </section>

      <section className="card space-y-4">
        <div className="form-group max-w-xs">
          <label className="label">Accounting Month</label>
          <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>

        {loading ? (
          <p className="text-slate-400">Loading period checklist...</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="card-sm flex items-center justify-between">
              <span>Finance Closed</span>
              <input type="checkbox" checked={record.financeClosed} onChange={() => toggle("financeClosed")} />
            </label>
            <label className="card-sm flex items-center justify-between">
              <span>Inventory Closed</span>
              <input type="checkbox" checked={record.inventoryClosed} onChange={() => toggle("inventoryClosed")} />
            </label>
            <label className="card-sm flex items-center justify-between">
              <span>HR Closed</span>
              <input type="checkbox" checked={record.hrClosed} onChange={() => toggle("hrClosed")} />
            </label>
            <label className="card-sm flex items-center justify-between">
              <span>Sales Closed</span>
              <input type="checkbox" checked={record.salesClosed} onChange={() => toggle("salesClosed")} />
            </label>
            <label className="card-sm flex items-center justify-between">
              <span>Procurement Closed</span>
              <input type="checkbox" checked={record.procurementClosed} onChange={() => toggle("procurementClosed")} />
            </label>
          </div>
        )}

        <div className="form-group">
          <label className="label">Close Notes</label>
          <textarea
            className="input min-h-24"
            value={record.notes || ""}
            onChange={(e) => setRecord((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Month-end remarks, reconciliation notes, unresolved items..."
          />
        </div>

        {message && <div className="alert-success">{message}</div>}
        {error && <div className="alert-error">{error}</div>}

        <button type="button" className="btn-primary" onClick={save} disabled={saving || loading}>
          {saving ? "Saving..." : "Save Monthly Close"}
        </button>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Months</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Finance</th>
                <th>Inventory</th>
                <th>HR</th>
                <th>Sales</th>
                <th>Procurement</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={6}>No close records yet.</td>
                </tr>
              )}
              {history.map((item) => (
                <tr key={item.month}>
                  <td>{String(item.month).slice(0, 7)}</td>
                  <td>{item.financeClosed ? "Closed" : "Open"}</td>
                  <td>{item.inventoryClosed ? "Closed" : "Open"}</td>
                  <td>{item.hrClosed ? "Closed" : "Open"}</td>
                  <td>{item.salesClosed ? "Closed" : "Open"}</td>
                  <td>{item.procurementClosed ? "Closed" : "Open"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
