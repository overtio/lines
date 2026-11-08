import type { Asked } from "./curl";

/*
 * What both formats read into (parse.ts reads .http, hurl/parse.ts reads Hurl): requests where they
 * are in the text, sent the same way (editor.ts), and, for Hurl, what each expects of its response.
 */

export interface Request {
  /** Where its part of the text starts: its `###` line, or the end of the request before. */
  from: number;
  /** Its request line, from its start to its end. */
  line: number;
  lineEnd: number;
  /** The end of its last line with anything on it. */
  to: number;
  /** Where its part of the text ends: the end of the line before the next request's part, or of the text. */
  end: number;
  /** What its `###` line says after the separator (.http). */
  title: string;
  /** Its name, from `# @name login`, for the requests after it to use its response (.http). */
  name: string | null;
  method: string;
  url: string;
  headers: [string, string][];
  body: string | null;
  /** Its body is read from a file (`< ./body.json`, `file,body.json;`), which lines doesn't do. */
  fileBody: boolean;
  /** The Content-Type its body is sent as, unless a header says another: Hurl's JSON and XML bodies say theirs. */
  bodyType?: string;
  /** Hurl's sections: query parameters and form fields, added as it's sent; `user:password`; cookies. */
  query?: [string, string][];
  form?: [string, string][];
  user?: string;
  cookies?: [string, string][];
  /** Whether redirects are followed: always in .http, with `location: true` in Hurl. */
  follow?: boolean;
  /** Variables its `[Options]` set (Hurl's `variable: name=value`). */
  variables?: [string, string][];
  /** What it expects of its response, to check, and what it captures from it (Hurl). */
  expect?: Expect;
  /** Something it uses that lines doesn't send yet: `[MultipartFormData]`, say. */
  unsupported?: string;
}

export interface ReadText {
  requests: Request[];
  /** Variables written in the text, by name: a later one with the same name wins (.http's `@name = value`). */
  variables: Map<string, string>;
  /** Comment lines' text (outside bodies), without their `#` or `//`, for the note's title and tags. */
  comments: string[];
}

/** What a Hurl entry expects of its response. */
export interface Expect {
  /** `HTTP 200`: its status, or null for `HTTP *`; and its version, if it says one. */
  status: number | null;
  version: string | null;
  /** Headers it must have, with those values. */
  headers: [string, string][];
  captures: Capture[];
  asserts: Assert[];
  /** The body it must have, exactly. */
  body: string | null;
}

/** Part of a response: `jsonpath "$.id"`, `header "Location"`, `status`… with filters after it. */
export interface Query {
  kind: string;
  argument: Value | null;
  filters: Filter[];
}

export interface Filter {
  kind: string;
  args: Value[];
}

/** A value as Hurl writes one: a string, number, boolean, null, or a regular expression. */
export type Value =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "boolean"; value: boolean }
  | { kind: "null" }
  | { kind: "regex"; value: string }
  /** `{{count}}`: a variable, as its own type. */
  | { kind: "template"; value: string }
  /** `hex,beef;` or `base64,…;`. */
  | { kind: "bytes"; value: Uint8Array };

export interface Capture {
  name: string;
  query: Query;
  /** As written, to show. */
  text: string;
  /** Why it couldn't be read, if it couldn't. */
  problem?: string;
}

export interface Assert {
  query: Query;
  not: boolean;
  predicate: string;
  value: Value | null;
  /** As written, to show. */
  text: string;
  /** Why it couldn't be read, if it couldn't. */
  problem?: string;
}

/** A check made of a response: an assert, the status, a header or the body; and how it went. */
export interface Check {
  text: string;
  ok: boolean;
  /** What the response had, when it didn't pass, or why it couldn't be checked. */
  actual?: string;
}

/** A request format: how its text reads, and how a request is written in it. */
export interface Dialect {
  id: "http" | "hurl";
  /** The languages its code blocks give: ```http and ```rest; ```hurl. */
  blocks: RegExp;
  read(text: string): ReadText;
  /** A request as its text: one added from a response's address, or a pasted curl command. */
  write(asked: Asked, notes?: string[]): string;
  /** What goes before a request added after another: `###\n` in .http. */
  separator: string;
  /** Whether sending them all stops at the first that fails, as Hurl does. */
  stops: boolean;
}
