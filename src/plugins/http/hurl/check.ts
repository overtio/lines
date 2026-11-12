import { equal, jsonPath } from "../jsonpath";
import type { Check, Expect, Filter, Query, Value } from "../request";

/*
 * Checks a response against what a Hurl entry expects of it (https://hurl.dev/docs/asserting-response.html):
 * its status and headers, its captures (which later entries use), its asserts, and its body. A
 * query, then filters, then a predicate: `jsonpath "$.items" count >= 2`. No scripts run.
 */

/** A response, as checks read it. */
export interface Answer {
  status: number;
  url: string;
  headers: [string, string][];
  text: string;
  bytes: Uint8Array;
  type: string;
  /** Milliseconds. */
  time: number;
}

/** A message in the app's language, by key: the checks' reasons. */
export type Say = (key: "missing" | "unsupported" | "notJson" | "invalid" | "status" | "body" | "capture", params?: Record<string, string>) => string;

export interface Context {
  answer: Answer;
  /** A variable's value, as its own type: captured earlier, or written; undefined if there's none. */
  variable(name: string): unknown;
  /** Text with its `{{templates}}` filled in. */
  fill(text: string): string;
  say: Say;
}

/** A query or filter lines can't do from a fetch: the version, the IP, certificates… */
class Unsupported extends Error {}

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** A value, as a check shows what the response had. */
export function shown(value: unknown, say: Say): string {
  if (value === undefined) return say("missing");
  if (value instanceof Uint8Array) return `hex,${hex(value)};`;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return JSON.stringify(value);
  const text = JSON.stringify(value);
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

/* Queries. */

function header(answer: Answer, name: string): string | string[] | undefined {
  const values = answer.headers.filter(([each]) => each.toLowerCase() === name.toLowerCase()).map(([, value]) => value);
  return values.length > 1 ? values : values[0];
}

/** A cookie the response sets, `name`, or one of its attributes, `name[Max-Age]`. */
function cookie(answer: Answer, spec: string): string | boolean | undefined {
  const [, name, attribute] = /^([^[]+)(?:\[([^\]]+)\])?$/.exec(spec) ?? [];
  for (const [key, value] of answer.headers) {
    if (key.toLowerCase() !== "set-cookie") continue;
    for (const cookieText of value.split(/,(?=\s*[^;,=\s]+=)/)) {
      const [pair, ...attributes] = cookieText.split(";").map((part) => part.trim());
      const at = pair.indexOf("=");
      if (pair.slice(0, at) !== name) continue;
      if (!attribute || attribute === "Value") return pair.slice(at + 1);
      for (const each of attributes) {
        const [key2, ...rest] = each.split("=");
        if (key2.toLowerCase() === attribute.toLowerCase()) return rest.length ? rest.join("=") : true;
      }
      return undefined;
    }
  }
  return undefined;
}

/** XPath 1.0 on the body, read as HTML or XML. */
function xpath(text: string, type: string, expression: string): unknown {
  const doc = new DOMParser().parseFromString(text, /html/.test(type) ? "text/html" : "application/xml");
  const result = doc.evaluate(expression, doc, null, XPathResult.ANY_TYPE, null);
  switch (result.resultType) {
    case XPathResult.NUMBER_TYPE:
      return result.numberValue;
    case XPathResult.STRING_TYPE:
      return result.stringValue;
    case XPathResult.BOOLEAN_TYPE:
      return result.booleanValue;
    default: {
      const nodes: string[] = [];
      for (let node = result.iterateNext(); node; node = result.iterateNext()) nodes.push(node.textContent ?? "");
      return nodes;
    }
  }
}

function regexOf(value: Value | undefined, context: Context): RegExp {
  if (!value || (value.kind !== "string" && value.kind !== "regex")) throw new Error("a pattern, in quotes or slashes");
  return new RegExp(value.kind === "string" ? context.fill(value.value) : value.value);
}

const text = (value: Value | null | undefined, context: Context) => {
  if (!value) throw new Error("an argument in quotes");
  if (value.kind === "string") return context.fill(value.value);
  if (value.kind === "template") return String(context.variable(value.value) ?? "");
  if (value.kind === "regex") return value.value;
  return String((value as { value: unknown }).value ?? "null");
};

function json(body: string, context: Context) {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(context.say("notJson"));
  }
}

