"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthz } from "@/lib/useAuthz";

type Account = { id: number; code: string; name: string; type: string };
type JournalLine = { id: number; accountId: number; type: "debit" | "credit"; amount: number };
type JournalEntry = {
  id: number;
  reference: string;
  date: string;
  journalType: string;
  description?: string;
  isPosted: boolean;
  lines: Array<{ id: number; type: string; amount: string; account: Account }>;
};

export default function JournalPage() {
  const { can } = useAuthz();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [journalType, setJournalType] = useState("general");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([
    { id: 1, accountId: 0, type: "debit", amount: 0 },
    { id: 2, accountId: 0, type: "credit", amount: 0 },
  ]);

  const load = async () => {
    try {
      const [accountsRes, entriesRes] = await Promise.all([
        fetch("/api/finance/accounts"),
        fetch("/api/finance/journal"),
      ]);
      const [accountsData, entriesData] = await Promise.all([accountsRes.json(), entriesRes.json()]);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setEntries(Array.isArray(entriesData) ? entriesData : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const debit = lines.filter((l) => l.type === "debit").reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const credit = lines.filter((l) => l.type === "credit").reduce((sum, l) => sum + Number(l.amount || 0), 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.000001 };
  }, [lines]);

  const addLine = () => {
    setLines((prev) => [...prev, { id: Date.now(), accountId: 0, type: "debit", amount: 0 }]);
  };

  const removeLine = (id: number) => {
    setLines((prev) => prev.filter((line) => line.id !== id));
  };

  const updateLine = (id: number, patch: Partial<JournalLine>) => {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const createEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can("/api/finance/journal", "POST")) return;
    setSaving(true);
    setError("");

    try {
      const payloadLines = lines
        .filter((line) => line.accountId > 0 && Number(line.amount) > 0)
        .map((line) => ({ accountId: line.accountId, type: line.type, amount: Number(line.amount) }));

      const res = await fetch("/api/finance/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalType, description, lines: payloadLines }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create journal entry" }));
        throw new Error(data.error || "Failed to create journal entry");
      }

      setDescription("");
      setLines([
        { id: 1, accountId: 0, type: "debit", amount: 0 },
        { id: 2, accountId: 0, type: "credit", amount: 0 },
      ]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create journal entry");
    } finally {
      setSaving(false);
    }
  };

  const postEntry = async (id: number) => {
    if (!can(`/api/finance/journal/${id}/post`, "POST")) return;
    try {
      const res = await fetch(`/api/finance/journal/${id}/post`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to post entry" }));
        throw new Error(data.error || "Failed to post entry");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post entry");
    }
  };

  const deleteEntry = async (id: number) => {
    if (!can(`/api/finance/journal/${id}`, "DELETE")) return;
    if (!window.confirm("Delete this journal entry? Account balances will be reversed automatically before deletion.")) return;
    const typed = window.prompt("Type DELETE to confirm permanent deletion", "");
    if ((typed || "").trim().toUpperCase() !== "DELETE") return;
    try {
      const res = await fetch(`/api/finance/journal/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to delete entry" }));
        throw new Error(data.error || "Failed to delete entry");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entry");
    }
  };

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Journal Entries</h1>
          <p className="page-subtitle">Create balanced entries and post them to account balances.</p>
        </div>
        <Link href="/finance/accounts" className="btn-secondary">
          Chart of Accounts
        </Link>
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">New Journal Entry</h2>
        {error && <div className="alert-error mb-4">{error}</div>}
        <form onSubmit={createEntry} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="form-group">
              <label className="label">Journal Type</label>
              <select className="input" value={journalType} onChange={(e) => setJournalType(e.target.value)}>
                <option value="general">general</option>
                <option value="sales">sales</option>
                <option value="purchases">purchases</option>
                <option value="bank">bank</option>
                <option value="cash">cash</option>
                <option value="payroll">payroll</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Description</label>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            {lines.map((line) => (
              <div key={line.id} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] items-end">
                <div className="form-group">
                  <label className="label">Account</label>
                  <select
                    className="input"
                    value={line.accountId || ""}
                    onChange={(e) => updateLine(line.id, { accountId: Number(e.target.value) })}
                  >
                    <option value="">Select account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Type</label>
                  <select
                    className="input"
                    value={line.type}
                    onChange={(e) => updateLine(line.id, { type: e.target.value as "debit" | "credit" })}
                  >
                    <option value="debit">debit</option>
                    <option value="credit">credit</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Amount</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.amount}
                    onChange={(e) => updateLine(line.id, { amount: Number(e.target.value || 0) })}
                  />
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => removeLine(line.id)}
                  disabled={!can("/api/finance/journal", "POST")}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              className="btn-secondary"
              onClick={addLine}
              disabled={!can("/api/finance/journal", "POST")}
            >
              + Add Line
            </button>
            <span className="text-sm text-slate-300">
              Debit: {totals.debit.toFixed(2)} | Credit: {totals.credit.toFixed(2)}
            </span>
            <span className={`badge ${totals.balanced ? "badge-green" : "badge-red"}`}>
              {totals.balanced ? "Balanced" : "Not balanced"}
            </span>
          </div>

          <button className="btn-primary" disabled={saving || !totals.balanced || !can("/api/finance/journal", "POST")}>
            {saving ? "Saving..." : "Create Journal Entry"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Journal Ledger</h2>
        {loading ? (
          <p className="text-slate-400">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-slate-400">No journal entries yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Lines</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="font-medium">
                      <Link href={`/finance/journal/${entry.id}`} className="text-cyan-300 hover:text-cyan-200">
                        {entry.reference}
                      </Link>
                    </td>
                    <td>{new Date(entry.date).toLocaleDateString()}</td>
                    <td>{entry.journalType}</td>
                    <td>{entry.lines.length}</td>
                    <td>
                      <span className={`badge ${entry.isPosted ? "badge-green" : "badge-amber"}`}>
                        {entry.isPosted ? "posted" : "draft"}
                      </span>
                    </td>
                    <td className="space-x-2 whitespace-nowrap">
                      {!entry.isPosted && can(`/api/finance/journal/${entry.id}/post`, "POST") && (
                        <button className="text-emerald-300 hover:text-emerald-200" onClick={() => postEntry(entry.id)}>
                          Post
                        </button>
                      )}
                      {!entry.isPosted && can(`/api/finance/journal/${entry.id}`, "DELETE") && (
                        <button className="text-red-300 hover:text-red-200" onClick={() => deleteEntry(entry.id)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
