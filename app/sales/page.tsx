"use client";

import Link from "next/link";

export default function SalesPage() {
  const sections = [
    {
      href: "/sales/customers",
      eyebrow: "Master data",
      title: "Customers",
      copy: "Maintain account profiles, legal identifiers, payment terms, and credit limits.",
      accent: "text-emerald-300",
    },
    {
      href: "/sales/quotes",
      eyebrow: "Pipeline",
      title: "Quotes",
      copy: "Build bilingual offers and control quote-to-order conversion.",
      accent: "text-cyan-300",
    },
    {
      href: "/sales/orders",
      eyebrow: "Execution",
      title: "Orders",
      copy: "Coordinate confirmed demand before delivery and invoicing.",
      accent: "text-blue-300",
    },
    {
      href: "/sales/invoices",
      eyebrow: "Billing",
      title: "Invoices",
      copy: "Issue invoices, record payments, and follow overdue balances.",
      accent: "text-rose-300",
    },
  ];

  return (
    <main className="space-y-6">
      <section className="hero-panel">
        <div className="space-y-4">
          <p className="hero-kicker">Commercial management</p>
          <h1 className="hero-title md:text-4xl">Run the full quote-to-cash cycle without clutter.</h1>
          <p className="hero-copy">The sales workspace stays simple on the surface while keeping the operational depth needed for customer onboarding, pricing discipline, delivery, and collections.</p>
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
