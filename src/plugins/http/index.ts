import { insert, named, SECTIONS } from "../../lib/editor/slashCommands";
import { t } from "../../lib/i18n/index.svelte";
import { extractTags } from "../../lib/notes/parse";
import { countLines } from "../../lib/notes/stats";
import type { NoteMeta } from "../../lib/notes/types";
import type { Plugin } from "../../lib/plugins/types";
import { el, type Parts } from "../../lib/print/parts";
import { blockRequests, noteRequests } from "./editor";
import { httpCode } from "./language";
import { parseHttp } from "./parse";

/*
 * API requests in notes, a lighter Bruno or Postman (docs/requests.md): requests written in the
 * .http format (parse.ts), sent from the note, their responses shown under them (editor.ts). In
 * .http notes, and in ```http code blocks in Markdown notes.
 */

/** Lines a .http note's title isn't read from: variables, `# @name`s, and lines of nothing but tags. */
const NOT_TITLE = /^\s*(?:@|(?:#|\/\/)\s*(?:@|#[\p{L}\p{N}_/-]+(?:\s+#[\p{L}\p{N}_/-]+)*\s*$))/u;

/** A .http note's title is its first line as it reads (a `###` title, a comment, or a request); its excerpt, its requests. */
function meta(body: string): NoteMeta {
  const { requests, comments } = parseHttp(body);
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
}

/** A comment line before any request (not a `###` one), and one of nothing but tags. */
const LEADING_COMMENT = /^\s*(?:#(?!##)|\/\/)/;
const TAG_LINE = /^\s*#\s*(?:#[\p{L}\p{N}_/-]+\s*)+$/u;

/**
 * The note with `# #tag` added, unless it has the tag: in the comments at its top, which are
 * outside every request (at its end, it would be the last request's body).
 */
function addTag(body: string, tag: string) {
  if (meta(body).tags.includes(tag)) return body;
  const lines = body.split("\n");
  let after = 0;
  while (after < lines.length && LEADING_COMMENT.test(lines[after])) after++;
  if (after && TAG_LINE.test(lines[after - 1])) lines[after - 1] = `${lines[after - 1].trimEnd()} #${tag}`;
  else lines.splice(after, 0, `# #${tag}`);
  return lines.join("\n");
}

/** On paper: the requests as written, highlighted. */
const print = (body: string, parts: Parts) => el("div", "doc doc-requests", parts.code(body, "http"));

export const http = (): Plugin => ({
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
        extensions: ["http", "rest"],
        mimeType: "text/plain",
        editor: () => noteRequests,
        meta,
        plainText: (body) => body,
        stats: (body) => countLines(body.split("\n").map((text) => ({ text, heading: text.startsWith("###") }))),
        addTag,
        // A tag in a comment just below the title, which the request written after it keeps among its headers.
        newNote: ({ tag }) => (tag ? `### \n# #${tag}` : "### "),
        file: (body) => body,
        print,
      },
    ],
    codeLanguages: [httpCode],
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
        ],
      },
    ],
  },
});
