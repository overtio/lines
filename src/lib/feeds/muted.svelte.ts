import { writeTerms } from "./filters";
import type { Muted } from "./filters";

/*
 * The words and phrases hidden in every feed (Settings → Library → Feed filters, filters.ts): kept
 * on this device, and synced beside what's done with posts (marks.ts), in `feeds/muted.json`, the
 * later setting winning.
 */

const KEY = "lines.mutedWords";

function read(): Muted {
  try {
    const { words, at } = JSON.parse(localStorage.getItem(KEY) ?? "null") ?? {};
    if (Array.isArray(words) && Number.isFinite(at)) return { words: words.filter((word): word is string => typeof word === "string"), at };
  } catch {
    // Private mode, or not written by lines: none.
  }
  return { words: [], at: 0 };
}

class MutedWords {
  #muted = $state.raw<Muted>(read());
  #listeners = new Set<() => void>();

  constructor() {
    // Set in Settings' own window, they're hidden here at once, and synced from here.
    window.addEventListener("storage", (event) => {
      if (event.key !== KEY) return;
      this.#muted = read();
      this.#notify();
    });
  }

  get words(): string[] {
    return this.#muted.words;
  }

  get muted(): Muted {
    return this.#muted;
  }

  /** Sets them, for every device. */
  set(words: string[]) {
    if (writeTerms(words) === writeTerms(this.#muted.words)) return;
    this.#muted = { words, at: Math.max(Date.now(), this.#muted.at + 1) };
    this.#save();
    this.#notify();
  }

  /** Takes in another device's, if they were set later. */
  merge(there: Muted | null) {
    if (!there || there.at <= this.#muted.at) return;
    this.#muted = there;
    this.#save();
  }

  /** Called on each change made here, to sync it. */
  onChange(listener: () => void) {
    this.#listeners.add(listener);
  }

  #notify() {
    for (const listener of this.#listeners) listener();
  }

  #save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.#muted));
    } catch {
      // Private mode or full storage: they last until lines is closed, and sync if it's on.
    }
  }
}

export const mutedWords = new MutedWords();
