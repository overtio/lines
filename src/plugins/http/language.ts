import { LanguageDescription, LanguageSupport, StreamLanguage, type StreamParser, type StringStream } from "@codemirror/language";
import { METHODS } from "./parse";

/*
 * Highlighting for the .http format (parse.ts reads it): `###` titles, comments, variables, the
 * method, headers' names, `{{references}}`, and JSON in bodies. The same in .http notes and in
 * ```http code blocks in Markdown notes.
 */

interface State {
  section: "start" | "headers" | "body" | "handler";
  /** After a `###` on its line: the rest is its title. */
  title: boolean;
  /** After an `@name =`, or in a header's value: the rest of the line is a value. */
  value: boolean;
}

const REFERENCE = /^\{\{[^{}\n]*\}\}/;

/** Text up to the next `{{`, as the token `style`. */
export function textOrReference(stream: StringStream, style: string | null) {
  if (stream.match(REFERENCE)) return "macroName";
  stream.next();
  while (!stream.eol() && !stream.match("{{", false)) stream.next();
  return style;
}

/** A body's text: JSON's keys, strings, numbers and constants stand out, whatever it is. */
export function bodyToken(stream: StringStream) {
  if (stream.match(REFERENCE)) return "macroName";
  if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return stream.match(/^\s*:/, false) ? "propertyName" : "string";
  if (stream.match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/)) return "number";
  if (stream.match(/^(?:true|false|null)\b/)) return "atom";
  stream.next();
  while (!stream.eol() && !/["\d{tfn-]/.test(stream.peek()!)) stream.next();
  return null;
}

const parser: StreamParser<State> = {
  name: "http",
  startState: () => ({ section: "start", title: false, value: false }),
  copyState: (state) => ({ ...state }),
  blankLine(state) {
    if (state.section === "headers") state.section = "body";
  },
  token(stream, state) {
    if (stream.sol()) {
      state.title = false;
      state.value = false;
      if (stream.match("###")) {
        state.section = "start";
        state.title = true;
        return "contentSeparator";
      }
      if (state.section === "handler") {
        if (stream.match(/^.*%}\s*$/)) state.section = "body";
        else stream.skipToEnd();
        return "comment";
      }
      if (state.section === "body" && stream.match(/^>\s*\{%/)) {
        if (!stream.match(/^.*%}\s*$/)) state.section = "handler";
        stream.skipToEnd();
        return "comment";
      }
      if (state.section === "body" && stream.match(/^(?:>|<>)/)) {
        stream.skipToEnd();
        return "comment";
      }
      if (state.section !== "body" && stream.match(/^\s*(?:#|\/\/)/)) {
        stream.skipToEnd();
        return "comment";
      }
      if (state.section === "start") {
        if (stream.match(/^\s*@[\w.-]+/)) {
          state.value = true;
          return "macroName";
        }
        stream.eatSpace();
        if (stream.eol()) return null;
        state.section = "headers";
        const method = stream.match(/^[A-Za-z]+(?=\s)/, false) as RegExpMatchArray | null;
        if (method && (METHODS.includes(method[0].toUpperCase()) || /^[A-Z]{3,}$/.test(method[0]))) {
          stream.match(method[0]);
          return "keyword";
        }
        return textOrReference(stream, null);
      }
      if (state.section === "headers" && !stream.match(/^\s+[?&]/, false)) {
        if (stream.match(/^[\w!#$%&'*+.^`|~-]+(?=\s*:)/)) {
          state.value = true;
          return "propertyName";
        }
        state.section = "body";
      }
    }
    if (state.title) {
      stream.skipToEnd();
      return "heading";
    }
    if (state.section === "body") return bodyToken(stream);
    if (state.value) {
      if (stream.match(/^\s*[=:]\s*/)) return "operator";
      return textOrReference(stream, state.section === "start" ? "string" : null);
    }
    // The request line, after its method.
    if (stream.match(/^\s+HTTP\/[\d.]+\s*$/)) return "comment";
    return textOrReference(stream, null);
  },
  languageData: { commentTokens: { line: "#" } },
};

export const httpLanguage = StreamLanguage.define(parser);

/** For ```http and ```rest code blocks, in the editor and on paper. */
export const httpCode = LanguageDescription.of({
  name: "HTTP",
  alias: ["http", "rest"],
  extensions: ["http", "rest"],
  support: new LanguageSupport(httpLanguage),
});
