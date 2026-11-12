import { expect, test } from "bun:test";
import {
  addDays,
  addMonths,
  dayIn,
  eventProperties,
  isOn,
  itemsOn,
  monthWeeks,
  notesOnDays,
  repeatDays,
  repeatIn,
  repeatText,
  retimed,
  spansOf,
  timeIn,
  weekOf,
  weekStartIn,
} from "../../src/lib/notes/calendar";
import { frontMatter, setProperties } from "../../src/lib/notes/properties";
import type { Note, NoteMeta } from "../../src/lib/notes/types";

const properties = (lines: string) => frontMatter(`---\n${lines}\n---\n# Note`)!.properties;

function entry(lines: string, made = new Date(2026, 0, 1).getTime()): { note: Note; meta: NoteMeta } {
  const note: Note = { id: lines, body: "", createdAt: made, updatedAt: made, pinned: false, trashed: false };
  return { note, meta: { title: "", excerpt: "", tags: [], hasOpenTodos: false, searchText: "", properties: properties(lines), type: "" } };
}

test("a property's value is a day when it starts with a real ISO date, with or without a time", () => {
  expect(dayIn("2026-11-30")).toBe("2026-11-30");
  expect(dayIn("2026-11-30 14:00")).toBe("2026-11-30");
  expect(dayIn("2026-11-30T14:00:00Z")).toBe("2026-11-30");
  expect(dayIn("2026-02-30")).toBeNull();
  expect(dayIn("30/11/2026")).toBeNull();
  expect(dayIn("2026-11-300")).toBeNull();
});

test("a note is on the days of its date and due, and every day from its start to its end", () => {
  expect(spansOf(properties("Date: 2026-11-30\ndue: 2026-12-02\ntype: trip"))).toEqual([
    { key: "date", from: "2026-11-30", to: "2026-11-30" },
    { key: "due", from: "2026-12-02", to: "2026-12-02" },
  ]);
  expect(spansOf(properties("start: 2026-11-28\nend: 2026-12-01"))).toEqual([{ key: "start", from: "2026-11-28", to: "2026-12-01" }]);
  // An end before the start, or a start alone, is just those days.
  expect(spansOf(properties("start: 2026-12-01\nend: 2026-11-28"))).toEqual([
    { key: "start", from: "2026-12-01", to: "2026-12-01" },
    { key: "end", from: "2026-11-28", to: "2026-11-28" },
  ]);
  expect(spansOf(properties("start: 2026-11-28"))).toEqual([{ key: "start", from: "2026-11-28", to: "2026-11-28" }]);
  expect(spansOf(properties("published: 2026-11-28"))).toEqual([]);
});

test("notes made or edited on a day are on it only when asked for", () => {
  const made = entry("type: idea", new Date(2026, 10, 9, 23, 30).getTime());
  expect(isOn(made.note, made.meta, "2026-11-09", false)).toBe(false);
  expect(isOn(made.note, made.meta, "2026-11-09", true)).toBe(true);
});

test("each day has the notes on it, a span on each of its days, a trashed note on none", () => {
  const trashed = entry("date: 2026-11-30");
  trashed.note.trashed = true;
  const on = notesOnDays([entry("date: 2026-11-30"), entry("start: 2026-11-29\nend: 2026-12-02"), trashed], "2026-11-01", "2026-11-30", false);
  expect(Object.fromEntries([...on].map(([day, notes]) => [day, notes.length]))).toEqual({ "2026-11-29": 1, "2026-11-30": 2 });
});

test("many notes on one day are counted in time in step with how many there are", () => {
  const one = entry("date: 2026-11-30");
  const many = Array.from({ length: 20_000 }, (_, i) => ({ ...one, note: { ...one.note, id: String(i) } }));
  const started = performance.now();
  expect(notesOnDays(many, "2026-11-30", "2026-11-30", false).get("2026-11-30")).toHaveLength(20_000);
  // Copying the day's list for each note took about half a second; adding to it, about 15 ms.
  expect(performance.now() - started).toBeLessThan(100);
});

test("moving by months keeps the day, or the month's last", () => {
  expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  expect(addMonths("2026-03-15", -12)).toBe("2025-03-15");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
});

test("a month is six weeks from the week's first day", () => {
  const monday = monthWeeks("2026-11-09", 1);
  expect(monday).toHaveLength(6);
  expect(monday[0][0]).toBe("2026-10-26");
  expect(monday[5][6]).toBe("2026-12-06");
  // November 1, 2026 is a Sunday: a week starting on Sunday begins with it.
  expect(monthWeeks("2026-11-30", 0)[0][0]).toBe("2026-11-01");
});

