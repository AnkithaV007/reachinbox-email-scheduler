"use client";
import { Bell } from "lucide-react";

interface HeaderProps {
  name?: string;
  email?: string;
  image?: string | null;
}

export function Header({ name }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6 shadow-2xs">
      <div className="flex items-center justify-between gap-4">
        {/* Mobile Branding / Title */}
        <div className="flex items-center gap-3 lg:hidden">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-600 font-bold text-white shadow-xs text-sm">
            R
          </span>
          <span className="text-base font-bold tracking-tight text-slate-900">ReachInbox</span>
        </div>

        {/* Dashboard Section Title / Quick Status */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Workspace:</span>
          <span className="text-xs font-bold text-slate-900">{name ? `${name}'s Outbound` : "Outbound Email Queue"}</span>
        </div>

        {/* Right Action: Neutral Bell */}
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            aria-label="Notifications"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
