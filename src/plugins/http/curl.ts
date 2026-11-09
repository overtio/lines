import { indentJson } from "./json";

/*
 * curl commands, to and from requests: "Copy as curl" writes one to run in a terminal, and a curl
 * command pasted into a request (as browsers' "Copy as cURL" and API docs give them) is read as the
 * request it makes, which each format writes its own way.
 */

export interface Asked {
  method: string;
  url: string;
  headers: [string, string][];
  body: string | null;
  /** `user:password`, sent as Basic authorization (Hurl's [BasicAuth], curl's -u). */
  user?: string;
}

/**
 * Marks a name in a request as a shell variable, for a secret (or anything else not filled in):
 * `{{github}}` copies as `${GITHUB}`, so the value comes from the shell rather than the clipboard.
 */
export const shellVariable = (name: string) => `\uE000${name}\uE000`;
const SHELL_VARIABLE = /\uE000([^\uE000]*)\uE000/g;
const variableName = (name: string) => name.toUpperCase().replace(/[^A-Z0-9_]/g, "_").replace(/^(?=\d)/, "_");

/** Quoted for a POSIX shell: in single quotes, or in double quotes around shell variables. */
function quote(text: string) {
  if (text.includes("\uE000")) return `"${text.replace(/[\\"$`]/g, "\\$&").replace(SHELL_VARIABLE, (_, name: string) => `\${${variableName(name)}}`)}"`;
  return /^[\w@%+=:,./-]+$/.test(text) ? text : `'${text.replaceAll("'", `'\\''`)}'`;
}

/** The command, an option to a line as API docs write them. */
export function toCurl({ method, url, headers, body, user }: Asked): string {
  const verb = method === "HEAD" ? "--head " : method !== "GET" || body !== null ? `-X ${method} ` : "";
  const lines = [`curl ${verb}${quote(url)}`, ...headers.map(([name, value]) => `-H ${quote(`${name}: ${value}`)}`)];
  if (user) lines.push(`-u ${quote(user)}`);
  if (body !== null) lines.push(`--data-raw ${quote(body)}`);
  return lines.join(" \\\n  ");
}

/** What bash reads these escapes in `$'…'` as. */
const ESCAPES: Record<string, string> = { a: "\x07", b: "\b", e: "\x1b", E: "\x1b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "\\": "\\", "'": "'", '"': '"', "?": "?" };
const utf8 = new TextDecoder("utf-8", { fatal: true });

/**
 * The text of an ANSI-C quoted string, `$'…'`, as bash reads it: Chrome's "Copy as cURL" writes
 * quotes, `!` and control characters this way (`\u0021`), Firefox's anything outside ASCII (`\xe9`).
 */
function ansiC(text: string) {
  return text.replace(/((?:\\(?:[0-7]{1,3}|x[\da-fA-F]{1,2}))+)|\\u([\da-fA-F]{1,4})|\\U([\da-fA-F]{1,8})|\\(.)/gs, (escape, bytes?: string, short?: string, long?: string, letter?: string) => {
    if (bytes) {
      const values = Uint8Array.from(bytes.split("\\").slice(1), (each) => (each[0] === "x" ? parseInt(each.slice(1), 16) : parseInt(each, 8)));
      // Bytes are UTF-8, as bash writes them for a terminal; but Firefox writes `é` as `\xe9`, its code.
      try {
        return utf8.decode(values);
      } catch {
        return String.fromCharCode(...values);
      }
    }
    const code = parseInt(short ?? long ?? "", 16);
    if (!Number.isNaN(code)) return code <= 0x10ffff ? String.fromCodePoint(code) : escape;
    // An escape bash doesn't know stays as written.
    return ESCAPES[letter!] ?? escape;
  });
}

/** A command's words, as a shell splits them: quotes, `$'…'`, backslashes and continued lines. */
export function words(command: string): string[] {
  const found: string[] = [];
  let word: string | null = null;
  const add = (text: string) => (word = (word ?? "") + text);
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (c === "\\" && (command[i + 1] === "\n" || (command[i + 1] === "\r" && command[i + 2] === "\n"))) {
      i += command[i + 1] === "\r" ? 2 : 1;
    } else if (/\s/.test(c)) {
      if (word !== null) found.push(word);
      word = null;
    } else if (c === "'") {
      const end = command.indexOf("'", i + 1);
      add(command.slice(i + 1, end < 0 ? undefined : end));
      i = end < 0 ? command.length : end;
    } else if (c === "$" && command[i + 1] === "'") {
      let end = i + 2;
      while (end < command.length && command[end] !== "'") end += command[end] === "\\" ? 2 : 1;
      add(ansiC(command.slice(i + 2, end)));
      i = end;
    } else if (c === '"') {
      let text = "";
      for (i++; i < command.length && command[i] !== '"'; i++) {
        if (command[i] === "\\" && /["\\$`\n]/.test(command[i + 1])) i++;
        text += command[i];
      }
      add(text);
    } else if (c === "\\") {
      add(command[++i] ?? "");
    } else {
      add(c);
    }
  }
  if (word !== null) found.push(word);
  return found;
}

