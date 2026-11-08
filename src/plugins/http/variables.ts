/*
 * `{{name}}` in a request: a variable from an `@name = value` line (or a Hurl capture), one lines
 * makes up (`{{$uuid}}`, `{{$timestamp}}`, `{{$randomInt 1 100}}`, Hurl's `{{newUuid}}` and
 * `{{newDate}}`), or part of a named request's last
 * response (`{{login.response.body.$.token}}`, `{{login.response.headers.Location}}`), as VS Code's
 * REST Client and Visual Studio write them; or, when no variable has the name, a secret
 * (notes/secrets.svelte.ts). No scripts run.
 */

import { jsonPath } from "./jsonpath";

/** A response as variables read it. */
export interface ResponseValues {
  headers: [string, string][];
  text: string;
}

export interface Scope {
  variables: ReadonlyMap<string, string>;
  /** The last response of the request named `name`, if it's been sent. */
  response(name: string): ResponseValues | undefined;
  /** What a name no variable has stands for: a secret, if there's one by that name. */
  secret?(name: string): string | undefined;
}

/** Why a variable couldn't be filled in, for the response to say. */
export class VariableError extends Error {
  constructor(
    /** `locked`: it may be a secret, in a locked note that stayed closed. */
    readonly reason: "unknown" | "unsent" | "path" | "loop" | "locked",
    readonly variable: string,
  ) {
    super(`${reason}: ${variable}`);
  }
}

const REFERENCE = /\{\{\s*([^{}]*?)\s*\}\}/g;
/** As deep as variables made of variables go, which a loop would otherwise make endless. */
const DEPTH = 10;

const random = (min: number, max: number) => min + Math.floor(Math.random() * (max - min));

/** The variables lines makes up, as REST Client and IntelliJ name them. */
function made(expression: string): string | undefined {
  const [name, ...args] = expression.split(/\s+/);
  switch (name) {
    case "$uuid":
    case "$guid":
    case "$random.uuid":
      return crypto.randomUUID();
    case "$timestamp":
      return String(Math.floor(Date.now() / 1000));
    case "$isoTimestamp":
      return new Date().toISOString();
    case "$datetime":
      return args[0] === "rfc1123" ? new Date().toUTCString() : new Date().toISOString();
    case "$randomInt":
    case "$random.integer": {
      const [min = 0, max = 1000] = args.map(Number).filter(Number.isFinite);
      return String(random(min, max));
    }
  }
  return undefined;
}

/** A part of a response: `body.*`, `body.$.token`, `headers.Location`. */
function part(response: ResponseValues, expression: string, path: string): string {
  const [kind, ...rest] = path.split(".");
  const selector = rest.join(".");
  if (kind === "headers") {
    const name = selector.toLowerCase();
    const found = response.headers.find(([header]) => header.toLowerCase() === name);
    if (found) return found[1];
  } else if (kind === "body") {
    if (selector === "*") return response.text;
    try {
      const found = jsonPath(JSON.parse(response.text), selector);
      if (found !== undefined) return typeof found === "string" ? found : JSON.stringify(found);
    } catch {
      // Not JSON, or not a path: nothing to find.
    }
  }
  throw new VariableError("path", expression);
}

/** `text` with every `{{…}}` in it filled in. Throws a VariableError for one that can't be. */
export function fillIn(text: string, scope: Scope, depth = 0): string {
  if (!text.includes("{{")) return text;
  return text.replace(REFERENCE, (_, expression: string) => {
    if (expression.startsWith("$")) {
      const value = made(expression);
      if (value === undefined) throw new VariableError("unknown", expression);
      return value;
    }
    const reference = /^([\w-]+)\.response\.(.+)$/.exec(expression);
    if (reference) {
      const response = scope.response(reference[1]);
      if (!response) throw new VariableError("unsent", reference[1]);
      return part(response, expression, reference[2]);
    }
    const value = scope.variables.get(expression);
    if (value === undefined) {
      // Hurl's made-up values.
      if (expression === "newUuid") return crypto.randomUUID();
      if (expression === "newDate") return new Date().toISOString();
      // A secret is its value as it is, not filled in further.
      const secret = scope.secret?.(expression);
      if (secret === undefined) throw new VariableError("unknown", expression);
      return secret;
    }
    if (depth >= DEPTH) throw new VariableError("loop", expression);
    return fillIn(value, scope, depth + 1);
  });
}

/** `text` with what can be filled in filled in, and the rest left as written: for copying as curl. */
export function fillInWhatCan(text: string, scope: Scope): string {
  return text.replace(REFERENCE, (written) => {
    try {
      return fillIn(written, scope);
    } catch {
      return written;
    }
  });
}
