"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthz } from "@/lib/useAuthz";

type Payroll = {
  id: number;
  month: string;
  status: string;
  baseSalary: string;
  bonuses: string;
  deductions: string;
  netPay: string;
  employee: {
    firstName: string;
    lastName: string;
    department?: string | null;
    position?: string | null;
  };
};

type FinanceAccount = {
  id: number;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
};

export default function PayrollDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuthz();
  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/hr/payroll/${id}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load payroll");
    }
    setPayroll(data);
  }, [id]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load payroll"));
  }, [load]);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const res = await fetch("/api/finance/accounts");
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) return;
        const assetAccounts = data.filter(
          (acc: FinanceAccount) => acc.type?.toLowerCase() === "asset" && acc.isActive !== false
        );
        setAccounts(assetAccounts);
        if (assetAccounts.length > 0) {
          setPaymentAccountId(String(assetAccounts[0].id));
        }
      } catch {
        // Keep page usable and let API return a clear message if account is missing
      }
    };
    loadAccounts();
  }, []);

  const approve = async () => {
    if (!can(`/api/hr/payroll/${id}/approve`, "POST")) return;
    try {
      const res = await fetch(`/api/hr/payroll/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to approve payroll");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve payroll");
    }
  };

  const pay = async () => {
    if (!can(`/api/hr/payroll/${id}/pay`, "POST")) return;
    if (!paymentAccountId) {
      setError("Please select the account used to pay payroll.");
      return;
    }
    try {
      const res = await fetch(`/api/hr/payroll/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          paymentAccountId: Number(paymentAccountId),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to mark payroll as paid" }));
        throw new Error(data.error || "Failed to mark payroll as paid");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark payroll as paid");
    }
  };

  const remaining = useMemo(() => {
    if (!payroll) return 0;
    return Number(payroll.baseSalary) + Number(payroll.bonuses) - Number(payroll.deductions);
  }, [payroll]);

  if (!payroll) {
    return <main className="card">Loading payroll...</main>;
  }

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payroll #{payroll.id}</h1>
          <p className="page-subtitle">
            {payroll.employee.firstName} {payroll.employee.lastName} - {new Date(payroll.month).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/print/payroll/${payroll.id}?lang=en`} target="_blank" rel="noreferrer" className="btn-secondary">Print EN</a>
          <a href={`/api/print/payroll/${payroll.id}?lang=fr`} target="_blank" rel="noreferrer" className="btn-secondary">Print FR</a>
          <Link href="/hr/payroll" className="btn-secondary">Back to Payroll</Link>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <section className="card grid gap-4 md:grid-cols-4">
        <div><div className="stat-label">Status</div><span className={`badge ${payroll.status === "paid" ? "badge-green" : payroll.status === "approved" ? "badge-blue" : "badge-amber"}`}>{payroll.status}</span></div>
        <div><div className="stat-label">Department</div><div>{payroll.employee.department || "-"}</div></div>
        <div><div className="stat-label">Position</div><div>{payroll.employee.position || "-"}</div></div>
        <div><div className="stat-label">Net Pay</div><div className="text-emerald-300 font-semibold">{remaining.toFixed(2)}</div></div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Payroll Breakdown</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Base Salary</td><td>{Number(payroll.baseSalary).toFixed(2)}</td></tr>
              <tr><td>Bonuses</td><td>{Number(payroll.bonuses).toFixed(2)}</td></tr>
              <tr><td>Deductions</td><td>-{Number(payroll.deductions).toFixed(2)}</td></tr>
              <tr><td className="font-semibold">Net Pay</td><td className="font-semibold text-emerald-300">{remaining.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-3">Actions</h2>
        {payroll.status === "approved" && (
          <div className="grid gap-4 md:grid-cols-2 mb-4">
            <div className="form-group">
              <label className="label">Payment Method</label>
              <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Paid From Account</label>
              <select className="input" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="flex gap-3 flex-wrap">
          {payroll.status === "draft" && (
            <button className="btn-primary" onClick={approve} disabled={!can(`/api/hr/payroll/${id}/approve`, "POST")}>Approve Payroll</button>
          )}
          {payroll.status === "approved" && (
            <button className="btn-secondary" onClick={pay} disabled={!can(`/api/hr/payroll/${id}/pay`, "POST") || !paymentAccountId}>Mark Payroll as Paid</button>
          )}
        </div>
      </section>
    </main>
  );
}
