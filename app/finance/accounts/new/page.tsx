"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthz } from "@/lib/useAuthz";

export default function NewAccountPage() {
  const { can } = useAuthz();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "asset",
    accountClass: "",
    balance: "0",
    description: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can("/api/finance/accounts", "POST")) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/finance/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          type: form.type,
          accountClass: form.accountClass || undefined,
          balance: Number(form.balance || 0),
          description: form.description || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create account" }));
        throw new Error(data.error || "Failed to create account");
      }

      router.push("/finance/accounts");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Add Account</h1>
          <p className="page-subtitle">Create a finance account for journal posting and reporting.</p>
        </div>
        <Link href="/finance/accounts" className="btn-secondary">
          Back to Accounts
        </Link>
      </div>

      <section className="card max-w-3xl">
        {!can("/api/finance/accounts", "POST") && (
          <div className="alert-warning mb-4">Your role has read-only access to finance accounts.</div>
        )}
        {error && <div className="alert-error mb-4">{error}</div>}

        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="form-group">
            <label className="label">Code</label>
            <input
              className="input"
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
              placeholder="e.g. 701100"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Type</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
            >
              <option value="asset">asset</option>
              <option value="liability">liability</option>
              <option value="equity">equity</option>
              <option value="income">income</option>
              <option value="expense">expense</option>
            </select>
          </div>

          <div className="form-group md:col-span-2">
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Account name"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Account Class</label>
            <input
              className="input"
              value={form.accountClass}
              onChange={(e) => setForm((prev) => ({ ...prev, accountClass: e.target.value }))}
              placeholder="1-7"
            />
          </div>

          <div className="form-group">
            <label className="label">Opening Balance</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={form.balance}
              onChange={(e) => setForm((prev) => ({ ...prev, balance: e.target.value }))}
            />
          </div>

          <div className="form-group md:col-span-2">
            <label className="label">Description</label>
            <textarea
              className="input min-h-24"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="md:col-span-2 flex gap-3">
            <button className="btn-primary" disabled={saving || !can("/api/finance/accounts", "POST")}>
              {saving ? "Saving..." : "Create Account"}
            </button>
            <Link href="/finance/accounts" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
