/*
 * A typing drill: a passage, what's been typed of it, and what that comes to, as typing tutors
 * count it: speed in words a minute, a word being five characters typed right; accuracy as the
 * keys typed right of all those typed, mistakes fixed after still counted; and the keys missed.
 */

/** What a keyboard types for characters it has no key for: curly quotes as straight ones, dashes as hyphens. */
const PLAIN: Record<string, string> = { "’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-", " ": " " };

/** Whether `typed` is right for `wanted`. */
export const matches = (wanted: string, typed: string) => typed === wanted || PLAIN[wanted] === typed;

/**
 * A block's text as it's typed: tabs as spaces, without spaces at the ends of lines, and a blank
 * line between paragraphs one line break, a press of Enter.
 */
export const passageOf = (source: string) =>
  source
    .replaceAll("\t", "  ")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

export class Drill {
  /** The passage, and what's typed of it, a character each (an emoji or an accented letter is one). */
  wanted = $state.raw<string[]>([]);
  typed = $state.raw<string[]>([]);
  /** When the first key was typed, and the last, by `performance.now()`. */
  started = $state<number | null>(null);
  finished = $state<number | null>(null);
  /** Kept up to date while it's going, so what it comes to shows as it goes. */
  now = $state(0);
  keys = $state(0);
  mistakes = $state(0);
  /** Time away from it while it was going (the keyboard elsewhere), which doesn't count. */
  #away = 0;
  #leftAt: number | null = null;
  #missed = new Map<string, number>();

  constructor(passage: string) {
    this.reset(passage);
  }

  get passage() {
    return this.wanted.join("");
  }

  reset(passage = this.passage) {
    this.wanted = Array.from(passage);
    this.typed = [];
    this.started = this.finished = null;
    this.keys = this.mistakes = 0;
    this.#away = 0;
    this.#leftAt = null;
    this.#missed.clear();
  }

  get going() {
    return this.started !== null && this.finished === null;
  }

  /**
   * What's typed now, from a text field holding it. Each character added counts as a key; after a
   * line break the next line's indent is typed for you, as an editor does. Gives back what the field
   * should hold.
   */
  type(value: string): string {
    if (this.finished !== null) return this.typed.join("");
    const now = performance.now();
    const { wanted } = this;
    const text = Array.from(value).slice(0, wanted.length);
    let same = 0;
    while (same < this.typed.length && same < text.length && this.typed[same] === text[same]) same++;
    for (let i = same; i < text.length; i++) {
      this.keys++;
      if (matches(wanted[i], text[i])) continue;
      this.mistakes++;
      this.#missed.set(wanted[i], (this.#missed.get(wanted[i]) ?? 0) + 1);
    }
    if (text.length > same) {
      this.started ??= now;
      if (text.at(-1) === "\n" && wanted[text.length - 1] === "\n") while (wanted[text.length] === " ") text.push(" ");
    }
    this.typed = text;
    this.now = now;
    if (text.length && text.length === wanted.length) this.finished = now;
    return text.join("");
  }

  /** The keyboard went elsewhere, or came back: time away doesn't count. */
  away(gone: boolean) {
    const now = performance.now();
    if (gone && this.going) this.#leftAt ??= now;
    else if (!gone && this.#leftAt !== null) {
      this.#away += now - this.#leftAt;
      this.#leftAt = null;
    }
  }

  /** How long it's taken, in milliseconds. */
  get time() {
    if (this.started === null) return 0;
    return Math.max(0, (this.finished ?? this.#leftAt ?? this.now) - this.started - this.#away);
  }

  /** Whether the character at `i` was typed right. */
  right(i: number) {
    return matches(this.wanted[i], this.typed[i]);
  }

  /** Words a minute, from the characters typed right; nothing until it's had a second. */
  get speed() {
    if (this.time < 1000) return 0;
    const right = this.typed.filter((_, i) => this.right(i)).length;
    return Math.round(right / 5 / (this.time / 60_000));
  }

  /** Of the keys typed, the share typed right, as a percentage. */
  get accuracy() {
    return this.keys ? Math.round((100 * (this.keys - this.mistakes)) / this.keys) : 100;
  }

  /** The characters missed most, most first: three at most. */
  missed() {
    return [...this.#missed]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => key);
  }
}

/** A passage's own number, to keep its best speed by. */
function hash(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = Math.imul(h, 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}

const BEST = "lines.typing.best";

function bests(): Record<string, number> {
  try {
    const stored = JSON.parse(localStorage.getItem(BEST) ?? "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

/** The best speed a passage has been typed at, on this device. */
export const bestSpeed = (passage: string): number | undefined => bests()[hash(passage)];

/** Keeps `speed` as the passage's best, if it is: whether it was. */
export function keepBest(passage: string, speed: number) {
  const all = bests();
  const key = hash(passage);
  if ((all[key] ?? 0) >= speed) return false;
  all[key] = speed;
  try {
    localStorage.setItem(BEST, JSON.stringify(all));
  } catch {
    // Not kept (private browsing): it's still the best this time.
  }
  return true;
}
