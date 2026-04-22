"use client";

import Link from "next/link";

export default function ProcurementPage() {
  const sections = [
    {
      href: "/procurement/suppliers",
      eyebrow: "Vendor base",
      title: "Suppliers",
      copy: "Register goods suppliers, freight partners, customs brokers, and service vendors.",
      accent: "text-rose-300",
    },
    {
      href: "/procurement/orders",
      eyebrow: "Execution",
      title: "Purchase Orders",
      copy: "Issue local and import POs with separate expense lines payable to other companies.",
      accent: "text-cyan-300",
    },
  ];

  return (
    <main className="space-y-6">
      <section className="hero-panel">
        <div className="space-y-4">
          <p className="hero-kicker">Procurement control</p>
          <h1 className="hero-title md:text-4xl">Separate product buying from landed-cost expenses cleanly.</h1>
          <p className="hero-copy">This workspace supports local procurement and imports while keeping freight, customs, and service charges distinct from the main product supplier.</p>
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
