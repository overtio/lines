import { describe, expect, test } from "bun:test";
import { readCurl } from "../../src/plugins/http/curl";
import { indentJson, jsonText, parseJson } from "../../src/plugins/http/json";
import { fillIn, type Scope } from "../../src/plugins/http/variables";

// A 64-bit id, which a double rounds to 1234567890123456800.
const ID = "1234567890123456789";

describe("whole numbers past 2^53 in requests' JSON", () => {
  test("a response's body is indented with its numbers as written", () => {
    expect(indentJson(`{"id": ${ID}, "price": 1.10, "tags": [], "meta": {}, "note": "a \\"[1, 2]\\" b"}`)).toBe(
      `{\n  "id": ${ID},\n  "price": 1.10,\n  "tags": [],\n  "meta": {},\n  "note": "a \\"[1, 2]\\" b"\n}`,
    );
    const plain = `[{"a":[1,{"b":null}],"c":"x"},true]`;
    expect(indentJson(plain)).toBe(JSON.stringify(JSON.parse(plain), null, 2));
    // Escapes read as they did: Python's json.dumps writes what isn't ASCII as `\u00e9`.
    expect(indentJson(String.raw`{"name": "Caf\u00e9", "quote": "a \"b\" \/ c", "id": 1234567890123456789}`)).toBe(`{\n  "name": "Café",\n  "quote": "a \\"b\\" / c",\n  "id": ${ID}\n}`);
    expect(() => indentJson("{ not json")).toThrow();
  });

  test("a value is read with its own digits", () => {
    expect(parseJson(`{"id": ${ID}, "n": 3, "big": 1e30}`)).toEqual({ id: BigInt(ID), n: 3, big: 1e30 });
    expect(jsonText(parseJson(`{"user": {"id": ${ID}, "name": "Ada"}, "ids": [${ID}, 2]}`))).toBe(`{"user":{"id":${ID},"name":"Ada"},"ids":[${ID},2]}`);
  });

  test("a later request uses a response's number as it came", () => {
    const scope: Scope = { variables: new Map(), response: () => ({ headers: [], text: `{"id": ${ID}, "user": {"id": ${ID}}, "price": 2.5}` }) };
    expect(fillIn("/tweets/{{tweet.response.body.$.id}}", scope)).toBe(`/tweets/${ID}`);
    expect(fillIn("{{tweet.response.body.$.user}}", scope)).toBe(`{"id":${ID}}`);
    expect(fillIn("{{tweet.response.body.$.price}}", scope)).toBe("2.5");
    const list: Scope = { variables: new Map(), response: () => ({ headers: [], text: `[{"id": ${ID}, "name": "a"}, {"id": 7, "name": "b"}]` }) };
    expect(fillIn("{{list.response.body.$[?@.id > 1000].name}}", list)).toBe("a");
  });

  test("a pasted curl command's JSON body keeps its numbers", () => {
    const read = readCurl(`curl https://api.example.com/orders -H 'Content-Type: application/json' -d '{"customer_id": ${ID}, "amount": 10.50}'`);
    expect(read?.asked.body).toBe(`{\n  "customer_id": ${ID},\n  "amount": 10.50\n}`);
  });
});
