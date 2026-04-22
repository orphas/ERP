"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthz } from "@/lib/useAuthz";

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  balance: string;
  isActive: boolean;
}

export default function AccountsList() {
  const { can } = useAuthz();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setActionError("");
      const res = await fetch("/api/finance/accounts");
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Failed to fetch accounts";
        throw new Error(message);
      }

      setAccounts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      setAccounts([]);
      setActionError(error instanceof Error ? error.message : "Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  };

  const typeColors: Record<string, string> = {
    asset: "badge-blue",
    liability: "badge-red",
    equity: "badge-purple",
    income: "badge-green",
    expense: "badge-amber",
  };

  const accountTypes = Array.from(new Set(accounts.map((a) => a.type).filter(Boolean)));

  const filteredAccounts = accounts.filter((account) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      account.code.toLowerCase().includes(query) ||
      account.name.toLowerCase().includes(query);
    const matchesType = typeFilter === "all" || account.type === typeFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? account.isActive : !account.isActive);
    return matchesSearch && matchesType && matchesStatus;
  });

  const activeCount = filteredAccounts.filter((a) => a.isActive).length;

  const handleDelete = async (account: Account) => {
    if (!can(`/api/finance/accounts/${account.id}`, "DELETE")) return;
    const ok = window.confirm(`Delete account ${account.code} - ${account.name}? This action may also remove linked accounting records and dependent transactions.`);
    if (!ok) return;
    const typed = window.prompt("Type DELETE to confirm permanent deletion", "");
    if ((typed || "").trim().toUpperCase() !== "DELETE") return;

    try {
      const res = await fetch(`/api/finance/accounts/${account.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Delete failed" }));
        throw new Error(data.error || "Delete failed");
      }
      await fetchAccounts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleEditSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingAccount) return;

    setSaving(true);
    setActionError("");

    try {
      const res = await fetch(`/api/finance/accounts/${editingAccount.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editingAccount.code,
          name: editingAccount.name,
          type: editingAccount.type,
          isActive: editingAccount.isActive,
          balance: Number(editingAccount.balance),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Update failed" }));
        throw new Error(data.error || "Update failed");
      }

      setEditingAccount(null);
      await fetchAccounts();
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
          <h1 className="page-title">Chart of Accounts</h1>
          <p className="page-subtitle">Filter by type and status for faster journal preparation</p>
        </div>
        {can("/api/finance/accounts", "POST") ? (
          <Link href="/finance/accounts/new" className="btn-primary">
            + Add Account
          </Link>
        ) : (
          <button className="btn-secondary" disabled>
            + Add Account
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-sm">
          <div className="stat-label">Filtered Accounts</div>
          <div className="stat-value text-violet-300">{filteredAccounts.length}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Active</div>
          <div className="stat-value text-emerald-300">{activeCount}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Inactive</div>
          <div className="stat-value text-slate-300">{filteredAccounts.length - activeCount}</div>
        </div>
      </div>

      <div className="card-sm grid gap-3 md:grid-cols-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by account code or name"
          className="input-sm"
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-sm">
          <option value="all">All types</option>
          {accountTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-sm">
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
      </div>

      {actionError && <div className="alert-error">{actionError}</div>}

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : filteredAccounts.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 mb-4">No accounts match your filters</p>
          {can("/api/finance/accounts", "POST") ? (
            <Link href="/finance/accounts/new" className="text-blue-600 hover:underline">
              Create your chart of accounts
            </Link>
          ) : (
            <span className="text-slate-500">Write access required to add accounts.</span>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Name</th>
                <th>Type</th>
                <th>Balance (MAD)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => (
                <tr key={account.id}>
                  <td className="font-mono font-bold">{account.code}</td>
                  <td className="font-medium">{account.name}</td>
                  <td>
                    <span className={`badge ${typeColors[account.type] || "badge-slate"}`}>{account.type}</span>
                  </td>
                  <td className="font-semibold">{account.balance}</td>
                  <td>
                    <span className={`badge ${account.isActive ? "badge-green" : "badge-slate"}`}>
                      {account.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="space-x-3 whitespace-nowrap">
                    {can(`/api/finance/accounts/${account.id}`, "PUT") ? (
                      <button onClick={() => setEditingAccount(account)} className="text-cyan-300 hover:text-cyan-200">
                        Edit
                      </button>
                    ) : (
                      <span className="text-slate-500">Edit</span>
                    )}
                    {can(`/api/finance/accounts/${account.id}`, "DELETE") ? (
                      <button onClick={() => handleDelete(account)} className="text-red-300 hover:text-red-200">
                        Delete
                      </button>
                    ) : (
                      <span className="text-slate-500">Delete</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingAccount && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="text-lg font-semibold text-white">Edit Account</h2>
              <button className="btn-ghost btn-sm" onClick={() => setEditingAccount(null)}>
                Close
              </button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="modal-body grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Code</label>
                    <input
                      className="input"
                      value={editingAccount.code}
                      onChange={(e) => setEditingAccount({ ...editingAccount, code: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Type</label>
                    <select
                      className="input"
                      value={editingAccount.type}
                      onChange={(e) => setEditingAccount({ ...editingAccount, type: e.target.value })}
                    >
                      <option value="asset">asset</option>
                      <option value="liability">liability</option>
                      <option value="equity">equity</option>
                      <option value="income">income</option>
                      <option value="expense">expense</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Name</label>
                  <input
                    className="input"
                    value={editingAccount.name}
                    onChange={(e) => setEditingAccount({ ...editingAccount, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label">Balance</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={editingAccount.balance}
                    onChange={(e) => setEditingAccount({ ...editingAccount, balance: e.target.value })}
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingAccount.isActive}
                    onChange={(e) => setEditingAccount({ ...editingAccount, isActive: e.target.checked })}
                  />
                  Active account
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditingAccount(null)}>
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
