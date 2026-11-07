/*
 * How spreadsheets show dates and money, as Settings → Editing → Spreadsheets says. Dates are kept
 * as ISO dates (2026-11-05), however they're typed (11/5/2026, 5 Nov 2026, November 5, 2026), so
 * every device and app reads them alike, and shown in the chosen style. Money is kept as written,
 * its symbol first ($1200, €5, CHF 30), and shown in the chosen currency style, its symbol at the
 * cell's left edge if chosen, as accounting formats show it. Amounts and numbers below zero show
 * with a minus or in parentheses, either in red.
 */

export type DateStyle = "medium" | "short" | "long" | "iso";
export type MoneyStyle = "symbol" | "whole" | "code";
export type NegativeStyle = "minus" | "parens" | "red" | "redParens";
export const DATE_STYLES: DateStyle[] = ["medium", "short", "long", "iso"];
export const MONEY_STYLES: MoneyStyle[] = ["symbol", "whole", "code"];
export const NEGATIVE_STYLES: NegativeStyle[] = ["minus", "parens", "red", "redParens"];

/** How cells show what's in them. */
export interface CellLook {
  dates: DateStyle;
  money: MoneyStyle;
  negative: NegativeStyle;
  /** Money's symbol at the cell's left edge, the amount at its right (where the locale writes the symbol first). */
  edge: boolean;
  /** The currency `$` and Format as Currency stand for. */
  currency: string;
  locale: string;
}

/**
 * What a cell shows: its text, money's symbol on its own when it goes at the cell's left edge,
 * whether it's in red, and whether it leaves room after it for the `)` of numbers below zero in
 * parentheses, so they line up.
 */
export interface Shown {
  text: string;
  symbol: string;
  red: boolean;
  room: boolean;
}
/** Currencies to choose from for "Format as Currency", by code. */
export const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY", "INR", "KRW", "BRL", "MXN", "SEK", "NOK", "DKK", "PLN", "UAH", "TRY", "ZAR", "SGD", "HKD", "NZD"];

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY = 86_400_000;

