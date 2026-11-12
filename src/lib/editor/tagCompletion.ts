import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";
import { locale } from "../i18n/index.svelte";
import { tagLooks } from "../notes/looks.svelte";
import { notes } from "../notes/store.svelte";
import { TAG_NAME } from "../notes/tags";
import type { IconCompletion } from "./objects";
import { ancestors } from "./util";

/*
 * The tags you have, as a #tag is typed: those starting with what's typed first, then those with a
 * part that does (`#meet` finds `work/meetings`), then the rest that have it, each with its icon
 * and how many notes have it. Like "@", a lone "#" waits for a letter, so a heading's `# ` and a
 * `#` that's just a `#` don't open it; nor does the tag already written in full.
 */

/** A tag being typed: a `#` where a tag can start (as notes/parse.ts reads them), and what's after it. */
const TYPING_TAG = new RegExp(`(?:^|[\\s(])#(${TAG_NAME})$`, "u");
const TAG_AFTER = new RegExp(`^${TAG_NAME}`, "u");
/** Where a `#` is just a `#`. */
const LITERAL = new Set(["FencedCode", "CodeBlock", "InlineCode", "CodeText", "URL", "Link", "Autolink", "HeaderMark", "FrontMatter"]);
const MAX_OPTIONS = 40;

export function tagSource(context: CompletionContext): CompletionResult | null {
  for (const node of ancestors(context.state, context.pos, -1)) if (LITERAL.has(node.name)) return null;
  const line = context.state.doc.lineAt(context.pos);
  const typed = TYPING_TAG.exec(line.text.slice(0, context.pos - line.from))?.[1];
  if (!typed) return null;
  const query = typed.toLowerCase();
  const rank = (path: string) => {
    const name = path.toLowerCase();
    return name.startsWith(query) ? 3 : name.split("/").some((part) => part.startsWith(query)) ? 2 : name.includes(query) ? 1 : 0;
  };
  const found = notes.tags
    .filter(({ path }) => path.toLowerCase() !== query)
    .map((tag) => ({ ...tag, rank: rank(tag.path) }))
    .filter(({ rank }) => rank > 0)
    .sort((a, b) => b.rank - a.rank || b.count - a.count || a.path.localeCompare(b.path))
    .slice(0, MAX_OPTIONS);
  if (!found.length) return null;
  const from = context.pos - typed.length;
  return {
    from,
    filter: false,
    options: found.map(({ path, count }): IconCompletion => ({
      label: path,
      detail: count.toLocaleString(locale),
      icon: tagLooks.icon(path),
      // The whole tag the cursor's in, what's after it too.
      apply: (view: EditorView, _completion, _from: number, to: number) => {
        const end = to + (TAG_AFTER.exec(view.state.sliceDoc(to, view.state.doc.lineAt(to).to))?.[0].length ?? 0);
        view.dispatch({ changes: { from, to: end, insert: path }, selection: { anchor: from + path.length }, userEvent: "input.complete" });
      },
    })),
  };
}
