/*
 * The Calendar: which day each note is on. A Markdown note is on the day of its `date` or `due`
 * property, and on every day from its `start` to its `end`. Days are written as ISO dates,
 * `2026-11-30`, in the device's time zone, so they sort and compare as strings. A time after the
 * date, `2026-11-30 14:00`, places the note at that time of day, as the clock on the wall reads it.
 * A `repeat` property (`every week on monday and thursday until 2027-03-01`) puts it on the days its
 * schedule gives too, each as long as the first, from its first day on.
 */
import type { WeekStart } from "../prefs.svelte";
import { keyOf, type Property, setProperties } from "./properties";
import type { Note, NoteMeta } from "./types";

/** A day, as `YYYY-MM-DD`. */
export type Day = string;

/** The days a note is on: one, or a span from `start` to `end`; and the times, if they say. */
export interface Span {
  /** The property it's from: `start` for a span to its `end`. */
  key: "date" | "due" | "start" | "end";
  from: Day;
  to: Day;
  /** When it starts on its first day, in minutes after midnight. */
  start?: number;
  /** When it ends on its last day, in minutes after midnight. */
  end?: number;
  /** One of the times a repeating note comes round: how many days after its own dates (0 for them). */
  shift?: number;
}

/** How long something with a start time and no end lasts, in minutes. */
export const USUAL_LENGTH = 60;
/** The shortest anything is drawn, in minutes, so a moment is still something to click. */
const SHORTEST = 15;
const DAY_MINUTES = 24 * 60;

/** How long a `start` to `end` span can be, so a typo in a year doesn't span centuries. */
const LONGEST_SPAN = 366;

/** A value that starts with a date, `2026-11-30`, perhaps followed by a time. */
const DATE = /^(\d{4})-(\d{2})-(\d{2})(?:$|[\sT])/;
/** The time after a date: `14:00`, `T14:00:00`, anything after it (seconds, a zone) read past. */
const TIME = /^\d{4}-\d{2}-\d{2}[\sT]+(\d{1,2}):(\d{2})(?!\d)/;

/** The day a property's value is, if it starts with a real date. */
export function dayIn(value: string): Day | null {
  const match = DATE.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? match[0].trim().slice(0, 10) : null;
}

