import { locale } from "./i18n/index.svelte";

// In the app's language (which changing restarts the app), as the device writes it.
const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
const day = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
const full = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" });
const longDay = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" });
const longDayYear = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", year: "numeric" });
const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day");
const yesterdayLabel = relative[0].toLocaleUpperCase() + relative.slice(1);
const ago = new Intl.RelativeTimeFormat(locale, { numeric: "always" });

/** Each unit a time ago is told in, and how many seconds it is, the largest first: no weeks, as "1 week ago" for 13 days misleads. */
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400],
  ["month", 30 * 86_400],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
];

export function formatDate(ms: number, now = new Date()): string {
  const date = new Date(ms);
  if (date.toDateString() === now.toDateString()) return time.format(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return yesterdayLabel;
  return date.getFullYear() === now.getFullYear() ? day.format(date) : full.format(date);
}

/** A day, "November 15", with its year if it's not this one. */
export function formatDay(ms: number, now = new Date()): string {
  const date = new Date(ms);
  return (date.getFullYear() === now.getFullYear() ? longDay : longDayYear).format(date);
}

/** How long ago a time was, in its largest whole unit, as a number: "3 hours ago", "13 days ago", "1 day ago" (not "yesterday", nor "last month" for 45 days). */
export function formatAgo(ms: number, now = Date.now()): string {
  const seconds = Math.max(0, (now - ms) / 1000);
  const [unit, size] = UNITS.find(([, size]) => seconds >= size) ?? UNITS.at(-1)!;
  return ago.format(-Math.floor(seconds / size), unit);
}
