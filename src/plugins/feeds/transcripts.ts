import { parseHtml } from "../../lib/feeds/html";
import { plainText } from "../../lib/feeds/markdown";

/*
 * Podcasting 2.0's transcripts and chapters (https://podcastindex.org/namespace/1.0): an episode in
 * a feed can name a file of what's said in it (SubRip, WebVTT, JSON or HTML), and one of its chapters
 * (JSON). Read here as lines of what's said, each from when it starts, put together into sentences,
 * and chapters, each from when it starts. What's said is only ever text.
 */

/** Something said: from when, to when, by whom (if the transcript says). In seconds. */
export interface Cue {
  start: number;
  end?: number;
  speaker?: string;
  text: string;
}

export interface Chapter {
  start: number;
  title: string;
  image?: string;
  link?: string;
}

/** A time as SubRip and WebVTT write it: `01:02:03,456`, `01:02:03.456`, `0:02:03.456`, `02:03.456`. */
function cueTime(text: string): number | null {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(text.trim());
  if (!match) return null;
  const [, hours = "0", minutes, seconds, fraction = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(fraction.padEnd(3, "0")) / 1000;
}

/** WebVTT's and SubRip's markup in what's said: voices, classes, styles, times within a cue, and SubRip's `{\an8}`. */
const CUE_MARKUP = /<\/?(?:v|c|i|b|u|ruby|rt|lang|font)(?:[.\s][^>]*)?>|<\d{1,2}:[\d:.]+>|\{\\[^}]*\}/gi;
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", lrm: "", rlm: "" };

/** A character reference read, or left as written if it names no character. */
function entity(whole: string, name: string): string {
  if (name[0] !== "#") return ENTITIES[name.toLowerCase()] ?? whole;
  const code = name[1] === "x" || name[1] === "X" ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
  return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : whole;
}

/** A cue's text as what's said: its markup taken out (a `<` that starts none stays), its references read. */
const cueText = (text: string) =>
  text
    .replace(CUE_MARKUP, "")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, entity)
    .replace(/\s+/g, " ")
    .trim();

