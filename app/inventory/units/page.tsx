"use client";

import { useEffect, useState } from "react";

type Unit = { id: number; name: string; code: string; createdAt: string };

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const data = await fetch("/api/inventory/units").then((r) => r.json());
    setUnits(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/inventory/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create unit" }));
        throw new Error(data.error || "Failed to create unit");
      }

      setName("");
      setCode("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create unit");
    }
  };

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Units of Measure</h1>
          <p className="page-subtitle">Manage product units used across inventory and transactions.</p>
        </div>
      </div>

      <section className="card">
        {error && <div className="alert-error mb-4">{error}</div>}
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-3 items-end">
          <div className="form-group">
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="label">Code</label>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <button className="btn-primary">Add Unit</button>
        </form>
      </section>

      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Code</th><th>Created</th></tr></thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}</td>
                  <td>{u.code}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