/** The time of day after a value's date, in minutes after midnight, if it has one. */
export function timeIn(value: string): number | null {
  const match = TIME.exec(value.trim());
  if (!match) return null;
  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** A time of day as a property writes it: 870 → `14:30`. */
export const timeText = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** The day a moment falls on, here. */
export function dayOf(moment: Date | number): Day {
  const date = new Date(moment);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** The day as a date, at its midnight. */
export function dateOf(day: Day): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The day `days` after this one (before it, if negative). */
export function addDays(day: Day, days: number): Day {
  const date = dateOf(day);
  date.setDate(date.getDate() + days);
  return dayOf(date);
}

/** The same day `months` later, or the month's last if it's shorter: Jan 31 → Feb 28. */
export function addMonths(day: Day, months: number): Day {
  const date = dateOf(day);
  const wanted = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(wanted, last));
  return dayOf(date);
}

const spans = new WeakMap<Property[], Span[]>();

/** The days a note's properties put it on. Each note's properties are read once. */
export function spansOf(properties: Property[]): Span[] {
  let found = spans.get(properties);
  if (found) return found;
  found = [];
  let start: Span | null = null;
  let end: Span | null = null;
  for (const property of properties) {
    const key = keyOf(property.key);
    if (key !== "date" && key !== "due" && key !== "start" && key !== "end") continue;
    const day = dayIn(property.value);
    if (!day) continue;
    const span: Span = { key, from: day, to: day, ...withTime("start", timeIn(property.value)) };
    if (key === "start") start ??= span;
    else if (key === "end") end ??= span;
    else found.push(span);
  }
  const ordered = start && end && (end.from > start.from || (end.from === start.from && end.start !== undefined && end.start > (start.start ?? -1)));
  if (start && end && ordered && end.from <= addDays(start.from, LONGEST_SPAN)) {
    found.push({ ...start, to: end.from, ...withTime("end", end.start ?? null) });
  } else {
    if (start) found.push(start);
    if (end && end.from !== start?.from) found.push(end);
  }
  spans.set(properties, found);
  return found;
}

const withTime = (key: "start" | "end", minutes: number | null) => (minutes === null ? {} : { [key]: minutes });

/** How many days from one day to another (negative if it's before). */
export const daysBetween = (from: Day, to: Day) => Math.round((dateOf(to).getTime() - dateOf(from).getTime()) / 86_400_000);

/*
 * Repeating. A note's `repeat` says how often it comes round again, in words, as a person would
 * write it: `daily`, `every 2 weeks`, `every weekday`, `every monday and thursday`, `monthly on the
 * last friday`, `every year`, and when it stops: `until 2027-03-01`, or `10 times`. Its own dates are
 * the first time, as a calendar's are (RFC 5545), and each time after is as long as they are.
 */

/** A note's schedule: every how many days, weeks, months or years; on which days; until when. */
export interface Repeat {
  unit: "day" | "week" | "month" | "year";
  every: number;
  /** A week's: the days of the week it's on (the first time's, if none). */
  weekdays?: Weekday[];
  /** A month's: the first to fifth (or last, -1) of a day of the week, rather than the same date. */
  nth?: number;
  weekday?: Weekday;
  /** The last day it can come round on, or how many times it does in all (the first among them). */
  until?: Day;
  times?: number;
}

const UNITS: Record<string, Repeat["unit"]> = { day: "day", days: "day", week: "week", weeks: "week", month: "month", months: "month", year: "year", years: "year" };
const ALONE: Record<string, Pick<Repeat, "unit" | "every" | "weekdays">> = {
  daily: { unit: "day", every: 1 },
  weekly: { unit: "week", every: 1 },
  biweekly: { unit: "week", every: 2 },
  fortnightly: { unit: "week", every: 2 },
  monthly: { unit: "month", every: 1 },
  yearly: { unit: "year", every: 1 },
  annually: { unit: "year", every: 1 },
  weekday: { unit: "week", every: 1, weekdays: [1, 2, 3, 4, 5] },
  weekdays: { unit: "week", every: 1, weekdays: [1, 2, 3, 4, 5] },
};
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ORDINALS: Record<string, number> = { first: 1, "1st": 1, second: 2, "2nd": 2, third: 3, "3rd": 3, fourth: 4, "4th": 4, fifth: 5, "5th": 5, last: -1 };
/** Words that read well in a schedule and say nothing more. */
const FILLER = new Set(["every", "each", "on", "the", "and", "of", "for", "repeat", "repeats", "a", "an", "month's", "in"]);

/** A day of the week by its name, whole or its first three letters (`mon`, `thursday`), a plural too. */
function weekdayIn(word: string): Weekday | null {
  const name = word.replace(/s$/, "");
  const i = WEEKDAYS.findIndex((day) => day === name || (name.length >= 3 && day.startsWith(name)));
  return i === -1 ? null : (i as Weekday);
}

/** The schedule a `repeat` property's value says, or null if it isn't one (a word it doesn't know, a typo, nothing to go by). */
export function repeatIn(value: string): Repeat | null {
  const words = value.toLowerCase().replace(/[,;]/g, " ").split(/\s+/).filter(Boolean);
  let unit: Repeat["unit"] | undefined;
  let every = 1;
  let until: Day | undefined;
  let times: number | undefined;
  let nth: number | undefined;
  const weekdays: Weekday[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const next = words[i + 1];
    if (word === "until" || word === "till") {
      const day = next && dayIn(next);
      if (!day) return null;
      until = day;
      i++;
    } else if (/^\d+$/.test(word) && (next === "times" || next === "time")) {
      times = Number(word);
      i++;
    } else if (/^\d+$/.test(word) && next && UNITS[next]) {
      every = Number(word);
      unit = UNITS[next];
      i++;
    } else if (word === "other" && next && UNITS[next]) {
      every = 2;
      unit = UNITS[next];
      i++;
    } else if (UNITS[word]) unit = UNITS[word];
    else if (ALONE[word]) {
      ({ unit } = ALONE[word]);
      every = ALONE[word].every;
      weekdays.push(...(ALONE[word].weekdays ?? []));
    } else if (word in ORDINALS) nth = ORDINALS[word];
    else if (weekdayIn(word) !== null) weekdays.push(weekdayIn(word)!);
    else if (!FILLER.has(word)) return null;
  }
  if (!unit && weekdays.length) unit = "week";
  if (!unit || every < 1 || times === 0) return null;
  const repeat: Repeat = { unit, every, ...(until && { until }), ...(times && { times }) };
  if (unit === "month" && nth !== undefined && weekdays.length === 1) return { ...repeat, nth, weekday: weekdays[0] };
  if (nth !== undefined) return null;
  if (weekdays.length) {
    if (unit !== "week" && unit !== "day") return null;
    // `every day` with days of the week named is those days, every week.
    return { ...repeat, unit: "week", every: unit === "day" ? 1 : every, weekdays: [...new Set(weekdays)].sort() };
  }
  return repeat;
}

/** The schedule as a `repeat` property writes it, which reads it back the same. */
export function repeatText(repeat: Repeat): string {
  const ending = [repeat.until && `until ${repeat.until}`, repeat.times && `${repeat.times} times`].filter(Boolean);
  const every = repeat.every === 1 ? `every ${repeat.unit}` : `every ${repeat.every} ${repeat.unit}s`;
  const isWeekdays = repeat.weekdays?.join() === "1,2,3,4,5";
  const days = (weekdays: Weekday[]) => weekdays.map((day) => WEEKDAYS[day]).join(" and ");
  const rule =
    repeat.unit === "week" && isWeekdays && repeat.every === 1
      ? "every weekday"
      : repeat.unit === "week" && repeat.weekdays?.length
        ? `${every} on ${days(repeat.weekdays)}`
        : repeat.unit === "month" && repeat.nth !== undefined && repeat.weekday !== undefined
          ? `${every} on the ${Object.keys(ORDINALS).find((word) => ORDINALS[word] === repeat.nth && !/\d/.test(word))} ${WEEKDAYS[repeat.weekday]}`
          : every;
  return [rule, ...ending].join(" ");
}

/** The `nth` (1 to 5, or -1 for the last) `weekday` of the month `day` is in, if the month has one. */
function nthWeekday(day: Day, nth: number, weekday: Weekday): Day | null {
  const date = dateOf(day);
  const [year, month] = [date.getFullYear(), date.getMonth()];
  if (nth > 0) {
    const first = new Date(year, month, 1).getDay();
    const found = new Date(year, month, 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7);
    return found.getMonth() === month ? dayOf(found) : null;
  }
  const last = new Date(year, month + 1, 0);
  last.setDate(last.getDate() - ((last.getDay() - weekday + 7) % 7));
  return dayOf(last);
}

/** How many of a schedule's periods (days, weeks, months, years) lie between two days, roughly, to start counting near the second. */
function periodsBetween(from: Day, to: Day, unit: Repeat["unit"]): number {
  const [a, b] = [dateOf(from), dateOf(to)];
  const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  return unit === "day" ? daysBetween(from, to) : unit === "week" ? Math.floor(daysBetween(from, to) / 7) : unit === "month" ? months : Math.floor(months / 12);
}

/** Never more than this many times are looked at for one note, whatever it says. */
const MOST_TIMES = 5000;

/**
 * The days a schedule comes round on, starting the first time on `first`, from `from` to `to`: in
 * order, the first among them if it's in there. A schedule counting its times starts from the first;
 * one that doesn't starts near `from`, so a birthday from 1990 is quick to place.
 */
export function repeatDays(first: Day, repeat: Repeat, from: Day, to: Day): Day[] {
  const found: Day[] = [];
  const last = repeat.until && repeat.until < to ? repeat.until : to;
  if (first > last) return found;
  const skip = repeat.times ? 0 : Math.max(0, Math.floor(periodsBetween(first, from, repeat.unit) / repeat.every) - 1);
  let count = 0;
  /** Each period's days, the `i`th period after the first. */
  const period = (i: number): Day[] => {
    const n = i * repeat.every;
    if (repeat.unit === "day") return [addDays(first, n)];
    if (repeat.unit === "year") return [addMonths(first, 12 * n)];
    if (repeat.unit === "month") {
      if (repeat.nth === undefined || repeat.weekday === undefined) return [addMonths(first, n)];
      const day = nthWeekday(addMonths(first.slice(0, 8) + "01", n), repeat.nth, repeat.weekday);
      return day ? [day] : [];
    }
    const weekdays = repeat.weekdays ?? [dateOf(first).getDay() as Weekday];
    const sunday = addDays(first, 7 * n - dateOf(first).getDay());
    return weekdays.map((weekday) => addDays(sunday, weekday));
  };
  /** Counts a time, kept if it's from `from` on; whether there may be more after it. */
  const take = (day: Day) => {
    if (day > last) return false;
    count++;
    if (day >= from) found.push(day);
    return !repeat.times || count < repeat.times;
  };
  // Its own dates are the first time, whether the schedule would have them or not.
  if (!take(first)) return found;
  for (let i = skip; i < skip + MOST_TIMES; i++) {
    for (const day of period(i)) {
      if (day <= first) continue;
      if (!take(day)) return found;
    }
  }
  return found;
}

const repeats = new WeakMap<Property[], Repeat | null>();

/** A note's schedule, from its `repeat` property, if it has one it can read. */
export function repeatOf(properties: Property[]): Repeat | null {
  if (repeats.has(properties)) return repeats.get(properties)!;
  const value = properties.find((property) => keyOf(property.key) === "repeat")?.value;
  const repeat = value ? repeatIn(value) : null;
  repeats.set(properties, repeat);
  return repeat;
}

/**
 * The days a note's properties put it on, from `from` to `to`: its own dates, and each time a
 * schedule brings them round again there, as long as they are (its days and times), its `shift`
 * from them saying how far.
 */
export function spansIn(properties: Property[], from: Day, to: Day): Span[] {
  const own = spansOf(properties);
  const repeat = repeatOf(properties);
  if (!repeat) return own;
  return own.flatMap((span) => {
    const length = daysBetween(span.from, span.to);
    return repeatDays(span.from, repeat, addDays(from, -length), to).map((day) => ({ ...span, from: day, to: addDays(day, length), shift: daysBetween(span.from, day) }));
  });
}

/** Whether the note is on this day: by its dates, or (with `edited`) as it was made or last changed then. */
export function isOn(note: Note, meta: NoteMeta, day: Day, edited: boolean): boolean {
  if (spansIn(meta.properties, day, day).some((span) => span.from <= day && day <= span.to)) return true;
  return edited && (dayOf(note.createdAt) === day || dayOf(note.updatedAt) === day);
}

/** The notes on each day from `from` to `to`, for the days that have any. */
export function notesOnDays<E extends { note: Note; meta: NoteMeta }>(entries: readonly E[], from: Day, to: Day, edited: boolean): Map<Day, E[]> {
  const on = new Map<Day, E[]>();
  for (const entry of entries) {
    const { note, meta } = entry;
    if (note.trashed) continue;
    const days = new Set<Day>();
    for (const span of spansIn(meta.properties, from, to)) {
      if (span.to < from || span.from > to) continue;
      for (let day = span.from < from ? from : span.from; day <= span.to && day <= to; day = addDays(day, 1)) days.add(day);
    }
    if (edited) {
      for (const day of [dayOf(note.createdAt), dayOf(note.updatedAt)]) if (day >= from && day <= to) days.add(day);
    }
    for (const day of days) {
      const list = on.get(day);
      if (list) list.push(entry);
      else on.set(day, [entry]);
    }
  }
  return on;
}

/** Days of the week as `Date.getDay()` counts them: 0 is Sunday, 1 Monday, 6 Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** The day weeks start on where `locale` is spoken: Monday in most places, Sunday in the US. */
export function weekStartIn(locale: string): Weekday {
  try {
    const place = new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const first = (place.getWeekInfo?.() ?? place.weekInfo)?.firstDay;
    if (first) return (first % 7) as Weekday;
  } catch {
    // An engine without week info, or a locale it doesn't know.
  }
  return /-(US|CA|MX|BR|JP|KR|IL|PH|TW|HK|IN|ZA)$/i.test(locale) || locale === "en" ? 0 : 1;
}

const CHOSEN_STARTS: Record<Exclude<WeekStart, "auto">, Weekday> = { sunday: 0, monday: 1, saturday: 6 };

/** The day the Calendar's weeks start on: as Settings say, or (automatic) where `locale` is spoken. */
export const firstWeekday = (choice: WeekStart, locale: string): Weekday => (choice === "auto" ? weekStartIn(locale) : CHOSEN_STARTS[choice]);

/** The weeks shown for the month `day` is in, each seven days from `weekStart`: always six of them, so the grid doesn't jump. */
export function monthWeeks(day: Day, weekStart: Weekday): Day[][] {
  const first = dateOf(day);
  first.setDate(1);
  const back = (first.getDay() - weekStart + 7) % 7;
  let current = addDays(dayOf(first), -back);
  const weeks: Day[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Day[] = [];
    for (let d = 0; d < 7; d++, current = addDays(current, 1)) week.push(current);
    weeks.push(week);
  }
  return weeks;
}

/** Something on the Calendar with a time: where it sits in its day, and beside what. */
export interface Placed<E> {
  entry: E;
  /** What put it there. */
  span: Span;
  /** From and to, in minutes after midnight. */
  start: number;
  end: number;
  /** Which of the side-by-side columns it takes where things overlap, and how many there are. */
  column: number;
  columns: number;
}

/** What's on a day: notes with a time at it, and the others for the whole day. */
export interface DayItems<E> {
  allDay: E[];
  timed: Placed<E>[];
}

/**
 * What's on each of `days`. A note dated with a time, or with a start and end on the same day, sits
 * at its time; the rest are the day's all along: a date alone, a span over several days, a note
 * made or edited that day (with `edited`). Those whose times overlap share the width side by side.
 */
export function itemsOn<E extends { note: Note; meta: NoteMeta }>(entries: readonly E[], days: readonly Day[], edited: boolean): Map<Day, DayItems<E>> {
  const items = new Map<Day, DayItems<E>>(days.map((day) => [day, { allDay: [], timed: [] }]));
  const [from, to] = [days[0], days[days.length - 1]];
  for (const entry of entries) {
    if (entry.note.trashed) continue;
    const whole = new Set<Day>();
    for (const span of spansIn(entry.meta.properties, from, to)) {
      if (span.to < from || span.from > to) continue;
      if (span.from === span.to && span.start !== undefined) {
        const start = span.start;
        const end = Math.min(DAY_MINUTES, Math.max(start + SHORTEST, span.end ?? start + USUAL_LENGTH));
        items.get(span.from)?.timed.push({ entry, span, start, end, column: 0, columns: 1 });
      } else {
        for (let day = span.from < from ? from : span.from; day <= span.to && day <= to; day = addDays(day, 1)) whole.add(day);
      }
    }
    if (edited) {
      for (const day of [dayOf(entry.note.createdAt), dayOf(entry.note.updatedAt)]) {
        if (items.has(day) && !items.get(day)!.timed.some((placed) => placed.entry === entry)) whole.add(day);
      }
    }
    for (const day of whole) items.get(day)?.allDay.push(entry);
  }
  for (const { timed } of items.values()) sideBySide(timed);
  return items;
}

/** Lays out a day's timed items: each group that overlaps shares the width, each in the first column free when it starts. */
function sideBySide(timed: Placed<unknown>[]) {
  timed.sort((a, b) => a.start - b.start || b.end - a.end);
  let group: Placed<unknown>[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -1;
  const close = () => {
    for (const placed of group) placed.columns = columnEnds.length;
    group = [];
    columnEnds = [];
  };
  for (const placed of timed) {
    if (placed.start >= groupEnd) close();
    let column = columnEnds.findIndex((end) => end <= placed.start);
    if (column === -1) column = columnEnds.push(0) - 1;
    columnEnds[column] = placed.end;
    placed.column = column;
    group.push(placed);
    groupEnd = Math.max(groupEnd, placed.end);
  }
  close();
}

/** The seven days of the week `day` is in, from `weekStart`. */
export function weekOf(day: Day, weekStart: Weekday): Day[] {
  const first = addDays(day, -((dateOf(day).getDay() - weekStart + 7) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

/** Where something on the Calendar goes: a day, and from and to in minutes after midnight. */
export interface Slot {
  day: Day;
  start: number;
  end: number;
}

/** A new event's properties: its type, and from and to on its day. */
export const eventProperties = ({ day, start, end }: Slot) => ({ type: "event", start: `${day} ${timeText(start)}`, end: `${day} ${timeText(end)}` });

/** A new event's properties for whole days, from one to the other (either way round): a `date` for one, a `start` and `end` for more. */
export function allDayProperties(a: Day, b: Day): Record<string, string> {
  const [from, to] = a <= b ? [a, b] : [b, a];
  return from === to ? { type: "event", date: from } : { type: "event", start: from, end: to };
}

/**
 * The note's text with what `span` put on the Calendar moved to `to`: a start and end both moved,
 * a date or due moved; a date given a length other than the usual one becomes a start and an end.
 */
export function retimed(body: string, span: Span, to: Slot): string {
  const at = (minutes: number) => `${to.day} ${timeText(minutes)}`;
  if (span.key === "start") return setProperties(body, { start: at(to.start), end: at(to.end) });
  if (span.key === "date" && to.end - to.start !== USUAL_LENGTH) return setProperties(body, { date: null, start: at(to.start), end: at(to.end) });
  return setProperties(body, { [span.key]: at(to.start) });
}
