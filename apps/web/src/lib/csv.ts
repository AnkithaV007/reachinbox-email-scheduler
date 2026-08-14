const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Pulls addresses out of a CSV or plain text upload.
 *
 * Deliberately format-agnostic: headers, quoting, and column order vary wildly
 * across lead exports, so it scans for anything shaped like an address and
 * de-dupes, rather than assuming a schema.
 */
export function extractEmails(text: string): { emails: string[]; duplicates: number } {
  const found = text.match(EMAIL_RE) ?? [];
  const normalized = found.map((e) => e.toLowerCase());
  const unique = [...new Set(normalized)];
  return { emails: unique, duplicates: normalized.length - unique.length };
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsText(file);
  });
}
