"use client";
import { useMemo, useState } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Input, Label, Textarea, FieldError } from "./ui/Field";
import { useToast } from "./ui/Toast";
import { extractEmails, readFileAsText } from "@/lib/csv";
import { localInputValue } from "@/lib/format";
import { api } from "@/lib/api";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import type { Sender } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
  token?: string;
  senders: Sender[];
}

export function ComposeModal({ open, onClose, onScheduled, token, senders }: Props) {
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState(0);
  const [startAt, setStartAt] = useState(localInputValue(2));
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [senderId, setSenderId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);

  const estimate = useMemo(() => {
    if (recipients.length === 0) return null;
    const perHour = Math.min(hourlyLimit, Math.floor(3600 / Math.max(delaySeconds, 1)));
    const hours = recipients.length / Math.max(perHour, 1);
    return { perHour, hours };
  }, [recipients.length, hourlyLimit, delaySeconds]);

  async function handleFile(file: File) {
    try {
      const text = await readFileAsText(file);
      const { emails, duplicates } = extractEmails(text);
      setFileName(file.name);
      setRecipients(emails);
      setDuplicates(duplicates);
      setErrors((e) => ({ ...e, recipients: "" }));
      if (emails.length === 0) {
        setErrors((e) => ({ ...e, recipients: "No valid email addresses found in that file." }));
      } else {
        toast(`Parsed ${emails.length} valid recipient email(s) from ${file.name}`);
      }
    } catch {
      toast("Could not read uploaded CSV/text file", "error");
    }
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!subject.trim()) next.subject = "Please add a subject line.";
    if (!body.trim()) next.body = "Please add message body content.";
    if (recipients.length === 0) next.recipients = "Upload a CSV or text file containing lead email addresses.";
    if (!startAt) next.startAt = "Select an intended start time.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await api.schedule(token, {
        subject: subject.trim(),
        body,
        recipients,
        startAt: new Date(startAt).toISOString(),
        delayMs: delaySeconds * 1000,
        hourlyLimit,
        senderId: senderId || undefined,
      });
      toast(`Successfully scheduled ${result.scheduled} emails via ${result.sender.email}`);
      reset();
      onScheduled();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not schedule campaign", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setSubject("");
    setBody("");
    setFileName(null);
    setRecipients([]);
    setDuplicates(0);
    setErrors({});
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compose Outbound Campaign"
      description="Define campaign subject & body, upload lead lists, and configure delivery settings."
    >
      <div className="space-y-6 text-xs">
        {/* Section 1: Message */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5">
            1. Campaign Message
          </h3>

          <div>
            <Label>Subject Line</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Quick question about your cold outreach setup"
              className="bg-white border-slate-200 focus:border-indigo-600 text-xs"
            />
            <FieldError>{errors.subject}</FieldError>
          </div>

          <div>
            <Label hint="Plain text or standard HTML message content">Message Body</Label>
            <Textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {{name}}, I noticed your outreach queue workflow and..."
              className="bg-white border-slate-200 focus:border-indigo-600 text-xs font-sans"
            />
            <FieldError>{errors.body}</FieldError>
          </div>
        </div>

        {/* Section 2: Recipients */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5">
            2. Recipient Leads
          </h3>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
            }}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 transition-all text-center ${
              isDragging
                ? "border-indigo-600 bg-indigo-50"
                : "border-slate-200 bg-slate-50 hover:border-slate-300"
            }`}
          >
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-2xs">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {fileName ? fileName : "Drop your CSV or TXT file here"}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  or <span className="text-indigo-600 font-semibold underline">click to browse</span> (e.g. <span className="font-mono">samples/leads.csv</span>)
                </p>
              </div>
            </div>
          </div>

          {fileName && (
            <div className="flex items-center justify-between rounded-xl bg-indigo-50 border border-indigo-100 px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <span className="font-bold text-indigo-900">{recipients.length} valid recipients</span>
                <span className="text-slate-500">({fileName})</span>
              </div>
              {duplicates > 0 && (
                <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                  {duplicates} duplicate(s) removed
                </span>
              )}
            </div>
          )}
          <FieldError>{errors.recipients}</FieldError>
        </div>

        {/* Section 3: Delivery Settings */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5">
            3. Delivery Settings
          </h3>

          {senders.length > 0 && (
            <div>
              <Label hint="Per-sender hourly rate caps are enforced independently">Sender Identity</Label>
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none"
              >
                <option value="">Auto-assign active system sender</option>
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email}) — {s.usedThisHour}/{s.hourlyLimit} sent this hour
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Start Time</Label>
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="bg-white border-slate-200 text-xs"
              />
              <FieldError>{errors.startAt}</FieldError>
            </div>
            <div>
              <Label hint="gap between emails">Min Delay (sec)</Label>
              <Input
                type="number"
                min={0}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="bg-white border-slate-200 text-xs"
              />
            </div>
            <div>
              <Label hint="max / sender / hr">Hourly Cap</Label>
              <Input
                type="number"
                min={1}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="bg-white border-slate-200 text-xs"
              />
            </div>
          </div>

          {/* Batch Duration Estimate Banner */}
          {estimate && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-[11px] text-slate-600">
              <div className="flex items-center justify-between">
                <span>Estimated Rate: <strong className="text-slate-900">{estimate.perHour} emails/hr</strong></span>
                <span>Total Duration: <strong className="text-indigo-700 font-semibold">
                  {estimate.hours < 1 ? `${Math.ceil(estimate.hours * 60)} minutes` : `${estimate.hours.toFixed(1)} hours`}
                </strong></span>
              </div>
              <p className="mt-1 text-slate-500 text-[10px]">
                Note: Over-quota emails automatically delay into subsequent hourly windows without dropping.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <Button variant="ghost" onClick={onClose} className="text-slate-600 hover:text-slate-900">
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs px-5 py-2.5 rounded-xl border border-indigo-700"
          >
            {submitting ? "Scheduling Jobs..." : `Schedule ${recipients.length > 0 ? `${recipients.length} Emails` : "Campaign"}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