/** Options that take a value, and lines doesn't use. */
const SKIPPED_WITH_VALUE = new Set([
  "-o", "--output", "-w", "--write-out", "-m", "--max-time", "--connect-timeout", "--retry", "-x", "--proxy",
  "-E", "--cert", "--cacert", "--key", "-K", "--config", "-T", "--upload-file", "-c", "--cookie-jar", "-r", "--range",
  "--max-redirs", "--resolve", "--interface", "-U", "--proxy-user",
]);

/** Short options that take a value, which can be in the same word: `-XPUT`. */
const SHORT_WITH_VALUE = new Set(["-X", "-H", "-d", "-u", "-A", "-e", "-b", "-F", ...[...SKIPPED_WITH_VALUE].filter((option) => option.length === 2)]);

/** Encoded as curl encodes `--data-urlencode`'s content: everything but letters, digits and `-._~`. */
const urlEncode = (text: string) => encodeURIComponent(text).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const header = (headers: [string, string][], name: string) => headers.find(([each]) => each.toLowerCase() === name.toLowerCase());

/** The request a curl command makes, and what of it lines doesn't send (as comments to write); null if `command` isn't one. */
export function readCurl(command: string): { asked: Asked; notes: string[] } | null {
  const args = words(command.trim());
  if (args[0] !== "curl") return null;
  let method: string | null = null;
  // `use` sets it, which TypeScript doesn't see: else it would take it to be null still after the loop.
  let url = null as string | null;
  let user: string | undefined;
  let get = false;
  const headers: [string, string][] = [];
  const data: string[] = [];
  const notes: string[] = [];
  /** Reads an option, which takes its value from `value` if it has one. */
  const use = (option: string, value: () => string) => {
    switch (option) {
      case "-X":
      case "--request":
        method = value().toUpperCase();
        break;
      case "-H":
      case "--header": {
        const [name, ...rest] = value().split(":");
        if (rest.length) headers.push([name.trim(), rest.join(":").trim()]);
        break;
      }
      case "-d":
      case "--data":
      case "--data-raw":
      case "--data-binary":
      case "--data-ascii":
        data.push(value());
        break;
      case "--data-urlencode": {
        // As curl reads it: `name=content` sends the content encoded, `=content` and `content` just
        // it; `name@file` and `@file` read a file, which lines doesn't.
        const text = value();
        const at = text.includes("=") ? text.indexOf("=") : text.indexOf("@");
        if (text[at] === "@") notes.push(`Not sent: lines doesn't read data from files yet (--data-urlencode ${text})`);
        else data.push(at > 0 ? `${text.slice(0, at)}=${urlEncode(text.slice(at + 1))}` : urlEncode(text.slice(at + 1)));
        break;
      }
      case "--json":
        data.push(value());
        if (!header(headers, "Content-Type")) headers.push(["Content-Type", "application/json"]);
        if (!header(headers, "Accept")) headers.push(["Accept", "application/json"]);
        break;
      case "-u":
      case "--user":
        user = value();
        break;
      case "-A":
      case "--user-agent":
        headers.push(["User-Agent", value()]);
        break;
      case "-e":
      case "--referer":
        headers.push(["Referer", value()]);
        break;
      case "-b":
      case "--cookie": {
        const cookie = value();
        if (cookie.includes("=")) headers.push(["Cookie", cookie]);
        break;
      }
      case "-I":
      case "--head":
        method = "HEAD";
        break;
      case "-G":
      case "--get":
        get = true;
        break;
      case "--url":
        url = value();
        break;
      case "-F":
      case "--form":
        notes.push(`Not sent: lines doesn't send forms with files yet (-F ${value()})`);
        break;
      default:
        if (SKIPPED_WITH_VALUE.has(option)) value();
        else if (!option.startsWith("-") && url === null) url = option;
    }
  };
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const next = () => args[++i] ?? "";
    const long = /^(--[\w.-]+)=(.*)$/.exec(arg);
    if (long) use(long[1], () => long[2]);
    else if (/^-[^-]./.test(arg)) {
      // Short options run together (`-sL`), the last perhaps with its value in the same word (`-XPUT`, `-H'Accept: …'`).
      for (let at = 1; at < arg.length; at++) {
        const option = `-${arg[at]}`;
        if (!SHORT_WITH_VALUE.has(option)) use(option, next);
        else {
          const rest = arg.slice(at + 1);
          use(option, () => rest || next());
          break;
        }
      }
    } else use(arg, next);
  }
  if (!url) return null;
  if (!/^[a-z][\w+.-]*:\/\//i.test(url) && !url.startsWith("{{")) url = `https://${url}`;
  let body: string | null = data.length ? data.join("&") : null;
  if (get && body !== null) {
    url += (url.includes("?") ? "&" : "?") + body;
    body = null;
  }
  const verb = method ?? (body !== null ? "POST" : "GET");
  if (body !== null && !header(headers, "Content-Type")) headers.push(["Content-Type", "application/x-www-form-urlencoded"]);
  if (body !== null && /json/i.test(header(headers, "Content-Type")?.[1] ?? "")) {
    try {
      body = indentJson(body);
    } catch {
      // Not JSON after all: as it was written.
    }
  }
  return { asked: { method: verb, url, headers, body, user }, notes };
}
