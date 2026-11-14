import { isolateHistory } from "@codemirror/commands";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { EditorState, Line, Transaction, TransactionSpec } from "@codemirror/state";
import { continueMarkup } from "../editor/markdownKeys";
import { clock } from "../library/text";
import { escapeMarkdown } from "../notes/escape";
import { frontMatter } from "../notes/properties";

/*
 * Times in an episode, written in a note as you listen (docs/library.md#notes-while-listening). In an
 * `episode` note, a time is `[12:34]`, which plays the note's episode from there; in any other note
 * it's a link to the episode's sound at that time, `[12:34](https://…/episode.mp3#t=754)`, a Media
 * Fragments address, which browsers (and so other apps' links) play from there too.
 */

/** A time as it's written, to the second it's in: `12:34`, or `1:02:03` from an hour on. */
export const stamp = (seconds: number) => clock(Math.floor(seconds)) ?? "0:00";

const STAMP = /^(?:(\d{1,2}):([0-5]\d)|(\d{1,3})):([0-5]\d)$/;

/** The seconds a time written `12:34` (or `1:02:03`, or `75:20`) says, or null if it isn't one. */
export function readStamp(text: string): number | null {
  const match = STAMP.exec(text);
  if (!match) return null;
  const [, hours, minutesAfterHours, minutes, seconds] = match;
  return Number(hours ?? 0) * 3600 + Number(minutesAfterHours ?? minutes) * 60 + Number(seconds);
}

/** The time a link to sound starts at, as its Media Fragment says (`#t=754`, `#t=12:34`, `#t=npt:754,800`), or null. */
export function fragmentTime(href: string): number | null {
  const hash = href.indexOf("#");
  if (hash === -1) return null;
  const value = new URLSearchParams(href.slice(hash + 1)).get("t")?.replace(/^npt:/, "").split(",")[0];
  if (!value) return null;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return readStamp(value.replace(/\.\d+$/, ""));
}

