"use client";
import type { EmailRow } from "@/types";
import { StatusBadge } from "./ui/StatusBadge";
import { EmptyState, ErrorState, TableSkeleton } from "./ui/States";
import { formatDateTime, relativeTo } from "@/lib/format";
import { ExternalLink, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { ReactNode, useState } from "react";
import { ConfirmModal } from "./ui/ConfirmModal";

interface Props {
  rows: EmailRow[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  mode: "scheduled" | "sent";
  emptyAction?: ReactNode;
  onDeleteEmail?: (emailId: string) => Promise<void>;
}

export function EmailTable({
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
  error,
  onRetry,
  mode,
  emptyAction,
  onDeleteEmail,
}: Props) {
  const [deleteTarget, setDeleteTarget] = useState<EmailRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const timeLabel = mode === "scheduled" ? "Scheduled for" : "Sent at";
  const totalPages = Math.ceil(total / Math.max(pageSize, 1));

  async function handleConfirmDelete() {
    if (!deleteTarget || !onDeleteEmail) return;
    setDeleting(true);
    try {
      await onDeleteEmail(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <TableSkeleton cols={5} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  if (rows.length === 0) {
    return mode === "scheduled" ? (
      <EmptyState
        title="No scheduled emails"
        body="Schedule a campaign and your queued emails will appear here until sent."
        action={emptyAction}
      />
    ) : (
      <EmptyState
        title="No sent emails yet"
        body="Successfully delivered emails will appear here once processed by the background worker."
      />
    );
  }

  return (
    <div className="flex flex-col justify-between">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3">Recipient & Sender</th>
              <th className="px-5 py-3">Subject</th>
              <th className="px-5 py-3">{timeLabel}</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => {
              const time = mode === "scheduled" ? row.scheduledAt : row.sentAt ?? row.scheduledAt;
              const initials = row.recipient.charAt(0).toUpperCase();

              return (
                <tr key={row.id} className="transition-colors hover:bg-slate-50/70">
                  {/* Recipient & Sender */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700 font-bold text-xs ring-1 ring-slate-200/80">
                        {initials}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{row.recipient}</p>
                        <p className="text-[11px] text-slate-500">via {row.sender.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Subject */}
                  <td className="max-w-xs px-5 py-3.5">
                    <p className="truncate font-medium text-slate-700" title={row.subject}>
                      {row.subject}
                    </p>
                  </td>

                  {/* Timestamp & Relative Time */}
                  <td className="whitespace-nowrap px-5 py-3.5">
                    <p className="font-medium text-slate-900">{formatDateTime(time)}</p>
                    <p className="text-[11px] text-slate-500">{relativeTo(time)}</p>
                  </td>

                  {/* Status & Failure Error Tooltip */}
                  <td className="px-5 py-3.5">
                    <StatusBadge status={row.status} />
                    {row.status === "failed" && row.lastError && (
                      <p
                        className="mt-1.5 max-w-[16rem] truncate rounded bg-rose-50 px-2 py-1 text-[11px] text-rose-700 border border-rose-200"
                        title={row.lastError}
                      >
                        {row.lastError}
                      </p>
                    )}
                  </td>

                  {/* Actions / Ethereal Preview & Delete */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {row.previewUrl && (
                        <a
                          href={row.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all shadow-2xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                        >
                          <span>Preview Email</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}

                      {/* Delete option for sent and failed email history records */}
                      {mode === "sent" && (row.status === "sent" || row.status === "failed") && onDeleteEmail && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(row)}
                          title="Delete email record"
                          aria-label="Delete email record"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors border border-transparent hover:border-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50">
        <p className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-900">{rows.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{" "}
          <span className="font-semibold text-slate-900">{Math.min(page * pageSize, total)}</span> of{" "}
          <span className="font-semibold text-slate-900">{total}</span> results
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </button>
          <span className="text-xs font-semibold text-slate-700 px-2">
            Page {page} of {Math.max(totalPages, 1)}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Individual Delete */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete email record?"
        message="This will remove this email record from your history. This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
