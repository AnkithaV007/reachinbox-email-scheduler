export type EmailStatus =
  | "scheduled"
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

export interface EmailRow {
  id: string;
  recipient: string;
  subject: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  attempts: number;
  lastError: string | null;
  previewUrl: string | null;
  sender: { email: string };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Sender {
  id: string;
  email: string;
  name: string;
  usedThisHour: number;
  hourlyLimit: number;
}

export interface SchedulePayload {
  subject: string;
  body: string;
  recipients: string[];
  startAt: string;
  delayMs: number;
  hourlyLimit: number;
  senderId?: string;
}

export interface ScheduleResult {
  campaignId: string;
  scheduled: number;
  duplicatesRemoved: number;
  sender: { id: string; email: string };
}
