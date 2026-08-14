import type { EmailRow, Paginated, SchedulePayload, ScheduleResult, Sender } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, token: string | undefined, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    if (res.status === 401) throw new ApiError("Session expired. Sign in again.", 401);
    throw new ApiError(detail.error ?? `Request failed (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  senders: (t?: string) => request<Sender[]>("/senders", t),

  scheduled: (t: string | undefined, page = 1, search = "") =>
    request<Paginated<EmailRow>>(
      `/emails/scheduled?page=${page}&search=${encodeURIComponent(search)}`,
      t
    ),

  sent: (t: string | undefined, page = 1, search = "") =>
    request<Paginated<EmailRow>>(
      `/emails/sent?page=${page}&search=${encodeURIComponent(search)}`,
      t
    ),

  schedule: (t: string | undefined, payload: SchedulePayload) =>
    request<ScheduleResult>("/campaigns", t, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  stats: (t?: string) => request<Record<string, number>>("/stats", t),

  cancelCampaign: (t: string | undefined, campaignId: string) =>
    request<{ cancelled: number }>(`/campaigns/${campaignId}`, t, { method: "DELETE" }),

  deleteSentEmail: (t: string | undefined, emailId: string) =>
    request<{ deleted: boolean }>(`/emails/sent/${emailId}`, t, { method: "DELETE" }),

  clearSentHistory: (t: string | undefined) =>
    request<{ deleted: number }>("/emails/sent", t, { method: "DELETE" }),
};