async function query(spec: Query, context: Context): Promise<unknown> {
  const { answer } = context;
  const argument = () => text(spec.argument, context);
  switch (spec.kind) {
    case "status":
      return answer.status;
    case "url":
      return answer.url;
    case "header":
      return header(answer, argument());
    case "cookie":
      return cookie(answer, argument());
    case "body":
      return answer.text;
    case "bytes":
      return answer.bytes;
    case "jsonpath":
      return jsonPath(json(answer.text, context), argument());
    case "xpath":
      return xpath(answer.text, answer.type, argument());
    case "regex": {
      const match = regexOf(spec.argument ?? undefined, context).exec(answer.text);
      return match?.[1];
    }
    case "variable":
      return context.variable(argument());
    case "duration":
      return Math.round(answer.time);
    case "sha256":
      return new Uint8Array(await crypto.subtle.digest("SHA-256", answer.bytes.slice()));
    default:
      throw new Unsupported(spec.kind);
  }
}

/* Filters. */

const isList = Array.isArray;
const decoder = (label = "utf-8") => new TextDecoder(label);
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const HTML = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" } as Record<string, string>;

/** `%Y-%m-%d` and the like, as Hurl's dateFormat writes dates (in UTC). */
function strftime(date: Date, format: string) {
  const pad = (n: number, size = 2) => String(n).padStart(size, "0");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return format.replace(/%([a-zA-Z+%])/g, (_, code: string) => {
    switch (code) {
      case "Y": return String(date.getUTCFullYear());
      case "y": return pad(date.getUTCFullYear() % 100);
      case "m": return pad(date.getUTCMonth() + 1);
      case "d": return pad(date.getUTCDate());
      case "e": return String(date.getUTCDate()).padStart(2, " ");
      case "H": return pad(date.getUTCHours());
      case "M": return pad(date.getUTCMinutes());
      case "S": return pad(date.getUTCSeconds());
      case "j": return pad(Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86_400_000) + 1, 3);
      case "a": return days[date.getUTCDay()].slice(0, 3);
      case "A": return days[date.getUTCDay()];
      case "b": return months[date.getUTCMonth()].slice(0, 3);
      case "B": return months[date.getUTCMonth()];
      case "F": return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
      case "T": return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
      case "s": return String(Math.floor(date.getTime() / 1000));
      case "Z": return "UTC";
      case "z": return "+0000";
      case "+": return date.toISOString();
      case "%": return "%";
      default: return `%${code}`;
    }
  });
}

/** A date written in `format`: ISO 8601 (`%+`) or whatever the browser reads; others aren't read yet. */
function strptime(value: string, format: string) {
  const date = new Date(format === "%+" || format === "%Y-%m-%dT%H:%M:%S%.fZ" ? value : value.replace(/ /, "T"));
  if (Number.isNaN(date.getTime())) throw new Error(`${JSON.stringify(value)} isn't a date lines reads (${format})`);
  return date;
}

