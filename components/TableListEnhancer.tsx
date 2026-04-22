"use client";

import { useEffect } from "react";

type EnhancedState = {
  rows: HTMLTableRowElement[];
  headers: HTMLTableCellElement[];
  sortIndex: number;
  sortDir: "asc" | "desc";
  query: string;
  filterColumn: number;
  dateFrom: string;
  dateTo: string;
  pageSize: number;
  page: number;
  visibleColumns: Set<number>;
  dateColumn: number;
  sortedRows: HTMLTableRowElement[];
};

const ENHANCED_ATTR = "data-enhanced-list";
const ALL_COLUMNS = -1;

function parseTimestamp(value: string): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function startOfDay(dateIso: string): number | null {
  if (!dateIso) return null;
  return parseTimestamp(`${dateIso}T00:00:00`);
}

function endOfDay(dateIso: string): number | null {
  if (!dateIso) return null;
  return parseTimestamp(`${dateIso}T23:59:59.999`);
}

function cellText(row: HTMLTableRowElement, colIndex: number): string {
  return (row.cells[colIndex]?.textContent || "").trim();
}

function detectDateColumn(rows: HTMLTableRowElement[], headers: HTMLTableCellElement[]): number {
  for (let i = 0; i < headers.length; i += 1) {
    let sample = 0;
    let valid = 0;
    for (const row of rows) {
      const text = cellText(row, i);
      if (!text) continue;
      sample += 1;
      if (parseTimestamp(text) != null) valid += 1;
      if (sample >= 8) break;
    }
    if (sample > 0 && valid / sample >= 0.6) return i;
  }
  return -1;
}

function buildPageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, total - 1, total];
  if (current >= total - 3) return [1, 2, total - 4, total - 3, total - 2, total - 1, total];
  return [1, current - 1, current, current + 1, total];
}

