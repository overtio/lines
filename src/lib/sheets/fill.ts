import { isFormula } from "./cells";
import { dateNumber, dateText, iso, isoParts } from "./display";

/*
 * Filling cells from those before them, as dragging a selection's corner does in Excel and Numbers.
 * What's filled from goes on as a series where it makes one: numbers (1, 2 → 3, 4, on their trend),
 * text ending in a number (Item 1 → Item 2), days and months (Mon → Tue, January, March → May, in
 * English and the app's language), and dates (2026-01-31 → 2026-02-01; a month apart, by months).
 * Anything else repeats, formulas moving as copying moves them. One number repeats, as in Excel;
 * `other` swaps the two, so one number counts up and a series repeats.
 */

export interface FillOptions {
  /** Swaps going on and repeating, as ⌥ (Ctrl on Windows) does dragging in Excel. */
  other?: boolean;
  /** The app's locale, whose day and month names make series as English ones do. */
  locale?: string;
  /** A formula as it reads `steps` cells further along. */
  moved: (formula: string, steps: number) => string;
}

const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;
const NUMBERED = /^(.*?)(\d+)(\D*)$/;

/** The `count` cells after `cells`, which are in the order they're filled in. */
export function continueCells(cells: string[], count: number, options: FillOptions): string[] {
  const next = cells.some(isFormula) ? null : series(cells, options);
  return Array.from({ length: count }, (_, i) => {
    if (next) return next(cells.length + i);
    // Repeated, each cell after the one as many back as there are cells filled from.
    const from = i % cells.length;
    const text = cells[from];
    return isFormula(text) ? options.moved(text, cells.length + i - from) : text;
  });
}

/** What's at each place along a series the cells make, counting from the first; null if they don't make one. */
function series(cells: string[], { other = false, locale }: FillOptions): ((at: number) => string) | null {
  if (!cells.length || cells.some((cell) => !cell)) return null;
  const one = cells.length === 1;
  if (cells.every((cell) => NUMBER.test(cell))) {
    // One number repeats, unless swapped; several go on along their trend, unless swapped.
    if (one ? !other : other) return null;
    const numbers = cells.map(Number);
    const decimals = Math.max(...cells.map((cell) => /\.(\d+)/.exec(cell)?.[1].length ?? 0));
    const trend = one ? (at: number) => numbers[0] + at : line(numbers);
    return (at) => written(trend(at), decimals);
  }
  if (other) return null;
  return dates(cells) ?? names(cells, locale) ?? names(cells.map((cell) => cell.replace(SEPT, "$1$2")), locale) ?? numbered(cells);
}

/** The straight line that best fits numbers at 0, 1, 2…, as Excel's series follow: exactly an arithmetic one's. */
function line(numbers: number[]) {
  const n = numbers.length;
  const meanX = (n - 1) / 2;
  const meanY = numbers.reduce((sum, y) => sum + y, 0) / n;
  let across = 0;
  let spread = 0;
  numbers.forEach((y, x) => {
    across += (x - meanX) * (y - meanY);
    spread += (x - meanX) ** 2;
  });
  const slope = across / spread;
  return (at: number) => meanY + slope * (at - meanX);
}

/** A number as a cell has it: without the last digits' rounding errors, and with as many decimals as those filled from if it has no more. */
function written(n: number, decimals: number) {
  const exact = Number(n.toPrecision(15));
  const fixed = exact.toFixed(decimals);
  return Number(fixed) === exact ? fixed : String(exact);
}

/** The step between each of the numbers and the next, if it's always the same. */
function steady(numbers: number[]): number | null {
  if (numbers.length === 1) return 1;
  const step = numbers[1] - numbers[0];
  return numbers.every((n, i) => !i || n - numbers[i - 1] === step) ? step : null;
}

/** Text with a number at the end (Item 1, Q3, Room 007), each one the same around it. */
function numbered(cells: string[]) {
  const parts = cells.map((cell) => NUMBERED.exec(cell));
  const [, before, digits, after] = parts[0] ?? [];
  if (parts.some((part) => !part || part[1] !== before || part[3] !== after)) return null;
  const step = steady(parts.map((part) => Number(part![2])));
  if (step === null) return null;
  // Room 007 → Room 008, keeping the zeros.
  const width = digits.startsWith("0") ? digits.length : 0;
  return (at: number) => `${before}${String(Math.abs(Number(digits) + step * at)).padStart(width, "0")}${after}`;
}

/** Dates written as ISO dates: a day apart (or as many), or the same day of each month or year. */
function dates(cells: string[]) {
  const parts = cells.map(isoParts);
  if (parts.some((part) => !part)) return null;
  const [year, month, day] = parts[0]!;
  const months = parts.map((part) => part![0] * 12 + part![1] - 1);
  const monthStep = cells.length > 1 && parts.every((part) => part![2] === day) ? steady(months) : null;
  if (monthStep) {
    return (at: number) => {
      const whole = year * 12 + month - 1 + monthStep * at;
      const [y, m] = [Math.floor(whole / 12), ((whole % 12) + 12) % 12];
      // The 31st a month on is the last day of a shorter month.
      const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      return iso(y, m + 1, Math.min(day, last));
    };
  }
  const days = cells.map((cell) => dateNumber(cell)!);
  const step = steady(days);
  return step === null ? null : (at: number) => dateText(days[0] + step * at);
}

/** Days' and months' names, long and short, in English and the app's language. */
const lists = new Map<string, string[][]>();
function namesIn(locale: string) {
  let found = lists.get(locale);
  if (!found) {
    found = [];
    for (const tag of new Set(["en", locale.split("-")[0]])) {
      for (const style of ["long", "short"] as const) {
        const day = new Intl.DateTimeFormat(tag, { weekday: style, timeZone: "UTC" });
        const month = new Intl.DateTimeFormat(tag, { month: style, timeZone: "UTC" });
        // 1 January 2024 was a Monday.
        found.push(Array.from({ length: 7 }, (_, i) => day.format(Date.UTC(2024, 0, 1 + i))));
        found.push(Array.from({ length: 12 }, (_, i) => month.format(Date.UTC(2024, i, 1))));
      }
    }
    lists.set(locale, found);
  }
  return found;
}

const plain = (name: string) => name.toLocaleLowerCase().replace(/\.$/, "");

/** September as Sept, as it's often written, for English's Sep. */
const SEPT = /^(sep)t(\.?)$/i;

/** Days or months by name (Monday, Tue, March), going round the week or year, written as the first is. */
function names(cells: string[], locale = "en") {
  const like = cells[0];
  for (const list of namesIn(locale)) {
    const at = cells.map((cell) => list.findIndex((name) => plain(name) === plain(cell)));
    if (at.some((i) => i < 0)) continue;
    const round = (i: number) => ((i % list.length) + list.length) % list.length;
    const step = cells.length === 1 ? 1 : round(at[1] - at[0]);
    if (!step || at.some((i, n) => n && round(i - at[n - 1]) !== step)) return null;
    return (place: number) => {
      const name = list[round(at[0] + step * place)];
      const dotted = like.endsWith(".") ? name : name.replace(/\.$/, "");
      if (like === like.toLocaleUpperCase()) return dotted.toLocaleUpperCase();
      if (like === like.toLocaleLowerCase()) return dotted.toLocaleLowerCase();
      return dotted.charAt(0).toLocaleUpperCase() + dotted.slice(1);
    };
  }
  return null;
}
