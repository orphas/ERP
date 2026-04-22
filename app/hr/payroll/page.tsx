"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthz } from "@/lib/useAuthz";

type Employee = { id: number; firstName: string; lastName: string; salary: string };
type Payroll = {
  id: number;
  month: string;
  baseSalary: string;
  bonuses: string;
  deductions: string;
  netPay: string;
  status: string;
  employee: Employee;
};

export default function PayrollPage() {
  const { can } = useAuthz();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [baseSalary, setBaseSalary] = useState("0");
  const [bonuses, setBonuses] = useState("0");
  const [deductions, setDeductions] = useState("0");
  const [error, setError] = useState("");

  const load = async () => {
    const [payrollData, employeeData] = await Promise.all([
      fetch("/api/hr/payroll").then((r) => r.json()),
      fetch("/api/hr/employees").then((r) => r.json()),
    ]);

    setPayrolls(Array.isArray(payrollData) ? payrollData : []);
    setEmployees(Array.isArray(employeeData) ? employeeData : []);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const employee = employees.find((e) => e.id === Number(employeeId));
    if (employee) {
      setBaseSalary(String(Number(employee.salary || 0)));
    }
  }, [employeeId, employees]);

  const createPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can("/api/hr/payroll", "POST")) return;
    setError("");

    try {
      const res = await fetch("/api/hr/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: Number(employeeId),
          month: `${month}-01`,
          baseSalary: Number(baseSalary),
          bonuses: Number(bonuses),
          deductions: Number(deductions),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create payroll" }));
        throw new Error(data.error || "Failed to create payroll");
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payroll");
    }
  };

  const approve = async (id: number) => {
    if (!can(`/api/hr/payroll/${id}/approve`, "POST")) return;
    try {
      const res = await fetch(`/api/hr/payroll/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to approve payroll");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve payroll");
    }
  };

  const pay = async (id: number) => {
    if (!can(`/api/hr/payroll/${id}/pay`, "POST")) return;
    try {
      const res = await fetch(`/api/hr/payroll/${id}/pay`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to pay payroll");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pay payroll");
    }
  };

  return (
    <main className="space-y-6">
      <div className="page-header"><div><h1 className="page-title">Payroll</h1><p className="page-subtitle">Generate monthly payroll, approve runs, and mark payments.</p></div></div>

      <section className="card">
        {error && <div className="alert-error mb-4">{error}</div>}
        <form onSubmit={createPayroll} className="grid gap-3 md:grid-cols-5 items-end">
          <div className="form-group md:col-span-2"><label className="label">Employee</label><select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required><option value="">Select employee</option>{employees.map((employee) => (<option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>))}</select></div>
          <div className="form-group"><label className="label">Month</label><input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} required /></div>
          <div className="form-group"><label className="label">Base</label><input className="input" type="number" step="0.01" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} required /></div>
          <div className="form-group"><label className="label">Bonus</label><input className="input" type="number" step="0.01" value={bonuses} onChange={(e) => setBonuses(e.target.value)} /></div>
          <div className="form-group"><label className="label">Deductions</label><input className="input" type="number" step="0.01" value={deductions} onChange={(e) => setDeductions(e.target.value)} /></div>
          <button className="btn-primary md:col-span-5" disabled={!can("/api/hr/payroll", "POST")}>
            Create Payroll
          </button>
        </form>
      </section>

      <section className="card">
        <div className="table-wrap"><table className="table"><thead><tr><th>Employee</th><th>Month</th><th>Net Pay</th><th>Status</th><th>Actions</th></tr></thead><tbody>{payrolls.map((payroll) => (<tr key={payroll.id}><td className="font-medium">{payroll.employee?.firstName} {payroll.employee?.lastName}</td><td>{new Date(payroll.month).toLocaleDateString()}</td><td>{payroll.netPay}</td><td><span className={`badge ${payroll.status === "paid" ? "badge-green" : payroll.status === "approved" ? "badge-blue" : "badge-amber"}`}>{payroll.status}</span></td><td className="space-x-2 whitespace-nowrap"><Link href={`/hr/payroll/${payroll.id}`} className="text-slate-300 hover:text-white">View</Link>{payroll.status === "draft" && can(`/api/hr/payroll/${payroll.id}/approve`, "POST") && <button className="text-cyan-300 hover:text-cyan-200" onClick={() => approve(payroll.id)}>Approve</button>}{payroll.status === "approved" && can(`/api/hr/payroll/${payroll.id}/pay`, "POST") && <button className="text-emerald-300 hover:text-emerald-200" onClick={() => pay(payroll.id)}>Mark Paid</button>}</td></tr>))}</tbody></table></div>
      </section>
    </main>
  );
}
