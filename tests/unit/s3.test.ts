import { describe, expect, test } from "bun:test";
import { stubApp } from "./stubs";

/** The requests the bucket was sent, and how it answers one: with a status, and the object's ETag. */
const sent: Request[] = [];
let answer = (_request: Request) => ({ status: 200, etag: "new" });
stubApp({
  webFetch: async () => async (request: Request) => {
    sent.push(request);
    const { status, etag } = answer(request);
    return new Response(null, { status, headers: { etag: `"${etag}"` } });
  },
});
const { S3Remote } = await import("../../src/lib/sync/s3");

const bucket = (name: string) =>
  new S3Remote({ endpoint: "https://s3.example.com", region: "us-east-1", bucket: name, prefix: "", accessKeyId: "id", secretAccessKey: "secret" });

describe("an S3 bucket", () => {
  test("writes a note only over the version expected, or where there's none", async () => {
    const notes = bucket("notes");
    expect(await notes.put("notes/a.md", "text", "listed")).toBe("new");
    expect(sent.at(-1)!.headers.get("if-match")).toBe('"listed"');
    expect(await notes.put("notes/b.md", "text", null)).toBe("new");
    expect(sent.at(-1)!.headers.get("if-none-match")).toBe("*");
    // Another device wrote it since.
    answer = (request) => ({ status: request.method === "PUT" ? 412 : 200, etag: "theirs" });
    expect(await notes.put("notes/a.md", "text", "listed")).toBe(false);
  });

  test("one that turns conditional writes down writes as it did before", async () => {
    answer = (request) => ({ status: request.headers.has("if-match") ? 501 : 200, etag: "new" });
    expect(await bucket("declines").put("notes/a.md", "text", "listed")).toBe("new");
    expect(sent.at(-1)!.headers.has("if-match")).toBe(false);
  });

  test("so does one that refuses them though the note is as expected, which would otherwise never be written", async () => {
    const refuses = bucket("refuses");
    answer = (request) => (request.headers.has("if-match") ? { status: 412, etag: "" } : { status: 200, etag: request.method === "HEAD" ? "listed" : "new" });
    expect(await refuses.put("notes/a.md", "text", "listed")).toBe("new");
    expect(sent.at(-1)!.headers.has("if-match")).toBe(false);
    // Remembered: the next note goes up at once.
    const before = sent.length;
    expect(await refuses.put("notes/b.md", "text", "listed")).toBe("new");
    expect(sent.length - before).toBe(1);
  });
});