/** Who's speaking, written before what they say: `Ada Moss: …`, `Speaker 1: …`, `[SPEAKER_04]: …`. */
const SPEAKER = /^\[?(\p{Lu}[\p{L}\p{N}_.'’ -]{0,39}?)\]?:\s+/u;

/**
 * SubRip and WebVTT: blocks a blank line apart, each a `start --> end` line and what's said under it.
 * Who's speaking is WebVTT's voice (`<v Ada Moss>`), or a name before what's said, if that name is
 * written so more than once (so a line that starts "Warning: …" isn't Warning's); either goes on to
 * the lines after, as transcripts often name a speaker only where it changes, until another's named.
 */
function readCues(text: string): Cue[] {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .flatMap((block) => {
      const lines = block.split("\n");
      const timing = lines.findIndex((line) => line.includes("-->"));
      if (timing === -1) return [];
      const [from, to] = lines[timing].split("-->");
      const start = cueTime(from);
      // WebVTT's cue settings come after the end's time.
      const end = cueTime(to.trim().split(/\s+/)[0]);
      const written = lines.slice(timing + 1).join(" ");
      const voice = /<v(?:\.[\w.-]+)?\s+([^>]+)>/.exec(written)?.[1].trim();
      const said = cueText(written);
      return start === null || !said ? [] : [{ start, end, voice, said, named: voice ? undefined : SPEAKER.exec(said) }];
    });
  const names = new Map<string, number>();
  for (const { named } of blocks) if (named) names.set(named[1], (names.get(named[1]) ?? 0) + 1);
  let speaker: string | undefined;
  return blocks.flatMap(({ start, end, voice, said, named }) => {
    const label = named && names.get(named[1])! > 1 ? named : null;
    speaker = voice ?? label?.[1].trim() ?? speaker;
    const words = label ? said.slice(label[0].length) : said;
    return words ? [{ start, ...(end !== null && { end }), ...(speaker && { speaker }), text: words }] : [];
  });
}

/** A number a JSON file gives, as a number or (some do) as text. */
const seconds = (value: unknown) => (typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN);

/** Podcasting 2.0's JSON: `{ segments: [{ startTime, endTime, speaker, body }] }`. */
function readJson(text: string): Cue[] {
  const segments: unknown = JSON.parse(text)?.segments;
  if (!Array.isArray(segments)) return [];
  return segments.flatMap((segment): Cue[] => {
    const { startTime, endTime, speaker, body } = segment ?? {};
    const start = seconds(startTime);
    const end = seconds(endTime);
    const said = typeof body === "string" ? plainText(body) : "";
    if (!Number.isFinite(start) || !said) return [];
    return [{ start, ...(Number.isFinite(end) && { end }), ...(typeof speaker === "string" && speaker.trim() && { speaker: speaker.trim() }), text: said }];
  });
}

/**
 * Podcasting 2.0's HTML: `<cite>Speaker:</cite> <time>0:00</time> <p>What's said</p>`, again and
 * again, a speaker often named only where it changes; read as the page's text, never shown.
 */
function readHtml(text: string): Cue[] {
  const cues: Cue[] = [];
  let speaker: string | undefined;
  let start: number | null = null;
  for (const element of parseHtml(text).querySelectorAll("cite, time, p")) {
    const said = plainText(element.innerHTML);
    if (element.localName === "cite") speaker = said.replace(/:$/, "") || undefined;
    else if (element.localName === "time") start = cueTime(said);
    else if (start !== null && said) {
      cues.push({ start, ...(speaker && { speaker }), text: said });
      start = null;
    }
  }
  return cues;
}

/** A transcript's lines, read as its type says (or as it looks, if it says none, or something else). Nothing, if it isn't one lines reads. */
export function readTranscript(text: string, type = ""): Cue[] {
  const kind = type.toLowerCase();
  const head = text.trimStart();
  try {
    if (kind.includes("json") || head.startsWith("{")) return readJson(text);
    if (kind.includes("vtt") || kind.includes("srt") || kind.includes("subrip") || head.startsWith("WEBVTT") || /^\d+\s*\n[\d:,.]+\s*-->/.test(head)) return readCues(text);
    if (kind.includes("html") || head.startsWith("<")) return readHtml(text);
  } catch {
    // Not what it said it was.
  }
  return [];
}

/** Where a sentence ends: its stop, question or exclamation mark (and a closing quote or bracket). */
const SENTENCE_END = /[.?!…]["'”’)\]]?$/;
/** A sentence's most, in characters, and the most silence within one, in seconds. */
const LONGEST = 280;
const PAUSE = 2;

/**
 * Lines put together into sentences: some transcripts give each word, or a few, a line of its own.
 * A line goes on the one before while the same person is speaking, that one hasn't ended a sentence,
 * nor run long, and there's no pause between.
 */
export function sentences(cues: readonly Cue[]): Cue[] {
  const joined: Cue[] = [];
  for (const cue of cues) {
    const last = joined.at(-1);
    const goesOn =
      last &&
      last.speaker === cue.speaker &&
      !SENTENCE_END.test(last.text) &&
      last.text.length + cue.text.length < LONGEST &&
      cue.start - (last.end ?? cue.start) <= PAUSE;
    if (goesOn) joined[joined.length - 1] = { ...last, ...(cue.end !== undefined && { end: cue.end }), text: `${last.text} ${cue.text}` };
    else joined.push({ ...cue });
  }
  return joined;
}

const web = (value: unknown) => (typeof value === "string" && /^https?:\/\/\S+$/i.test(value) ? value : undefined);

/**
 * Podcasting 2.0's chapters, as their JSON lists them (`{ chapters: [{ startTime, title, img, url, toc }] }`),
 * in order: those for the table of contents (`toc: false` are not: a listener's tip, say), with a
 * title; a picture or link only on the web.
 */
export function readChapters(text: string): Chapter[] {
  let chapters: unknown;
  try {
    chapters = JSON.parse(text)?.chapters;
  } catch {
    return [];
  }
  if (!Array.isArray(chapters)) return [];
  return chapters
    .flatMap((chapter): Chapter[] => {
      const { startTime, title, img, url, toc } = chapter ?? {};
      const start = seconds(startTime);
      if (!Number.isFinite(start) || toc === false || typeof title !== "string" || !title.trim()) return [];
      const [image, link] = [web(img), web(url)];
      return [{ start, title: title.trim(), ...(image && { image }), ...(link && { link }) }];
    })
    .sort((a, b) => a.start - b.start);
}

/** Which of `list` (in order of when each starts) is the one at `seconds`: the last to start by then, or -1. */
export function indexAt(list: readonly { start: number }[], seconds: number): number {
  let low = 0;
  let high = list.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (list[middle].start <= seconds) {
      found = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  return found;
}
