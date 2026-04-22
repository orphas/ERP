"use client";

import { useState } from "react";

type Entity = "products" | "customers" | "suppliers" | "employees" | "accounts";

const entities: Array<{ id: Entity; label: string; description: string }> = [
  { id: "products", label: "Products", description: "SKU, name, category, pricing and stock thresholds" },
  { id: "customers", label: "Customers", description: "Customer master data and credit defaults" },
  { id: "suppliers", label: "Suppliers", description: "Supplier contacts and tax identifiers" },
  { id: "employees", label: "Employees", description: "Employee profiles, salary and hire date" },
  { id: "accounts", label: "Accounts", description: "Chart of accounts and opening balances" },
];

export default function DataExchangePage() {
  const [importing, setImporting] = useState<Entity | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const doImport = async (entity: Entity, file: File) => {
    setImporting(entity);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("entity", entity);
      formData.append("file", file);

      const res = await fetch("/api/tools/excel/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      const imported = Number(data.imported || 0);
      const rowCount = Number(data.totalRows || 0);
      const issueCount = Array.isArray(data.errors) ? data.errors.length : 0;
      setMessage(`Imported ${imported}/${rowCount} ${entity} rows. ${issueCount > 0 ? `${issueCount} rows had issues.` : "No errors."}`);
      if (issueCount > 0) {
        setError((data.errors as string[]).slice(0, 6).join("\n"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting("");
    }
  };

  return (
    <main className="space-y-6">
      <section className="card">
        <div className="page-header mb-0">
          <div>
            <h1 className="page-title">Excel Data Exchange</h1>
            <p className="page-subtitle">Export full lists to Excel-compatible CSV and import updates back quickly.</p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Coverage</th>
                <th>Export</th>
                <th>Import</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium">{item.label}</td>
                  <td>{item.description}</td>
                  <td>
                    <a className="btn-secondary btn-sm" href={`/api/tools/excel/export?entity=${item.id}`}>
                      Download CSV
                    </a>
                  </td>
                  <td>
                    <label className="btn-primary btn-sm cursor-pointer">
                      {importing === item.id ? "Importing..." : "Upload CSV"}
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        disabled={Boolean(importing)}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            doImport(item.id, f);
                          }
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {message && <div className="alert-success whitespace-pre-line">{message}</div>}
      {error && <div className="alert-error whitespace-pre-line">{error}</div>}
    </main>
  );
}
