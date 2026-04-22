"use client";

import Link from "next/link";

export default function InventoryPage() {
  const sections = [
    {
      href: "/inventory/products",
      eyebrow: "Master data",
      title: "Products",
      copy: "Create product records with pricing, cost, and replenishment controls.",
      accent: "text-cyan-300",
    },
    {
      href: "/inventory/categories",
      eyebrow: "Structure",
      title: "Categories",
      copy: "Keep the catalog clean for reporting, pricing, and supply planning.",
      accent: "text-emerald-300",
    },
    {
      href: "/inventory/warehouses",
      eyebrow: "Storage",
      title: "Warehouses",
      copy: "Manage physical locations, transfer points, and operational zones.",
      accent: "text-amber-300",
    },
    {
      href: "/inventory/units",
      eyebrow: "Control",
      title: "Units",
      copy: "Standardize units of measure used across sales and procurement.",
      accent: "text-violet-300",
    },
    {
      href: "/inventory/batches",
      eyebrow: "Traceability",
      title: "Batches",
      copy: "Track availability, landed cost, and batch-level stock movement.",
      accent: "text-rose-300",
    },
  ];

  return (
    <main className="space-y-6">
      <section className="hero-panel">
        <div className="space-y-4">
          <p className="hero-kicker">Inventory command</p>
          <h1 className="hero-title md:text-4xl">Keep stock visible from purchase receipt to delivery.</h1>
          <p className="hero-copy">This area handles product master data, storage structure, measurement standards, and batch traceability for a distribution-grade ERP flow.</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
