import { languages } from "@codemirror/language-data";
import type { Extension } from "@codemirror/state";
import { t } from "../../lib/i18n/index.svelte";
import { extractTags } from "../../lib/notes/parse";
import { TAGS_ONLY } from "../../lib/notes/tags";
import { countLines } from "../../lib/notes/stats";
import type { NoteMeta } from "../../lib/notes/types";
import type { NoteLanguage, Plugin } from "../../lib/plugins/types";
import { el } from "../../lib/print/parts";
import { codeEditing } from "./editor";

/*
 * Code notes: a note that's a file of code, in any of the programming languages CodeMirror knows
 * (@codemirror/language-data), drawn as a code editor draws it (editor.ts) and kept as the file it
 * is, which downloads and exports with its language's extension. One format for each language
 * (but Markdown and LaTeX, which are formats of their own), shown together as Code, with a choice of
 * language, in a note's ⓘ panel.
 */

/** Languages whose usual extension isn't the first CodeMirror lists (Python's is BUILD, for Bazel). */
const USUAL: Record<string, string> = { Python: "py", APL: "apl", XQuery: "xquery", SystemVerilog: "sv" };

/** Formats of their own, with editors of their own, rather than code. */
const OWN_FORMATS = new Set(["Markdown", "LaTeX"]);

/** How each kind of language comments, for a note's title and tags; `//` for the rest (`/*` too, when reading). */
const COMMENTS: [string[], string, string?][] = [
  [["Python", "Cython", "Shell", "Ruby", "Perl", "R", "YAML", "TOML", "CMake", "CoffeeScript", "LiveScript", "Julia", "PowerShell", "Properties files", "Crystal", "Puppet", "RPM Spec", "Tcl", "Sieve", "NSIS", "Gherkin", "HXML", "SPARQL", "Turtle", "NTriples"], "#"],
  [["SQL", "MySQL", "MariaDB SQL", "PostgreSQL", "SQLite", "PLSQL", "MS SQL", "CQL", "Lua", "Haskell", "Elm", "VHDL", "Eiffel", "Pig", "ASN.1"], "--"],
  [["Clojure", "ClojureScript", "Common Lisp", "Scheme", "edn", "Gas", "Z80", "MUMPS", "mIRC", "IDL", "WebAssembly"], ";"],
  [["Erlang", "Octave", "Oz"], "%"],
  [["VB.NET", "VBScript"], "'"],
  [["HTML", "XML", "Vue", "DTD", "Markdown"], "<!--", "-->"],
  [["CSS", "Closure Stylesheets (GSS)"], "/*", "*/"],
  [["OCaml", "SML", "Pascal", "Mathematica"], "(*", "*)"],
  [["Jinja"], "{#", "#}"],
];

const commentOf = (name: string): [string, string?] => {
  const found = COMMENTS.find(([names]) => names.includes(name));
  return found ? [found[1], found[2]] : ["//"];
};

/**
 * What opens a comment in a language that comments with `mark` (`##` too), or with `//` and `/*`,
 * so a line of code (`#include`, `'use strict'`) isn't read as one.
 */
