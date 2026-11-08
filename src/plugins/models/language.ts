import { LanguageDescription, LanguageSupport, StreamLanguage, type StreamParser } from "@codemirror/language";

/*
 * Highlighting for OpenSCAD's code, in ```openscad blocks: its keywords, the shapes and operations
 * it has, special variables ($fn), numbers, strings and comments.
 */

const KEYWORDS = /^(?:module|function|if|else|for|intersection_for|let|each|assert|echo|include|use|true|false|undef)\b/;

const BUILT_IN =
  /^(?:cube|sphere|cylinder|polyhedron|square|circle|polygon|text|import|surface|translate|rotate|scale|resize|mirror|multmatrix|color|offset|hull|minkowski|union|difference|intersection|linear_extrude|rotate_extrude|projection|render|children|abs|sign|sin|cos|tan|asin|acos|atan|atan2|floor|round|ceil|ln|log|pow|sqrt|exp|min|max|norm|cross|len|concat|lookup|str|chr|ord|search|rands|is_undef|is_bool|is_num|is_string|is_list|is_function)\b/;

const parser: StreamParser<{ comment: boolean }> = {
  name: "openscad",
  startState: () => ({ comment: false }),
  token(stream, state) {
    if (state.comment || stream.match("/*")) {
      state.comment = !stream.match(/^.*?\*\//);
      if (state.comment) stream.skipToEnd();
      return "comment";
    }
    if (stream.eatSpace()) return null;
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return "string";
    // A file to include or use: <MCAD/gears.scad>.
    if (stream.match(/^<[^<>\s]+>/)) return "string";
    if (stream.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i)) return "number";
    if (stream.match(/^\$\w+/)) return "atom";
    if (stream.match(KEYWORDS)) return "keyword";
    if (stream.match(BUILT_IN)) return "variableName.standard";
    if (stream.match(/^[A-Za-z_]\w*/)) return stream.match(/^\s*\(/, false) ? "variableName.function" : "variableName";
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: "//", block: { open: "/*", close: "*/" } } },
};

export const openScadCode = LanguageDescription.of({
  name: "OpenSCAD",
  alias: ["openscad", "scad"],
  extensions: ["scad"],
  support: new LanguageSupport(StreamLanguage.define(parser)),
});
