"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Role = "admin" | "manager" | "staff";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  roles?: Role[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "",
    items: [
      { href: "/", label: "Dashboard", exact: true, icon: "M3 5a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm10 0a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2V5zM3 15a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4zm10 0a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4z" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/sales/customers", label: "Customers", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
      { href: "/sales/quotes", label: "Quotations", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
      { href: "/sales/orders", label: "Sales Orders", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
      { href: "/sales/invoices", label: "Invoices", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" },
    ],
  },
  {
    label: "Procurement",
    items: [
      { href: "/procurement/suppliers", label: "Suppliers", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
      { href: "/procurement/orders", label: "Purchase Orders", icon: "M9 12h6m-3-3v6m-7 3h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2z" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/inventory/products", label: "Products", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" },
      { href: "/inventory/categories", label: "Categories", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
      { href: "/inventory/warehouses", label: "Warehouses", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/finance/accounts", label: "Chart of Accounts", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
      { href: "/finance/journal", label: "Journal Entries", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
      { href: "/finance/receivables", label: "Receivables", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10m2-8h4m0 0l-2-2m2 2l-2 2" },
      { href: "/finance/payables", label: "Payables", icon: "M7 15h10M7 11h10M7 7h10M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" },
      { href: "/finance/invoice-summary", label: "Invoice Summary", icon: "M9 14h6m-6-4h6m-6 8h4M7 3h7l5 5v13a1 1 0 01-1 1H7a2 2 0 01-2-2V5a2 2 0 012-2z" },
      { href: "/finance/expenses", label: "Expenses", icon: "M12 8c-2.21 0-4 .895-4 2s1.79 2 4 2 4 .895 4 2-1.79 2-4 2-4-.895-4-2m4-6v12" },
      { href: "/finance/profitability", label: "Profitability", icon: "M3 17l6-6 4 4 8-8M14 7h7v7" },
      { href: "/finance/cogs", label: "Cost of Goods Sold", icon: "M4 19h16M6 16l2-5 3 3 4-8 3 5" },
    ],
  },
  {
    label: "Human Resources",
    items: [
      { href: "/hr/employees", label: "Employees", icon: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" },
      { href: "/hr/payroll", label: "Payroll", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/reporting", label: "Reports", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
      { href: "/operations", label: "Operations", roles: ["admin", "manager"] as Role[], icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
      { href: "/settings", label: "Settings", roles: ["admin", "manager"] as Role[], icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
    ],
  },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
    >
      <path d={d} />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);
  const [open, setOpen] = useState(false);
  const [customGroupOrder, setCustomGroupOrder] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data) => setRole((data.user?.role as Role) || null))
      .catch(() => setRole(null));
  }, []);

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !item.roles || (role && item.roles.includes(role))
          ),
        }))
        .filter((group) => group.items.length > 0),
    [role]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem("erp_nav_group_order");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCustomGroupOrder(parsed as string[]);
      }
    } catch {
      // ignore bad local settings
    }
  }, []);

  const orderedVisibleGroups = useMemo(() => {
    if (!customGroupOrder || customGroupOrder.length === 0) return visibleGroups;
    const rootGroup = visibleGroups.find((g) => g.label === "");
    const modules = visibleGroups.filter((g) => g.label !== "");
    const byLabel = new Map(modules.map((g) => [g.label, g]));
    const orderedModules = customGroupOrder
      .map((label) => byLabel.get(label))
      .filter(Boolean) as NavGroup[];
    const remaining = modules.filter((g) => !customGroupOrder.includes(g.label));
    return [...(rootGroup ? [rootGroup] : []), ...orderedModules, ...remaining];
  }, [visibleGroups, customGroupOrder]);

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <>
      <button
        className="fixed left-3 top-3.5 z-50 rounded-md p-1.5 text-slate-400 hover:bg-white/10 lg:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-5 w-5"
        >
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <button
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-white/[0.07] bg-[#0d1821] transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-4">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-[10px] font-bold text-white">
            S
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">
            SGICR ERP
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2">
          {orderedVisibleGroups.map((group) => (
            <div key={group.label || "__root"} className="mb-3">
              {group.label && (
                <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2.5 rounded px-2.5 py-[7px] text-[13px] transition-colors ${
                          active
                            ? "bg-emerald-600/15 text-emerald-300 font-medium"
                            : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                        }`}
                      >
                        <span className={active ? "text-emerald-400" : "text-slate-600"}>
                          <NavIcon d={item.icon} />
                        </span>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/[0.07] px-4 py-3">
          <p className="text-[11px] text-slate-600">MAD / TVA 20%</p>
        </div>
      </aside>
    </>
  );
}