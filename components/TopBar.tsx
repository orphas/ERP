"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type AuthUser = {
  username: string;
  name: string;
  role: "admin" | "manager" | "staff";
};

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data) => setUser(data.user || null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    setTodayLabel(
      new Intl.DateTimeFormat("en-MA", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date())
    );
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const pageTitle = pathname
    .split("/")
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.replace(/-/g, " "))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" / ") || "Dashboard";

  return (
    <header className="sticky top-0 z-20 flex h-[52px] shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#0a1520]/90 px-4 backdrop-blur-md md:px-6">
      <div className="pl-8 lg:pl-0">
        <h1 className="text-sm font-semibold text-slate-100">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-slate-500 sm:block">{todayLabel}</span>
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{user.name}</span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-white/[0.07] text-slate-400">{user.role}</span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="rounded px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
