import type { EmailStatus } from "@/types";

const tone: Record<EmailStatus, string> = {
  scheduled: "bg-sky-50 text-sky-700 border-sky-200",
  queued: "bg-amber-50 text-amber-700 border-amber-200",
  sending: "bg-indigo-50 text-indigo-700 border-indigo-200 font-bold",
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-semibold capitalize border ${
        tone[status] ?? tone.scheduled
      }`}
    >
      {status}
    </span>
  );
}
