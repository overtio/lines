import { languages } from "@codemirror/language-data";
import type { Extension } from "@codemirror/state";
import { t } from "../../lib/i18n/index.svelte";
import { extractTags } from "../../lib/notes/parse";
import { countLines } from "../../lib/notes/stats";
import type { NoteMeta } from "../../lib/notes/types";
import type { NoteLanguage, Plugin } from "../../lib/plugins/types";
import { el } from "../../lib/print/parts";
import { codeEditing } from "./editor";

/*
 * Code notes: a note that's a file of code, in any of the programming languages CodeMirror knows
 * (@codemirror/language-data), drawn as a code editor draws it (editor.ts) and kept as the file it
 * is, which downloads and syncs with its language's extension. One format for each language,
 * shown together as Code, with a choice of language, in a note's ⓘ panel.
 */

/** How each kind of language comments, for a note's tags; `//` for the rest. */
const COMMENTS: [string[], string, string?][] = [
  [["Python", "Cython", "Shell", "Ruby", "Perl", "R", "YAML", "TOML", "CMake", "CoffeeScript", "Julia", "PowerShell", "Properties files", "Crystal", "Puppet", "RPM Spec", "Tcl", "Sieve", "NSIS"], "#"],
  [["SQL", "MySQL", "MariaDB SQL", "PostgreSQL", "SQLite", "PLSQL", "MS SQL", "CQL", "Lua", "Haskell", "Elm", "VHDL", "Eiffel", "Pig"], "--"],
  [["Clojure", "ClojureScript", "Common Lisp", "Scheme", "edn", "Gas", "Z80", "MUMPS"], ";"],
  [["Erlang", "Octave"], "%"],
  [["VB.NET", "VBScript"], "'"],
  [["HTML", "XML", "Vue", "DTD", "Markdown"], "<!--", "-->"],
  [["CSS", "Closure Stylesheets (GSS)"], "/*", "*/"],
  [["OCaml", "SML", "Pascal", "Mathematica"], "(*", "*)"],
];

const commentOf = (name: string): [string, string?] => {
  const found = COMMENTS.find(([names]) => names.includes(name));
  return found ? [found[1], found[2]] : ["//"];
};

/** A comment's opening and closing marks, and a script's `#!` line. */
const OPENING = /^\s*(?:\/\/+|#+|--+|;+|%+|'+|\/\*+|\(\*|<!--|\{#)\s*/;
const CLOSING = /\s*(?:\*\/|\*\)|-->|#\})\s*$/;
const SHEBANG = /^#!/;

/** A note's title is its first line as it reads, a comment without its marks; its tags are in the comments at its top. */
function meta(body: string): NoteMeta {
  const lines = body.split("\n", 400);
  const first = lines.findIndex((line) => line.trim() && !SHEBANG.test(line));
  const title = first < 0 ? "" : lines[first].replace(OPENING, "").replace(CLOSING, "").trim();
  const comments: string[] = [];
  for (const line of lines.slice(Math.max(first, 0))) {
    if (!line.trim()) continue;
    if (!OPENING.test(line)) break;
    comments.push(line.replace(OPENING, "").replace(CLOSING, ""));
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

/** The note with `#tag` in a comment at its top, unless it has the tag. */
const addTag = (comment: [string, string?]) => (body: string, tag: string) =>
  meta(body).tags.includes(tag) ? body : `${[comment[0], `#${tag}`, comment[1]].filter(Boolean).join(" ")}\n${body}`;

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
      .filter((description) => description.extensions.length)
      .map((description): NoteLanguage => {
        const comment = commentOf(description.name);
        // Made once, so a note opened in the language again is set up as it was.
        let editing: Extension | undefined;
        return {
          id: formatId(description.name),
          name: description.name,
          group: group(),
          extensions: [...description.extensions],
          mimeType: "text/plain",
          editor: () => (editing ??= codeEditing(description)),
          meta,
          plainText: (body) => body,
          stats: (body) => countLines(body.split("\n").map((text) => ({ text, heading: false }))),
          addTag: addTag(comment),
          newNote: ({ tag }) => (tag ? addTag(comment)("", tag) : ""),
          file: (body) => body,
          print: (body, parts) => el("div", "doc doc-code-note", parts.code(body, description.name)),
        };
      }),
  },
});
