import type { Asked } from "../curl";
import type { Assert, Capture, Expect, Filter, Query, ReadText, Request, Value } from "../request";

/*
 * Reads Hurl files (https://hurl.dev/docs/hurl-file.html): entries one after another, each a
 * request (method and address, headers, sections such as [Query], and a body) and, optionally,
 * what its response should be (`HTTP 200`, headers, [Captures], [Asserts], a body). Comments start
 * with `#`. The comment just above a request is its title, for the outline.
 */

const REQUEST_LINE = /^([A-Z]+)\s+(\S.*)$/;
const RESPONSE_LINE = /^HTTP(?:\/([\d.]+))?\s+(\d{3}|\*)$/;
const SECTION = /^\[([A-Za-z]+)\]$/;
const KEY_VALUE = /^((?:[\w.\-[\]@$]|\\.)+)\s*:\s?(.*)$/;
const COMMENT = /^#\s?(.*)$/;
/** A comment of nothing but tags, `# #work #api`: a note made under a tag has one, and it isn't a title. */
const TAGS = /^(?:#[\p{L}\p{N}_/-]+\s*)+$/u;

/** Section names, by alias. */
const SECTIONS: Record<string, string> = {
  QueryStringParams: "query",
  Query: "query",
  FormParams: "form",
  Form: "form",
  MultipartFormData: "multipart",
  Multipart: "multipart",
  Cookies: "cookies",
  BasicAuth: "basicAuth",
  Options: "options",
  Captures: "captures",
  Asserts: "asserts",
};

/** A line without its comment, which a ` #` starts (`\#` is a `#`). */
function uncommented(line: string) {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\") i++;
    else if (c === '"') quoted = !quoted;
    else if (c === "#" && !quoted && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).trimEnd();
  }
  return line.trimEnd();
}

const unescape = (text: string) => text.replace(/\\(.)/g, (_, c: string) => ({ n: "\n", t: "\t", r: "\r" } as Record<string, string>)[c] ?? c);

/* Captures and asserts: `jsonpath "$.id" toInt == 3`. */

const QUERIES = new Set(["status", "version", "url", "header", "cookie", "body", "bytes", "rawbytes", "xpath", "jsonpath", "regex", "variable", "duration", "sha256", "md5", "certificate", "ip", "redirects"]);
const WITH_ARGUMENT = new Set(["header", "cookie", "xpath", "jsonpath", "regex", "variable", "certificate"]);
/** Filters, with how many arguments each takes. */
const FILTERS: Record<string, number> = {
  base64Decode: 0, base64Encode: 0, base64UrlSafeDecode: 0, base64UrlSafeEncode: 0, charsetDecode: 1, decode: 1, count: 0,
  dateFormat: 1, format: 1, daysAfterNow: 0, daysBeforeNow: 0, first: 0, last: 0, htmlEscape: 0, htmlUnescape: 0,
  jsonpath: 1, location: 0, nth: 1, regex: 1, replace: 2, replaceRegex: 2, split: 1, toDate: 1, toFloat: 0, toInt: 0,
  toHex: 0, toString: 0, urlDecode: 0, urlEncode: 0, urlQueryParam: 1, utf8Decode: 0, utf8Encode: 0, xpath: 1,
};
const WITH_VALUE = new Set(["==", "!=", ">", ">=", "<", "<=", "startsWith", "endsWith", "contains", "includes", "matches"]);
const WITHOUT_VALUE = new Set(["exists", "isBoolean", "isCollection", "isDate", "isEmpty", "isFloat", "isInteger", "isIpv4", "isIpv6", "isIsoDate", "isList", "isNumber", "isObject", "isString", "isUuid"]);

type Token = { kind: "word"; text: string } | { kind: "value"; value: Value };

