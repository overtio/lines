import { imageSize, mediaLink } from "./attachments";
import { isPageBreak } from "./pageBreak";
import { frontMatter } from "./properties";

export interface NoteStats {
  words: number;
  characters: number;
  sentences: number;
  paragraphs: number;
}

const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const HAS_WORD = /[\p{L}\p{N}]/u;
const HEADING_RE = /^\s{0,3}#{1,6}\s/;
const FENCE_RE = /^\s*(```|~~~)/;
const RULE_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;
/** A card's `::: card` or `:::` line. */
const CARD_FENCE_RE = /^\s*:{3,}/;
/** The |---|:--:| line under a table's header. */
const TABLE_DELIM_RE = /^(?=.*\|)\s*\|?(\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?\s*$/;
const sentenceSegmenter = "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "sentence" }) : null;

/** One line with its Markdown syntax removed, so it reads (and counts) as written. */
export function plainLine(line: string): string {
  if (isPageBreak(line)) return "";
  return line
    // Comments show nowhere: a line's mark (`<!-- mark green: check -->`) isn't part of its text, nor of a title.
    .replace(/\s*<!--.*?-->/g, "")
    .replace(/^\s*\|(.*?)\|?\s*$/, (_, row: string) =>
      row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|")).join("\t"),
    )
    .replace(/^\s*(?:#{1,6}\s+|>\s?)*/, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, "")
    // Link text may have escaped brackets, as attached files' names do: `[a \[draft\].txt](…)`.
    .replace(/!\[(?:\\.|[^\]\\])*\]\([^)]*\)/g, "")
    .replace(/\[((?:\\.|[^\]\\])*)\]\(([^)]*)\)/g, (_, text: string, href: string) => {
      const shown = text.replace(/\\([[\]\\])/g, "$1");
      // A video's width (`[Sky.mp4|400]`) is how it's shown, not part of its name.
      return mediaLink(href) === "video" ? imageSize(shown).alt : shown;
    })
    .replace(/\*\*|__|~~|==|`|\*|<\/?u>/gi, "")
    // A wiki link reads as what it shows: `[[Ada Lovelace]]` as `Ada Lovelace`, `[[Ada Lovelace|Ada]]` as `Ada`.
    .replace(/(?<![!\\])\[\[([^[\]\n|#]+)(?:#[^[\]\n|]*)?(?:\|([^[\]\n]+))?\]\]/gu, (_, name: string, shown?: string) => (shown ?? name).trim())
    // A mention of a note with spaces in its title: `@[Ada Lovelace]` reads `@Ada Lovelace`.
    .replace(/(?<![\p{L}\p{N}_./\\@])@\[([^\]\n]+)\]/gu, "@$1")
    // _emphasis_, but not the underscores inside snake_case words.
    .replace(/(?<![\p{L}\p{N}])_([^_\n]+)_(?![\p{L}\p{N}])/gu, "$1")
    .trimEnd();
}

/** The note's lines after its properties (notes/properties.ts), which aren't part of its text. */
function textLines(body: string): string[] {
  return body.split("\n").slice(frontMatter(body)?.lines ?? 0);
}

/** A Markdown note as plain text: Markdown and properties removed, code kept, fences, dividers and card fences dropped, table cells tab-separated. */
export function plainText(body: string): string {
  return textLines(body)
    .filter((line) => !FENCE_RE.test(line) && !RULE_RE.test(line) && !TABLE_DELIM_RE.test(line) && !CARD_FENCE_RE.test(line))
    .map(plainLine)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countSentences(text: string): number {
  if (!sentenceSegmenter) return text.split(/[.!?…]+(?:\s|$)/).filter((s) => HAS_WORD.test(s)).length;
  let count = 0;
  for (const { segment } of sentenceSegmenter.segment(text)) if (HAS_WORD.test(segment)) count++;
  return count;
}

/**
 * Counts what a reader sees in a Markdown note. Every line with words is a paragraph (that's how
 * the editor shows them), except headings, which also don't count as sentences.
 */
export function noteStats(body: string): NoteStats {
  const lines: CountedLine[] = [];
  let inFence = false;
  for (const line of textLines(body)) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && (RULE_RE.test(line) || TABLE_DELIM_RE.test(line) || CARD_FENCE_RE.test(line))) continue;
    lines.push({ text: inFence ? line : plainLine(line), heading: inFence || HEADING_RE.test(line) });
  }
  return countLines(lines);
}

/** A line as it reads, and whether it's a heading (or code), which counts words but not as a paragraph. */
export interface CountedLine {
  text: string;
  heading: boolean;
}

/** Counts a note's lines, as any language reads them: words and characters, and paragraphs and sentences outside headings. */
export function countLines(lines: Iterable<CountedLine>): NoteStats {
  const stats: NoteStats = { words: 0, characters: 0, sentences: 0, paragraphs: 0 };
  for (const { text, heading } of lines) {
    const words = text.match(WORD_RE)?.length ?? 0;
    stats.words += words;
    stats.characters += [...text.trim()].length;
    if (!words || heading) continue;
    stats.paragraphs++;
    stats.sentences += countSentences(text);
  }
  return stats;
}