test("weeks start where the language and region start them", () => {
  expect(weekStartIn("en-US")).toBe(0);
  expect(weekStartIn("en-GB")).toBe(1);
  expect(weekStartIn("fr")).toBe(1);
});

test("a time after the date is read as the clock on the wall reads it", () => {
  expect(timeIn("2026-11-30 14:05")).toBe(14 * 60 + 5);
  expect(timeIn("2026-11-30T09:30:00Z")).toBe(9 * 60 + 30);
  expect(timeIn("2026-11-30")).toBeNull();
  expect(timeIn("2026-11-30 25:00")).toBeNull();
  expect(spansOf(properties("start: 2026-11-30 14:00\nend: 2026-11-30 15:30"))).toEqual([{ key: "start", from: "2026-11-30", to: "2026-11-30", start: 840, end: 930 }]);
  // An end before the start on the same day is the start alone.
  expect(spansOf(properties("start: 2026-11-30 14:00\nend: 2026-11-30 13:00"))).toEqual([{ key: "start", from: "2026-11-30", to: "2026-11-30", start: 840 }]);
  // An end at 24:00 is the day's end, as an event dragged to midnight writes it; anything else isn't a time then.
  const late = eventProperties({ day: "2026-11-30", start: 22 * 60, end: 24 * 60 });
  expect(late.end).toBe("2026-11-30 24:00");
  expect(spansOf(properties(`start: ${late.start}\nend: ${late.end}`))).toEqual([{ key: "start", from: "2026-11-30", to: "2026-11-30", start: 1320, end: 1440 }]);
  expect(timeIn("2026-11-30 24:00")).toBeNull();
  expect(itemsOn([entry("end: 2026-11-30 24:00")], ["2026-11-30"], false).get("2026-11-30")!.timed.map(({ start, end }) => [start, end])).toEqual([[1425, 1440]]);
});

test("a day's notes with times sit at them, side by side where they overlap; the others are all day", () => {
  const days = weekOf("2026-11-30", 1);
  expect(days).toEqual(["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"]);
  const review = entry("date: 2026-11-30 10:00");
  const pairing = entry("start: 2026-11-30 10:30\nend: 2026-11-30 12:00");
  const lunch = entry("date: 2026-11-30 12:00");
  const trip = entry("start: 2026-11-29\nend: 2026-12-01 18:00");
  const items = itemsOn([review, pairing, lunch, trip], days, false);
  const monday = items.get("2026-11-30")!;
  expect(monday.allDay).toEqual([trip]);
  expect(monday.timed.map(({ entry, start, end, column, columns }) => [entry, start, end, column, columns])).toEqual([
    [review, 600, 660, 0, 2],
    [pairing, 630, 720, 1, 2],
    // Starts as the others end: a group of its own, the whole width.
    [lunch, 720, 780, 0, 1],
  ]);
  expect(items.get("2026-12-01")!.allDay).toEqual([trip]);
  expect(items.get("2026-12-02")!.allDay).toEqual([]);
});

test("setting properties changes their lines in place, takes them out, adds them at the end, or adds the properties", () => {
  const body = "---\ntype: meeting\nDate: 2026-11-30\ntags:\n  - a\n  - b\n---\n# Review";
  expect(setProperties(body, { date: "2026-12-01 10:00" })).toBe("---\ntype: meeting\nDate: 2026-12-01 10:00\ntags:\n  - a\n  - b\n---\n# Review");
  expect(setProperties(body, { tags: null, end: "2026-12-01" })).toBe("---\ntype: meeting\nDate: 2026-11-30\nend: 2026-12-01\n---\n# Review");
  expect(setProperties("# Plain", { date: "2026-11-30" })).toBe("---\ndate: 2026-11-30\n---\n# Plain");
});

test("moving a note on the Calendar rewrites what put it there", () => {
  const timed = "---\ndate: 2026-11-30 10:00\n---\n# Review";
  const [date] = spansOf(frontMatter(timed)!.properties);
  // Moved, an hour long still: its date.
  expect(retimed(timed, date, { day: "2026-12-01", start: 840, end: 900 })).toBe("---\ndate: 2026-12-01 14:00\n---\n# Review");
  // Made longer: a start and an end.
  expect(retimed(timed, date, { day: "2026-11-30", start: 600, end: 690 })).toBe("---\nstart: 2026-11-30 10:00\nend: 2026-11-30 11:30\n---\n# Review");
  const event = "---\ntype: event\nstart: 2026-11-30 10:00\nend: 2026-11-30 11:00\n---\n# Lunch";
  const [span] = spansOf(frontMatter(event)!.properties);
  expect(retimed(event, span, { day: "2026-12-02", start: 720, end: 780 })).toBe("---\ntype: event\nstart: 2026-12-02 12:00\nend: 2026-12-02 13:00\n---\n# Lunch");
  expect(eventProperties({ day: "2026-11-30", start: 570, end: 630 })).toEqual({ type: "event", start: "2026-11-30 09:30", end: "2026-11-30 10:30" });
});

