"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthz } from "@/lib/useAuthz";

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
}

export default function CustomersList() {
  const { can } = useAuthz();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setActionError("");
      const res = await fetch("/api/sales/customers");
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Failed to fetch customers";
        throw new Error(message);
      }

      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching customers:", error);
      setCustomers([]);
      setActionError(error instanceof Error ? error.message : "Failed to fetch customers");
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      customer.name.toLowerCase().includes(query) ||
      customer.email.toLowerCase().includes(query) ||
      customer.phone.toLowerCase().includes(query);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? customer.isActive : !customer.isActive);
    return matchesSearch && matchesStatus;
  });

  const activeCount = filteredCustomers.filter((c) => c.isActive).length;

  const handleDelete = async (customer: Customer) => {
    const ok = window.confirm(`Delete customer ${customer.name}? Related quotations, sales orders, invoices, accounting entries, and dependent records will also be removed.`);
    if (!ok) return;
    const typed = window.prompt("Type DELETE to confirm permanent deletion", "");
    if ((typed || "").trim().toUpperCase() !== "DELETE") return;

    try {
      const res = await fetch(`/api/sales/customers/${customer.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Delete failed" }));
        throw new Error(data.error || "Delete failed");
      }
      await fetchCustomers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleEditSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCustomer) return;

    setSaving(true);
    setActionError("");

    try {
      const res = await fetch(`/api/sales/customers/${editingCustomer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingCustomer.name,
          email: editingCustomer.email,
          phone: editingCustomer.phone,
          isActive: editingCustomer.isActive,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Update failed" }));
        throw new Error(data.error || "Update failed");
      }

      setEditingCustomer(null);
      await fetchCustomers();
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
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Commercial relationships and account status</p>
        </div>
        {can("/api/sales/customers", "POST") ? (
          <Link href="/sales/customers/new" className="btn-primary">
            + Add Customer
          </Link>
        ) : (
          <button className="btn-secondary" disabled>
            + Add Customer
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-sm">
          <div className="stat-label">Filtered Customers</div>
          <div className="stat-value text-emerald-300">{filteredCustomers.length}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Active</div>
          <div className="stat-value text-cyan-300">{activeCount}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Inactive</div>
          <div className="stat-value text-rose-300">{filteredCustomers.length - activeCount}</div>
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
      ) : filteredCustomers.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 mb-4">No customers match your filters</p>
          <Link href="/sales/customers/new" className="text-blue-600 hover:underline">
            Add your first customer
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="card flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{customer.name}</h3>
                <div className="text-sm text-slate-400 space-y-1">
                  <p>Email: {customer.email || "-"}</p>
                  <p>Phone: {customer.phone || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`badge ${customer.isActive ? "badge-green" : "badge-red"}`}>
                  {customer.isActive ? "Active" : "Inactive"}
                </span>
                {can(`/api/sales/customers/${customer.id}`, "PUT") ? (
                  <button onClick={() => setEditingCustomer(customer)} className="text-cyan-300 hover:text-cyan-200">
                    Edit
                  </button>
                ) : (
                  <span className="text-slate-500">Edit</span>
                )}
                {can(`/api/sales/customers/${customer.id}`, "DELETE") ? (
                  <button onClick={() => handleDelete(customer)} className="text-red-300 hover:text-red-200">
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

      {editingCustomer && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="text-lg font-semibold text-white">Edit Customer</h2>
              <button className="btn-ghost btn-sm" onClick={() => setEditingCustomer(null)}>
                Close
              </button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="modal-body grid gap-4">
                <div className="form-group">
                  <label className="label">Name</label>
                  <input
                    className="input"
                    value={editingCustomer.name}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Email</label>
                    <input
                      className="input"
                      value={editingCustomer.email || ""}
                      onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Phone</label>
                    <input
                      className="input"
                      value={editingCustomer.phone || ""}
                      onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                    />
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingCustomer.isActive}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, isActive: e.target.checked })}
                  />
                  Active customer
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditingCustomer(null)}>
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