/** A capture's or assert's words and values. */
function tokens(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const until = (end: string) => {
    let value = "";
    for (i++; i < text.length && text[i] !== end; i++) {
      if (text[i] === "\\" && end !== "/") value += unescape(text.slice(i, (i += 1) + 1));
      else if (text[i] === "\\" && text[i + 1] === "/") value += text[++i];
      else value += text[i];
    }
    if (text[i] !== end) throw new Error(`no closing ${end}`);
    i++;
    return value;
  };
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) i++;
    else if (c === '"') out.push({ kind: "value", value: { kind: "string", value: until('"') } });
    else if (c === "`") out.push({ kind: "value", value: { kind: "string", value: until("`") } });
    else if (c === "/" && out.length && text[i + 1] !== " ") out.push({ kind: "value", value: { kind: "regex", value: until("/") } });
    else if (text.startsWith("{{", i)) {
      const end = text.indexOf("}}", i);
      if (end < 0) throw new Error("no closing }}");
      out.push({ kind: "value", value: { kind: "template", value: text.slice(i + 2, end).trim() } });
      i = end + 2;
    } else {
      const word = /^[^\s"`]+/.exec(text.slice(i))![0];
      i += word.length;
      const bytes = /^(hex|base64),([^;]*);$/.exec(word);
      if (bytes) {
        const value = bytes[1] === "hex" ? Uint8Array.from(bytes[2].match(/../g) ?? [], (pair) => parseInt(pair, 16)) : Uint8Array.from(atob(bytes[2]), (c) => c.charCodeAt(0));
        out.push({ kind: "value", value: { kind: "bytes", value } });
      } else if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(word)) out.push({ kind: "value", value: { kind: "number", value: Number(word) } });
      else if (word === "true" || word === "false") out.push({ kind: "value", value: { kind: "boolean", value: word === "true" } });
      else if (word === "null") out.push({ kind: "value", value: { kind: "null" } });
      else out.push({ kind: "word", text: word });
    }
  }
  return out;
}

/** Reads a query and its filters from `list`, from `at`; where it stopped. */
function query(list: Token[]): { query: Query; rest: Token[] } {
  const [first, ...rest] = list;
  if (first?.kind !== "word" || !QUERIES.has(first.text)) throw new Error(`not a query: ${first?.kind === "word" ? first.text : "a value"}`);
  let argument: Value | null = null;
  if (WITH_ARGUMENT.has(first.text)) {
    const next = rest.shift();
    if (next?.kind !== "value") throw new Error(`${first.text} needs its argument, in quotes`);
    argument = next.value;
  }
  const filters: Filter[] = [];
  while (rest[0]?.kind === "word" && rest[0].text in FILTERS) {
    const name = (rest.shift() as { text: string }).text;
    const args: Value[] = [];
    for (let n = 0; n < FILTERS[name]; n++) {
      const next = rest.shift();
      if (next?.kind !== "value") throw new Error(`${name} needs ${FILTERS[name]} argument${FILTERS[name] > 1 ? "s" : ""}`);
      args.push(next.value);
    }
    filters.push({ kind: name, args });
  }
  return { query: { kind: first.text, argument, filters }, rest };
}

const NONE: Query = { kind: "none", argument: null, filters: [] };

function capture(line: string): Capture {
  const match = KEY_VALUE.exec(line);
  if (!match) return { name: "", query: NONE, text: line, problem: "name: query" };
  try {
    const { query: read, rest } = query(tokens(match[2]));
    // `redact` hides a captured value in Hurl's logs; lines writes none.
    const left = rest.filter((token) => !(token.kind === "word" && token.text === "redact"));
    if (left.length) throw new Error("more after the query than lines reads");
    return { name: unescape(match[1]), query: read, text: line };
  } catch (error) {
    return { name: unescape(match[1]), query: NONE, text: line, problem: (error as Error).message };
  }
}

function assert(line: string): Assert {
  try {
    const { query: read, rest } = query(tokens(line));
    let not = false;
    if (rest[0]?.kind === "word" && rest[0].text === "not") {
      not = true;
      rest.shift();
    }
    const predicate = rest.shift();
    if (predicate?.kind !== "word" || !(WITH_VALUE.has(predicate.text) || WITHOUT_VALUE.has(predicate.text))) throw new Error("expected a predicate: ==, contains, exists…");
    let value: Value | null = null;
    if (WITH_VALUE.has(predicate.text)) {
      const next = rest.shift();
      if (next?.kind !== "value") throw new Error(`${predicate.text} needs a value`);
      value = next.value;
    }
    if (rest.length) throw new Error("more after the predicate than lines reads");
    return { query: read, not, predicate: predicate.text, value, text: line };
  } catch (error) {
    return { query: NONE, not: false, predicate: "", value: null, text: line, problem: (error as Error).message };
  }
}