test("a repeat property reads as people write a schedule, and anything else isn't one", () => {
  expect(repeatIn("daily")).toEqual({ unit: "day", every: 1 });
  expect(repeatIn("Every 2 weeks")).toEqual({ unit: "week", every: 2 });
  expect(repeatIn("every other month")).toEqual({ unit: "month", every: 2 });
  expect(repeatIn("every weekday")).toEqual({ unit: "week", every: 1, weekdays: [1, 2, 3, 4, 5] });
  expect(repeatIn("every Monday and Thu")).toEqual({ unit: "week", every: 1, weekdays: [1, 4] });
  expect(repeatIn("every 2 weeks on mondays, fridays")).toEqual({ unit: "week", every: 2, weekdays: [1, 5] });
  expect(repeatIn("monthly on the last friday")).toEqual({ unit: "month", every: 1, nth: -1, weekday: 5 });
  expect(repeatIn("every month on the 2nd tuesday")).toEqual({ unit: "month", every: 1, nth: 2, weekday: 2 });
  expect(repeatIn("yearly until 2030-01-01")).toEqual({ unit: "year", every: 1, until: "2030-01-01" });
  expect(repeatIn("every week 10 times")).toEqual({ unit: "week", every: 1, times: 10 });
  for (const wrong of ["", "sometimes", "every blue moon", "until tomorrow", "every week until", "every year on the second", "every 0 days"]) expect(repeatIn(wrong)).toBeNull();
});

test("a schedule is written as it reads, and reads back the same", () => {
  for (const text of ["every day", "every 3 days", "every weekday", "every week", "every 2 weeks on monday and thursday", "every month", "every month on the last friday", "every year until 2030-01-01", "every week 4 times"]) {
    expect(repeatText(repeatIn(text)!)).toBe(text);
  }
});

test("a schedule comes round on its days, its own dates the first, until it stops", () => {
  // Every week, from Tuesday 3 November 2026.
  expect(repeatDays("2026-11-03", repeatIn("weekly")!, "2026-11-01", "2026-11-30")).toEqual(["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]);
  // On Mondays and Thursdays, from that Tuesday: it first, then those days.
  expect(repeatDays("2026-11-03", repeatIn("every monday and thursday")!, "2026-11-01", "2026-11-12")).toEqual(["2026-11-03", "2026-11-05", "2026-11-09", "2026-11-12"]);
  // Every weekday, three times in all.
  expect(repeatDays("2026-11-06", repeatIn("every weekday 3 times")!, "2026-11-01", "2026-11-30")).toEqual(["2026-11-06", "2026-11-09", "2026-11-10"]);
  // The last Friday of each month, until February.
  expect(repeatDays("2026-11-27", repeatIn("monthly on the last friday until 2027-02-01")!, "2026-11-01", "2027-06-01")).toEqual(["2026-11-27", "2026-12-25", "2027-01-29"]);
  // The 31st each month, on the last day of a shorter one.
  expect(repeatDays("2027-01-31", repeatIn("monthly")!, "2027-01-01", "2027-04-30")).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  // A birthday from 1990, found in 2026 without counting every year since.
  expect(repeatDays("1990-03-14", repeatIn("every year")!, "2026-01-01", "2026-12-31")).toEqual(["2026-03-14"]);
  // Nothing before its first time.
  expect(repeatDays("2026-11-20", repeatIn("daily")!, "2026-11-01", "2026-11-19")).toEqual([]);
});

test("a repeating note is on each day it comes round, each time as long as the first, at its time", () => {
  const standup = entry("start: 2026-11-02 09:00\nend: 2026-11-02 09:15\nrepeat: every weekday");
  expect(isOn(standup.note, standup.meta, "2026-11-04", false)).toBe(true);
  expect(isOn(standup.note, standup.meta, "2026-11-07", false)).toBe(false);
  const week = itemsOn([standup], weekOf("2026-11-04", 1), false);
  expect(week.get("2026-11-06")!.timed.map((placed) => [placed.start, placed.end, placed.span.shift])).toEqual([[540, 555, 4]]);
  const trip = entry("start: 2026-11-06\nend: 2026-11-08\nrepeat: every 2 weeks");
  expect([...notesOnDays([trip], "2026-11-01", "2026-11-30", false).keys()].sort()).toEqual(["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-20", "2026-11-21", "2026-11-22"]);
});
