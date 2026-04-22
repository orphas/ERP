"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthz } from "@/lib/useAuthz";

type JournalLine = {
  id: number;
  type: "debit" | "credit";
  amount: string;
  description?: string | null;
  account: { id: number; code: string; name: string };
};

type JournalEntry = {
  id: number;
  reference: string;
  date: string;
  journalType: string;
  description?: string | null;
  isPosted: boolean;
  lines: JournalLine[];
};

export default function JournalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuthz();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/finance/journal/${id}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load journal entry");
    }
    setEntry(data);
  }, [id]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load journal entry"));
  }, [load]);

  const totals = useMemo(() => {
    if (!entry) return { debit: 0, credit: 0 };
    return entry.lines.reduce(
      (acc, line) => {
        const amount = Number(line.amount || 0);
        if (line.type === "debit") acc.debit += amount;
        if (line.type === "credit") acc.credit += amount;
        return acc;
      },
      { debit: 0, credit: 0 }
    );
  }, [entry]);

  const postEntry = async () => {
    if (!can(`/api/finance/journal/${id}/post`, "POST")) return;
    try {
      const res = await fetch(`/api/finance/journal/${id}/post`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to post journal entry" }));
        throw new Error(data.error || "Failed to post journal entry");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post journal entry");
    }
  };

  if (!entry) {
    return <main className="card">Loading journal entry...</main>;
  }

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Journal Entry {entry.reference}</h1>
          <p className="page-subtitle">Type: {entry.journalType}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/print/journal/${entry.id}?lang=en`} target="_blank" rel="noreferrer" className="btn-secondary">Print EN</a>
          <a href={`/api/print/journal/${entry.id}?lang=fr`} target="_blank" rel="noreferrer" className="btn-secondary">Print FR</a>
          <Link href="/finance/journal" className="btn-secondary">Back to Journal</Link>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <section className="card grid gap-4 md:grid-cols-4">
        <div><div className="stat-label">Date</div><div>{new Date(entry.date).toLocaleDateString()}</div></div>
        <div><div className="stat-label">Status</div><span className={`badge ${entry.isPosted ? "badge-green" : "badge-amber"}`}>{entry.isPosted ? "posted" : "draft"}</span></div>
        <div><div className="stat-label">Debit</div><div>{totals.debit.toFixed(2)}</div></div>
        <div><div className="stat-label">Credit</div><div>{totals.credit.toFixed(2)}</div></div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Line Items</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {entry.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.account.code} - {line.account.name}</td>
                  <td>{line.type}</td>
                  <td>{Number(line.amount).toFixed(2)}</td>
                  <td>{line.description || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!entry.isPosted && (
        <section className="card">
          <h2 className="text-lg font-semibold text-white mb-3">Actions</h2>
          <button className="btn-primary" onClick={postEntry} disabled={!can(`/api/finance/journal/${id}/post`, "POST")}>Post Journal Entry</button>
        </section>
      )}
    </main>
  );
}
