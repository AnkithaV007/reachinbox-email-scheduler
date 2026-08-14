const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function extractEmails(text: string): { emails: string[]; duplicates: number } {
  const found = text.match(EMAIL_RE) ?? [];
  const normalized = found.map((e) => e.toLowerCase());
  const unique = [...new Set(normalized)];
  return { emails: unique, duplicates: normalized.length - unique.length };
}