const openingOf = (mark: string) =>
  new RegExp(`^\\s*(?:${(mark === "//" ? ["//", "/*"] : [mark]).map((each) => `${each.replace(/[*(){]/g, "\\$&")}+`).join("|")})\\s*`);
/** A comment's closing mark, and a script's `#!` line. */
const CLOSING = /\s*(?:\*\/|\*\)|-->|#\})\s*$/;
const SHEBANG = /^#!/;

const commentText = (line: string, opening: RegExp) => line.replace(opening, "").replace(CLOSING, "").trim();
/** A comment that's only tags, as `addTag` writes them. */
const tagsLine = (line: string, opening: RegExp) => opening.test(line) && TAGS_ONLY.test(commentText(line, opening));
/** Where the note starts, after a script's `#!` line. */
const topOf = (lines: string[]) => lines.findIndex((line) => line.trim() && !SHEBANG.test(line));
/** The line a note's title is read from: its first, but a `#!` line or a comment of only tags. */
const titleLineOf = (lines: string[], opening: RegExp) => lines.findIndex((line) => line.trim() && !SHEBANG.test(line) && !tagsLine(line, opening));
/** A comment of its own, a line saying `text`. */
const commented = ([open, close]: [string, string?], text: string) => [open, text, close].filter(Boolean).join(" ");

/**
 * A note's title is its first line as it reads, a comment (`opening` starts one) without its marks
 * (but one of only tags); its tags are in the comments at its top.
 */
function meta(body: string, opening: RegExp): NoteMeta {
  const lines = body.split("\n", 400);
  const first = titleLineOf(lines, opening);
  const title = first < 0 ? "" : commentText(lines[first], opening);
  const comments: string[] = [];
  for (const line of lines.slice(Math.max(topOf(lines), 0))) {
    if (!line.trim()) continue;
    if (!opening.test(line)) break;
    comments.push(line.replace(opening, "").replace(CLOSING, ""));
  }
  return {
    title,
    excerpt: lines
      .slice(first + 1)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ")
      .slice(0, 200),
    tags: extractTags(comments.join("\n")),
    hasOpenTodos: false,
    searchText: body.toLowerCase(),
    properties: [],
    type: "",
  };
}

/**
 * The note with `#tag` in a comment at its top, unless it has the tag: in a comment of tags there
 * already, or one of its own below the title (a comment) or above the code, after a `#!` line.
 */
const addTag = (comment: [string, string?], opening: RegExp) => (body: string, tag: string) => {
  if (meta(body, opening).tags.includes(tag)) return body;
  const lines = body.split("\n");
  const top = topOf(lines);
  if (top < 0) return `${commented(comment, `#${tag}`)}\n${body}`;
  for (let i = top; i < lines.length && opening.test(lines[i]); i++) {
    if (!tagsLine(lines[i], opening)) continue;
    lines[i] = CLOSING.test(lines[i]) ? lines[i].replace(CLOSING, (closing) => ` #${tag}${closing}`) : `${lines[i].trimEnd()} #${tag}`;
    return lines.join("\n");
  }
  const at = opening.test(lines[top]) ? top + 1 : top;
  lines.splice(at, 0, commented(comment, `#${tag}`));
  return lines.join("\n");
};

/**
 * The note with its title changed by `mark`, its code left as it is: in the comment the title is
 * read from, or else in a comment of its own above the line it's read from (after a `#!` line, in a
 * note without one). As it is, if that comment would read as a tag it doesn't have (`#include`).
 */
const markTitle = (comment: [string, string?], opening: RegExp) => (body: string, mark: (title: string) => string) => {
  const lines = body.split("\n");
  const first = titleLineOf(lines, opening);
  const title = first < 0 ? "" : commentText(lines[first], opening);
  const opened = first < 0 ? null : opening.exec(lines[first]);
  if (opened) lines[first] = opened[0] + mark(title) + lines[first].slice(opened[0].length + title.length);
  else lines.splice(first < 0 ? (SHEBANG.test(lines[0]) ? 1 : 0) : first, 0, commented(comment, mark(title).trim()));
  const text = lines.join("\n");
  return meta(text, opening).tags.join() === meta(body, opening).tags.join() ? text : body;
};

const group = () => ({ id: "code", name: t("plugins.code"), default: "code-javascript" });

/** A language's format id: `code-python`, `code-cpp`, `code-csharp`. Kept by notes, so it never changes. */
const formatId = (name: string) =>
  `code-${name
    .toLowerCase()
    .replaceAll("+", "p")
    .replaceAll("#", "sharp")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

export const code = (): Plugin => ({
  id: "code",
  name: t("plugins.code"),
  description: t("plugins.code.description"),
  icon: "code",
  enabledByDefault: true,
  contributes: {
    languages: languages
      .filter((description) => description.extensions.length && !OWN_FORMATS.has(description.name))
      .map((description): NoteLanguage => {
        const comment = commentOf(description.name);
        const opening = openingOf(comment[0]);
        // Made once, so a note opened in the language again is set up as it was.
        let editing: Extension | undefined;
        return {
          id: formatId(description.name),
          name: description.name,
          group: group(),
          extensions: [...new Set([USUAL[description.name] ?? description.extensions[0], ...description.extensions])],
          mimeType: "text/plain",
          editor: () => (editing ??= codeEditing(description)),
          meta: (body) => meta(body, opening),
          plainText: (body) => body,
          stats: (body) => countLines(body.split("\n").map((text) => ({ text, heading: false }))),
          addTag: addTag(comment, opening),
          markTitle: markTitle(comment, opening),
          newNote: ({ tag }) => (tag ? addTag(comment, opening)("", tag) : ""),
          file: (body) => body,
          print: (body, parts) => el("div", "doc doc-code-note", parts.code(body, description.name)),
        };
      }),
  },
});
