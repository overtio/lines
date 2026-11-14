import { describe, expect, mock, spyOn, test } from "bun:test";
import { stubApp } from "./stubs";

/** The requests the bucket was sent, and how it answers one: with a status, and the object's ETag. */
const sent: Request[] = [];
let answer = (_request: Request) => ({ status: 200, etag: "new" });
stubApp({
  isTauri: true,
  webFetch: async () => async (request: Request) => {
    sent.push(request);
    const { status, etag } = answer(request);
    return new Response(null, { status, headers: { etag: `"${etag}"` } });
  },
});

/** What the app's native side was given to transfer, and the bucket it reaches, as src-tauri/src/bucket_sync.rs. */
const transferred: { method: string; url: string; headers: [string, string][]; body: Uint8Array }[] = [];
const files = new Map<string, Uint8Array>();
mock.module("@tauri-apps/api/core", () => ({
  invoke: async (command: string, body: Uint8Array, options: { headers: Record<string, string> }) => {
    if (command !== "sync_bucket_transfer") throw new Error(`No command ${command}`);
    const signed = JSON.parse(decodeURIComponent(options.headers["x-request"]));
    transferred.push({ ...signed, body });
    const path = new URL(signed.url).pathname;
    if (path.includes("unreachable")) throw { status: null, text: "error sending request" };
    if (path.includes("denied")) throw { status: 403, text: "<Error><Code>AccessDenied</Code></Error>" };
    if (signed.method === "PUT") return void files.set(path, body);
    const file = files.get(path);
    if (!file) throw { status: 404, text: "<Error><Code>NoSuchKey</Code></Error>" };
    return file.slice().buffer;
  },
}));
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

describe("an S3 bucket from the apps", () => {
  test("takes and gives an attachment as its bytes, not through the HTTP plugin", async () => {
    const remote = bucket("files");
    const photo = Uint8Array.from({ length: 1024 }, (_, i) => i % 256);
    const notes = sent.length;
    await remote.putFile("attachments/a.png", new Blob([photo], { type: "image/png" }));
    const put = transferred.at(-1)!;
    expect(put).toMatchObject({ method: "PUT", url: "https://s3.example.com/files/attachments/a.png", body: photo });
    expect(new Headers(put.headers).get("content-type")).toBe("image/png");
    expect(new Headers(put.headers).get("authorization")).toStartWith("AWS4-HMAC-SHA256 ");

    const got = await remote.getFile("attachments/a.png");
    expect(transferred.at(-1)).toMatchObject({ method: "GET", body: new Uint8Array() });
    expect(new Uint8Array(await got!.arrayBuffer())).toEqual(photo);
    expect(sent.length).toBe(notes);
  });

  test("one that isn't there is null; a refusal, or a bucket out of reach, says so", async () => {
    const remote = bucket("files");
    expect(await remote.getFile("attachments/missing.png")).toBeNull();
    await expect(remote.getFile("attachments/denied.png")).rejects.toThrow("sync.error.denied");
    const logged = spyOn(console, "error").mockImplementation(() => {});
    await expect(remote.putFile("attachments/unreachable.png", new Blob(["x"]))).rejects.toThrow("sync.error.unreachableApp");
    logged.mockRestore();
  });
});
