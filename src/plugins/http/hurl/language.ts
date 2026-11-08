import { LanguageDescription, LanguageSupport, StreamLanguage, type StreamParser, type StringStream } from "@codemirror/language";
import { bodyToken, textOrReference } from "../language";

/*
 * Highlighting for Hurl (hurl/parse.ts reads it): comments, the method, `HTTP 200`, [Sections],
 * names before a colon, queries and filters in captures and asserts, predicates, strings, regular
 * expressions, `{{templates}}`, and JSON bodies. The same in .hurl notes and ```hurl blocks.
 */

interface State {
  section: string | null;
  /** In a ``` body. */
  fenced: boolean;
  /** On a line after its first word: a header's or a key's value. */
  value: boolean;
}

const QUERIES = /^(?:status|version|url|header|cookie|body|bytes|rawbytes|xpath|jsonpath|regex|variable|duration|sha256|md5|certificate|ip|redirects)\b/;
const FILTERS = /^(?:base64Decode|base64Encode|base64UrlSafeDecode|base64UrlSafeEncode|charsetDecode|decode|count|dateFormat|format|daysAfterNow|daysBeforeNow|first|last|htmlEscape|htmlUnescape|jsonpath|location|nth|regex|replaceRegex|replace|split|toDate|toFloat|toInt|toHex|toString|urlDecode|urlEncode|urlQueryParam|utf8Decode|utf8Encode|xpath|redact)\b/;
const PREDICATES = /^(?:not|startsWith|endsWith|contains|includes|matches|exists|isBoolean|isCollection|isDate|isEmpty|isFloat|isInteger|isIpv4|isIpv6|isIsoDate|isList|isNumber|isObject|isString|isUuid)\b/;

/** A capture's or assert's next word or value. */
function expression(stream: StringStream) {
  if (stream.eatSpace()) return null;
  if (stream.match(/^\{\{[^{}\n]*\}\}/)) return "macroName";
  if (stream.match(/^"(?:[^"\\]|\\.)*"?/) || stream.match(/^`[^`]*`?/)) return "string";
  if (stream.match(/^\/(?:[^/\\]|\\.)+\/?/)) return "regexp";
  if (stream.match(/^-?\d+(?:\.\d+)?\b/)) return "number";
  if (stream.match(/^(?:true|false|null)\b/)) return "atom";
  if (stream.match(/^(?:hex|base64|file),[^;\s]*;/)) return "string";
  if (stream.match(QUERIES) || stream.match(FILTERS)) return "variableName.function";
  if (stream.match(PREDICATES)) return "operatorKeyword";
  if (stream.match(/^(?:==|!=|>=|<=|>|<)/)) return "operator";
  if (stream.match(/^#.*/)) return "comment";
  stream.match(/^\S+/);
  return null;
}

const parser: StreamParser<State> = {
  name: "hurl",
  startState: () => ({ section: null, fenced: false, value: false }),
  copyState: (state) => ({ ...state }),
  token(stream, state) {
    if (stream.sol()) {
      state.value = false;
      if (state.fenced) {
        if (stream.match(/^\s*```\s*$/)) state.fenced = false;
        else stream.skipToEnd();
        return "string";
      }
      if (stream.match(/^\s*#.*/)) return "comment";
      if (stream.match(/^\s*```/)) {
        state.fenced = true;
        stream.skipToEnd();
        return "string";
      }
      if (stream.match(/^[A-Z]+(?=\s+\S)/)) {
        state.section = null;
        state.value = true;
        return "keyword";
      }
      if (stream.match(/^HTTP(?:\/[\d.]+)?(?=\s)/)) {
        state.section = null;
        state.value = true;
        return "keyword";
      }
      if (stream.match(/^\[[A-Za-z]+\]\s*$/)) {
        state.section = stream.current().trim().slice(1, -1);
        return "typeName";
      }
      if (state.section === "Asserts") return expression(stream);
      if (stream.match(/^(?:[\w.\-[\]@$]|\\.)+(?=\s*:)/)) {
        state.value = true;
        return "propertyName";
      }
      // A body: JSON's parts stand out.
      return bodyToken(stream);
    }
    if (state.section === "Asserts" || (state.section === "Captures" && state.value && !stream.match(/^\s*:\s*/, false))) return expression(stream);
    if (stream.match(/^\s*:\s*/)) return "operator";
    if (stream.match(/^\s+#.*/)) return "comment";
    if (state.value) return textOrReference(stream, state.section === "Options" ? "atom" : null);
    return bodyToken(stream);
  },
  languageData: { commentTokens: { line: "#" } },
};

export const hurlLanguage = StreamLanguage.define(parser);

/** For ```hurl code blocks, in the editor and on paper. */
export const hurlCode = LanguageDescription.of({
  name: "Hurl",
  alias: ["hurl"],
  extensions: ["hurl"],
  support: new LanguageSupport(hurlLanguage),
});
