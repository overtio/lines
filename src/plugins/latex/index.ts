import { t } from "../../lib/i18n/index.svelte";
import { ATTACHMENT_PATH } from "../../lib/notes/attachments";
import { addTagIn, extractTags } from "../../lib/notes/parse";
import { countLines } from "../../lib/notes/stats";
import type { NoteMeta } from "../../lib/notes/types";
import type { Plugin } from "../../lib/plugins/types";
import { latexEditing } from "./editor";
import { printDocument } from "./print";
import { latexContent, latexDocument, latexLines, latexPlainText } from "./text";

/*
 * Notes written in LaTeX (docs/latex.md): drawn as you type them (editor.ts, reading the note with
 * syntax.ts), read for the note list (text.ts), laid out for paper (print.ts), and exported as a
 * document that compiles.
 */

/** A LaTeX note's title and excerpt come from its text as it reads; its tags can be in comments (`% #work`). */
function meta(body: string): NoteMeta {
  const { text, title } = latexContent(body);
  const lines = latexLines(text)
    .map((line) => line.text.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (title) lines.unshift(title);
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
        editor: () => latexEditing,
        meta,
        plainText: latexPlainText,
        stats: (body) => countLines(latexLines(latexContent(body).text)),
        // In a comment, which LaTeX ignores.
        addTag: (body, tag) => addTagIn(body, tag, "%"),
        newNote: ({ tag }) => (tag ? `\n\n% #${tag}` : ""),
        // A document that compiles on its own, its images' \includegraphics pointing into `attachments`.
        file: (body, attachments) => latexDocument(attachments ? body.replaceAll(`{${ATTACHMENT_PATH}`, `{${attachments}`) : body),
        print: printDocument,
      },
    ],
  },
});
