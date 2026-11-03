import { markdownEditing } from "../../lib/editor/setup";
import { t } from "../../lib/i18n/index.svelte";
import { ATTACHMENT_PATH } from "../../lib/notes/attachments";
import { addTagIn, computeMeta } from "../../lib/notes/parse";
import { noteStats, plainText } from "../../lib/notes/stats";
import type { Plugin } from "../../lib/plugins/types";
import { markdownDocument } from "../../lib/print/markdown";

/*
 * Markdown, as lines reads and writes it (Linedown, docs/linedown.md): the language notes are
 * written in unless they say otherwise. Other plugins can add to it (its `markdown` additions).
 * Its code is the editor's (lib/editor), which other languages build on too, and lib/print/markdown.ts.
 */

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
        // Ready for its title, after its tag, or its type (as its properties).
        newNote: ({ tag, type }) => (tag ? `# \n\n#${tag}` : type ? `---\ntype: ${type}\n---\n# ` : "# "),
        file: (body, attachments) => (attachments ? body.replaceAll(`](${ATTACHMENT_PATH}`, `](${attachments}`) : body),
        print: markdownDocument,
      },
    ],
  },
});
