/*
 * Logseq's journals: a day's page is a file named by `:journal/file-name-format` (`2026_11_14.md`)
 * and titled by `:journal/page-title-format` ("Nov 14th, 2026"), which links to it use. Both are
 * date-fns formats; these read and write the parts of them days need.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TOKEN = /yyyy|yy|MMMM|MMM|MM|M|do|dd|d|EEEE|EEE|EE|E|'[^']*'|[^yMdE']+/g;

const ordinal = (day: number) => `${day}${day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th"}`;
const two = (value: number) => String(value).padStart(2, "0");

/** A day, `{ year, month, day }` (month from 1), written as `format` says. */
export function formatDay({ year, month, day }: { year: number; month: number; day: number }, format: string) {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (format.match(TOKEN) ?? [])
    .map((token) => {
      switch (token) {
        case "yyyy":
          return String(year);
        case "yy":
          return two(year % 100);
        case "MMMM":
          return MONTHS[month - 1];
        case "MMM":
          return MONTHS[month - 1].slice(0, 3);
        case "MM":
          return two(month);
        case "M":
          return String(month);
        case "do":
          return ordinal(day);
        case "dd":
          return two(day);
        case "d":
          return String(day);
        case "EEEE":
          return DAYS[weekday];
        case "EEE":
        case "EE":
        case "E":
          return DAYS[weekday].slice(0, 3);
        default:
          return token.startsWith("'") ? token.slice(1, -1) : token;
      }
    })
    .join("");
}

/** The day a name written as `format` says (a journal's file name), or null if it isn't one. */
export function readDay(name: string, format: string) {
  let pattern = "";
  for (const token of format.match(TOKEN) ?? []) {
    if (token === "yyyy") pattern += "(?<year>\\d{4})";
    else if (token === "MM" || token === "M") pattern += "(?<month>\\d{1,2})";
    else if (token === "dd" || token === "d") pattern += "(?<day>\\d{1,2})";
    else if (/^[yMdE]/.test(token)) return null;
    else pattern += (token.startsWith("'") ? token.slice(1, -1) : token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  const groups = new RegExp(`^${pattern}$`).exec(name)?.groups;
  if (!groups) return null;
  const day = { year: Number(groups.year), month: Number(groups.month), day: Number(groups.day) };
  return day.month >= 1 && day.month <= 12 && day.day >= 1 && day.day <= 31 ? day : null;
}

/** A day as lines writes one: `2026-11-14`. */
export const isoDay = ({ year, month, day }: { year: number; month: number; day: number }) => `${year}-${two(month)}-${two(day)}`;
