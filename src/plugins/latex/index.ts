import { t } from "../../lib/i18n/index.svelte";
import { ATTACHMENT_PATH } from "../../lib/notes/attachments";
import { addTagIn, extractTags } from "../../lib/notes/parse";
import { countLines } from "../../lib/notes/stats";
import type { NoteMeta } from "../../lib/notes/types";
import type { Plugin } from "../../lib/plugins/types";
import { inVerbatim, latexEditing } from "./editor";
import { printDocument } from "./print";
import { latexContent, latexDocument, latexLine, latexLines, latexPlainText, markTitle } from "./text";
import { commentMarks } from "../../lib/editor/markers";

/*
 * Notes written in LaTeX (docs/latex.md): drawn as you type them (editor.ts, reading the note with
 * syntax.ts), read for the note list (text.ts), laid out for paper (print.ts), and exported as a
 * document that compiles.
 */

/** A LaTeX note's title and excerpt come from its text as it reads; its tags can be in comments (`% #work`). */
function meta(body: string): NoteMeta {
  const { text, title } = latexContent(body);
  // Lines are read only until there's a title and an excerpt, which in a long note are a few of them.
  const lines = title ? [title] : [];
  let excerpt = -1;
  for (const line of text.split("\n")) {
    if (excerpt >= 200) break;
    const read = latexLine(line).text.replace(/\s+/g, " ").trim();
    if (!read) continue;
    if (lines.length) excerpt += read.length + 1;
    lines.push(read);
  }
  return {
    title: lines[0] ?? "",
    excerpt: lines.slice(1).join(" ").slice(0, 200),
    tags: extractTags(body),
    hasOpenTodos: false,
    searchText: body.toLowerCase(),
    properties: [],
    type: "",
  };
}

export const latex = (): Plugin => ({
  id: "latex",
  name: "LaTeX",
  description: t("plugins.latex.description"),
  icon: "graduation-cap",
  enabledByDefault: true,
  contributes: {
    languages: [
      {
        id: "latex",
        name: "LaTeX",
        extensions: ["tex"],
        mimeType: "application/x-tex",
        editor: latexEditing,
        meta,
        plainText: latexPlainText,
        stats: (body) => countLines(latexLines(latexContent(body).text)),
        // In a comment, which LaTeX ignores.
        addTag: (body, tag) => addTagIn(body, tag, "%"),
        markTitle,
        newNote: ({ tag }) => (tag ? `\n\n% #${tag}` : ""),
        // A document that compiles on its own, its images' \includegraphics pointing into `attachments`.
        file: (body, attachments) => latexDocument(attachments ? body.replaceAll(`{${ATTACHMENT_PATH}`, `{${attachments}`) : body),
        print: printDocument,
        // A comment, which LaTeX ignores; in verbatim, `%` is text.
        lineMarks: commentMarks("%", "", { notAfter: "\\", skip: inVerbatim }),
      },
    ],
  },
});
