"use client";

import { useMemo, useRef, useState, useEffect } from "react";

export type DataColumn<T> = {
  key: string;
  label: string;
  defaultVisible?: boolean;
  sortable?: boolean;
  getValue?: (row: T) => string | number | null | undefined;
  render: (row: T) => React.ReactNode;
};

type SortDir = "asc" | "desc";

type DataTableProps<T> = {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  maxHeight?: string;
  emptyMessage?: string;
  dateField?: string | ((row: T) => string | Date | null | undefined);
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  searchPlaceholder?: string;
  preferencesKey?: string;
};

const ALL_FIELDS = "__all_fields__";

const normalizeText = (value: unknown) => String(value ?? "").toLowerCase();

const parseDateValue = (value: unknown): number | null => {
  if (!value) return null;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  const time = new Date(String(value)).getTime();
  return Number.isNaN(time) ? null : time;
};

const startOfDay = (isoDate: string): number | null => {
  if (!isoDate) return null;
  return parseDateValue(`${isoDate}T00:00:00`);
};

const endOfDay = (isoDate: string): number | null => {
  if (!isoDate) return null;
  return parseDateValue(`${isoDate}T23:59:59.999`);
};

const buildPageNumbers = (currentPage: number, totalPages: number): number[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, totalPages - 1, totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, 2, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
};

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  maxHeight = "68vh",
  emptyMessage = "No records found.",
  dateField,
  pageSizeOptions = [20, 50, 100],
  defaultPageSize = 20,
  searchPlaceholder = "Search records...",
  preferencesKey,
}: DataTableProps<T>) {
  const defaultVisible = new Set(
    columns.filter((c) => c.defaultVisible !== false).map((c) => c.key)
  );
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(defaultVisible);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterField, setFilterField] = useState<string>(ALL_FIELDS);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const pickerRef = useRef<HTMLDivElement>(null);
  const columnPrefsStorageKey = preferencesKey ? `erp.datatable.${preferencesKey}.visibleColumns` : null;

  useEffect(() => {
    if (!columnPrefsStorageKey) return;
    try {
      const raw = window.localStorage.getItem(columnPrefsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as string[];
      if (!Array.isArray(parsed)) return;
      const allowed = new Set(columns.map((c) => c.key));
      const filtered = parsed.filter((key) => allowed.has(key));
      if (filtered.length >= 2) {
        setVisibleKeys(new Set(filtered));
      }
    } catch {
      // Ignore malformed local preference values.
    }
  }, [columnPrefsStorageKey, columns]);

  useEffect(() => {
    if (!columnPrefsStorageKey) return;
    try {
      window.localStorage.setItem(columnPrefsStorageKey, JSON.stringify(Array.from(visibleKeys)));
    } catch {
      // Ignore storage write issues.
    }
  }, [columnPrefsStorageKey, visibleKeys]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const visibleColumns = columns.filter((c) => visibleKeys.has(c.key));

  const resolvedDateAccessor = useMemo(() => {
    if (typeof dateField === "function") {
      return (row: T) => parseDateValue(dateField(row));
    }

    if (typeof dateField === "string" && dateField.trim()) {
      return (row: T) => parseDateValue((row as Record<string, unknown>)[dateField]);
    }

    const candidateKeys = ["date", "createdAt"];
    for (const key of candidateKeys) {
      const hasKey = rows.some((row) => Object.prototype.hasOwnProperty.call(row as object, key));
      if (hasKey) {
        return (row: T) => parseDateValue((row as Record<string, unknown>)[key]);
      }
    }

    return (_row: T) => null;
  }, [dateField, rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeText(filterQuery).trim();
    const fromTime = startOfDay(dateFrom);
    const toTime = endOfDay(dateTo);

    return rows.filter((row) => {
      const rowDate = resolvedDateAccessor(row);
      const matchesDate = (() => {
        if (fromTime == null && toTime == null) return true;
        if (rowDate == null) return false;
        if (fromTime != null && rowDate < fromTime) return false;
        if (toTime != null && rowDate > toTime) return false;
        return true;
      })();

      if (!matchesDate) return false;
      if (!normalizedQuery) return true;

      const searchInColumn = (col: DataColumn<T>) => {
        const raw = col.getValue
          ? col.getValue(row)
          : (row as Record<string, unknown>)[col.key];
        return normalizeText(raw).includes(normalizedQuery);
      };

      if (filterField === ALL_FIELDS) {
        return columns.some((col) => searchInColumn(col));
      }

      const selectedColumn = columns.find((col) => col.key === filterField);
      if (!selectedColumn) return true;
      return searchInColumn(selectedColumn);
    });
  }, [rows, filterQuery, filterField, dateFrom, dateTo, resolvedDateAccessor, columns]);

  const handleSort = (colKey: string) => {
    if (sortKey === colKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(colKey);
      setSortDir("asc");
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filteredRows;
    const getValue =
      col.getValue ||
      ((row: T) => {
        const val = (row as Record<string, unknown>)[col.key];
        return val == null ? "" : String(val);
      });
    return [...filteredRows].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (av == null && bv == null) return 0;
      if (av == null) return sortDir === "asc" ? 1 : -1;
      if (bv == null) return sortDir === "asc" ? -1 : 1;
      const an = Number(av);
      const bn = Number(bv);
      if (!Number.isNaN(an) && !Number.isNaN(bn)) {
        return sortDir === "asc" ? an - bn : bn - an;
      }
      const as_ = String(av).toLowerCase();
      const bs_ = String(bv).toLowerCase();
      if (as_ < bs_) return sortDir === "asc" ? -1 : 1;
      if (as_ > bs_) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortKey, sortDir, columns]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterQuery, filterField, dateFrom, dateTo, sortKey, sortDir, pageSize]);

  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const toggleColumn = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 2) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const sortIcon = (key: string) => {
    if (sortKey !== key) return "⇅";
    return sortDir === "asc" ? "↑" : "↓";
  };

  const clearFilters = () => {
    setFilterQuery("");
    setFilterField(ALL_FIELDS);
    setDateFrom("");
    setDateTo("");
  };

  const pageNumbers = buildPageNumbers(currentPage, totalPages);
  const rangeStart = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalRows);

  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input
            type="text"
            className="input"
            placeholder={searchPlaceholder}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
          <select
            className="input"
            value={filterField}
            onChange={(e) => setFilterField(e.target.value)}
          >
            <option value={ALL_FIELDS}>All Fields</option>
            {columns.map((col) => (
              <option key={col.key} value={col.key}>{col.label}</option>
            ))}
          </select>
          <input
            type="date"
            className="input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Filter from date"
          />
          <input
            type="date"
            className="input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Filter to date"
          />
          <button type="button" className="btn-secondary btn-sm" onClick={clearFilters}>Clear Filters</button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 px-1 relative" ref={pickerRef}>
          <label className="text-xs text-slate-400">Items Per Page</label>
          <select
            className="input w-24"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) || defaultPageSize)}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary btn-xs flex items-center gap-1"
            onClick={() => setPickerOpen((v) => !v)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
            Column Visibility
          </button>

          {pickerOpen && (
            <div className="absolute right-0 top-9 z-50 w-72 rounded-2xl shadow-2xl"
              style={{ background: "rgba(11,24,32,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                Visible Columns
              </div>
              <div className="grid grid-cols-2 gap-0.5 px-3 pb-3 max-h-80 overflow-y-auto">
                {columns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={visibleKeys.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="w-3.5 h-3.5 accent-emerald-500 rounded"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-400 px-1">
        Showing {rangeStart}-{rangeEnd} of {totalRows} entries
      </div>

      <div
        style={{ maxHeight, overflowY: "auto", overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)" }}
        className="rounded-[1.25rem]"
      >
        <div style={{ borderRadius: 0, border: "none", overflowX: "visible", overflowY: "visible" }} className="table-wrap">
          <table className="table" data-managed-table="true" style={{ minWidth: "max-content" }}>
            <thead
              className="sticky top-0 z-10"
              style={{ background: "rgba(10,22,30,0.97)" }}
            >
              <tr>
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap ${col.sortable !== false ? "cursor-pointer select-none hover:text-white" : ""}`}
                    onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable !== false && (
                        <span
                          className="text-[10px] transition-colors"
                          style={{ color: sortKey === col.key ? "var(--brand-strong)" : "rgba(148,163,184,0.45)" }}
                        >
                          {sortIcon(col.key)}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="text-center py-12 text-slate-500">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr key={rowKey(row)}>
                    {visibleColumns.map((col) => (
                      <td key={col.key}>{col.render(row)}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="text-xs text-slate-500">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            Previous
          </button>
          {pageNumbers.map((pageNo, index) => {
            const previous = index > 0 ? pageNumbers[index - 1] : null;
            const showGap = previous != null && pageNo - previous > 1;
            return (
              <span key={`page-${pageNo}`} className="inline-flex items-center gap-1">
                {showGap ? <span className="px-1 text-slate-500">...</span> : null}
                <button
                  type="button"
                  className={`btn-xs ${pageNo === currentPage ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setCurrentPage(pageNo)}
                >
                  {pageNo}
                </button>
              </span>
            );
          })}
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
