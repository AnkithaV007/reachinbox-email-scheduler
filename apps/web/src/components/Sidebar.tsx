"use client";
import {
  CalendarDays,
  Send,
  Plus,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import type { Sender } from "@/types";

type NavigationTab = "scheduled" | "sent";

interface SidebarProps {
  activeTab: NavigationTab;
  composeOpen: boolean;
  onTabChange: (tab: NavigationTab) => void;
  onComposeClick: () => void;
  senders: Sender[];
  scheduledCount: number;
  sentCount: number;
  userName?: string;
  userEmail?: string;
  userImage?: string | null;
}

export function Sidebar({
  activeTab,
  composeOpen,
  onTabChange,
  onComposeClick,
  senders,
  scheduledCount,
  sentCount,
  userName,
  userEmail,
  userImage,
}: SidebarProps) {
  const activeSender = senders[0];
  const usedThisHour = activeSender?.usedThisHour ?? 0;
  const hourlyLimit = activeSender?.hourlyLimit ?? 200;
  const usagePercentage = Math.min(Math.round((usedThisHour / Math.max(hourlyLimit, 1)) * 100), 100);

  return (
    <aside className="flex h-full w-64 flex-col justify-between border-r border-slate-200 bg-white p-4">
      <div>
        {/* 1. Brand Header */}
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 font-bold text-white shadow-xs text-base">
            R
          </span>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900 leading-tight block">
              ReachInbox
            </span>
            <span className="text-[11px] font-semibold text-indigo-600 leading-tight">
              Email Scheduler
            </span>
          </div>
        </div>

        {/* 2. User Profile Section (Top directly under ReachInbox branding) */}
        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-2.5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userImage}
                alt={userName || "User"}
                className="h-8 w-8 shrink-0 rounded-full ring-2 ring-slate-200 object-cover"
              />
            ) : (
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200">
                {userName ? userName.charAt(0).toUpperCase() : "U"}
              </div>
            )}
            <div className="overflow-hidden text-left">
              <p className="truncate text-xs font-bold leading-tight text-slate-900">{userName || "User"}</p>
              <p className="truncate text-[11px] leading-tight text-slate-500">{userEmail}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Logout"
            aria-label="Logout"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* 3. Primary Action Button: Compose Email */}
        <div className="mt-4">
          <button
            type="button"
            onClick={onComposeClick}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
              composeOpen
                ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-600 ring-offset-2"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>Compose Email</span>
          </button>
        </div>

        {/* 4. Core Navigation Items */}
        <nav className="mt-5 space-y-1.5" aria-label="Mail Navigation">
          {/* Scheduled Nav */}
          <button
            type="button"
            onClick={() => onTabChange("scheduled")}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
              !composeOpen && activeTab === "scheduled"
                ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100/80 shadow-2xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <CalendarDays
                className={`h-4 w-4 shrink-0 ${
                  !composeOpen && activeTab === "scheduled" ? "text-indigo-600" : "text-slate-400"
                }`}
              />
              <span>Scheduled</span>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                !composeOpen && activeTab === "scheduled"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {scheduledCount}
            </span>
          </button>

          {/* Sent Nav */}
          <button
            type="button"
            onClick={() => onTabChange("sent")}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
              !composeOpen && activeTab === "sent"
                ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100/80 shadow-2xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <Send
                className={`h-4 w-4 shrink-0 ${
                  !composeOpen && activeTab === "sent" ? "text-indigo-600" : "text-slate-400"
                }`}
              />
              <span>Sent</span>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                !composeOpen && activeTab === "sent"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {sentCount}
            </span>
          </button>
        </nav>
      </div>

      {/* 5. Hourly Usage Progress Card near bottom */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Hourly Usage</span>
          <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
            {usagePercentage}%
          </span>
        </div>
        <p className="mt-2 text-xs font-semibold text-slate-900">
          {usedThisHour} / {hourlyLimit} <span className="font-normal text-slate-500">emails used</span>
        </p>

        {/* Progress Bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
        <p className="mt-2 text-[10px] text-slate-400">Resets next hour window</p>
      </div>
    </aside>
  );
}