/* Bodies. */

/** Where a JSON body that starts on line `from` ends: where its brackets close. */
function jsonEnd(lines: string[], from: number) {
  let depth = 0;
  let quoted = false;
  for (let n = from; n < lines.length; n++) {
    const line = lines[n];
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quoted) {
        if (c === "\\") i++;
        else if (c === '"') quoted = false;
      } else if (c === '"') quoted = true;
      else if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") depth--;
    }
    if (depth <= 0) return n;
  }
  return lines.length - 1;
}

interface Body {
  text: string | null;
  /** What it is, when it says: JSON, XML. */
  type?: string;
  /** Lines it took. */
  last: number;
  file?: boolean;
  unsupported?: string;
}

/** A body starting on line `from`: JSON, XML, ```multiline```, `oneline`, or a kind lines doesn't send. */
function body(lines: string[], from: number, starts: (line: string) => boolean): Body {
  const first = lines[from].trim();
  if (first.startsWith("```")) {
    const kind = first.slice(3).trim();
    let close = from + 1;
    while (close < lines.length && lines[close].trim() !== "```") close++;
    const content = lines.slice(from + 1, close).join("\n");
    // Not closed (yet): it runs to the end of the note.
    const last = Math.min(close, lines.length - 1);
    if (kind === "graphql") return { text: null, last, unsupported: "GraphQL" };
    if (kind === "base64" || kind === "hex") return { text: null, last, unsupported: kind };
    const type = kind === "json" ? "application/json" : kind === "xml" ? "application/xml" : undefined;
    return { text: content + (close > from + 1 ? "\n" : ""), last, type };
  }
  if (first.startsWith("`")) return { text: unescape(first.slice(1, first.lastIndexOf("`"))), last: from };
  if (first.startsWith("{") || first.startsWith("[")) {
    const last = jsonEnd(lines, from);
    return { text: lines.slice(from, last + 1).join("\n"), last, type: "application/json" };
  }
  if (first.startsWith("file,")) return { text: null, last: from, file: true };
  if (/^(base64|hex),/.test(first)) return { text: null, last: from, unsupported: first.slice(0, first.indexOf(",")) };
  // XML, or anything else: to the next entry or response. The comments (and blank lines) just
  // above that are its own: an entry's title, say.
  let last = from;
  while (last + 1 < lines.length && !starts(lines[last + 1])) last++;
  while (last > from && (!lines[last].trim() || COMMENT.test(lines[last].trim()))) last--;
  return { text: lines.slice(from, last + 1).join("\n"), last, type: first.startsWith("<") ? "application/xml" : undefined };
}

/* Entries. */

const isRequestLine = (line: string) => REQUEST_LINE.test(line) && !RESPONSE_LINE.test(uncommented(line));

