/*
 * JSONPath (RFC 9535), as Hurl's `jsonpath "$.items[0].id"` and .http's
 * `{{login.response.body.$.token}}` use it: names (`.a`, `['a b']`), indexes (`[0]`, `[-1]`),
 * wildcards (`.*`, `[*]`), slices (`[1:3]`), unions (`[0,2]`), descendants (`..a`) and filters
 * (`[?@.price < 10]`, `[?@.isbn]`, with `&&`, `||` and `!`). No function extensions.
 */

type Json = unknown;

/** What `path` finds in `value`: every match, and whether the path can only ever find one (a singular query). */
export function jsonPathAll(value: Json, path: string): { found: Json[]; singular: boolean } {
  const reader = new Reader(path.trim());
  if (!reader.eat("$")) throw new Error(`a JSONPath starts with $: ${path}`);
  let nodes: Json[] = [value];
  let singular = true;
  while (!reader.done()) {
    const step = reader.segment();
    singular &&= step.singular;
    nodes = nodes.flatMap(step.apply);
  }
  return { found: nodes, singular };
}

/** The one value `path` leads to, as Hurl gives it: a list for several, a value for one, undefined for none. */
export function jsonPath(value: Json, path: string): Json {
  const { found, singular } = jsonPathAll(value, path);
  if (singular || found.length === 1) return found[0];
  return found.length ? found : undefined;
}

const isObject = (value: Json): value is Record<string, Json> => typeof value === "object" && value !== null && !Array.isArray(value);
const children = (value: Json): Json[] => (Array.isArray(value) ? value : isObject(value) ? Object.values(value) : []);

function descendants(value: Json): Json[] {
  const all: Json[] = [value];
  for (const child of children(value)) all.push(...descendants(child));
  return all;
}

const index = (list: Json[], at: number) => list[at < 0 ? list.length + at : at];

function slice(list: Json[], start: number | null, end: number | null, step: number | null) {
  const by = step ?? 1;
  if (by === 0) return [];
  const length = list.length;
  const bound = (n: number) => (n < 0 ? Math.max(length + n, 0) : Math.min(n, length));
  const out: Json[] = [];
  if (by > 0) for (let i = bound(start ?? 0); i < bound(end ?? length); i += by) out.push(list[i]);
  else for (let i = start === null ? length - 1 : Math.min(bound(start), length - 1); i > (end === null ? -1 : bound(end)); i += by) out.push(list[i]);
  return out;
}

type Selector = (value: Json) => Json[];
interface Step {
  apply: Selector;
  singular: boolean;
}

/** Reads a path a character at a time. */
class Reader {
  at = 0;
  constructor(readonly text: string) {}

  done() {
    this.space();
    return this.at >= this.text.length;
  }
  space() {
    while (/\s/.test(this.text[this.at] ?? "")) this.at++;
  }
  peek(text: string) {
    this.space();
    return this.text.startsWith(text, this.at);
  }
  eat(text: string) {
    if (!this.peek(text)) return false;
    this.at += text.length;
    return true;
  }
  expect(text: string) {
    if (!this.eat(text)) throw new Error(`expected ${text} at ${this.at + 1} in ${this.text}`);
  }

  name() {
    const match = /^[\p{L}_$][\p{L}\p{N}_$-]*/u.exec(this.text.slice(this.at));
    if (!match) throw new Error(`expected a name at ${this.at + 1} in ${this.text}`);
    this.at += match[0].length;
    return match[0];
  }

