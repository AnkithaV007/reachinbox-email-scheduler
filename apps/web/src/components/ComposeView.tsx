"use client";
import { useCallback, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { FieldError } from "./ui/Field";
import { useToast } from "./ui/Toast";
import { extractEmails, readFileAsText } from "@/lib/csv";
import { localInputValue } from "@/lib/format";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  Clock,
  Upload,
  ChevronDown,
  Paperclip,
  X,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-react";
import type { Sender } from "@/types";

interface Props {
  onBack: () => void;
  onScheduled: () => void;
  token?: string;
  senders: Sender[];
}

// ─── helpers ────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function isValidEmail(s: string) {
  return EMAIL_RE.test(s.trim());
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

// ─── RichEditor ─────────────────────────────────────────────────────────────

interface RichEditorProps {
  editorRef: React.RefObject<HTMLDivElement>;
  onChange: (html: string) => void;
}

function RichEditor({ editorRef, onChange }: RichEditorProps) {
  const exec = useCallback((cmd: string, value?: string) => {
    // Focus the editor first so execCommand targets it
    editorRef.current?.focus();
    document.execCommand(cmd, false, value ?? undefined);
    // Sync state after command
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [editorRef, onChange]);

  const toolbarBtn = (
    label: string,
    icon: React.ReactNode,
    cmd: string,
    value?: string
  ) => (
    <button
      key={cmd + (value ?? "")}
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => {
        // prevent blur before execCommand
        e.preventDefault();
        exec(cmd, value);
      }}
      style={{
        padding: "4px",
        border: "none",
        background: "none",
        cursor: "pointer",
        color: "#64748b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "4px",
        transition: "color 0.12s, background 0.12s",
      }}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "#0f172a";
        (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9";
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
        (e.currentTarget as HTMLButtonElement).style.background = "none";
      }}
    >
      {icon}
    </button>
  );

  const sep = (key: string) => (
    <div
      key={key}
      style={{ width: "1px", height: "14px", background: "#e2e8f0", margin: "0 2px" }}
    />
  );

  return (
    <div>
      {/* Toolbar */}
      <div
        style={{
          display: "inline-flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "2px",
          borderRadius: "10px",
          border: "1px solid rgba(226,232,240,0.8)",
          backgroundColor: "#ffffff",
          padding: "6px 10px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          marginBottom: "10px",
        }}
      >
        {toolbarBtn("Undo", <Undo2 size={14} />, "undo")}
        {toolbarBtn("Redo", <Redo2 size={14} />, "redo")}
        {sep("s1")}
        {/* Text style label */}
        <button
          type="button"
          title="Normal text"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("formatBlock", "p");
          }}
          style={{
            padding: "4px 6px",
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "#64748b",
            fontSize: "12px",
            fontWeight: "700",
            borderRadius: "4px",
            transition: "color 0.12s, background 0.12s",
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#0f172a";
            (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
            (e.currentTarget as HTMLButtonElement).style.background = "none";
          }}
        >
          Tt
        </button>
        {toolbarBtn("Bold", <Bold size={14} />, "bold")}
        {toolbarBtn("Italic", <Italic size={14} />, "italic")}
        {toolbarBtn("Underline", <Underline size={14} />, "underline")}
        {toolbarBtn("Strikethrough", <Strikethrough size={14} />, "strikeThrough")}
        {sep("s2")}
        {toolbarBtn("Align Left", <AlignLeft size={14} />, "justifyLeft")}
        {toolbarBtn("Align Center", <AlignCenter size={14} />, "justifyCenter")}
        {toolbarBtn("Align Right", <AlignRight size={14} />, "justifyRight")}
        {sep("s3")}
        {toolbarBtn("Bullet List", <List size={14} />, "insertUnorderedList")}
        {toolbarBtn("Numbered List", <ListOrdered size={14} />, "insertOrderedList")}
        {toolbarBtn("Blockquote", <Quote size={14} />, "formatBlock", "blockquote")}
      </div>

      {/* Contenteditable editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        data-placeholder="Type Your Reply..."
        style={{
          minHeight: "200px",
          outline: "none",
          fontSize: "12px",
          color: "#0f172a",
          lineHeight: "1.7",
          fontFamily: "inherit",
          wordBreak: "break-word",
        }}
      />

      <style>{`
        [contenteditable]:empty:not(:focus)::before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
        [contenteditable] blockquote {
          border-left: 3px solid #e2e8f0;
          margin: 4px 0;
          padding-left: 12px;
          color: #64748b;
        }
        [contenteditable] ul { list-style: disc; padding-left: 20px; }
        [contenteditable] ol { list-style: decimal; padding-left: 20px; }
      `}</style>
    </div>
  );
}

// ─── ComposeView ─────────────────────────────────────────────────────────────

export function ComposeView({ onBack, onScheduled, token, senders }: Props) {
  const toast = useToast();
  const editorRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Recipients — combined from CSV upload + manual tag entry
  const [recipients, setRecipients] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);

  // Manual "To" tag input
  const [toInput, setToInput] = useState("");

  // From field — dropdown only (configured system senders)
  const [senderId, setSenderId] = useState<string>("");

  const [startAt, setStartAt] = useState(localInputValue(2));
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSchedulePopover, setShowSchedulePopover] = useState(false);

  // Attachment — store actual File + preview info
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<{ name: string; size: string } | null>(null);

  // ── Estimate ──
  const perHour =
    recipients.length === 0
      ? 0
      : Math.min(hourlyLimit, Math.floor(3600 / Math.max(delaySeconds, 1)));
  const hours = perHour === 0 ? 0 : recipients.length / perHour;
  const estimate = recipients.length > 0 ? { perHour, hours } : null;

  // ── CSV/TXT file upload ──
  async function handleFile(file: File) {
    try {
      const text = await readFileAsText(file);
      const { emails, duplicates: dups } = extractEmails(text);
      setFileName(file.name);
      // Merge with existing manual recipients, de-dupe
      const merged = [...new Set([...recipients, ...emails])];
      const addedDups = recipients.length + emails.length - merged.length;
      setRecipients(merged);
      setDuplicates((prev) => prev + dups + addedDups);
      setErrors((e) => ({ ...e, recipients: "" }));
      if (emails.length === 0) {
        setErrors((e) => ({ ...e, recipients: "No valid email addresses found in file." }));
      } else {
        toast(`Parsed ${emails.length} recipient(s) from ${file.name}`);
      }
    } catch {
      toast("Could not read uploaded CSV/text file", "error");
    }
  }

  // ── Manual "To" tag logic ──
  function addManualEmail(raw: string) {
    const parts = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const p of parts) {
      if (isValidEmail(p)) valid.push(p);
      else if (p.length > 0) invalid.push(p);
    }
    if (valid.length > 0) {
      setRecipients((prev) => {
        const merged = [...new Set([...prev, ...valid])];
        return merged;
      });
      setErrors((e) => ({ ...e, recipients: "" }));
    }
    if (invalid.length > 0) {
      toast(`Invalid email(s) skipped: ${invalid.join(", ")}`, "error");
    }
    setToInput("");
  }

  function removeRecipient(email: string) {
    setRecipients((prev) => prev.filter((r) => r !== email));
  }

  function handleToKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (toInput.trim()) addManualEmail(toInput);
    } else if (e.key === "Backspace" && toInput === "" && recipients.length > 0) {
      // Remove last tag on backspace
      setRecipients((prev) => prev.slice(0, -1));
    }
  }

  // ── Attachment ──
  function handleAttachmentSelect(file: File) {
    const szMb = (file.size / (1024 * 1024)).toFixed(1);
    setAttachmentFile(file);
    setAttachmentPreview({ name: file.name, size: `${szMb} MB` });
    if (file.size > 1024 * 1024) {
      toast(`Attached: ${file.name} (${szMb} MB) — large files may be rejected by some email providers`, "error");
    } else {
      toast(`Attached: ${file.name}`);
    }
  }

  function removeAttachment() {
    setAttachmentFile(null);
    setAttachmentPreview(null);
  }

  // ── Validation ──
  function validate() {
    const next: Record<string, string> = {};
    if (!subject.trim()) next.subject = "Please add a subject line.";
    if (!body.trim() && !editorRef.current?.innerText?.trim())
      next.body = "Please add message body content.";
    if (recipients.length === 0)
      next.recipients = "Add at least one recipient email address.";
    if (!startAt) next.startAt = "Select an intended start time.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Submit ──
  async function submit() {
    // Sync body from editor before validating
    const currentBody = editorRef.current?.innerHTML ?? body;
    setBody(currentBody);

    if (!validate()) return;
    setSubmitting(true);
    try {
      let finalBody = currentBody;

      // Embed attachment into HTML body
      if (attachmentFile) {
        try {
          const dataUrl = await readFileAsDataURL(attachmentFile);
          const isImage = attachmentFile.type.startsWith("image/");
          if (isImage) {
            finalBody +=
              `<br/><p><strong>Attachment:</strong></p>` +
              `<img src="${dataUrl}" alt="${attachmentFile.name}" style="max-width:100%;border:1px solid #e2e8f0;border-radius:6px;" />`;
          } else {
            finalBody +=
              `<br/><p><strong>Attachment:</strong> ` +
              `<a href="${dataUrl}" download="${attachmentFile.name}">${attachmentFile.name}</a></p>`;
          }
        } catch {
          toast("Could not read attachment — sending without it", "error");
        }
      }

      const result = await api.schedule(token, {
        subject: subject.trim(),
        body: finalBody,
        recipients,
        startAt: new Date(startAt).toISOString(),
        delayMs: delaySeconds * 1000,
        hourlyLimit,
        senderId: senderId || undefined,
      });
      toast(`Successfully scheduled ${result.scheduled} emails via ${result.sender.email}`);
      onScheduled();
      onBack();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not schedule campaign", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePresetTime(hoursToAdd: number, targetHour?: number) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    if (targetHour !== undefined) {
      d.setHours(targetHour, 0, 0, 0);
    } else {
      d.setHours(d.getHours() + hoursToAdd);
    }
    const isoStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setStartAt(isoStr);
  }

  const selectedSender = senders.find((s) => s.id === senderId) || senders[0];
  const senderDisplayLabel = selectedSender
    ? `${selectedSender.name} (${selectedSender.email})`
    : "Auto-assign active system sender";

  // Determine file-type icon label for attachment preview
  const attachIconLabel = attachmentFile?.type.startsWith("image/")
    ? "IMG"
    : attachmentFile?.name.endsWith(".pdf")
    ? "PDF"
    : "FILE";

  return (
    /*
     * Outer: fill every pixel the Dashboard gives us.
     * Dashboard's <main> has no padding when compose is open,
     * so this div stretches edge-to-edge horizontally and
     * top-to-bottom vertically (min-h fills the column flex parent).
     */
    <div className="relative flex flex-col w-full min-h-full bg-white overflow-y-auto">
      {/* ── Top Header Bar ── */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-3 text-xl font-bold text-slate-900 hover:text-slate-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <ArrowLeft className="h-5 w-5 text-slate-700" />
          <span>Compose New Email</span>
        </button>

        {/* Right controls */}
        <div className="flex items-center gap-4">
          {/* Paperclip — functional attachment picker */}
          <label
            title="Attach file"
            className="relative cursor-pointer p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Paperclip className="h-4 w-4" />
            <input
              type="file"
              onChange={(e) =>
                e.target.files?.[0] && handleAttachmentSelect(e.target.files[0])
              }
              className="hidden"
            />
            {attachmentPreview && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
                1
              </span>
            )}
          </label>

          {/* Schedule clock toggle */}
          <button
            type="button"
            onClick={() => setShowSchedulePopover((prev) => !prev)}
            title="Schedule Date & Time"
            aria-label="Schedule Date & Time"
            className={`p-1.5 transition-colors ${
              showSchedulePopover ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Clock className="h-4 w-4" />
          </button>

          {/* Send Later */}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-full border border-emerald-500 px-5 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
          >
            {submitting ? "Scheduling..." : "Send Later"}
          </button>
        </div>
      </div>

      {/* ── Main form ── */}
      <div className="flex-1 flex flex-col px-6 pt-5 pb-6 space-y-0 text-xs">

        {/* ── FROM ROW ── */}
        <div className="flex items-center gap-4 border-b border-slate-100 py-3">
          <span className="w-16 font-medium text-slate-500 shrink-0 text-xs">From</span>
          <div className="flex items-center gap-2 flex-1">
            {senders.length > 0 ? (
              <div className="relative">
                <select
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  className="appearance-none rounded-full bg-slate-100/80 px-4 py-1.5 pr-9 text-xs font-medium text-slate-800 border-0 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="">{senderDisplayLabel}</option>
                  {senders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              </div>
            ) : (
              <span className="rounded-full bg-slate-100/80 px-4 py-1.5 text-xs font-medium text-slate-800">
                Auto-assign active system sender
              </span>
            )}
          </div>
        </div>

        {/* ── TO ROW ── */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3">
          <div className="flex items-start gap-4 flex-1">
            <span className="w-16 font-medium text-slate-500 shrink-0 text-xs pt-2">To</span>
            {/* Tag container */}
            <div
              className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[34px] cursor-text"
              onClick={() => {
                (document.getElementById("to-input") as HTMLInputElement | null)?.focus();
              }}
            >
              {/* Existing tags */}
              {recipients.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500 bg-emerald-50/60 px-3 py-1 text-xs font-medium text-emerald-700"
                >
                  {r}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecipient(r);
                    }}
                    className="ml-0.5 text-emerald-400 hover:text-emerald-700 transition-colors"
                    aria-label={`Remove ${r}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {duplicates > 0 && (
                <span className="text-[10px] text-slate-400 font-medium">
                  ({duplicates} duplicate removed)
                </span>
              )}
              {/* Typing input */}
              <input
                id="to-input"
                type="text"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                onKeyDown={handleToKeyDown}
                onBlur={() => {
                  if (toInput.trim()) addManualEmail(toInput);
                }}
                placeholder={
                  recipients.length === 0 ? "recipient@example.com, another@example.com" : ""
                }
                className="flex-1 min-w-[200px] bg-transparent py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* CSV/TXT Upload */}
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer transition-colors shrink-0 pt-2">
            <Upload className="h-3.5 w-3.5 text-emerald-600" />
            <span>Upload List</span>
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />
          </label>
        </div>
        {errors.recipients && <FieldError>{errors.recipients}</FieldError>}

        {/* ── SUBJECT ROW ── */}
        <div className="flex items-center gap-4 border-b border-slate-100 py-3">
          <span className="w-16 font-medium text-slate-500 shrink-0 text-xs">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 bg-transparent py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
          />
        </div>
        {errors.subject && <FieldError>{errors.subject}</FieldError>}

        {/* ── DELAY & HOURLY LIMIT ── */}
        <div className="flex flex-wrap items-center gap-8 border-b border-slate-100 py-3">
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-500 text-xs">Delay between 2 emails</span>
            <input
              type="number"
              min={0}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              className="w-14 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-500 text-xs">Hourly Limit</span>
            <input
              type="number"
              min={1}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
              className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {estimate && (
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
              Est.{" "}
              {estimate.hours < 1
                ? `${Math.ceil(estimate.hours * 60)} min`
                : `${estimate.hours.toFixed(1)} hrs`}
            </span>
          )}
        </div>

        {/* ── RICH TEXT EDITOR ── */}
        {/* flex-1 makes this section grow to fill remaining vertical space */}
        <div className="flex-1 flex flex-col rounded-2xl bg-slate-50/60 mt-3 border border-slate-100/80 overflow-hidden">
          {/* Editor surface: flex-1 lets it fill the panel */}
          <div className="flex-1 flex flex-col p-5">
            <RichEditor editorRef={editorRef} onChange={setBody} />

            {/* Attachment preview card */}
            {attachmentPreview && (
              <div className="mt-4 flex items-center gap-3 pt-3 border-t border-slate-200/60">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-xs">
                    {attachIconLabel}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{attachmentPreview.name}</p>
                    <p className="text-[10px] text-slate-400">{attachmentPreview.size}</p>
                  </div>
                  <button
                    type="button"
                    onClick={removeAttachment}
                    className="ml-2 text-slate-400 hover:text-slate-600"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>{/* /inner flex p-5 */}
        </div>{/* /outer editor panel */}
        {errors.body && <FieldError>{errors.body}</FieldError>}
      </div>{/* /main form */}

      {/* ── Schedule Popover ── */}
      {showSchedulePopover && (
        <div className="absolute right-6 top-14 z-30 w-80 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-xs font-bold text-slate-900">Send Later</h4>
            <button
              type="button"
              onClick={() => setShowSchedulePopover(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Pick date &amp; time
              </label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1 pt-1 border-t border-slate-100 text-xs">
              {[
                { label: "Tomorrow", fn: () => handlePresetTime(24) },
                { label: "Tomorrow, 10:00 AM", fn: () => handlePresetTime(0, 10) },
                { label: "Tomorrow, 11:00 AM", fn: () => handlePresetTime(0, 11) },
                { label: "Tomorrow, 3:00 PM", fn: () => handlePresetTime(0, 15) },
              ].map(({ label, fn }) => (
                <button
                  key={label}
                  type="button"
                  onClick={fn}
                  className="w-full text-left py-1.5 px-2 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="ghost"
                onClick={() => setShowSchedulePopover(false)}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={() => setShowSchedulePopover(false)}
                className="rounded-full border border-emerald-500 px-4 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
