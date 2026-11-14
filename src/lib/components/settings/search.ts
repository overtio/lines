import index from "virtual:settings-search";
import { type MessageKey, t } from "../../i18n/index.svelte";
import en from "../../i18n/locales/en";
import { plugins } from "../../plugins/registry.svelte";
import type { Section } from "./sections";

/*
 * Searching Settings: what each section shows (its settings' names and notes, their choices, its
 * groups' titles), as the build found it in the section's files (vite.config.ts), in the app's
 * language; the plugins' names too. Messages filled in as something happens ("{name} deleted")
 * aren't settings, so they're left out.
 */

export interface Found {
  section: Section;
  /** What matched, as Settings shows it; the section's own title when that's what matched. */
  text: string;
  /**
   * The part of the section it's in (`ThemeEditor`), for one that isn't drawn for what's chosen (a
   * theme of your own's name, with one of lines' own chosen): it leads to the place that part marks
   * with `data-settings-part`, which says how to have it.
   */
  part?: string;
}

/** For matching: lowercase, without accents, so "resume" finds "Résumé". */
const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

type Entry = Found & { plain: string; inSection: string };

/** What's in each section to find, worked out once (the language doesn't change without a reload). */
let entries: Entry[] | null = null;

function entriesOf(shown: Section[]): Entry[] {
  if (entries) return entries;
  const messages = en as Record<string, string>;
  entries = shown.flatMap((section) => {
    // Each text once, with the part it's first in.
    const texts = new Map<string, string | undefined>([[section.title, undefined]]);
    for (const [key, part] of Object.entries(index[section.id] ?? {})) {
      const text = key in messages && !messages[key].includes("{") ? t(key as MessageKey) : null;
      if (text && !texts.has(text)) texts.set(text, part);
    }
    if (section.id === "plugins") for (const { name } of plugins.all) if (!texts.has(name)) texts.set(name, undefined);
    const inSection = plain(section.title);
    return [...texts].map(([text, part]) => ({ section, text, part, plain: plain(text), inSection }));
  });
  return entries;
}

/**
 * What in the sections shown has every word of `query`, in it or its section's title (one at least
 * in it: "cursor color" finds Cursor's Color): a section's title first, then names that start with
 * the query, then the rest, shorter (names before notes) first.
 */
export function searchSettings(query: string, shown: Section[]): Found[] {
  const words = plain(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const whole = words.join(" ");
  const rank = ({ section, text, plain: found }: Entry) =>
    (text === section.title ? 0 : found.startsWith(whole) ? 1 : 2) * 10_000 + text.length;
  return entriesOf(shown)
    .filter((entry) => words.every((word) => entry.plain.includes(word) || entry.inSection.includes(word)) && words.some((word) => entry.plain.includes(word)))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 60)
    .map(({ section, text, part }) => ({ section, text, part }));
}