/** A link's address without its fragment: the sound itself. */
export const soundOf = (href: string) => href.replace(/#.*$/, "");

/**
 * Whether an address is a file of sound (or video) on the web, by its name: not a page (a show's notes
 * link their own times to their page, `…/1055#t=03:36`), nor anything but http(s).
 */
export function isSoundFile(href: string): boolean {
  try {
    const url = new URL(href);
    return (url.protocol === "https:" || url.protocol === "http:") && /\.(?:mp3|m4a|m4b|aac|ogg|oga|opus|wav|flac|mp4|m4v|mov)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

/** A time written in a note other than the episode's: a link to its sound at that time. */
export function timeLink(audio: string, seconds: number): string {
  const href = `${soundOf(audio)}#t=${Math.floor(seconds)}`;
  // An address with spaces or brackets in it is written in <…>, which Markdown reads as one.
  return `[${stamp(seconds)}](${/[\s()<>]/.test(href) ? `<${href}>` : href})`;
}

/**
 * A time in the episode whose sound is `audio`, as it's written in a note whose own episode's sound is
 * `noteAudio` (none, if it isn't an `episode` note): in the episode's own, `[12:34]`; elsewhere its link.
 */
export const timeIn = (noteAudio: string | undefined, audio: string, seconds: number) =>
  noteAudio === soundOf(audio) ? `[${stamp(seconds)}]` : timeLink(audio, seconds);

/** An item of a list of times: its indent and marker, its time, the time's link (in a note not the episode's), and what's after. */
const TIME_ITEM = /^(\s*[-*+] )\[([\d:]+)\](\(<[^>]*>\)|\([^)\s]*\))?(?: (.*))?$/;
const LIST_ITEM = /^\s*[-*+] /;

/**
 * A line that's an item of a list of times, `- [12:34] what was said` (or `- [12:34](…#t=754) …`):
 * its parts, if its time is one, and the item Markdown reads it as. Not text that only looks like one,
 * in code, math, HTML or the note's properties.
 */
function timeItemOn(state: EditorState, line: Line) {
  const item = TIME_ITEM.exec(line.text);
  if (!item || readStamp(item[2]) === null || (item[3] && fragmentTime(item[3].replace(/^\(<?|>?\)$/g, "")) === null)) return null;
  if (line.number <= (frontMatter(state.doc.sliceString(0, Math.min(state.doc.length, 10_000)))?.lines ?? 0)) return null;
  const tree = ensureSyntaxTree(state, line.to, 50) ?? syntaxTree(state);
  // In the note's own tree, not a code block's language's: a ```markdown block's list is code.
  const mark = tree.resolve(line.from + item[1].length - 2, 1);
  if (mark.name !== "ListMark" || mark.parent?.name !== "ListItem") return null;
  return { lead: item[1], after: item[4] ?? "", node: mark.parent };
}

/**
 * The note's end, as Take Notes leaves it (takeNotes.ts): a new item of a list of times starting with
 * `time`, as it's written in the note (`[12:34]`, or its link), the cursor after it; under the list's
 * last item, or a blank line below text. One it just started, with nothing after its time, starts
 * again at the new time.
 */
export function timeItem(state: EditorState, time: string): TransactionSpec {
  const { doc } = state;
  const last = doc.line(doc.lines);
  const item = `- ${time} `;
  const started = timeItemOn(state, last);
  let from = doc.length;
  let insert = item;
  if (started?.lead === "- " && !started.after.trim()) from = last.from;
  else if (last.text.trim()) insert = `${LIST_ITEM.test(last.text) ? "\n" : "\n\n"}${item}`;
  else {
    const above = last.number > 1 ? doc.line(last.number - 1).text : "";
    if (above.trim() && !LIST_ITEM.test(above)) insert = `\n${item}`;
  }
  return { changes: { from, to: doc.length, insert }, selection: { anchor: from + insert.length }, userEvent: "input" };
}

/**
 * Enter at the end of an item of a list of times, in the episode's own note while it's in the player
 * (noteTimes.ts): the next item, starting with `time`, the time it's at. On the list's last item, with
 * nothing after its time (one just started), it's Markdown's Enter on an empty item instead, its time
 * taken out: the list ends, or a nested one moves out a level. One in the middle of a list keeps the
 * time someone wrote. Each as one change of its own, which ⌘Z takes back. Null where the cursor isn't
 * at the end of such an item.
 */
export function timeEnter(state: EditorState, time: string): { spec: TransactionSpec; continued: boolean } | null {
  const { main } = state.selection;
  if (!main.empty || state.selection.ranges.length > 1) return null;
  const line = state.doc.lineAt(main.head);
  const item = main.head === line.to ? timeItemOn(state, line) : null;
  if (!item) return null;
  const annotations = isolateHistory.of("full");
  if (!item.after.trim() && item.node.nextSibling?.name !== "ListItem") {
    const bare = state.update({ changes: { from: line.from + item.lead.length, to: line.to } });
    let ended: Transaction | undefined;
    continueMarkup({ state: bare.state, dispatch: (tr) => (ended = tr) });
    if (!ended) return null;
    return { spec: { changes: bare.changes.compose(ended.changes), selection: ended.selection, annotations, userEvent: "delete" }, continued: false };
  }
  const insert = `\n${item.lead}${time} `;
  return { spec: { changes: { from: line.to, insert }, selection: { anchor: line.to + insert.length }, annotations, userEvent: "input" }, continued: true };
}

/**
 * Something said in the episode quoted with its time (`time`, as it's written in the note) and who
 * said it, `> [12:34] What was said. — Kyle`, as text that reads as just that; a blank line around,
 * the cursor below it to write on. After the cursor's line, or at the note's end in a note just
 * opened (`atEnd`); never in its properties.
 */
export function quoteItem(state: EditorState, time: string, said: string, speaker: string | undefined, atEnd: boolean): TransactionSpec {
  const { doc } = state;
  const properties = frontMatter(doc.sliceString(0, Math.min(doc.length, 10_000)))?.lines ?? 0;
  const cursor = doc.lineAt(state.selection.main.head);
  const line = atEnd || cursor.number <= properties ? doc.line(doc.lines) : cursor;
  const quote = `> ${time} ${escapeMarkdown(said)}${speaker ? ` — ${escapeMarkdown(speaker)}` : ""}`;
  // A paragraph of its own: a blank line after one with text (or the properties), or in place of an
  // empty line, one more if text is right above it, which the quote would otherwise go on.
  const after = !!line.text.trim() || line.number <= properties;
  const above = !after && line.number > 1 && !!doc.line(line.number - 1).text.trim();
  const insert = after ? `\n\n${quote}\n\n` : `${above ? "\n" : ""}${quote}\n\n`;
  const from = after ? line.to : line.from;
  return { changes: { from, to: line.to, insert }, selection: { anchor: from + insert.length }, userEvent: "input" };
}