function filter(value: unknown, spec: Filter, context: Context): unknown {
  const arg = (n: number) => text(spec.args[n], context);
  const string = () => {
    if (typeof value !== "string") throw new Error(`${spec.kind} needs a string`);
    return value;
  };
  const bytes = () => {
    if (value instanceof Uint8Array) return value;
    if (typeof value === "string") return new TextEncoder().encode(value);
    throw new Error(`${spec.kind} needs bytes`);
  };
  switch (spec.kind) {
    case "count":
      if (isList(value)) return value.length;
      if (value instanceof Uint8Array) return value.length;
      throw new Error("count needs a list");
    case "nth": {
      if (!isList(value)) throw new Error("nth needs a list");
      const at = Number(arg(0));
      return value[at < 0 ? value.length + at : at];
    }
    case "first":
      return isList(value) ? value[0] : value;
    case "last":
      return isList(value) ? value.at(-1) : value;
    case "regex": {
      const match = regexOf(spec.args[0], context).exec(string());
      return match?.[1];
    }
    case "replace":
      return string().replaceAll(arg(0), () => arg(1));
    case "replaceRegex":
      return string().replace(new RegExp(regexOf(spec.args[0], context).source, "g"), arg(1));
    case "split":
      return string().split(arg(0));
    case "jsonpath":
      return jsonPath(json(string(), context), arg(0));
    case "xpath":
      return xpath(string(), "", arg(0));
    case "toInt": {
      const number = typeof value === "number" ? value : Number(string());
      if (!Number.isFinite(number)) throw new Error(`${JSON.stringify(value)} isn't a number`);
      return Math.trunc(number);
    }
    case "toFloat": {
      const number = typeof value === "number" ? value : Number(string());
      if (!Number.isFinite(number)) throw new Error(`${JSON.stringify(value)} isn't a number`);
      return number;
    }
    case "toString":
      return typeof value === "string" ? value : value instanceof Date ? value.toISOString() : JSON.stringify(value);
    case "urlDecode":
      return decodeURIComponent(string().replace(/\+/g, " "));
    case "urlEncode":
      return encodeURIComponent(string());
    case "urlQueryParam":
      return new URL(string(), "http://lines.invalid").searchParams.get(arg(0)) ?? undefined;
    case "htmlEscape":
      return string().replace(/[&<>"']/g, (c) => HTML[c]);
    case "htmlUnescape": {
      const area = document.createElement("textarea");
      area.innerHTML = string();
      return area.value;
    }
    case "base64Decode":
    case "base64UrlSafeDecode":
      return fromBase64(string());
    case "base64Encode":
      return toBase64(bytes());
    case "base64UrlSafeEncode":
      return toBase64(bytes()).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    case "toHex":
      return hex(bytes());
    case "utf8Decode":
      return decoder().decode(bytes());
    case "utf8Encode":
      return new TextEncoder().encode(string());
    case "decode":
    case "charsetDecode":
      return decoder(arg(0)).decode(bytes());
    case "toDate":
      return strptime(string(), arg(0));
    case "format":
    case "dateFormat":
      if (!(value instanceof Date)) throw new Error(`${spec.kind} needs a date (toDate)`);
      return strftime(value, arg(0));
    case "daysAfterNow":
    case "daysBeforeNow": {
      if (!(value instanceof Date)) throw new Error(`${spec.kind} needs a date (toDate)`);
      const days = Math.floor((value.getTime() - Date.now()) / 86_400_000);
      return spec.kind === "daysAfterNow" ? days : -days;
    }
    case "location": {
      const where = header(context.answer, "Location");
      return typeof where === "string" ? new URL(where, context.answer.url).href : undefined;
    }
    default:
      throw new Unsupported(spec.kind);
  }
}

/* Predicates. */

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const IPV6 = /^(?:[\da-f]{0,4}:){2,7}[\da-f]{0,4}$/i;
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** A value written in an assert, as its type: `{{count}}` as the variable's own. */
function expected(value: Value, context: Context): unknown {
  switch (value.kind) {
    case "string":
      return context.fill(value.value);
    case "number":
    case "boolean":
      return value.value;
    case "null":
      return null;
    case "regex":
      return new RegExp(value.value);
    case "template":
      return context.variable(value.value);
    case "bytes":
      return value.value;
  }
}

const same = (a: unknown, b: unknown) => {
  if (a instanceof Uint8Array && b instanceof Uint8Array) return a.length === b.length && a.every((byte, i) => byte === b[i]);
  if (a instanceof Date || b instanceof Date) return new Date(a as string).getTime() === new Date(b as string).getTime();
  return equal(a, b);
};

const ordered = (a: unknown, b: unknown) => {
  const values = [a, b].map((each) => (each instanceof Date ? each.getTime() : each));
  if (typeof values[0] !== typeof values[1] || (typeof values[0] !== "number" && typeof values[0] !== "string")) throw new Error(`can't compare ${JSON.stringify(a)} with ${JSON.stringify(b)}`);
  return values as [number, number];
};

function holds(actual: unknown, predicate: string, value: unknown): boolean {
  switch (predicate) {
    case "==": return same(actual, value);
    case "!=": return !same(actual, value);
    case ">": { const [a, b] = ordered(actual, value); return a > b; }
    case ">=": { const [a, b] = ordered(actual, value); return a >= b; }
    case "<": { const [a, b] = ordered(actual, value); return a < b; }
    case "<=": { const [a, b] = ordered(actual, value); return a <= b; }
    case "startsWith": return typeof actual === "string" && actual.startsWith(String(value));
    case "endsWith": return typeof actual === "string" && actual.endsWith(String(value));
    case "contains":
      if (typeof actual === "string") return actual.includes(String(value));
      if (isList(actual)) return actual.some((each) => same(each, value));
      return false;
    case "includes": return isList(actual) && actual.some((each) => same(each, value));
    case "matches": return typeof actual === "string" && (value instanceof RegExp ? value : new RegExp(String(value))).test(actual);
    case "exists": return actual !== undefined;
    case "isBoolean": return typeof actual === "boolean";
    case "isCollection": return typeof actual === "object" && actual !== null && !(actual instanceof Date) && !(actual instanceof Uint8Array);
    case "isDate": return actual instanceof Date;
    case "isEmpty":
      if (typeof actual === "string" || isList(actual) || actual instanceof Uint8Array) return actual.length === 0;
      return typeof actual === "object" && actual !== null && Object.keys(actual).length === 0;
    case "isFloat": return typeof actual === "number" && !Number.isInteger(actual);
    case "isInteger": return typeof actual === "number" && Number.isInteger(actual);
    case "isNumber": return typeof actual === "number";
    case "isIpv4": return typeof actual === "string" && IPV4.test(actual);
    case "isIpv6": return typeof actual === "string" && IPV6.test(actual) && actual.includes(":");
    case "isIsoDate": return typeof actual === "string" && ISO_DATE.test(actual);
    case "isList": return isList(actual);
    case "isObject": return typeof actual === "object" && actual !== null && !isList(actual) && !(actual instanceof Date) && !(actual instanceof Uint8Array);
    case "isString": return typeof actual === "string";
    case "isUuid": return typeof actual === "string" && UUID.test(actual);
    default: throw new Unsupported(predicate);
  }
}

/** A query and its filters, worked out. */
async function evaluate(spec: Query, context: Context) {
  let value = await query(spec, context);
  for (const each of spec.filters) value = filter(value, each, context);
  return value;
}

function problem(error: unknown, say: Say) {
  if (error instanceof Unsupported) return say("unsupported", { what: error.message });
  return error instanceof Error ? error.message : String(error);
}

/**
 * Checks `answer` against `expect`, in Hurl's order: status, headers, captures, asserts, body. The
 * captures, worked out, are what the entries after it can use.
 */
export async function check(expect: Expect, context: Context, captured: Map<string, unknown>): Promise<Check[]> {
  const { answer, say } = context;
  const checks: Check[] = [];
  if (expect.status !== null) {
    const ok = answer.status === expect.status;
    checks.push({ text: say("status", { status: String(expect.status) }), ok, actual: ok ? undefined : String(answer.status) });
  }
  for (const [name, value] of expect.headers) {
    const had = header(answer, name);
    const values = had === undefined ? [] : isList(had) ? had : had.split(/,\s*/).length > 1 ? [had, ...had.split(/,\s*/)] : [had];
    const ok = values.includes(context.fill(value));
    checks.push({ text: `${name}: ${value}`, ok, actual: ok ? undefined : shown(had, say) });
  }
  for (const capture of expect.captures) {
    if (capture.problem) {
      checks.push({ text: capture.text, ok: false, actual: say("invalid", { error: capture.problem }) });
      continue;
    }
    try {
      const value = await evaluate(capture.query, context);
      if (value === undefined) checks.push({ text: say("capture", { name: capture.name }), ok: false, actual: say("missing") });
      else captured.set(capture.name, value);
    } catch (error) {
      checks.push({ text: capture.text, ok: false, actual: problem(error, say) });
    }
  }
  for (const assert of expect.asserts) {
    if (assert.problem) {
      checks.push({ text: assert.text, ok: false, actual: say("invalid", { error: assert.problem }) });
      continue;
    }
    try {
      const actual = await evaluate(assert.query, context);
      const result = holds(actual, assert.predicate, assert.value ? expected(assert.value, context) : undefined);
      // A value that isn't there fails every predicate but `not exists`.
      const ok = actual === undefined && assert.predicate !== "exists" ? false : assert.not ? !result : result;
      checks.push({ text: assert.text, ok, actual: ok ? undefined : shown(actual, say) });
    } catch (error) {
      checks.push({ text: assert.text, ok: false, actual: problem(error, say) });
    }
  }
  if (expect.body !== null) {
    const wanted = context.fill(expect.body);
    let ok = answer.text === wanted || answer.text.trimEnd() === wanted.trimEnd();
    if (!ok) {
      try {
        ok = equal(JSON.parse(answer.text), JSON.parse(wanted));
      } catch {
        // Not JSON: compared as text.
      }
    }
    checks.push({ text: say("body"), ok, actual: ok ? undefined : shown(answer.text, say) });
  }
  return checks;
}
