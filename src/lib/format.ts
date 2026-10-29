const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const day = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const full = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(-1, "day");
const yesterdayLabel = relative[0].toLocaleUpperCase() + relative.slice(1);

export function formatDate(ms: number, now = new Date()): string {
  const date = new Date(ms);
  if (date.toDateString() === now.toDateString()) return time.format(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return yesterdayLabel;
  return date.getFullYear() === now.getFullYear() ? day.format(date) : full.format(date);
}
