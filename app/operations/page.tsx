"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type OperationLog = {
  id: number;
  action: string;
  entityType: string;
  entityId?: number | null;
  details?: string | null;
  createdAt: string;
};

export default function OperationsPage() {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/operations/logs");
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) =>
      [log.action, log.entityType, log.details || "", String(log.entityId || "")]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [logs, query]);

  return (
    <main className="space-y-6">
      <section className="hero-panel">
        <div className="page-header mb-0">
          <div className="space-y-3">
            <p className="hero-kicker">Governance and control</p>
            <h1 className="hero-title md:text-4xl">Operations audit trail</h1>
            <p className="hero-copy">Track key ERP activities across sales, finance, procurement, HR, and settings, then run close-check routines from the same area.</p>
          </div>
        </div>
        <div className="mt-4">
          <Link href="/operations/period-close" className="btn-secondary">Monthly Close Checklist</Link>
        </div>
      </section>

      <section className="card">
        <div className="form-group">
          <label className="label">Search logs</label>
          <input className="input" placeholder="action, entity, reference..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </section>

      <section className="card">
        {loading ? (
          <p className="text-slate-400">Loading operations logs...</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>ID</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5}>No logs found.</td>
                  </tr>
                )}
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.action}</td>
                    <td>{log.entityType}</td>
                    <td>{log.entityId ?? "-"}</td>
                    <td>{log.details || "-"}</td>
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
