import { plugins } from "../plugins/registry.svelte";
import type { Note } from "./types";

/** How far down a note its title is looked for: past the longest properties. */
export const TITLE_LINES = 110;

/**
 * The note's text with its title changed to `title`, as written there: where its language keeps it
 * (a LaTeX document's `\title`), or in place of the title on the line it's read from, so a heading
 * stays a heading. An untitled note has its empty heading filled in, or (in Markdown) a heading put
 * after its properties. Null if the title can't be put where it would be read from.
 */
export function retitled({ body, format }: Note, title: string): string | null {
  const own = plugins.language(format).markTitle?.(body, () => title);
  if (own) return own;
  const read = (text: string) => plugins.meta(format, text).title.trim();
  const old = read(body);
  const lines = body.split("\n");
  const changed = (i: number, line: string) => [...lines.slice(0, i), line, ...lines.slice(i + 1)].join("\n");
  for (let i = 0; i < Math.min(lines.length, TITLE_LINES); i++) {
    const line = old ? (lines[i].includes(old) ? lines[i].replace(old, () => title) : null) : /^#{1,6}\s*$/.test(lines[i]) ? `${lines[i].trim()} ${title}` : null;
    if (line === null) continue;
    const text = changed(i, line);
    if (read(text) === title.trim()) return text;
  }
  if (old || format) return null;
  // A Markdown note without a title: one after its properties, if it has them.
  const end = lines[0] === "---" ? lines.findIndex((line, i) => i > 0 && (line === "---" || line === "...")) : -1;
  return [...lines.slice(0, end + 1), `# ${title}`, ...lines.slice(end + 1)].join("\n");
}
