export function formatDateTime(value: string | null): string {
  if (!value) return "--";
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function relativeTo(value: string | null): string {
  if (!value) return "";
  const diff = new Date(value).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return "now";
  if (Math.abs(mins) < 60) return mins > 0 ? `in ${mins}m` : `${-mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs > 0 ? `in ${hrs}h` : `${-hrs}h ago`;
}

/** Local datetime-input value for "now + n minutes". */
export function localInputValue(offsetMinutes = 2): string {
  const d = new Date(Date.now() + offsetMinutes * 60000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
