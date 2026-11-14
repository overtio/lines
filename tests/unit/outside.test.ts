import { beforeEach, describe, expect, mock, test } from "bun:test";
import { stubApp } from "./stubs";

/*
 * Asking the web in the apps (src/lib/outside.ts): redirects followed one at a time, and never from
 * the web at large onto this computer or its network, by a redirect or by a name the system says
 * stands for one of its addresses. The app's requests and the system's answers are the test's.
 */

/** What each address answers: a status and where it leads, or a body. */
const answers = new Map<string, { status?: number; location?: string; body?: string }>();
const asked: { url: string; method?: string; redirects?: number }[] = [];
/** The names the system says stand for an address on this computer or its network. */
const localNames = new Set(["127.0.0.1.nip.io", "router.example"]);

stubApp({
  isTauri: true,
  hostIsPublic: async (host: string) => !localNames.has(host),
  webFetch: async () => async (url: string, init?: RequestInit & { maxRedirections?: number }) => {
    asked.push({ url, method: init?.method, redirects: init?.maxRedirections });
    const answer = answers.get(url);
    if (!answer) return new Response("", { status: 404 });
    return new Response(answer.body ?? "", { status: answer.status ?? 200, headers: answer.location ? { location: answer.location } : {} });
  },
});
mock.module("../../src/lib/release", () => ({ VERSION: "0.0.0", REPO: "https://github.com/overtio/lines" }));
const { isLocal, LocalAddress, outsideFetch } = await import("../../src/lib/outside");
const { fetchFeed } = await import("../../src/lib/feeds/fetch");

beforeEach(() => {
  answers.clear();
  asked.length = 0;
});

describe("asking the web in the apps", () => {
  test("a site's name is this computer's or its network's by the name alone: no dot, a local network's, or a private address", () => {
    for (const host of ["localhost", "printer", "nas.local", "home.lan", "127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.0.10", "169.254.169.254", "100.100.0.1", "0.0.0.0", "[::1]", "[fd00::1]"]) {
      expect(isLocal(host), host).toBe(true);
    }
    // What a name stands for is the system's to say.
    for (const host of ["example.com", "8.8.8.8", "172.32.0.1", "127.0.0.1.nip.io"]) expect(isLocal(host), host).toBe(false);
  });

  test("redirects are followed here, one at a time, keeping a HEAD a HEAD", async () => {
    answers.set("https://blog.example/feed", { status: 301, location: "https://www.blog.example/feed" });
    answers.set("https://www.blog.example/feed", { status: 302, location: "/feed.xml" });
    answers.set("https://www.blog.example/feed.xml", { body: "<rss/>" });
    const response = await outsideFetch("https://blog.example/feed", { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(asked).toEqual([
      { url: "https://blog.example/feed", method: "HEAD", redirects: 0 },
      { url: "https://www.blog.example/feed", method: "HEAD", redirects: 0 },
      { url: "https://www.blog.example/feed.xml", method: "HEAD", redirects: 0 },
    ]);
  });

  test("an address on the web never leads to this computer or its network: by a redirect, or by a name that stands for one of its addresses", async () => {
    answers.set("https://blog.example/feed", { status: 302, location: "http://127.0.0.1:8080/admin" });
    await expect(outsideFetch("https://blog.example/feed")).rejects.toBeInstanceOf(LocalAddress);
    expect(asked.map(({ url }) => url)).toEqual(["https://blog.example/feed"]);

    asked.length = 0;
    answers.set("https://blog.example/picture", { status: 307, location: "https://router.example/status" });
    await expect(outsideFetch("https://blog.example/picture")).rejects.toBeInstanceOf(LocalAddress);
    expect(asked.map(({ url }) => url)).toEqual(["https://blog.example/picture"]);

    asked.length = 0;
    await expect(outsideFetch("https://127.0.0.1.nip.io/feed")).rejects.toBeInstanceOf(LocalAddress);
    expect(asked).toEqual([]);
  });

  test("an address on this computer to begin with (a feed you run yourself) is asked as it is, wherever it leads", async () => {
    answers.set("http://localhost:8080/feed", { status: 302, location: "http://127.0.0.1:8080/feed.xml" });
    answers.set("http://127.0.0.1:8080/feed.xml", { body: "<rss/>" });
    expect((await outsideFetch("http://localhost:8080/feed")).status).toBe(200);
  });

  test("ten redirects, and no more", async () => {
    for (let i = 0; i < 12; i++) answers.set(`https://loop.example/${i}`, { status: 302, location: `/${i + 1}` });
    await expect(outsideFetch("https://loop.example/0")).rejects.toThrow("too many redirects");
    expect(asked.length).toBe(11);
  });

  test("a feed that leads onto this computer's network couldn't be fetched, and says why", async () => {
    answers.set("https://blog.example/feed", { status: 301, location: "https://192.168.1.1/feed" });
    await expect(fetchFeed("https://blog.example/feed")).rejects.toMatchObject({ message: "local" });
  });
});
