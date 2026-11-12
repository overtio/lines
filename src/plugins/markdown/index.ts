import { syntaxTree } from "@codemirror/language";
import { commentMarks } from "../../lib/editor/markers";
import { frontMatterField } from "../../lib/editor/objects";
import { markdownEditing } from "../../lib/editor/setup";
import { t } from "../../lib/i18n/index.svelte";
import { ATTACHMENT_PATH } from "../../lib/notes/attachments";
import { addTagIn, computeMeta } from "../../lib/notes/parse";
import { noteStats, plainText } from "../../lib/notes/stats";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import type { Plugin } from "../../lib/plugins/types";
import { markdownDocument } from "../../lib/print/markdown";

/*
 * Markdown, as lines reads and writes it (Linedown, docs/linedown.md): the language notes are
 * written in unless they say otherwise. Other plugins can add to it (its `markdown` additions).
 * Its code is the editor's (lib/editor), which other languages build on too, and lib/print/markdown.ts.
 */

/** What a line mark's comment would be part of, or break, rather than follow: code, math, tables, raw HTML. */
const NOT_TEXT = new Set(["FencedCode", "CodeBlock", "InlineCode", "InlineMath", "MathBlock", "Table", "HTMLBlock", "CommentBlock", "SetextHeading1", "SetextHeading2"]);

/**
 * Where `<!-- … -->` isn't a line mark: anywhere but the end of a paragraph's, a todo's or a
 * heading's text (in a list or a quote too). In code it's text; after a fence, `$$`, a table's
 * row, a divider or the properties it would change what they are.
 */
function notMarkable(state: EditorState, pos: number) {
  const front = state.field(frontMatterField, false);
  if (front && state.doc.lineAt(pos).number <= front.lines) return true;
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1); node; node = node.parent) {
    if (NOT_TEXT.has(node.name)) return true;
    if (node.name === "Paragraph" || node.name === "Task" || node.name.startsWith("ATXHeading")) return false;
  }
  return true;
}

export const markdown = (): Plugin => ({
  id: "markdown",
  name: "Markdown",
  description: t("plugins.markdown.description"),
  icon: "hash",
  enabledByDefault: true,
  required: true,
  contributes: {
    languages: [
      {
        id: "markdown",
        name: "Markdown",
        extensions: ["md", "markdown"],
        mimeType: "text/markdown",
        editor: markdownEditing,
        meta: computeMeta,
        plainText,
        stats: noteStats,
        addTag: (body, tag) => addTagIn(body, tag),
        // Ready for its title, after its tag, or its type and other properties.
        newNote: ({ tag, type, properties }) => {
          if (tag) return `# \n\n#${tag}`;
          const lines = Object.entries({ ...(type && { type }), ...properties }).map(([key, value]) => `${key}: ${value}`);
          return lines.length ? `---\n${lines.join("\n")}\n---\n# ` : "# ";
        },
        file: (body, attachments) => (attachments ? body.replaceAll(`](${ATTACHMENT_PATH}`, `](${attachments}`) : body),
        print: markdownDocument,
        // An HTML comment, which Markdown apps don't show.
        lineMarks: commentMarks("<!--", "-->", { skip: notMarkable }),
      },
    ],
  },
});
