"use client";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4 text-xs">
        <div className="flex items-start gap-3 rounded-xl bg-rose-50 border border-rose-100 p-4">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-slate-700 leading-relaxed text-xs">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="text-slate-600 hover:text-slate-900">
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            loading={loading}
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs px-4 py-2 rounded-xl border border-rose-700"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
