"use client";

import { useEffect, useState } from "react";

const NAV_GROUP_ORDER_KEY = "erp_nav_group_order";
const LEGACY_NAV_ITEM_ORDER_KEY = "erp_nav_order";

const MAIN_GROUPS = [
  "Sales",
  "Procurement",
  "Inventory",
  "Finance",
  "Human Resources",
  "Administration",
];

function loadOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(NAV_GROUP_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

function applyOrder(order: string[]): string[] {
  const ordered = order.filter((label) => MAIN_GROUPS.includes(label));
  const remaining = MAIN_GROUPS.filter((label) => !ordered.includes(label));
  return [...ordered, ...remaining];
}

export default function NavOrderSection() {
  const [groups, setGroups] = useState(MAIN_GROUPS);
  const [saved, setSaved] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    const order = loadOrder();
    if (order) {
      setGroups(applyOrder(order));
      setIsCustom(true);
    }
  }, []);

  const move = (index: number, direction: -1 | 1) => {
    const next = [...groups];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setGroups(next);
    setSaved(false);
  };

  const saveOrder = () => {
    localStorage.setItem(NAV_GROUP_ORDER_KEY, JSON.stringify(groups));
    localStorage.removeItem(LEGACY_NAV_ITEM_ORDER_KEY);
    setSaved(true);
    setIsCustom(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const resetOrder = () => {
    localStorage.removeItem(NAV_GROUP_ORDER_KEY);
    localStorage.removeItem(LEGACY_NAV_ITEM_ORDER_KEY);
    setGroups(MAIN_GROUPS);
    setIsCustom(false);
    setSaved(false);
  };

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Navigation Order</h2>
        <p className="text-xs text-slate-400 mt-1">
          Reorder only the main sidebar module headings (Sales, Procurement, Inventory, etc.).
          {isCustom && <span className="ml-2 text-amber-400 font-medium">Custom order active</span>}
        </p>
      </div>

      <div className="space-y-1">
        {groups.map((group, index) => (
          <div
            key={group}
            className="flex items-center gap-3 rounded-lg px-3 py-2 bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 transition-colors"
          >
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed text-xs leading-none px-1 py-0.5 rounded hover:bg-slate-700"
                title="Move up"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === groups.length - 1}
                className="text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed text-xs leading-none px-1 py-0.5 rounded hover:bg-slate-700"
                title="Move down"
              >
                ▼
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-slate-200 font-medium">{group}</span>
            </div>
            <span className="text-xs text-slate-600 font-mono">Module</span>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={saveOrder}
        >
          Save Navigation Order
        </button>
        {isCustom && (
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={resetOrder}
          >
            Reset to Default
          </button>
        )}
        {saved && (
          <span className="text-sm text-emerald-400 flex items-center gap-1">
            ✓ Order saved - sidebar updated for module headings
          </span>
        )}
      </div>
    </section>
  );
}
