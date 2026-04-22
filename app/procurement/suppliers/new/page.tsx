"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UniversalActionBar, UniversalField, UniversalFormGrid, UniversalFormSection } from "@/components/ui/UniversalForm";

export default function NewSupplierPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    defaultCurrency: "MAD",
    ice: "",
    ifCode: "",
    rc: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/procurement/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create supplier" }));
        throw new Error(data.error || "Failed to create supplier");
      }

      router.push("/procurement/suppliers");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create supplier");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Add Supplier</h1>
          <p className="page-subtitle">Register a supplier for procurement and purchase order flows.</p>
        </div>
        <Link href="/procurement/suppliers" className="btn-secondary">Back to Suppliers</Link>
      </div>

      <UniversalFormSection
        title="Supplier Creation"
        description="Use the universal supplier form for procurement and third-party expenses."
        className="max-w-3xl"
      >
        {error && <div className="alert-error mb-4">{error}</div>}

        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <UniversalField label="Name" className="form-group md:col-span-2">
            <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          </UniversalField>
          <UniversalField label="Email">
            <input className="input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </UniversalField>
          <UniversalField label="Phone">
            <input className="input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </UniversalField>
          <UniversalField label="Default Currency">
            <select className="input" value={form.defaultCurrency} onChange={(e) => setForm((p) => ({ ...p, defaultCurrency: e.target.value }))}>
              <option value="MAD">MAD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </UniversalField>
          <UniversalField label="Address" className="form-group md:col-span-2">
            <textarea className="input min-h-24" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          </UniversalField>
          <UniversalField label="ICE">
            <input className="input" value={form.ice} onChange={(e) => setForm((p) => ({ ...p, ice: e.target.value }))} />
          </UniversalField>
          <UniversalField label="IF">
            <input className="input" value={form.ifCode} onChange={(e) => setForm((p) => ({ ...p, ifCode: e.target.value }))} />
          </UniversalField>
          <UniversalField label="RC">
            <input className="input" value={form.rc} onChange={(e) => setForm((p) => ({ ...p, rc: e.target.value }))} />
          </UniversalField>

          <UniversalActionBar className="md:col-span-2 flex gap-3">
            <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Create Supplier"}</button>
            <Link href="/procurement/suppliers" className="btn-secondary">Cancel</Link>
          </UniversalActionBar>
        </form>
      </UniversalFormSection>
    </main>
  );
}
