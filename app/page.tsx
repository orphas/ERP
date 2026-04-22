"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Stats {
  products: number;
  customers: number;
  employees: number;
  accounts: number;
  suppliers: number;
}

interface Insights {
  pendingInvoices: number;
  totalRevenue: number;
  lowStockProducts: { id: number; name: string }[];
}

export default function Home() {
  const [stats, setStats] = useState<Stats>({ products: 0, customers: 0, employees: 0, accounts: 0, suppliers: 0 });
  const [insights, setInsights] = useState<Insights>({ pendingInvoices: 0, totalRevenue: 0, lowStockProducts: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [products, customers, employees, accounts, suppliers, dash] = await Promise.all([
          fetch("/api/inventory/products").then((r) => r.json()),
          fetch("/api/sales/customers").then((r) => r.json()),
          fetch("/api/hr/employees").then((r) => r.json()),
          fetch("/api/finance/accounts").then((r) => r.json()),
          fetch("/api/procurement/suppliers").then((r) => r.json()),
          fetch("/api/dashboard").then((r) => r.json()),
        ]);
        setStats({
          products: products.length ?? 0,
          customers: customers.length ?? 0,
          employees: employees.length ?? 0,
          accounts: accounts.length ?? 0,
          suppliers: suppliers.length ?? 0,
        });
        setInsights({
          pendingInvoices: Number(dash.pendingInvoices ?? 0),
          totalRevenue: Number(dash.totalRevenue ?? 0),
          lowStockProducts: Array.isArray(dash.lowStockProducts) ? dash.lowStockProducts.slice(0, 5) : [],
        });
      } catch {
        // keep defaults
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const kpis = [
    { label: "Pending Invoices", value: loading ? "-" : String(insights.pendingInvoices), color: "text-amber-300", href: "/sales/invoices" },
    { label: "Revenue Collected", value: loading ? "-" : insights.totalRevenue.toLocaleString("fr-MA") + " MAD", color: "text-emerald-300", href: "/finance/accounts" },
    { label: "Low Stock Alerts", value: loading ? "-" : String(insights.lowStockProducts.length), color: insights.lowStockProducts.length > 0 ? "text-rose-300" : "text-slate-300", href: "/inventory/products" },
    { label: "Products", value: loading ? "-" : String(stats.products), color: "text-cyan-300", href: "/inventory/products" },
    { label: "Customers", value: loading ? "-" : String(stats.customers), color: "text-slate-200", href: "/sales/customers" },
    { label: "Employees", value: loading ? "-" : String(stats.employees), color: "text-slate-200", href: "/hr/employees" },
  ];

  const shortcuts = [
    { label: "New Product", href: "/inventory/products/new", primary: true },
    { label: "New Customer", href: "/sales/customers/new", primary: false },
    { label: "New Purchase Order", href: "/procurement/orders", primary: false },
    { label: "New Invoice", href: "/sales/invoices", primary: false },
  ];

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Overview</h2>
          <p className="mt-0.5 text-sm text-slate-400">Welcome back. Here is what needs your attention today.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {shortcuts.map((s) => (
            <Link key={s.href} href={s.href} className={s.primary ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="card-sm block hover:border-white/20 transition-colors">
            <p className="text-xs text-slate-400">{k.label}</p>
            <p className={"mt-1 text-2xl font-bold " + k.color}>{k.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-white">Quick Access</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Products", href: "/inventory/products", sub: "Inventory" },
              { label: "Customers", href: "/sales/customers", sub: "Sales" },
              { label: "Suppliers", href: "/procurement/suppliers", sub: "Procurement" },
              { label: "Invoices", href: "/sales/invoices", sub: "Sales" },
              { label: "Purchase Orders", href: "/procurement/orders", sub: "Procurement" },
              { label: "Chart of Accounts", href: "/finance/accounts", sub: "Finance" },
              { label: "Employees", href: "/hr/employees", sub: "HR" },
              { label: "Reports", href: "/reporting", sub: "Analytics" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 hover:bg-white/[0.07] hover:border-white/[0.12] transition-colors"
              >
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">{item.sub}</p>
                <p className="text-sm font-medium text-slate-200">{item.label}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Low Stock</h3>
              <Link href="/inventory/products" className="text-xs text-cyan-400 hover:text-cyan-300">View all</Link>
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : insights.lowStockProducts.length === 0 ? (
              <p className="text-sm text-slate-500">No low-stock alerts.</p>
            ) : (
              <ul className="space-y-2">
                {insights.lowStockProducts.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
                    <span className="text-slate-300">{p.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h3 className="mb-3 text-sm font-semibold text-white">Module Setup</h3>
            <div className="space-y-2">
              {[
                { label: "Products", count: stats.products, href: "/inventory/products/new" },
                { label: "Customers", count: stats.customers, href: "/sales/customers/new" },
                { label: "Suppliers", count: stats.suppliers, href: "/procurement/suppliers" },
                { label: "Accounts", count: stats.accounts, href: "/finance/accounts" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{item.label}</span>
                  {loading ? (
                    <span className="text-slate-600">-</span>
                  ) : item.count > 0 ? (
                    <span className="text-emerald-400 font-medium">{item.count} records</span>
                  ) : (
                    <Link href={item.href} className="text-amber-400 hover:text-amber-300 text-xs">Add first</Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}