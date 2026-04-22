"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import TableListEnhancer from "@/components/TableListEnhancer";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="shell-app">
      <Sidebar />
      <main className="shell-main lg:pl-56 print:pl-0">
        <TopBar />
        <TableListEnhancer />
        <div className="shell-content">{children}</div>
      </main>
    </div>
  );
}
