"use client";

import Link from "next/link";

export default function HRPage() {
  const sections = [
    {
      href: "/hr/employees",
      eyebrow: "Workforce base",
      title: "Employees",
      copy: "Maintain employee records, departments, salaries, CIN, and CNSS data.",
      accent: "text-amber-300",
    },
    {
      href: "/hr/payroll",
      eyebrow: "Payroll",
      title: "Payroll",
      copy: "Prepare payroll cycles and follow approval and payment status clearly.",
      accent: "text-emerald-300",
    },
  ];

  return (
    <main className="space-y-6">
      <section className="hero-panel">
        <div className="space-y-4">
          <p className="hero-kicker">People operations</p>
          <h1 className="hero-title md:text-4xl">Keep employee records and payroll cycles under tight control.</h1>
          <p className="hero-copy">The HR module keeps workforce administration straightforward while preserving payroll visibility and compliance-critical employee details.</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
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
