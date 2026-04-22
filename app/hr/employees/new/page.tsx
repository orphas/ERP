"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewEmployeePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    position: "",
    department: "",
    salary: "0",
    hireDate: new Date().toISOString().slice(0, 10),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          salary: Number(form.salary || 0),
          hireDate: new Date(form.hireDate),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create employee" }));
        throw new Error(data.error || "Failed to create employee");
      }

      router.push("/hr/employees");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create employee");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Add Employee</h1>
          <p className="page-subtitle">Create a new employee profile for HR and payroll.</p>
        </div>
        <Link href="/hr/employees" className="btn-secondary">
          Back to Employees
        </Link>
      </div>

      <section className="card max-w-3xl">
        {error && <div className="alert-error mb-4">{error}</div>}

        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="form-group">
            <label className="label">First Name</label>
            <input className="input" value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="label">Last Name</label>
            <input className="input" value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">Position</label>
            <input className="input" value={form.position} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">Department</label>
            <input className="input" value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">Salary (MAD)</label>
            <input type="number" step="0.01" className="input" value={form.salary} onChange={(e) => setForm((p) => ({ ...p, salary: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="label">Hire Date</label>
            <input type="date" className="input" value={form.hireDate} onChange={(e) => setForm((p) => ({ ...p, hireDate: e.target.value }))} required />
          </div>

          <div className="md:col-span-2 flex gap-3">
            <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Create Employee"}</button>
            <Link href="/hr/employees" className="btn-secondary">Cancel</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
