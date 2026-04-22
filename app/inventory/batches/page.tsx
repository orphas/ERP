"use client";

import { useEffect, useState } from "react";

type Product = { id: number; name: string };
type Warehouse = { id: number; name: string };
type Batch = {
  id: number;
  batchNumber: string;
  quantity: number;
  availableQuantity: number;
  landedUnitCost: string;
  product: Product;
  warehouse: Warehouse;
};

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState({
    productId: "",
    warehouseId: "",
    batchNumber: "",
    quantity: "0",
    availableQuantity: "0",
    landedUnitCost: "0",
  });
  const [error, setError] = useState("");

  const load = async () => {
    const [b, p, w] = await Promise.all([
      fetch("/api/inventory/batches").then((r) => r.json()),
      fetch("/api/inventory/products").then((r) => r.json()),
      fetch("/api/inventory/warehouses").then((r) => r.json()),
    ]);
    setBatches(Array.isArray(b) ? b : []);
    setProducts(Array.isArray(p) ? p : []);
    setWarehouses(Array.isArray(w) ? w : []);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/inventory/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: Number(form.productId),
          warehouseId: Number(form.warehouseId),
          batchNumber: form.batchNumber,
          quantity: Number(form.quantity),
          availableQuantity: Number(form.availableQuantity),
          landedUnitCost: Number(form.landedUnitCost),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create batch" }));
        throw new Error(data.error || "Failed to create batch");
      }
      setForm({ productId: "", warehouseId: "", batchNumber: "", quantity: "0", availableQuantity: "0", landedUnitCost: "0" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create batch");
    }
  };

  return (
    <main className="space-y-6">
      <div className="page-header"><div><h1 className="page-title">Stock Batches</h1><p className="page-subtitle">Track lot-level inventory across products and warehouses.</p></div></div>

      <section className="card">
        {error && <div className="alert-error mb-4">{error}</div>}
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-3 items-end">
          <div className="form-group"><label className="label">Product</label><select className="input" value={form.productId} onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))} required><option value="">Select product</option>{products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div>
          <div className="form-group"><label className="label">Warehouse</label><select className="input" value={form.warehouseId} onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))} required><option value="">Select warehouse</option>{warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}</select></div>
          <div className="form-group"><label className="label">Batch Number</label><input className="input" value={form.batchNumber} onChange={(e) => setForm((p) => ({ ...p, batchNumber: e.target.value }))} required /></div>
          <div className="form-group"><label className="label">Qty</label><input className="input" type="number" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} required /></div>
          <div className="form-group"><label className="label">Available Qty</label><input className="input" type="number" value={form.availableQuantity} onChange={(e) => setForm((p) => ({ ...p, availableQuantity: e.target.value }))} required /></div>
          <div className="form-group"><label className="label">Landed Unit Cost</label><input className="input" type="number" step="0.01" value={form.landedUnitCost} onChange={(e) => setForm((p) => ({ ...p, landedUnitCost: e.target.value }))} required /></div>
          <button className="btn-primary md:col-span-3">Create Batch</button>
        </form>
      </section>

      <section className="card">
        <div className="table-wrap"><table className="table"><thead><tr><th>Batch</th><th>Product</th><th>Warehouse</th><th>Qty</th><th>Available</th><th>Cost</th></tr></thead><tbody>{batches.map((batch) => (<tr key={batch.id}><td className="font-medium">{batch.batchNumber}</td><td>{batch.product?.name || "-"}</td><td>{batch.warehouse?.name || "-"}</td><td>{batch.quantity}</td><td>{batch.availableQuantity}</td><td>{batch.landedUnitCost}</td></tr>))}</tbody></table></div>
      </section>
    </main>
  );
}
