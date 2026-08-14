import { ReactNode } from "react";
import { Inbox, AlertTriangle, RefreshCw } from "lucide-react";

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-slate-100 bg-white" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-4 px-6 py-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-3.5 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 sm:py-12 text-center bg-white">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 mb-2.5 shadow-2xs">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="text-xs sm:text-sm font-bold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-[11px] sm:text-xs text-slate-500 leading-relaxed">{body}</p>
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 sm:py-12 text-center bg-white">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 mb-2.5">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold text-rose-700 max-w-md">{message}</p>
      <button
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span>Try again</span>
      </button>
    </div>
  );
}
