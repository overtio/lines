import { type Edit, edited, FENCE_START, isElsewhere, pathOf, readMarkdown } from "../../lib/imports/markdown";
import { attachmentPath, noteLink, type Tally } from "../../lib/imports/notes";
import { attachmentType } from "../../lib/notes/attachments";

/*
 * A Notion page in Linedown (docs/importing.md#notion). Notion's Markdown export is Markdown much as
 * lines writes it (headings, lists, to-dos, tables, code, `$math$`); what's its own becomes lines':
 * links to pages and databases (relative paths with Notion's ids) as wiki links, pictures and files
 * as attachments, callouts (`<aside>`) as lines' callouts, toggles (`<details>`) as their title and
 * what's in them, open. Code, math and HTML otherwise are left as they are.
 */

/** What a link's path in the export leads to: a page or database by its name, a file by its index among those kept. */
export type Target = { note: string } | { file: number; name: string };

/** What a page's translation needs of the export. */
export interface Pages {
  /** What a link's path (decoded, from the page's folder) leads to; null for nothing in the export. */
  resolve(path: string): Target | null;
  report: Tally;
}

/** A callout's icon as lines' nearest kind: Notion's callouts are any emoji, a 💡 to begin with. */
const KINDS: [RegExp, string][] = [
  [/^(?:⚠️?|🚧|⛔|🔥)/u, "warning"],
  [/^(?:❗|‼️?|🚨|❌|🛑)/u, "error"],
  [/^(?:❓|❔|🤔)/u, "question"],
];

/** Notion's callouts (`<aside>` … `</aside>`) as lines' (cards.ts), toggles (`<details>`) as their summary in bold and what's under it; outside code. */
function blocks(text: string, pages: Pages, name: string) {
  const out: string[] = [];
  let fence = "";
  const lines = text.split("\n");
  for (const [i, line] of lines.entries()) {
    const opening = FENCE_START.exec(line);
    if (fence || opening) {
      if (opening) fence = !fence ? opening[1] : opening[1][0] === fence[0] && opening[1].length >= fence.length ? "" : fence;
      out.push(line);
      continue;
    }
    const aside = /^\s*<aside>\s*(.*)$/.exec(line);
    if (aside) {
      // Its text starts with its icon, after the tag or on the next line: the kind's said by the icon.
      const first = aside[1].trim();
      const kind = KINDS.find(([icon]) => icon.test(first || (lines[i + 1] ?? "").trim()))?.[1] ?? "info";
      if (out.length && out.at(-1)!.trim()) out.push("");
      out.push(`:::${kind}`, ...(first ? [first] : []));
      continue;
    }
    if (/^\s*<\/aside>\s*$/.test(line)) {
      while (out.length && !out.at(-1)!.trim()) out.pop();
      out.push(":::");
      // A blank line after a card, as other apps need.
      if (lines[i + 1]?.trim()) out.push("");
      continue;
    }
    const summary = /^\s*(?:<details>\s*)?<summary>(.*?)<\/summary>\s*$/.exec(line);
    if (summary) {
      pages.report.add("import.report.toggles", `${summary[1].trim()} (${name})`);
      out.push(`**${summary[1].trim()}**`);
      continue;
    }
    if (/^\s*<\/?details>\s*$/.test(line)) continue;
    out.push(line);
  }
  return out.join("\n");
}

/** A Notion page's text in Linedown. */
export function translate(text: string, pages: Pages, name: string): string {
  const body = blocks(text, pages, name);
  const edits: Edit[] = [];
  for (const link of readMarkdown(body).links) {
    if (isElsewhere(link.address)) continue;
    const whole = body.slice(link.from, link.to);
    const target = pages.resolve(pathOf(link.address));
    if (!target) {
      pages.report.add("import.report.missing", `${whole} (${name})`);
      continue;
    }
    const place = "file" in target && attachmentPath(target.file);
    const insert =
      "note" in target
        ? noteLink(target.note, { shown: link.text })
        : link.image && attachmentType(target.name).startsWith("image/")
          ? `![${link.text}](${place})`
          : `[${link.text || target.name}](${place})`;
    edits.push({ ...link, insert });
  }
  return edited(body, edits);
}
