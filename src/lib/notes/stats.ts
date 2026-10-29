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
  return line
    .replace(/^\s*\|(.*?)\|?\s*$/, (_, row: string) =>
      row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|")).join("\t"),
    )
    .replace(/^\s*(?:#{1,6}\s+|>\s?)*/, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, "")
    // Link text may have escaped brackets, as attached files' names do: `[a \[draft\].txt](…)`.
    .replace(/!\[(?:\\.|[^\]\\])*\]\([^)]*\)/g, "")
    .replace(/\[((?:\\.|[^\]\\])*)\]\([^)]*\)/g, (_, text: string) => text.replace(/\\([[\]\\])/g, "$1"))
    .replace(/\*\*|__|~~|==|`|\*/g, "")
    // _emphasis_, but not the underscores inside snake_case words.
    .replace(/(?<![\p{L}\p{N}])_([^_\n]+)_(?![\p{L}\p{N}])/gu, "$1")
    .trimEnd();
}

/** The note as plain text: Markdown removed, code kept, fences, dividers and card fences dropped, table cells tab-separated. */
export function plainText(body: string): string {
  return body
    .split("\n")
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
 * Counts what a reader sees. Every line with words is a paragraph (that's how the editor shows
 * them), except headings, which also don't count as sentences.
 */
export function noteStats(body: string): NoteStats {
  const stats: NoteStats = { words: 0, characters: 0, sentences: 0, paragraphs: 0 };
  let inFence = false;
  for (const line of body.split("\n")) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && (RULE_RE.test(line) || TABLE_DELIM_RE.test(line) || CARD_FENCE_RE.test(line))) continue;
    const text = inFence ? line : plainLine(line);
    const words = text.match(WORD_RE)?.length ?? 0;
    stats.words += words;
    stats.characters += [...text.trim()].length;
    if (!words || inFence || HEADING_RE.test(line)) continue;
    stats.paragraphs++;
    stats.sentences += countSentences(text);
  }
  return stats;
}
