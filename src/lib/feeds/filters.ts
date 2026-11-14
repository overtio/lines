import { propertyValue } from "../notes/escape";

/*
 * Filters that keep or hide feeds' posts by their words: a feed's own, on its subscription's note
 * (`include:`, only its posts with one of these; `exclude:`, none of its posts with one of these),
 * and those hidden in every feed (Settings → Library → Feed filters), which sync with what's done
 * with posts (marks.ts). Each lists words and phrases between commas (`crypto, web3 summit`; a
 * phrase in quotes too). A post has one when its title, text, author or categories have it, as
 * whole words where words are spaced apart, whatever their case and Latin or Greek accents. Hiding
 * wins over keeping.
 *
 * What each post has is read once, when it's fetched or the filters change, and kept with it
 * (`KeptPost.filtered`): reading or dismissing posts never tests them again.
 */

/**
 * Text as filters read it: in lower case, Latin and Greek letters' accents taken off (é is e, ά is
 * α), but other scripts' marks kept, which make other letters (が isn't か, й isn't и, काम isn't कम).
 */
export const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/(\p{Script=Latin}|\p{Script=Greek})\p{M}+/gu, "$1")
    .normalize("NFC")
    .toLowerCase();

/** How much of a post's text filters read: its start, as much as a few paragraphs. */
const TEXT = 2000;

/** What a post is matched against: its title, author, categories and text (`text`, plain, or else its excerpt), folded. */
export function wordsOf(post: { title: string; author?: string; categories?: string[]; excerpt: string }, text = post.excerpt): string {
  return fold([post.title, post.author, ...(post.categories ?? []), text.slice(0, TEXT)].filter(Boolean).join("\n"));
}

/** The words and phrases a filter lists, as written: between commas, their quotes and extra spaces taken off, each once whatever its case. */
export function termsOf(value: string): string[] {
  const terms: string[] = [];
  for (const each of value.split(",")) {
    const term = each.replace(/["“”«»]/g, " ").replace(/\s+/g, " ").trim();
    if (term && !terms.some((other) => fold(other) === fold(term))) terms.push(term);
  }
  return terms;
}

/** A filter's words and phrases written back, as a field has them. */
export const writeTerms = (terms: string[]) => terms.join(", ");

/** The same, as a note's property: as any outside text is written, so `#ad` is no tag. */
export const termsValue = (terms: string[]) => propertyValue(writeTerms(terms));

/** Scripts written without spaces between words, or with words run into what follows them (Korean's particles): a term in one is found within words. */
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

/** Whether text has a term: what tests folded text for each term, made once, and the first term it has. */
export function matcher(terms: string[]): (words: string) => string | undefined {
  const patterns = terms.map((term) => {
    const folded = fold(term);
    const escaped = folded
      .split(" ")
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s+");
    // Whole words, where words are spaced apart; within them where they're not (広告 in 新製品の広告です).
    const pattern = UNSPACED.test(folded) ? escaped : `(?<![\\p{L}\\p{N}\\p{M}])${escaped}(?![\\p{L}\\p{N}\\p{M}])`;
    return { term, pattern: new RegExp(pattern, "u") };
  });
  return (words) => patterns.find(({ pattern }) => pattern.test(words))?.term;
}

/** A post kept out of the lists by a filter: one of the words it hides, or (`term` undefined) none of those its feed keeps. */
export interface Filtered {
  term?: string;
}

/** A feed's filters, made once: what keeps a post out of the lists, if anything does; null for none. */
export function postFilter(include: string[], exclude: string[]): ((words: string) => Filtered | null) | null {
  if (!include.length && !exclude.length) return null;
  const hides = matcher(exclude);
  const keeps = matcher(include);
  return (words) => {
    const term = hides(words);
    if (term) return { term };
    return include.length && !keeps(words) ? {} : null;
  };
}

/** What a feed's filters are, as one string: posts' verdicts made with another are made again. */
export const filterKey = (include: string[], exclude: string[]) => JSON.stringify([include.map(fold), exclude.map(fold)]);

/** The words and phrases hidden in every feed (Settings → Library → Feed filters), and when they were set. */
export interface Muted {
  words: string[];
  at: number;
}

/** The file they're synced in, beside the feeds' marks (marks.ts). */
export const MUTED_FILE = "muted.json";

/** The words hidden everywhere a file says, if it says. */
export function readMuted(text: string): Muted | null {
  try {
    const { words, at } = JSON.parse(text) ?? {};
    return Array.isArray(words) && Number.isFinite(at) ? { words: words.filter((word): word is string => typeof word === "string"), at } : null;
  } catch {
    return null;
  }
}

export const writeMuted = ({ words, at }: Muted) => JSON.stringify({ format: "lines-feed-filters", version: 1, words, at }) + "\n";
