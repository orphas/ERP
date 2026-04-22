"use client";

import { useEffect, useState } from "react";

type Warehouse = { id: number; name: string; code: string; zoneType: string; isActive: boolean };

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState({ name: "", code: "", zoneType: "main" });
  const [error, setError] = useState("");

  const load = async () => {
    const data = await fetch("/api/inventory/warehouses").then((r) => r.json());
    setWarehouses(Array.isArray(data) ? data : []);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/inventory/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create warehouse" }));
        throw new Error(data.error || "Failed to create warehouse");
      }
      setForm({ name: "", code: "", zoneType: "main" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create warehouse");
    }
  };

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Warehouses</h1>
          <p className="page-subtitle">Configure stock locations and operational zones.</p>
        </div>
      </div>

      <section className="card">
        {error && <div className="alert-error mb-4">{error}</div>}
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-4 items-end">
          <div className="form-group"><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required /></div>
          <div className="form-group"><label className="label">Code</label><input className="input" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} required /></div>
          <div className="form-group"><label className="label">Zone</label><select className="input" value={form.zoneType} onChange={(e) => setForm((p) => ({ ...p, zoneType: e.target.value }))}><option value="main">main</option><option value="transit">transit</option><option value="storage">storage</option><option value="returns">returns</option><option value="staging">staging</option></select></div>
          <button className="btn-primary">Add Warehouse</button>
        </form>
      </section>

      <section className="card">
        <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Code</th><th>Zone</th><th>Status</th></tr></thead><tbody>{warehouses.map((w) => (<tr key={w.id}><td className="font-medium">{w.name}</td><td>{w.code}</td><td>{w.zoneType}</td><td><span className={`badge ${w.isActive ? "badge-green" : "badge-slate"}`}>{w.isActive ? "active" : "inactive"}</span></td></tr>))}</tbody></table></div>
      </section>
    </main>
  );
}