/** A currency's symbol, written before amounts, for those that have one of their own. */
const SYMBOLS: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₹": "INR", "₩": "KRW", "₽": "RUB", "₺": "TRY", "₪": "ILS", "₴": "UAH", "฿": "THB", "₱": "PHP", "₫": "VND", "₦": "NGN" };
const MONEY = new RegExp(`^([-+]?)\\s*(?:([${Object.keys(SYMBOLS).join("")}])|([A-Z]{3})\\s)\\s*([-+]?)\\s*(\\d[\\d,]*(?:\\.\\d+)?|\\.\\d+)$`);

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** A number format, made once: making one takes far longer than using it, and every cell shown uses one. */
export function numberFormat(locale: string, options: Intl.NumberFormatOptions) {
  const key = `${locale} ${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (!format) numberFormats.set(key, (format = new Intl.NumberFormat(locale, options)));
  return format;
}

/** A date format, made once. */
function dateFormat(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale} ${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) dateFormats.set(key, (format = new Intl.DateTimeFormat(locale, options)));
  return format;
}

/** The currency the device's region uses, for the setting's first choice. */
export function localCurrency(locale: string): string {
  const region = new Intl.Locale(locale).maximize().region ?? "";
  const known: Record<string, string> = { US: "USD", GB: "GBP", JP: "JPY", CH: "CHF", CA: "CAD", AU: "AUD", CN: "CNY", IN: "INR", KR: "KRW", BR: "BRL", MX: "MXN", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", UA: "UAH", TR: "TRY", ZA: "ZAR", SG: "SGD", HK: "HKD", NZ: "NZD" };
  const euro = ["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"];
  return known[region] ?? (euro.includes(region) ? "EUR" : "USD");
}

/* Dates. */

/** An ISO date's year, month and day, if it is one, and a real day. */
export function isoParts(text: string): [number, number, number] | null {
  const match = ISO.exec(text);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  return real(y, m, d) ? [y, m, d] : null;
}

const real = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
export const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Months' names, long and short, in English and the locale's language, lowercase without dots: their number by name. */
const monthNames = new Map<string, Map<string, number>>();
function monthsIn(locale: string) {
  let found = monthNames.get(locale);
  if (!found) {
    found = new Map();
    for (const tag of new Set(["en", locale])) {
      for (const style of ["long", "short"] as const) {
        const format = new Intl.DateTimeFormat(tag, { month: style, timeZone: "UTC" });
        for (let m = 0; m < 12; m++) found.set(format.format(Date.UTC(2024, m, 1)).toLocaleLowerCase().replace(/\.$/, ""), m + 1);
      }
    }
    // September as Sept, as it's often written.
    found.set("sept", 9);
    monthNames.set(locale, found);
  }
  return found;
}

/** The order the locale writes a date's numbers in: "mdy" in the US, "dmy" in most places, "ymd" in East Asia. */
function dateOrder(locale: string) {
  return dateFormat(locale, { day: "numeric", month: "numeric", year: "numeric" })
    .formatToParts(Date.UTC(2026, 10, 5))
    .flatMap(({ type }) => (type === "day" ? "d" : type === "month" ? "m" : type === "year" ? "y" : []))
    .join("");
}

/** A year written with two digits as Excel reads it: 00–29 in the 2000s, 30–99 in the 1900s. */
const fullYear = (y: string) => (y.length === 2 ? Number(y) + (Number(y) < 30 ? 2000 : 1900) : Number(y));

/**
 * A date typed in a usual way (2026-11-05, 2026/11/05, 11/5/2026 or 5/11/2026 as the locale writes
 * them, 5.11.26, Nov 5, 2026, 5 November 2026, 5 de noviembre de 2026) as an ISO date; null for
 * anything else.
 */
export function readDate(text: string, locale: string): string | null {
  const typed = text.trim();
  if (isoParts(typed)) return typed;
  let match = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(typed);
  if (match) {
    const [y, m, d] = match.slice(1).map(Number);
    return real(y, m, d) ? iso(y, m, d) : null;
  }
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(typed);
  if (match) {
    const order = dateOrder(locale);
    const [a, b] = [Number(match[1]), Number(match[2])];
    const [m, d] = order.indexOf("m") < order.indexOf("d") ? [a, b] : [b, a];
    const y = fullYear(match[3]);
    return real(y, m, d) ? iso(y, m, d) : null;
  }
  const words = typed.toLocaleLowerCase().replace(/\bde\b/g, " ").replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const months = monthsIn(locale);
  const month = (name: string) => months.get(name.replace(/\.$/, ""));
  // November 5 2026, Nov 5th 2026
  match = /^(\p{L}+\.?) (\d{1,2})(?:st|nd|rd|th)? (\d{4})$/u.exec(words);
  if (match && month(match[1])) {
    const [m, d, y] = [month(match[1])!, Number(match[2]), Number(match[3])];
    return real(y, m, d) ? iso(y, m, d) : null;
  }
  // 5 November 2026, 5. Nov 2026
  match = /^(\d{1,2})\.? (\p{L}+\.?) (\d{4})$/u.exec(words);
  if (match && month(match[2])) {
    const [d, m, y] = [Number(match[1]), month(match[2])!, Number(match[3])];
    return real(y, m, d) ? iso(y, m, d) : null;
  }
  return null;
}

const dateStyles = new Map<string, Intl.DateTimeFormat>();

/** The format of dates in a style, found quickly: every date shown is shown with it. */
function dateStyle(locale: string, style: Exclude<DateStyle, "iso">) {
  const key = `${locale} ${style}`;
  let format = dateStyles.get(key);
  if (!format) dateStyles.set(key, (format = dateFormat(locale, { dateStyle: style, timeZone: "UTC" })));
  return format;
}

/** An ISO date as the setting shows it, in the locale's way; anything else as it is. */
export function showDate(text: string, style: DateStyle, locale: string): string {
  const parts = isoParts(text);
  if (!parts || style === "iso") return text;
  const [y, m, d] = parts;
  return dateStyle(locale, style).format(Date.UTC(y, m - 1, d));
}

/** An ISO date as a number of days, for sorting and counting. */
export const dateNumber = (text: string) => {
  const parts = isoParts(text);
  return parts ? Date.UTC(parts[0], parts[1] - 1, parts[2]) / DAY : null;
};

/** A number of days as an ISO date. */
export const dateText = (days: number) => new Date(days * DAY).toISOString().slice(0, 10);

/* Money. */

/** Money as written or shown ($1,200.50, -€5, CHF 30): its symbol or code, and its amount. */
function moneyMatch(text: string) {
  const match = MONEY.exec(text.trim());
  if (!match) return null;
  const [, sign, symbol, code, after, digits] = match;
  const amount = Number(digits.replaceAll(",", "")) * (sign === "-" || after === "-" ? -1 : 1);
  return Number.isFinite(amount) ? { symbol, code, amount } : null;
}

/** An amount of money as written or shown ($1,200.50, -€5, CHF 30): its currency and amount. `$` is the chosen currency's, if that's a dollar. */
export function readMoney(text: string, chosen: string): { currency: string; amount: number } | null {
  const money = moneyMatch(text);
  if (!money) return null;
  const currency = money.code ?? (money.symbol === "$" && symbolOf(chosen) === "$" ? chosen : SYMBOLS[money.symbol]);
  return { currency, amount: money.amount };
}

/** An amount of money as written: what it's written with in front (`$`, or a code and a space: `CHF `), and its amount. */
export function writtenMoney(text: string): { symbol: string; amount: number } | null {
  const money = moneyMatch(text);
  return money && { symbol: money.code ? `${money.code} ` : money.symbol, amount: money.amount };
}

/** Currencies' symbols, worked out once. */
const symbols = new Map<string, string>();

/** The symbol a currency's amounts are written with: its own ($, €), or its code (CHF). */
export function symbolOf(currency: string): string {
  let symbol = symbols.get(currency);
  if (symbol === undefined) {
    const own = Object.entries(SYMBOLS).find(([, code]) => code === currency)?.[0];
    const narrow = own ? undefined : numberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(1)
      .find(({ type }) => type === "currency")?.value;
    symbol = own ?? (narrow && narrow.length === 1 ? narrow : `${currency} `);
    symbols.set(currency, symbol);
  }
  return symbol;
}

/** An amount as a cell's written with the currency: $1200, CHF 30. */
export const moneyText = (amount: number, currency: string) => `${amount < 0 ? "-" : ""}${symbolOf(currency)}${Math.abs(amount)}`;

const inParens = (negative: NegativeStyle) => negative === "parens" || negative === "redParens";
const inRed = (negative: NegativeStyle) => negative === "red" || negative === "redParens";

/** A number as written (`-5`, `-1,200.5`, `-3%`) or shown below zero, with its minus, as the setting writes it: `(5)`. */
export const negativeText = (text: string, negative: NegativeStyle) => (inParens(negative) && /^[-−]/.test(text) ? `(${text.slice(1)})` : text);

const moneyStyles = new Map<string, Intl.NumberFormat>();

/** The format of a currency's amounts in a style, found quickly: every amount shown is shown with it. */
function moneyStyle(locale: string, currency: string, money: MoneyStyle) {
  const key = `${locale} ${currency} ${money}`;
  let format = moneyStyles.get(key);
  if (!format) {
    format = numberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: money === "code" ? "code" : "narrowSymbol",
      ...(money === "whole" ? { maximumFractionDigits: 0, minimumFractionDigits: 0 } : {}),
    });
    moneyStyles.set(key, format);
  }
  return format;
}

/** An amount of money as the settings show it, in the locale's way; with `edge`, its symbol apart if the locale writes it first. */
function moneyShown(amount: number, currency: string, look: Pick<CellLook, "money" | "negative" | "edge" | "locale">): Shown {
  const parens = inParens(look.negative) && amount < 0;
  const red = amount < 0 && inRed(look.negative);
  const room = inParens(look.negative) && amount >= 0;
  const shown = parens ? -amount : amount;
  let parts: Intl.NumberFormatPart[];
  try {
    const format = moneyStyle(look.locale, currency, look.money);
    // Its parts only to set the symbol apart.
    if (!look.edge) {
      const text = format.format(shown);
      return { text: parens ? `(${text})` : text, symbol: "", red, room };
    }
    parts = format.formatToParts(shown);
  } catch {
    return { text: String(amount), symbol: "", red, room };
  }
  const at = parts.findIndex(({ type }) => type === "currency");
  const apart = look.edge && at >= 0 && at < parts.findIndex(({ type }) => type === "integer");
  // The symbol and the space beside it go; a minus stays with the amount.
  const kept = apart ? parts.filter(({ type, value }, i) => i !== at && !(type === "literal" && Math.abs(i - at) === 1 && !value.trim())) : parts;
  const text = kept.map(({ value }) => value).join("");
  return { text: parens ? `(${text})` : text, symbol: apart ? parts[at].value : "", red, room };
}

/** An amount of money as the settings show it, in the locale's way, as text: its symbol by it. */
export const showMoney = (amount: number, currency: string, look: Pick<CellLook, "money" | "negative" | "locale">) =>
  moneyShown(amount, currency, { ...look, edge: false }).text;

/** A plain number, as written or worked out. */
const NUMBER = /^-?(?:\d[\d,]*(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?%?$/;

/** What a cell shows, `text` being what its formula or what's written in it works out to: dates, money and numbers below zero as the settings say. */
export function cellShown(text: string, look: CellLook): Shown {
  if (ISO.test(text)) return { text: showDate(text, look.dates, look.locale), symbol: "", red: false, room: false };
  const money = readMoney(text, look.currency);
  if (money) return moneyShown(money.amount, money.currency, look);
  if (!NUMBER.test(text)) return { text, symbol: "", red: false, room: false };
  const negative = text.startsWith("-");
  return { text: negativeText(text, look.negative), symbol: "", red: negative && inRed(look.negative), room: !negative && inParens(look.negative) };
}

/** What a cell shows, as text (to copy, say, or read out): money's symbol by the amount, and nothing in red. */
export const displayed = (text: string, look: CellLook) => cellShown(text, { ...look, edge: false }).text;
