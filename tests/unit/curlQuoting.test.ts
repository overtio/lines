import { describe, expect, test } from "bun:test";
import { readCurl, words } from "../../src/plugins/http/curl";

/** A word as Chrome's "Copy as cURL (bash)" quotes it (DevTools' escapeStringPosix). */
function chrome(text: string) {
  const escapes = (c: string) => c < " " || (c >= "\x7f" && c <= "\x9f") || c === "!";
  if (![...text].some((c) => escapes(c) || c === "'")) return `'${text}'`;
  const escaped = text.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  return `$'${[...escaped].map((c) => (escapes(c) ? `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}` : c)).join("")}'`;
}

describe("a pasted curl command's $'…' strings", () => {
  test("Chrome's, with an apostrophe, a ! and control characters", () => {
    const body = `{"message":"Hello, it's me!","bell":"\x07","tab":"\t","line":"a\\nb"}`;
    const read = readCurl(`curl ${chrome("https://api.example.com/messages")} \\\n  -H ${chrome("content-type: text/plain")} \\\n  --data-raw ${chrome(body)}`);
    expect(read?.asked.body).toBe(body);
  });

  test("Firefox's, with ! in octal and what isn't ASCII in hex or as a code point", () => {
    expect(words(String.raw`curl --data-raw $'Hi\041 caf\xe9 \u4e2d\u6587'`)).toEqual(["curl", "--data-raw", "Hi! café 中文"]);
  });

  test("every escape bash reads", () => {
    expect(words(String.raw`$'\a\b\e\E\f\n\r\t\v\\\'\"\?'`)).toEqual(["\x07\b\x1b\x1b\f\n\r\t\v\\'\"?"]);
    expect(words(String.raw`$'\101\x42\u0043\U0001F600 \xc3\xa9'`)).toEqual(["ABC😀 é"]);
    // One bash doesn't know stays as written.
    expect(words(String.raw`$'a\qb\x\u'`)).toEqual([String.raw`a\qb\x\u`]);
  });
});
