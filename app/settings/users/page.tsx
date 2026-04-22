"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Role = "admin" | "manager" | "staff";

type ManagedUser = {
  id: number;
  username: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type UserForm = {
  username: string;
  name: string;
  role: Role;
  password: string;
  isActive: boolean;
};

const defaultForm: UserForm = {
  username: "",
  name: "",
  role: "staff",
  password: "",
  isActive: true,
};

export default function SettingsUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState<UserForm>(defaultForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/users", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to load users");
      }
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
  };

  const setValue = <K extends keyof UserForm>(key: K, value: UserForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const url = editingId ? `/api/settings/users/${editingId}` : "/api/settings/users";
      const method = editingId ? "PUT" : "POST";
      const payload = {
        username: form.username,
        name: form.name,
        role: form.role,
        isActive: form.isActive,
        ...(form.password ? { password: form.password } : {}),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save user");
      }

      setMessage(editingId ? "User updated." : "User created.");
      resetForm();
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (user: ManagedUser) => {
    setEditingId(user.id);
    setForm({
      username: user.username,
      name: user.name,
      role: user.role,
      password: "",
      isActive: user.isActive,
    });
    setMessage("");
    setError("");
  };

  const handleDelete = async (user: ManagedUser) => {
    const confirmed = window.confirm(`Delete user ${user.username}?`);
    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/settings/users/${user.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete user");
      }
      setMessage(`User ${user.username} deleted.`);
      if (editingId === user.id) {
        resetForm();
      }
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  return (
    <main className="space-y-6">
      <section className="card">
        <div className="page-header mb-0 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="page-title">User Access</h1>
            <p className="page-subtitle">Admin-managed credentials, role assignment, and account activation.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/settings" className="btn-secondary btn-sm">
              Back to Settings
            </Link>
            <Link href="/settings/data-exchange" className="btn-secondary btn-sm">
              Data Exchange
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{editingId ? "Edit User" : "Create User"}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Admin accounts can access every page and API. Managers and staff remain role-limited.
            </p>
          </div>

          <div className="form-group">
            <label className="label">Full Name</label>
            <input className="input" value={form.name} onChange={(e) => setValue("name", e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="label">Username</label>
            <input className="input" value={form.username} onChange={(e) => setValue("username", e.target.value)} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="form-group">
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={(e) => setValue("role", e.target.value as Role)}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
              </select>
            </div>

            <div className="form-group">
              <label className="label">Password {editingId ? "(leave blank to keep current)" : ""}</label>
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => setValue("password", e.target.value)}
                required={!editingId}
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setValue("isActive", e.target.checked)} />
            Account is active
          </label>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update User" : "Create User"}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={resetForm} disabled={saving}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        <section className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Current Users</h2>
            <p className="mt-1 text-sm text-slate-400">Use this list to rotate passwords, disable access, or promote users.</p>
          </div>

          {loading ? (
            <div className="alert-info">Loading users...</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.username}</td>
                      <td className="capitalize">{user.role}</td>
                      <td>{user.isActive ? "Active" : "Inactive"}</td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="btn-secondary btn-sm" onClick={() => startEdit(user)}>
                            Edit
                          </button>
                          <button type="button" className="btn-secondary btn-sm" onClick={() => handleDelete(user)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {message && <div className="alert-success">{message}</div>}
        {error && <div className="alert-error">{error}</div>}
      </section>
    </main>
  );
}