function enhanceTable(table: HTMLTableElement) {
  if (table.getAttribute(ENHANCED_ATTR) === "1") return;
  if (table.getAttribute("data-managed-table") === "true") return;

  const thead = table.tHead;
  const tbody = table.tBodies[0];
  const headerRow = thead?.rows[0];
  if (!thead || !tbody || !headerRow) return;

  const headers = Array.from(headerRow.cells);
  const rows = Array.from(tbody.rows);
  if (headers.length === 0 || rows.length === 0) return;

  table.setAttribute(ENHANCED_ATTR, "1");

  const state: EnhancedState = {
    rows,
    headers,
    sortIndex: -1,
    sortDir: "asc",
    query: "",
    filterColumn: ALL_COLUMNS,
    dateFrom: "",
    dateTo: "",
    pageSize: 20,
    page: 1,
    visibleColumns: new Set(headers.map((_h, idx) => idx)),
    dateColumn: detectDateColumn(rows, headers),
    sortedRows: rows,
  };

  const wrapper = table.closest(".table-wrap") as HTMLElement | null;
  const host = wrapper?.parentElement || table.parentElement;
  if (!host) return;

  if (wrapper) {
    wrapper.style.overflowX = "auto";
    wrapper.style.overflowY = "auto";
    if (!wrapper.style.maxHeight) wrapper.style.maxHeight = "72vh";
  }

  const toolbar = document.createElement("div");
  toolbar.className = "grid gap-2 md:grid-cols-[1fr_auto] mb-2";

  const left = document.createElement("div");
  left.className = "grid gap-2 sm:grid-cols-2 lg:grid-cols-5";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "input";
  searchInput.placeholder = "Search records...";

  const filterSelect = document.createElement("select");
  filterSelect.className = "input";

  const allOption = document.createElement("option");
  allOption.value = String(ALL_COLUMNS);
  allOption.textContent = "All Fields";
  filterSelect.appendChild(allOption);

  headers.forEach((head, idx) => {
    const option = document.createElement("option");
    option.value = String(idx);
    option.textContent = (head.textContent || `Column ${idx + 1}`).trim();
    filterSelect.appendChild(option);
  });

  const fromInput = document.createElement("input");
  fromInput.type = "date";
  fromInput.className = "input";

  const toInput = document.createElement("input");
  toInput.type = "date";
  toInput.className = "input";

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "btn-secondary btn-sm";
  clearButton.textContent = "Clear Filters";

  left.append(searchInput, filterSelect, fromInput, toInput, clearButton);

  const right = document.createElement("div");
  right.className = "flex flex-wrap items-center justify-end gap-2";

  const pageLabel = document.createElement("span");
  pageLabel.className = "text-xs text-slate-400";
  pageLabel.textContent = "Items Per Page";

  const pageSizeSelect = document.createElement("select");
  pageSizeSelect.className = "input w-24";
  [20, 50, 100].forEach((size) => {
    const option = document.createElement("option");
    option.value = String(size);
    option.textContent = String(size);
    pageSizeSelect.appendChild(option);
  });
  pageSizeSelect.value = "20";

  const pickerDetails = document.createElement("details");
  pickerDetails.className = "relative";
  const pickerSummary = document.createElement("summary");
  pickerSummary.className = "btn-secondary btn-xs list-none cursor-pointer";
  pickerSummary.textContent = "Column Visibility";
  const pickerBody = document.createElement("div");
  pickerBody.className = "absolute right-0 mt-1 z-40 w-72 rounded-2xl shadow-2xl p-3 grid grid-cols-2 gap-1";
  pickerBody.style.background = "rgba(11,24,32,0.98)";
  pickerBody.style.border = "1px solid rgba(255,255,255,0.1)";

  headers.forEach((head, idx) => {
    const label = document.createElement("label");
    label.className = "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-300";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.className = "w-3.5 h-3.5 accent-emerald-500 rounded";

    const span = document.createElement("span");
    span.textContent = (head.textContent || `Column ${idx + 1}`).trim();

    checkbox.addEventListener("change", () => {
      if (!checkbox.checked && state.visibleColumns.size <= 2) {
        checkbox.checked = true;
        return;
      }
      if (checkbox.checked) state.visibleColumns.add(idx);
      else state.visibleColumns.delete(idx);
      state.page = 1;
      apply();
    });

    label.append(checkbox, span);
    pickerBody.appendChild(label);
  });

  pickerDetails.append(pickerSummary, pickerBody);
  right.append(pageLabel, pageSizeSelect, pickerDetails);
  toolbar.append(left, right);

  const summary = document.createElement("div");
  summary.className = "text-xs text-slate-400 mb-2 px-1";

  const pager = document.createElement("div");
  pager.className = "flex items-center justify-between gap-2 mt-2 px-1";
  const pagerInfo = document.createElement("div");
  pagerInfo.className = "text-xs text-slate-500";
  const pagerButtons = document.createElement("div");
  pagerButtons.className = "flex flex-wrap items-center gap-1";

  const prevButton = document.createElement("button");
  prevButton.type = "button";
  prevButton.className = "btn-secondary btn-xs";
  prevButton.textContent = "Previous";

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "btn-secondary btn-xs";
  nextButton.textContent = "Next";

  pagerButtons.append(prevButton, nextButton);
  pager.append(pagerInfo, pagerButtons);

  host.insertBefore(toolbar, wrapper || table);
  host.insertBefore(summary, wrapper || table);
  host.insertBefore(pager, (wrapper || table).nextSibling);

  function applyColumnVisibility() {
    headers.forEach((head, idx) => {
      head.style.display = state.visibleColumns.has(idx) ? "" : "none";
    });
    state.rows.forEach((row) => {
      Array.from(row.cells).forEach((cell, idx) => {
        (cell as HTMLElement).style.display = state.visibleColumns.has(idx) ? "" : "none";
      });
    });
  }

  function rowMatches(row: HTMLTableRowElement): boolean {
    const fromTs = startOfDay(state.dateFrom);
    const toTs = endOfDay(state.dateTo);

    if (state.dateColumn >= 0 && (fromTs != null || toTs != null)) {
      const ts = parseTimestamp(cellText(row, state.dateColumn));
      if (ts == null) return false;
      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts > toTs) return false;
    }

    if (!state.query) return true;

    if (state.filterColumn === ALL_COLUMNS) {
      for (let i = 0; i < state.headers.length; i += 1) {
        if (cellText(row, i).toLowerCase().includes(state.query)) return true;
      }
      return false;
    }

    return cellText(row, state.filterColumn).toLowerCase().includes(state.query);
  }

  function compareRows(a: HTMLTableRowElement, b: HTMLTableRowElement): number {
    if (state.sortIndex < 0) return 0;

    const av = cellText(a, state.sortIndex);
    const bv = cellText(b, state.sortIndex);

    const an = Number(av);
    const bn = Number(bv);
    if (!Number.isNaN(an) && !Number.isNaN(bn)) {
      return state.sortDir === "asc" ? an - bn : bn - an;
    }

    const ad = parseTimestamp(av);
    const bd = parseTimestamp(bv);
    if (ad != null && bd != null) {
      return state.sortDir === "asc" ? ad - bd : bd - ad;
    }

    const cmp = av.localeCompare(bv, undefined, { sensitivity: "base" });
    return state.sortDir === "asc" ? cmp : -cmp;
  }

  function apply() {
    const filtered = state.rows.filter(rowMatches);
    const sorted = [...filtered].sort(compareRows);
    state.sortedRows = sorted;

    sorted.forEach((row) => tbody.appendChild(row));

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;

    const start = (state.page - 1) * state.pageSize;
    const end = Math.min(start + state.pageSize, total);

    sorted.forEach((row, idx) => {
      row.style.display = idx >= start && idx < end ? "" : "none";
    });

    applyColumnVisibility();

    summary.textContent = `Showing ${total === 0 ? 0 : start + 1}-${end} of ${total} entries`;
    pagerInfo.textContent = `Page ${state.page} of ${totalPages}`;

    while (pagerButtons.children.length > 2) {
      pagerButtons.removeChild(pagerButtons.children[1]);
    }

    const pages = buildPageNumbers(state.page, totalPages);
    for (let i = pages.length - 1; i >= 0; i -= 1) {
      const pageNo = pages[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn-xs ${pageNo === state.page ? "btn-primary" : "btn-secondary"}`;
      btn.textContent = String(pageNo);
      btn.addEventListener("click", () => {
        state.page = pageNo;
        apply();
      });
      pagerButtons.insertBefore(btn, nextButton);
    }

    prevButton.toggleAttribute("disabled", state.page <= 1);
    nextButton.toggleAttribute("disabled", state.page >= totalPages);
  }

  searchInput.addEventListener("input", () => {
    state.query = searchInput.value.trim().toLowerCase();
    state.page = 1;
    apply();
  });

  filterSelect.addEventListener("change", () => {
    state.filterColumn = Number(filterSelect.value);
    state.page = 1;
    apply();
  });

  fromInput.addEventListener("change", () => {
    state.dateFrom = fromInput.value;
    state.page = 1;
    apply();
  });

  toInput.addEventListener("change", () => {
    state.dateTo = toInput.value;
    state.page = 1;
    apply();
  });

  clearButton.addEventListener("click", () => {
    state.query = "";
    state.filterColumn = ALL_COLUMNS;
    state.dateFrom = "";
    state.dateTo = "";
    searchInput.value = "";
    filterSelect.value = String(ALL_COLUMNS);
    fromInput.value = "";
    toInput.value = "";
    state.page = 1;
    apply();
  });

  pageSizeSelect.addEventListener("change", () => {
    state.pageSize = Number(pageSizeSelect.value) || 20;
    state.page = 1;
    apply();
  });

  prevButton.addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    apply();
  });

  nextButton.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(state.sortedRows.length / state.pageSize));
    state.page = Math.min(totalPages, state.page + 1);
    apply();
  });

  headers.forEach((head, idx) => {
    head.style.cursor = "pointer";
    head.addEventListener("click", () => {
      if (state.sortIndex === idx) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortIndex = idx;
        state.sortDir = "asc";
      }
      state.page = 1;
      apply();
    });
  });

  apply();
}

export default function TableListEnhancer() {
  useEffect(() => {
    const run = () => {
      const tables = Array.from(document.querySelectorAll("table.table")) as HTMLTableElement[];
      tables.forEach((table) => enhanceTable(table));
    };

    run();

    const observer = new MutationObserver(() => run());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}