export function parseHurl(text: string): ReadText {
  const lines = text.split("\n");
  const starts: number[] = [];
  for (let i = 0, pos = 0; i < lines.length; pos += lines[i].length + 1, i++) starts.push(pos);
  const endOf = (n: number) => starts[n] + lines[n].length;

  const requests: Request[] = [];
  const comments: string[] = [];
  let entry: Request | null = null;
  let phase: "request" | "response" = "request";
  let section: string | null = null;
  let expect: Expect | null = null;
  /** The comment just above, for the next request's title. */
  let title = "";

  /** Ends the entry being read at `end`, the end of its last line. */
  const finish = (end: number) => {
    if (!entry) return;
    entry.end = end;
    if (expect) entry.expect = expect;
    requests.push(entry);
    entry = null;
    expect = null;
  };

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trim();
    const comment = COMMENT.exec(line);
    if (!line || comment) {
      if (comment) {
        const said = comment[1].trim();
        if (said) comments.push(said);
        if (!TAGS.test(said)) title = said;
      }
      continue;
    }
    const content = uncommented(line);
    const requestLine = isRequestLine(content) ? REQUEST_LINE.exec(content) : null;
    if (requestLine) {
      // The entry starts with the comments and blank lines just above its request line.
      let first = n;
      while (first > 0 && (!lines[first - 1].trim() || COMMENT.test(lines[first - 1].trim()))) first--;
      finish(first > 0 ? endOf(first - 1) : 0);
      entry = {
        from: starts[first],
        line: starts[n],
        lineEnd: endOf(n),
        to: endOf(n),
        end: text.length,
        title,
        name: null,
        method: requestLine[1],
        url: requestLine[2].trim(),
        headers: [],
        body: null,
        fileBody: false,
        follow: false,
      };
      phase = "request";
      section = null;
      title = "";
      continue;
    }
    title = "";
    if (!entry) continue;
    entry.to = endOf(n);
    const response = RESPONSE_LINE.exec(content);
    if (response) {
      phase = "response";
      section = null;
      expect = { status: response[2] === "*" ? null : Number(response[2]), version: response[1] ?? null, headers: [], captures: [], asserts: [], body: null };
      continue;
    }
    const sectionLine = SECTION.exec(content);
    if (sectionLine) {
      section = SECTIONS[sectionLine[1]] ?? `unknown:${sectionLine[1]}`;
      if (section === "multipart") entry.unsupported = "[Multipart]";
      continue;
    }
    const pair = KEY_VALUE.exec(content);
    if (phase === "request") {
      if (pair && section !== "body") {
        const key = unescape(pair[1]);
        const value = unescape(pair[2].trim());
        if (section === null) entry.headers.push([key, value]);
        else if (section === "query") (entry.query ??= []).push([key, value]);
        else if (section === "form") (entry.form ??= []).push([key, value]);
        else if (section === "cookies") (entry.cookies ??= []).push([key, value]);
        else if (section === "basicAuth") entry.user = `${key.trim()}:${value}`;
        else if (section === "options") {
          if ((key === "location" || key === "location-trusted") && value === "true") entry.follow = true;
          else if (key === "variable") {
            const at = value.indexOf("=");
            if (at > 0) (entry.variables ??= []).push([value.slice(0, at).trim(), value.slice(at + 1).trim()]);
          }
        }
        continue;
      }
      // Anything else is its body, which comes last.
      const read = body(lines, n, (next) => isRequestLine(uncommented(next.trim())) || RESPONSE_LINE.test(uncommented(next.trim())));
      entry.body = read.text;
      entry.bodyType = read.type;
      entry.fileBody = !!read.file;
      if (read.unsupported) entry.unsupported = read.unsupported;
      n = read.last;
      entry.to = endOf(n);
      section = "body";
      continue;
    }
    // The response.
    if (!expect) continue;
    if (section === "captures") expect.captures.push(capture(content));
    else if (section === "asserts") expect.asserts.push(assert(content));
    else if (section === null && pair) expect.headers.push([unescape(pair[1]), unescape(pair[2].trim())]);
    else {
      const read = body(lines, n, (next) => isRequestLine(uncommented(next.trim())));
      expect.body = read.text;
      n = read.last;
      entry.to = endOf(n);
    }
  }
  finish(text.length);
  return { requests, variables: new Map(), comments };
}

/** A request as a Hurl entry: what lines doesn't send of it as comments, its line, headers, [BasicAuth], then its body. */
export function writeHurl({ method, url, headers, body, user }: Asked, notes: string[] = []): string {
  const lines = [...notes.map((note) => `# ${note}`), `${method} ${url}`, ...headers.map(([name, value]) => `${name}: ${value.replace(/#/g, "\\#")}`)];
  if (user) {
    const at = user.indexOf(":");
    lines.push("[BasicAuth]", at < 0 ? `${user}:` : `${user.slice(0, at)}: ${user.slice(at + 1)}`);
  }
  if (body !== null) {
    let json = false;
    try {
      JSON.parse(body);
      json = /^\s*[[{]/.test(body);
    } catch {
      // Not JSON: a ``` body.
    }
    lines.push(json ? body : `\`\`\`\n${body}\n\`\`\``);
  }
  return lines.join("\n");
}
