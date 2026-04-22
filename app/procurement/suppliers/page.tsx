"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthz } from "@/lib/useAuthz";

interface Supplier {
  id: number;
  name: string;
  email: string;
  phone: string;
  defaultCurrency: string;
  isActive: boolean;
}

export default function SuppliersList() {
  const { can } = useAuthz();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setActionError("");
      const res = await fetch("/api/procurement/suppliers");
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Failed to fetch suppliers";
        throw new Error(message);
      }

      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      setSuppliers([]);
      setActionError(error instanceof Error ? error.message : "Failed to fetch suppliers");
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      supplier.name.toLowerCase().includes(query) ||
      supplier.email.toLowerCase().includes(query) ||
      supplier.phone.toLowerCase().includes(query);
    const matchesStatus =
      statusFilter === "all" || (statusFilter === "active" ? supplier.isActive : !supplier.isActive);
    return matchesSearch && matchesStatus;
  });

  const activeCount = filteredSuppliers.filter((s) => s.isActive).length;

  const handleDelete = async (supplier: Supplier) => {
    const ok = window.confirm(`Delete supplier ${supplier.name}? Related purchase orders, accounting entries, and dependent records will also be removed.`);
    if (!ok) return;
    const typed = window.prompt("Type DELETE to confirm permanent deletion", "");
    if ((typed || "").trim().toUpperCase() !== "DELETE") return;

    try {
      const res = await fetch(`/api/procurement/suppliers/${supplier.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Delete failed" }));
        throw new Error(data.error || "Delete failed");
      }
      await fetchSuppliers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleEditSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingSupplier) return;

    setSaving(true);
    setActionError("");

    try {
      const res = await fetch(`/api/procurement/suppliers/${editingSupplier.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingSupplier.name,
          email: editingSupplier.email,
          phone: editingSupplier.phone,
          defaultCurrency: editingSupplier.defaultCurrency,
          isActive: editingSupplier.isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Update failed" }));
        throw new Error(data.error || "Update failed");
      }

      setEditingSupplier(null);
      await fetchSuppliers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">Vendor registry with fast search and active vendor tracking</p>
        </div>
        {can("/api/procurement/suppliers", "POST") ? (
          <Link href="/procurement/suppliers/new" className="btn-primary">
            + Add Supplier
          </Link>
        ) : (
          <button className="btn-secondary" disabled>
            + Add Supplier
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-sm">
          <div className="stat-label">Filtered Suppliers</div>
          <div className="stat-value text-rose-300">{filteredSuppliers.length}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Active</div>
          <div className="stat-value text-emerald-300">{activeCount}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Inactive</div>
          <div className="stat-value text-slate-300">{filteredSuppliers.length - activeCount}</div>
        </div>
      </div>

      <div className="card-sm grid gap-3 md:grid-cols-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or phone"
          className="input-sm"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-sm">
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
      </div>

      {actionError && <div className="alert-error">{actionError}</div>}

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : filteredSuppliers.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 mb-4">No suppliers match your filters</p>
          <Link href="/procurement/suppliers/new" className="text-blue-600 hover:underline">
            Add your first supplier
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredSuppliers.map((supplier) => (
            <div key={supplier.id} className="card flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{supplier.name}</h3>
                <div className="text-sm text-slate-400 space-y-1">
                  <p>Email: {supplier.email || "-"}</p>
                  <p>Phone: {supplier.phone || "-"}</p>
                  <p>Default Currency: {supplier.defaultCurrency || "MAD"}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`badge ${supplier.isActive ? "badge-green" : "badge-red"}`}>
                  {supplier.isActive ? "Active" : "Inactive"}
                </span>
                {can(`/api/procurement/suppliers/${supplier.id}`, "PUT") ? (
                  <button onClick={() => setEditingSupplier(supplier)} className="text-cyan-300 hover:text-cyan-200">
                    Edit
                  </button>
                ) : (
                  <span className="text-slate-500">Edit</span>
                )}
                {can(`/api/procurement/suppliers/${supplier.id}`, "DELETE") ? (
                  <button onClick={() => handleDelete(supplier)} className="text-red-300 hover:text-red-200">
                    Delete
                  </button>
                ) : (
                  <span className="text-slate-500">Delete</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingSupplier && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="text-lg font-semibold text-white">Edit Supplier</h2>
              <button className="btn-ghost btn-sm" onClick={() => setEditingSupplier(null)}>
                Close
              </button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="modal-body grid gap-4">
                <div className="form-group">
                  <label className="label">Name</label>
                  <input
                    className="input"
                    value={editingSupplier.name}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Email</label>
                    <input
                      className="input"
                      value={editingSupplier.email || ""}
                      onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Phone</label>
                    <input
                      className="input"
                      value={editingSupplier.phone || ""}
                      onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Default Currency</label>
                  <select
                    className="input"
                    value={editingSupplier.defaultCurrency || "MAD"}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, defaultCurrency: e.target.value })}
                  >
                    <option value="MAD">MAD</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingSupplier.isActive}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, isActive: e.target.checked })}
                  />
                  Active supplier
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditingSupplier(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
