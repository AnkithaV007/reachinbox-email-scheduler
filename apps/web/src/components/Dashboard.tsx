"use client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { EmailTable } from "./EmailTable";
import { ComposeView } from "./ComposeView";
import { ConfirmModal } from "./ui/ConfirmModal";
import { useToast } from "./ui/Toast";
import { Button } from "./ui/Button";
import { api } from "@/lib/api";
import {
  CalendarDays,
  Send,
  Plus,
  Search,
  Filter,
  Trash2,
} from "lucide-react";
import type { EmailRow, Sender } from "@/types";

type Tab = "scheduled" | "sent";

export function Dashboard() {
  const { data: session } = useSession();
  const token = session?.idToken;
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("scheduled");
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});

  const load = useCallback(async (isPolling = false) => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (!isPolling) {
      setError(null);
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const [data, statsData] = await Promise.all([
        tab === "scheduled" ? api.scheduled(token, page, search) : api.sent(token, page, search),
        api.stats(token).catch(() => ({})),
      ]);
      setRows(data.items);
      setTotal(data.total);
      setStats(statsData);
    } catch (err) {
      if (!isPolling) {
        setError(err instanceof Error ? err.message : "Could not load email jobs");
      }
    } finally {
      if (!isPolling) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [tab, page, search, token]);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(true);
      }
    }, 4000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (token) api.senders(token).then(setSenders).catch(() => setSenders([]));
  }, [token]);

  async function handleDeleteEmail(emailId: string) {
    try {
      await api.deleteSentEmail(token, emailId);
      toast("Email record deleted.");
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete email record", "error");
    }
  }

  async function handleClearSentHistory() {
    setClearing(true);
    try {
      const res = await api.clearSentHistory(token);
      toast(`Email history cleared (${res.deleted} record(s) removed).`);
      setClearHistoryOpen(false);
      setPage(1);
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not clear email history", "error");
    } finally {
      setClearing(false);
    }
  }

  const scheduledCount = (stats.scheduled ?? 0) + (stats.queued ?? 0) + (stats.sending ?? 0);
  const sentCount = stats.sent ?? 0;
  const failedCount = stats.failed ?? 0;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Left Sidebar */}
      <div className="hidden lg:block lg:w-64 shrink-0">
        <div className="sticky top-0 h-screen">
          <Sidebar
            activeTab={tab}
            composeOpen={composeOpen}
            onTabChange={(t) => {
              setTab(t);
              setComposeOpen(false);
              setPage(1);
            }}
            onComposeClick={() => setComposeOpen(true)}
            senders={senders}
            scheduledCount={scheduledCount}
            sentCount={sentCount}
            userName={session?.user?.name ?? ""}
            userEmail={session?.user?.email ?? ""}
            userImage={session?.user?.image}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        <Header
          name={session?.user?.name ?? ""}
          email={session?.user?.email ?? ""}
          image={session?.user?.image}
        />

        <main className={composeOpen ? "flex-1 flex flex-col overflow-hidden" : "flex-1 px-4 py-6 sm:px-8"}>
          {composeOpen ? (
            /* Full-page compose — no outer padding, fills all remaining viewport */
            <div className="flex-1 flex flex-col min-h-0 w-full">
              <ComposeView
                onBack={() => setComposeOpen(false)}
                onScheduled={() => {
                  setTab("scheduled");
                  setPage(1);
                  void load();
                }}
                token={token}
                senders={senders}
              />
            </div>
          ) : (
            /* Email List Main View */
            <>
              {/* Header */}
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    {tab === "scheduled" ? "Scheduled Emails" : "Sent Emails"}
                  </h1>
                  <p className="mt-1 text-xs text-slate-500">
                    {tab === "scheduled"
                      ? "Queued outbound campaigns waiting for delivery."
                      : "Delivered email history and preview records."}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {tab === "sent" && (sentCount > 0 || failedCount > 0) && (
                    <button
                      type="button"
                      onClick={() => setClearHistoryOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/60 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-all shadow-2xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Clear History</span>
                    </button>
                  )}

                  <Button
                    onClick={() => setComposeOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs px-4 py-2.5 rounded-xl border border-indigo-700"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Compose Email</span>
                  </Button>
                </div>
              </div>

              {/* Email Content Card Container */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                {/* Controls Bar: Tabs + Filter + Search */}
                <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50">
                  {/* Folder Navigation Tabs */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setTab("scheduled");
                        setPage(1);
                      }}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        tab === "scheduled"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                      }`}
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>Scheduled ({scheduledCount})</span>
                    </button>

                    <button
                      onClick={() => {
                        setTab("sent");
                        setPage(1);
                      }}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        tab === "sent"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                      }`}
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Sent ({sentCount})</span>
                    </button>
                  </div>

                  {/* Time Filter & Search Bar */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                      <Filter className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-700">All Time</span>
                    </div>

                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Search email or subject..."
                        className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:outline-none"
                      />
                      {search && (
                        <button
                          onClick={() => {
                            setSearch("");
                            setPage(1);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Email Table List */}
                <EmailTable
                  rows={rows}
                  total={total}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  loading={loading}
                  error={error}
                  onRetry={() => void load(false)}
                  mode={tab}
                  onDeleteEmail={handleDeleteEmail}
                  emptyAction={
                    <Button
                      onClick={() => setComposeOpen(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 py-2 font-semibold"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Compose New Email
                    </Button>
                  }
                />
              </div>
            </>
          )}
        </main>
      </div>

      {/* Clear History Confirmation Modal */}
      <ConfirmModal
        open={clearHistoryOpen}
        onClose={() => setClearHistoryOpen(false)}
        title="Clear email history?"
        message="This will permanently remove all sent and failed email records for your account. Emails that have already been processed cannot be recalled."
        confirmLabel="Clear History"
        loading={clearing}
        onConfirm={handleClearSentHistory}
      />
    </div>
  );
}