  string() {
    this.space();
    const quote = this.text[this.at];
    let out = "";
    for (this.at++; this.at < this.text.length && this.text[this.at] !== quote; this.at++) {
      if (this.text[this.at] === "\\") {
        const next = this.text[++this.at];
        out += ({ n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" } as Record<string, string>)[next] ?? next;
      } else out += this.text[this.at];
    }
    this.expect(quote);
    return out;
  }

  number(): number | null {
    this.space();
    const match = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.text.slice(this.at));
    if (!match) return null;
    this.at += match[0].length;
    return Number(match[0]);
  }

  /** `.name`, `.*`, `..name`, `..*`, or `[…]`. */
  segment(): Step {
    if (this.eat("..")) {
      const step = this.peek("[") ? this.bracket() : this.eat("*") ? { apply: children, singular: false } : this.member();
      return { apply: (value) => descendants(value).flatMap(step.apply), singular: false };
    }
    if (this.eat(".")) return this.eat("*") ? { apply: children, singular: false } : this.member();
    if (this.peek("[")) return this.bracket();
    throw new Error(`unexpected ${this.text[this.at]} at ${this.at + 1} in ${this.text}`);
  }

  member(): Step {
    const name = this.name();
    return { apply: (value) => (isObject(value) && name in value ? [value[name]] : []), singular: true };
  }

  bracket(): Step {
    this.expect("[");
    const selectors: Selector[] = [];
    let singular = true;
    do {
      const { apply, singular: one } = this.selector();
      selectors.push(apply);
      singular &&= one;
    } while (this.eat(","));
    this.expect("]");
    return { apply: (value) => selectors.flatMap((select) => select(value)), singular: singular && selectors.length === 1 };
  }

  selector(): Step {
    if (this.peek("'") || this.peek('"')) {
      const name = this.string();
      return { apply: (value) => (isObject(value) && name in value ? [value[name]] : []), singular: true };
    }
    if (this.eat("*")) return { apply: children, singular: false };
    if (this.eat("?")) {
      const test = this.logical();
      return { apply: (value) => children(value).filter((child) => test(child)), singular: false };
    }
    const start = this.number();
    if (this.eat(":")) {
      const end = this.number();
      const step = this.eat(":") ? this.number() : null;
      return { apply: (value) => (Array.isArray(value) ? slice(value, start, end, step) : []), singular: false };
    }
    if (start === null) throw new Error(`expected an index at ${this.at + 1} in ${this.text}`);
    return { apply: (value) => (Array.isArray(value) && index(value, start) !== undefined ? [index(value, start)] : []), singular: true };
  }

  /* Filters: `@.price < 10 && !@.sold`, `(@.a || @.b)`. */

  logical(): (node: Json) => boolean {
    let test = this.conjunction();
    while (this.eat("||")) {
      const left = test;
      const right = this.conjunction();
      test = (node) => left(node) || right(node);
    }
    return test;
  }

  conjunction(): (node: Json) => boolean {
    let test = this.basic();
    while (this.eat("&&")) {
      const left = test;
      const right = this.basic();
      test = (node) => left(node) && right(node);
    }
    return test;
  }

  basic(): (node: Json) => boolean {
    if (this.eat("!")) {
      const inner = this.basic();
      return (node) => !inner(node);
    }
    if (this.eat("(")) {
      const inner = this.logical();
      this.expect(")");
      return inner;
    }
    const left = this.operand();
    const operator = ["==", "!=", "<=", ">=", "<", ">"].find((each) => this.eat(each));
    // On its own, a path tests that something's there.
    if (!operator) return (node) => left.exists(node);
    const right = this.operand();
    return (node) => compare(left.value(node), operator, right.value(node));
  }

  operand(): { value: (node: Json) => Json; exists: (node: Json) => boolean } {
    if (this.peek("@") || this.peek("$")) {
      const relative = this.eat("@");
      if (!relative) this.expect("$");
      const steps: Step[] = [];
      while (this.peek(".") || this.peek("[")) steps.push(this.segment());
      const all = (node: Json) => steps.reduce<Json[]>((nodes, step) => nodes.flatMap(step.apply), [node]);
      return { value: (node) => all(node)[0], exists: (node) => all(node).length > 0 };
    }
    let literal: Json;
    if (this.peek("'") || this.peek('"')) literal = this.string();
    else if (this.eat("true")) literal = true;
    else if (this.eat("false")) literal = false;
    else if (this.eat("null")) literal = null;
    else {
      literal = this.number();
      if (literal === null) throw new Error(`unexpected ${this.text[this.at]} at ${this.at + 1} in ${this.text}`);
    }
    return { value: () => literal, exists: () => true };
  }
}

function compare(left: Json, operator: string, right: Json) {
  if (operator === "==") return equal(left, right);
  if (operator === "!=") return !equal(left, right);
  const comparable = (typeof left === "number" && typeof right === "number") || (typeof left === "string" && typeof right === "string");
  if (!comparable) return operator.includes("=") && equal(left, right);
  const [a, b] = [left as number | string, right as number | string];
  return operator === "<" ? a < b : operator === "<=" ? a <= b : operator === ">" ? a > b : a >= b;
}

/** The same JSON value: numbers by value, lists and objects by what's in them. */
export function equal(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((each, i) => equal(each, b[i]));
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => key in b && equal(a[key], b[key]));
  }
  return false;
}
