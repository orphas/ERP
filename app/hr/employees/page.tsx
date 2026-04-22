"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthz } from "@/lib/useAuthz";

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  department: string;
  salary: string;
  isActive: boolean;
}

export default function EmployeesList() {
  const { can } = useAuthz();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setActionError("");
      const res = await fetch("/api/hr/employees");
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Failed to fetch employees";
        throw new Error(message);
      }

      setEmployees(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching employees:", error);
      setEmployees([]);
      setActionError(error instanceof Error ? error.message : "Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  };

  const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));

  const filteredEmployees = employees.filter((emp) => {
    const query = search.trim().toLowerCase();
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    const matchesSearch =
      !query ||
      fullName.includes(query) ||
      emp.email.toLowerCase().includes(query) ||
      (emp.position || "").toLowerCase().includes(query);
    const matchesDepartment =
      departmentFilter === "all" || (emp.department || "") === departmentFilter;
    const matchesStatus =
      statusFilter === "all" || (statusFilter === "active" ? emp.isActive : !emp.isActive);
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const activeCount = filteredEmployees.filter((e) => e.isActive).length;

  const handleDelete = async (employee: Employee) => {
    const ok = window.confirm(`Delete employee ${employee.firstName} ${employee.lastName}? Payroll history and linked records will also be removed.`);
    if (!ok) return;
    const typed = window.prompt("Type DELETE to confirm permanent deletion", "");
    if ((typed || "").trim().toUpperCase() !== "DELETE") return;

    try {
      const res = await fetch(`/api/hr/employees/${employee.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Delete failed" }));
        throw new Error(data.error || "Delete failed");
      }
      await fetchEmployees();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleEditSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingEmployee) return;

    setSaving(true);
    setActionError("");

    try {
      const res = await fetch(`/api/hr/employees/${editingEmployee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editingEmployee.firstName,
          lastName: editingEmployee.lastName,
          email: editingEmployee.email,
          position: editingEmployee.position,
          department: editingEmployee.department,
          salary: Number(editingEmployee.salary),
          isActive: editingEmployee.isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Update failed" }));
        throw new Error(data.error || "Update failed");
      }

      setEditingEmployee(null);
      await fetchEmployees();
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
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">Workforce directory with department and status filters</p>
        </div>
        {can("/api/hr/employees", "POST") ? (
          <Link href="/hr/employees/new" className="btn-primary">
            + Add Employee
          </Link>
        ) : (
          <button className="btn-secondary" disabled>
            + Add Employee
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-sm">
          <div className="stat-label">Filtered Employees</div>
          <div className="stat-value text-amber-300">{filteredEmployees.length}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Active</div>
          <div className="stat-value text-emerald-300">{activeCount}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Departments</div>
          <div className="stat-value text-cyan-300">{departments.length}</div>
        </div>
      </div>

      <div className="card-sm grid gap-3 md:grid-cols-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or role"
          className="input-sm"
        />
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="input-sm"
        >
          <option value="all">All departments</option>
          {departments.map((department) => (
            <option key={department} value={department}>
              {department}
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
      ) : filteredEmployees.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 mb-4">No employees match your filters</p>
          <Link href="/hr/employees/new" className="text-blue-600 hover:underline">
            Add your first employee
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Position</th>
                <th>Department</th>
                <th>Salary (MAD)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td className="font-medium">{emp.firstName} {emp.lastName}</td>
                  <td className="text-sm">{emp.email}</td>
                  <td>{emp.position || "-"}</td>
                  <td>{emp.department || "-"}</td>
                  <td className="font-semibold">{emp.salary}</td>
                  <td>
                    <span className={`badge ${emp.isActive ? "badge-green" : "badge-red"}`}>
                      {emp.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="space-x-3 whitespace-nowrap">
                    {can(`/api/hr/employees/${emp.id}`, "PUT") ? (
                      <button onClick={() => setEditingEmployee(emp)} className="text-cyan-300 hover:text-cyan-200">
                        Edit
                      </button>
                    ) : (
                      <span className="text-slate-500">Edit</span>
                    )}
                    {can(`/api/hr/employees/${emp.id}`, "DELETE") ? (
                      <button onClick={() => handleDelete(emp)} className="text-red-300 hover:text-red-200">
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

      {editingEmployee && (
        <div className="modal-overlay">
          <div className="modal-lg">
            <div className="modal-header">
              <h2 className="text-lg font-semibold text-white">Edit Employee</h2>
              <button className="btn-ghost btn-sm" onClick={() => setEditingEmployee(null)}>
                Close
              </button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="modal-body grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">First Name</label>
                    <input
                      className="input"
                      value={editingEmployee.firstName}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Last Name</label>
                    <input
                      className="input"
                      value={editingEmployee.lastName}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Email</label>
                    <input
                      className="input"
                      value={editingEmployee.email}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Salary</label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={editingEmployee.salary}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, salary: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Position</label>
                    <input
                      className="input"
                      value={editingEmployee.position || ""}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, position: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Department</label>
                    <input
                      className="input"
                      value={editingEmployee.department || ""}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                    />
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingEmployee.isActive}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, isActive: e.target.checked })}
                  />
                  Active employee
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditingEmployee(null)}>
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
