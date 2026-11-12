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
    const keys = (index[section.id] ?? []).filter((key) => key in messages && !messages[key].includes("{"));
    const texts = [section.title, ...keys.map((key) => t(key as MessageKey))];
    if (section.id === "plugins") texts.push(...plugins.all.map((plugin) => plugin.name));
    const inSection = plain(section.title);
    return [...new Set(texts)].map((text) => ({ section, text, plain: plain(text), inSection }));
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
    .map(({ section, text }) => ({ section, text }));
}
