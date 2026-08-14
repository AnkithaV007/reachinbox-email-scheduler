"use client";
import { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";

const base =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 " +
  "focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600";

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">{children}</label>
      {hint && <span className="text-[11px] text-slate-400 font-normal">{hint}</span>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${base} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${base} resize-y ${props.className ?? ""}`} />;
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-rose-600 font-medium">{children}</p>;
}
