"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/");

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(params.get("next") || "/");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Login failed" }));
        throw new Error(data.error || "Login failed");
      }

      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="hero-panel flex flex-col justify-between">
          <div className="space-y-5">
            <p className="hero-kicker">SGICR enterprise workspace</p>
            <h1 className="hero-title">Morocco-ready ERP for teams running local and international operations.</h1>
            <p className="hero-copy">
              Manage customer lifecycles, import procurement, landed costs, finance control, payroll, and bilingual document output from one platform.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="metric-card">
                <div className="stat-label">Commercial</div>
                <div className="text-lg font-semibold text-emerald-300">Quotes to cash</div>
                <p className="metric-note">Customers, orders, deliveries, invoices, payments.</p>
              </div>
              <div className="metric-card">
                <div className="stat-label">Supply chain</div>
                <div className="text-lg font-semibold text-cyan-300">Imports and stock</div>
                <p className="metric-note">Suppliers, landed costs, batches, receiving, warehousing.</p>
              </div>
              <div className="metric-card">
                <div className="stat-label">Compliance</div>
                <div className="text-lg font-semibold text-amber-300">ICE IF RC CNSS</div>
                <p className="metric-note">Core identifiers and print-ready company settings.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="shell-metric">
              <span className="shell-metric-label">Base currency</span>
              <span className="shell-metric-value">MAD</span>
            </div>
            <div className="shell-metric">
              <span className="shell-metric-label">Languages</span>
              <span className="shell-metric-value">EN / FR</span>
            </div>
            <div className="shell-metric">
              <span className="shell-metric-label">Focus</span>
              <span className="shell-metric-value">Simple control</span>
            </div>
          </div>
        </section>

        <section className="card flex items-center">
          <div className="w-full">
            <div>
              <p className="hero-kicker">Secure access</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Sign in</h2>
              <p className="page-subtitle">Use one of the demo roles to check permissions and workflows.</p>
            </div>

            {error && <div className="alert-error mt-4">{error}</div>}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="label">Username</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  autoComplete="current-password"
                  required
                />
              </div>
              <button className="btn-primary w-full" disabled={loading}>
                {loading ? "Signing in..." : "Enter ERP workspace"}
              </button>
            </form>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <button type="button" className="metric-card text-left" onClick={() => { setUsername("admin"); setPassword("admin123"); }}>
                <div className="stat-label">Admin</div>
                <div className="text-base font-semibold text-white">admin</div>
                <div className="metric-note">Full settings and control access.</div>
              </button>
              <button type="button" className="metric-card text-left" onClick={() => { setUsername("manager"); setPassword("manager123"); }}>
                <div className="stat-label">Manager</div>
                <div className="text-base font-semibold text-white">manager</div>
                <div className="metric-note">Operational supervision and approvals.</div>
              </button>
              <button type="button" className="metric-card text-left" onClick={() => { setUsername("staff"); setPassword("staff123"); }}>
                <div className="stat-label">Staff</div>
                <div className="text-base font-semibold text-white">staff</div>
                <div className="metric-note">Daily processing without admin control.</div>
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
