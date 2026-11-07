/*
 * Reads requests written in the .http format, the one JetBrains' HTTP Client, VS Code's REST Client
 * and httpYac, and Visual Studio read (https://github.com/JetBrains/http-request-in-editor-spec).
 * Requests are separated by `###` lines, which can give them a title:
 *
 *   ### Sign in
 *   # @name login
 *   POST {{host}}/login
 *   Content-Type: application/json
 *
 *   { "user": "ada" }
 *
 * Before a request, `#` and `//` lines are comments (`# @name login` names it, for the requests
 * after it to use its response) and `@host = https://…` lines are variables. After the request
 * line, lines that start with `?` or `&` go on with its address, then come its headers, then,
 * after a blank line, its body. Response handlers (`> {% … %}`) and where to save a response
 * (`>> file`) are kept in the text but not part of the body.
 */

export interface HttpRequest {
  /** Where it starts: its `###` line, or the start of the text. */
  from: number;
  /** Its request line, from its start to its end. */
  line: number;
  lineEnd: number;
  /** The end of its last line with anything on it, before the next `###`. */
  to: number;
  /** Where its part of the text ends: the end of the line before the next `###`, or of the text. */
  end: number;
  /** What its `###` line says after the separator. */
  title: string;
  /** Its name, from `# @name login`, for the requests after it to use its response. */
  name: string | null;
  method: string;
  url: string;
  headers: [string, string][];
  body: string | null;
  /** Its body is read from a file (`< ./body.json`), which lines doesn't do. */
  fileBody: boolean;
}

export interface HttpText {
  requests: HttpRequest[];
  /** `@name = value` lines, by name: a later one with the same name wins. */
  variables: Map<string, string>;
  /** Comment lines' text, without their `#` or `//`, for the note's title and tags. */
  comments: string[];
}

export const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "TRACE", "CONNECT"];

const SEPARATOR = /^###/;
const COMMENT = /^\s*(?:#|\/\/)\s?(.*)$/;
const VARIABLE = /^\s*@([A-Za-z_][\w.-]*)\s*=\s*(.*?)\s*$/;
const NAME = /^@name\s*[=\s]\s*(\S+)/;
/** A request line: a method (any word in capitals, for WebDAV's and GraphQL's), an address, maybe a version. */
const REQUEST_LINE = /^([A-Za-z]+)\s+(\S.*?)(?:\s+HTTP\/[\d.]+)?\s*$/;
const ADDRESS_ONLY = /^(\S+?)(?:\s+HTTP\/[\d.]+)?\s*$/;
const CONTINUATION = /^\s+[?&]/;
/** A header: a name of the characters HTTP allows in one, a colon, its value. */
const HEADER = /^([\w!#$%&'*+.^`|~-]+)\s*:\s?(.*)$/;
/** What follows a body and isn't part of it: a response handler, where to save the response, the one before to compare. */
const AFTER_BODY = /^(?:>\s|>>|<>)/;

/** The method and address a request line asks for. */
export function requestLine(text: string): { method: string; url: string } | null {
  const line = text.trim();
  if (!line) return null;
  const full = REQUEST_LINE.exec(line);
  if (full && (METHODS.includes(full[1].toUpperCase()) || /^[A-Z]{3,}$/.test(full[1]))) {
    return { method: full[1].toUpperCase(), url: full[2] };
  }
  const address = ADDRESS_ONLY.exec(line);
  return address ? { method: "GET", url: address[1] } : null;
}

/** Whether a line, before a request, is a comment or a variable rather than the request itself. */
export const isPreamble = (text: string) => !text.trim() || COMMENT.test(text) || VARIABLE.test(text);

export function parseHttp(text: string): HttpText {
  const requests: HttpRequest[] = [];
  const variables = new Map<string, string>();
  const comments: string[] = [];
  const lines = text.split("\n");
  let pos = 0;
  let index = 0;

  const next = () => {
    const line = lines[index++];
    const start = pos;
    pos += line.length + 1;
    return { line, start, end: start + line.length };
  };

  while (index < lines.length) {
    // A part of the text, up to the next separator.
    const from = pos;
    let title = "";
    if (SEPARATOR.test(lines[index])) title = next().line.replace(SEPARATOR, "").trim();
    let name: string | null = null;
    let request: HttpRequest | null = null;
    let section: "start" | "headers" | "body" | "after" = "start";
    const body: string[] = [];
    let handler = false;

    while (index < lines.length && !SEPARATOR.test(lines[index])) {
      const { line, start, end } = next();
      if (section === "start") {
        const comment = COMMENT.exec(line);
        const variable = VARIABLE.exec(line);
        if (comment) {
          const directive = NAME.exec(comment[1].trim());
          if (directive) name = directive[1];
          else if (comment[1].trim() && !comment[1].trim().startsWith("@")) comments.push(comment[1].trim());
        } else if (variable) {
          variables.set(variable[1], variable[2]);
        } else if (line.trim()) {
          const asked = requestLine(line);
          if (!asked) continue;
          request = { from, line: start, lineEnd: end, to: end, end: text.length, title, name, ...asked, headers: [], body: null, fileBody: false };
          section = "headers";
        }
        continue;
      }
      if (!request) continue;
      if (line.trim()) request.to = end;
      if (section === "headers") {
        if (!line.trim()) section = "body";
        else if (CONTINUATION.test(line) && !request.headers.length) request.url += line.trim();
        else if (COMMENT.test(line)) continue;
        else {
          const header = HEADER.exec(line);
          if (header) request.headers.push([header[1], header[2].trim()]);
          else {
            // Not a header: the body, without the blank line before it.
            section = "body";
            body.push(line);
          }
        }
        continue;
      }
      if (handler) {
        if (/%}\s*$/.test(line)) handler = false;
        continue;
      }
      if (AFTER_BODY.test(line.trimStart())) {
        section = "after";
        handler = /^>\s*\{%/.test(line.trimStart()) && !/%}\s*$/.test(line);
        continue;
      }
      if (section === "body") body.push(line);
    }

    if (request) {
      request.end = pos - 1;
      while (body.length && !body.at(-1)!.trim()) body.pop();
      while (body.length && !body[0].trim()) body.shift();
      if (body.length) {
        request.body = body.join("\n");
        request.fileBody = body.length === 1 && /^<\s+\S/.test(body[0]);
      }
      requests.push(request);
    }
  }
  return { requests, variables, comments };
}

/** The request whose part of the text `pos` is in, if it has one. */
export const requestAt = (requests: readonly HttpRequest[], pos: number) =>
  requests.find((request) => request.from <= pos && pos <= request.end) ?? null;
