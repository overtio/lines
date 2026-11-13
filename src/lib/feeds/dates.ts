/*
 * Dates and durations as feeds write them: RSS's dates (RFC 822, often a little off), Atom's
 * (ISO 8601), and podcasts' durations (`1882`, `31:22`, `1:02:03`).
 */

/** Time zones RSS dates name rather than give as an offset. */
const ZONES: Record<string, string> = {
  UT: "+0000",
  UTC: "+0000",
  GMT: "+0000",
  Z: "+0000",
  EST: "-0500",
  EDT: "-0400",
  CST: "-0600",
  CDT: "-0500",
  MST: "-0700",
  MDT: "-0600",
  PST: "-0800",
  PDT: "-0700",
  CET: "+0100",
  CEST: "+0200",
  BST: "+0100",
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * When a feed says something was published, in milliseconds; undefined if it can't be read. Takes
 * what browsers read themselves, and RSS dates they don't: a named zone, a day name that's wrong or
 * in another language, a two-digit year, a single-digit hour.
 */
export function readDate(text: string | null | undefined): number | undefined {
  const trimmed = text?.trim();
  if (!trimmed) return undefined;
  // ISO 8601 (Atom), which every browser reads alike.
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return valid(Date.parse(trimmed));
  const match = /(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*([a-z]+|[+-]\d{2}:?\d{2})?/i.exec(trimmed);
  if (!match) return valid(Date.parse(trimmed));
  const [, day, monthName, yearText, hours = "0", minutes = "0", seconds = "0", zoneText = "GMT"] = match;
  const month = MONTHS.indexOf(monthName.toLowerCase());
  if (month < 0) return valid(Date.parse(trimmed));
  let year = Number(yearText);
  if (yearText.length === 2) year += year < 50 ? 2000 : 1900;
  const zone = ZONES[zoneText.toUpperCase()] ?? (/^[+-]/.test(zoneText) ? zoneText.replace(":", "") : "+0000");
  const offset = (zone[0] === "-" ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(3, 5)));
  return valid(Date.UTC(year, month, Number(day), Number(hours), Number(minutes), Number(seconds)) - offset * 60_000);
}

const valid = (time: number) => (Number.isFinite(time) ? time : undefined);

/** A podcast episode's length in seconds, from `itunes:duration`: seconds, or `MM:SS`, or `HH:MM:SS`. */
export function readDuration(text: string | null | undefined): number | undefined {
  const trimmed = text?.trim();
  if (!trimmed || !/^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$/.test(trimmed)) return undefined;
  const seconds = trimmed.split(":").reduce((total, part) => total * 60 + Number(part), 0);
  return seconds > 0 ? Math.round(seconds) : undefined;
}
