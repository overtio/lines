import { insert, named, SECTIONS } from "../../lib/editor/slashCommands";
import { t } from "../../lib/i18n/index.svelte";
import { extractTags } from "../../lib/notes/parse";
import { TAG_NAME } from "../../lib/notes/tags";
import { countLines } from "../../lib/notes/stats";
import type { NoteMeta } from "../../lib/notes/types";
import type { NoteLanguage, Plugin } from "../../lib/plugins/types";
import { el, type Parts } from "../../lib/print/parts";
import { http, hurl } from "./dialects";
import { blockRequests, hurlNoteRequests, noteRequests } from "./editor";
import { hurlCode } from "./hurl/language";
import { httpCode } from "./language";
import type { Dialect } from "./request";

/*
 * API requests in notes, a lighter Bruno or Postman (docs/requests.md): requests written in the
 * .http format (parse.ts) or Hurl's (hurl/), sent from the note, their responses shown under them
 * (editor.ts), and, for Hurl, checked. In .http and .hurl notes, and in ```http and ```hurl code
 * blocks in Markdown notes.
 */

/** Lines a note's title isn't read from: variables, `# @name`s, and lines of nothing but tags. */
const NOT_TITLE = new RegExp(`^\\s*(?:@|(?:#|//)\\s*(?:@|#${TAG_NAME}(?:\\s+#${TAG_NAME})*\\s*$))`, "u");

/** A note's title is its first line as it reads (a `###` title, a comment, or a request); its excerpt, its requests. */
const meta =
  (dialect: Dialect) =>
  (body: string): NoteMeta => {
    const { requests, comments } = dialect.read(body);
    let title = "";
    for (const line of body.split("\n", 200)) {
      if (!line.trim() || NOT_TITLE.test(line)) continue;
      title = line.replace(/^\s*(?:###|#|\/\/)\s*/, "").trim();
      if (title) break;
    }
    const asked = requests.map((request) => `${request.method} ${request.url}`).filter((request) => request !== title);
    return {
      title,
      excerpt: asked.join(" · ").slice(0, 200),
      tags: extractTags(comments.join("\n")),
      hasOpenTodos: false,
      searchText: body.toLowerCase(),
      properties: [],
      type: "",
    };
  };

/** A comment line before any request (not a `###` one), and one of nothing but tags. */
const LEADING_COMMENT = /^\s*(?:#(?!##)|\/\/)/;
const TAG_LINE = new RegExp(`^\\s*#\\s*(?:#${TAG_NAME}\\s*)+$`, "u");

/**
 * The note with `# #tag` added, unless it has the tag: in the comments at its top, which are
 * outside every request (at its end, it would be the last request's body).
 */
const addTag = (read: (body: string) => NoteMeta) => (body: string, tag: string) => {
  if (read(body).tags.includes(tag)) return body;
  const lines = body.split("\n");
  let after = 0;
  while (after < lines.length && LEADING_COMMENT.test(lines[after])) after++;
  if (after && TAG_LINE.test(lines[after - 1])) lines[after - 1] = `${lines[after - 1].trimEnd()} #${tag}`;
  else lines.splice(after, 0, `# #${tag}`);
  return lines.join("\n");
};

/** On paper: the requests as written, highlighted. */
const print = (language: string) => (body: string, parts: Parts) => el("div", "doc doc-requests", parts.code(body, language));

/** What's the same for notes in either format. */
function requestNotes(dialect: Dialect, extension: string): Omit<NoteLanguage, "id" | "name" | "editor" | "newNote"> {
  const read = meta(dialect);
  return {
    extensions: [extension, ...(extension === "http" ? ["rest"] : [])],
    mimeType: "text/plain",
    meta: read,
    plainText: (body) => body,
    stats: (body) => countLines(body.split("\n").map((text) => ({ text, heading: text.startsWith("###") }))),
    addTag: addTag(read),
    file: (body) => body,
    print: print(extension),
  };
}

export const requests = (): Plugin => ({
  id: "http",
  name: t("plugins.http"),
  description: t("plugins.http.description"),
  icon: "send",
  enabledByDefault: true,
  contributes: {
    languages: [
      {
        id: "http",
        name: t("http.format"),
        ...requestNotes(http, "http"),
        editor: () => noteRequests,
        // A tag in a comment just below the title, which the request written after it keeps among its headers.
        newNote: ({ tag }) => (tag ? `### \n# #${tag}` : "### "),
      },
      {
        id: "hurl",
        name: t("hurl.format"),
        ...requestNotes(hurl, "hurl"),
        editor: () => hurlNoteRequests,
        // Its title, a comment; then its tag, another.
        newNote: ({ tag }) => (tag ? `# \n# #${tag}` : "# "),
      },
    ],
    codeLanguages: [httpCode, hurlCode],
    markdown: [
      {
        editor: blockRequests,
        commands: [
          {
            ...named("editor.slash.request"),
            after: "codeBlock",
            hint: "http",
            icon: "send",
            section: SECTIONS.insert,
            apply: insert("```http\nGET https://|\n```", true),
          },
          {
            ...named("editor.slash.hurl"),
            after: "request",
            hint: "hurl",
            icon: "send",
            section: SECTIONS.insert,
            apply: insert("```hurl\nGET https://|\nHTTP 200\n[Asserts]\n\n```", true),
          },
        ],
      },
    ],
  },
});
