"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function FinancePage() {
  const [stats, setStats] = useState({ accounts: 0, entries: 0, postedEntries: 0, totalBalance: 0 });

  const sections = [
    {
      href: "/finance/accounts",
      eyebrow: "Ledger",
      title: "Chart of Accounts",
      copy: "Keep the account structure aligned with Morocco-style financial control.",
      accent: "text-violet-300",
    },
    {
      href: "/finance/accounts/new",
      eyebrow: "Setup",
      title: "Create Account",
      copy: "Add new accounts without leaving the finance workspace flow.",
      accent: "text-cyan-300",
    },
    {
      href: "/finance/journal",
      eyebrow: "Posting",
      title: "Journal Entries",
      copy: "Review, post, and track accounting movements and document impact.",
      accent: "text-emerald-300",
    },
    {
      href: "/finance/receivables",
      eyebrow: "Working Capital",
      title: "Receivables",
      copy: "Monitor customer balances, overdue exposure, and collection performance.",
      accent: "text-sky-300",
    },
    {
      href: "/finance/payables",
      eyebrow: "Working Capital",
      title: "Payables",
      copy: "Track supplier liabilities, payment progress, and unsettled obligations.",
      accent: "text-amber-300",
    },
    {
      href: "/finance/invoice-summary",
      eyebrow: "Controls",
      title: "Invoice Summary",
      copy: "Consolidated invoice totals by status, aging bucket, and period view.",
      accent: "text-fuchsia-300",
    },
    {
      href: "/finance/expenses",
      eyebrow: "Operations",
      title: "Expenses",
      copy: "Analyze landed costs, delivery expenses, and non-product charge trends.",
      accent: "text-rose-300",
    },
    {
      href: "/finance/profitability",
      eyebrow: "Performance",
      title: "Profitability",
      copy: "Review margin evolution by period using recognized revenue and COGS.",
      accent: "text-emerald-300",
    },
    {
      href: "/finance/cogs",
      eyebrow: "Cost Analysis",
      title: "COGS Analysis",
      copy: "Inspect cost-of-goods usage by invoice and by inventory batch.",
      accent: "text-cyan-300",
    },
  ];

  useEffect(() => {
    const load = async () => {
      const [accountsData, entriesData] = await Promise.all([
        fetch("/api/finance/accounts").then((r) => r.json()),
        fetch("/api/finance/journal").then((r) => r.json()),
      ]);

      const accounts = Array.isArray(accountsData) ? accountsData : [];
      const entries = Array.isArray(entriesData) ? entriesData : [];

      setStats({
        accounts: accounts.length,
        entries: entries.length,
        postedEntries: entries.filter((entry: { isPosted: boolean }) => entry.isPosted).length,
        totalBalance: accounts.reduce(
          (sum: number, account: { balance?: string | number }) => sum + Number(account.balance || 0),
          0
        ),
      });
    };

    load();
  }, []);

  return (
    <main className="space-y-6">
      <section className="hero-panel">
        <div className="space-y-4">
          <p className="hero-kicker">Financial control</p>
          <h1 className="hero-title md:text-4xl">A finance workspace that stays clear under operational load.</h1>
          <p className="hero-copy">Track account structure, posting discipline, and balances while keeping the surface area simple for day-to-day accounting users.</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="card-sm"><div className="stat-label">Accounts</div><div className="stat-value text-violet-300">{stats.accounts}</div></div>
        <div className="card-sm"><div className="stat-label">Journal Entries</div><div className="stat-value text-cyan-300">{stats.entries}</div></div>
        <div className="card-sm"><div className="stat-label">Posted</div><div className="stat-value text-emerald-300">{stats.postedEntries}</div></div>
        <div className="card-sm"><div className="stat-label">Total Balance</div><div className="stat-value text-amber-300">{stats.totalBalance.toFixed(2)}</div></div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="module-tile">
            <div className="text-sm text-slate-400">{section.eyebrow}</div>
            <div className={`module-tile-title ${section.accent}`}>{section.title}</div>
            <p className="module-tile-copy">{section.copy}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
