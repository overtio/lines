/*
 * JSON as an API wrote it. JSON.parse reads every number as a double, so a whole number past 2^53
 * comes back changed (a 64-bit id, 1234567890123456789, as 1234567890123456800): indenting a body,
 * and taking a value out of one, keep each number as it was written.
 */

/** JSON's tokens as written: strings, numbers, `true`, `false` and `null`, and punctuation. */
const TOKEN = /"[^"\\]*(?:\\.[^"\\]*)*"|[^\s"{}[\]:,]+|[{}[\]:,]/g;

/** The tokens of `text`, which must be JSON: throws if it isn't. */
function tokens(text: string) {
  JSON.parse(text);
  return text.match(TOKEN) ?? [];
}

/** JSON indented by two spaces, as JSON.stringify indents it, with its strings and numbers as written. */
export function indentJson(text: string): string {
  const list = tokens(text);
  const indents = ["\n"];
  let depth = 0;
  const newLine = () => (indents[depth] ??= `\n${"  ".repeat(depth)}`);
  let out = "";
  for (let i = 0; i < list.length; i++) {
    const token = list[i];
    if (token === "{" || token === "[") {
      // An empty one stays on its line: `{}`, `[]`.
      if (list[i + 1] === (token === "{" ? "}" : "]")) out += token + list[++i];
      else {
        depth++;
        out += token + newLine();
      }
    } else if (token === "}" || token === "]") {
      depth--;
      out += newLine() + token;
    } else if (token === ",") out += `,${newLine()}`;
    else if (token === ":") out += ": ";
    else out += token;
  }
  return out;
}

/** JSON's value, as JSON.parse reads it but with whole numbers too large for a double as BigInts. */
export function parseJson(text: string): unknown {
  const list = tokens(text);
  let at = 0;
  const value = (): unknown => {
    const token = list[at++];
    if (token === "[") {
      const items: unknown[] = [];
      if (list[at] === "]") at++;
      else {
        do items.push(value());
        while (list[at++] === ",");
      }
      return items;
    }
    if (token === "{") {
      const entries: [string, unknown][] = [];
      if (list[at] === "}") at++;
      else {
        do {
          // A name, its colon, its value.
          const name = JSON.parse(list[at]) as string;
          at += 2;
          entries.push([name, value()]);
        } while (list[at++] === ",");
      }
      return Object.fromEntries(entries);
    }
    const read: unknown = JSON.parse(token);
    return typeof read === "number" && !Number.isSafeInteger(read) && /^-?\d+$/.test(token) ? BigInt(token) : read;
  };
  return value();
}

/** A value as JSON, as JSON.stringify writes it, with BigInts as their digits. */
export function jsonText(value: unknown): string {
  if (typeof value === "bigint") return String(value);
  if (Array.isArray(value)) return `[${value.map(jsonText).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).map(([key, each]) => `${JSON.stringify(key)}:${jsonText(each)}`).join(",")}}`;
  return JSON.stringify(value);
}
