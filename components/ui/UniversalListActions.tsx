"use client";

import { useState } from "react";
import Link from "next/link";

type UniversalListActionsProps = {
  id: number;
  viewHref?: string;
  printDocument?: "quote" | "order" | "invoice" | "delivery" | "purchase-order" | "payroll" | "journal";
  onDelete?: (id: number) => Promise<void>;
  canDelete?: boolean;
  children?: React.ReactNode;
  deleteLabel?: string;
};

export default function UniversalListActions({
  id,
  viewHref,
  printDocument,
  onDelete,
  canDelete = false,
  children,
  deleteLabel = "record",
}: UniversalListActionsProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const openDeleteDialog = () => {
    if (!onDelete || !canDelete || deleting) return;
    setConfirmText("");
    setConfirmOpen(true);
  };

  const runDelete = async () => {
    if (!onDelete || !canDelete || deleting) return;
    if (confirmText.trim().toUpperCase() !== "DELETE") return;

    setDeleting(true);
    try {
      await onDelete(id);
      setConfirmOpen(false);
      setConfirmText("");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {viewHref && (
        <Link href={viewHref} className="btn-ghost btn-xs">
          View
        </Link>
      )}

      {printDocument && (
        <>
          <a
            href={`/api/print/${printDocument}/${id}?lang=en`}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary btn-xs"
          >
            Print EN
          </a>
          <a
            href={`/api/print/${printDocument}/${id}?lang=fr`}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary btn-xs"
          >
            Print FR
          </a>
        </>
      )}

      {children}

      {canDelete && onDelete && (
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={openDeleteDialog}
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-rose-400/25 bg-slate-950/95 p-5 shadow-2xl whitespace-normal">
            <h3 className="text-base font-semibold text-white">Confirm Permanent Deletion</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed break-words">
              You are deleting this {deleteLabel}. Connected accounting entries and dependent transactional records will also be removed. Stock quantities are restored automatically where applicable.
            </p>
            <p className="mt-3 text-xs text-rose-300">Type DELETE to confirm.</p>
            <input
              className="input mt-2"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
            />
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setConfirmOpen(false)} disabled={deleting}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={runDelete}
                disabled={deleting || confirmText.trim().toUpperCase() !== "DELETE"}
              >
                {deleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
