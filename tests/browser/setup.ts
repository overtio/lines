import { afterAll, beforeAll } from "bun:test";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, webkit } from "playwright";
import { build, preview, type PreviewServer } from "vite";

/*
 * Before the browser tests: the app built with the tests' helpers (`--mode test`, src/test/), served,
 * and a headless browser, Chromium unless BROWSER=webkit says WebKit (Safari, and the Apple apps'
 * web views). LINES_TEST_BUILD=0 serves the last build again. Loaded before them (package.json).
 */

const root = fileURLToPath(new URL("../..", import.meta.url));
const outDir = "dist-test";

declare global {
  var lines: { browser: Browser; url: string; engine: "chromium" | "webkit" };
}

let server: PreviewServer;

beforeAll(async () => {
  if (process.env.LINES_TEST_BUILD !== "0") await build({ root, mode: "test", logLevel: "error", build: { outDir, emptyOutDir: true } });
  // A port of its own on 127.0.0.1: "localhost" can be IPv4 or IPv6, so another worktree's server
  // on the same port number could answer this one's browser.
  server = await preview({ root, mode: "test", logLevel: "error", build: { outDir }, preview: { host: "127.0.0.1", port: 0, open: false } });
  const engine = process.env.BROWSER === "webkit" ? "webkit" : "chromium";
  // Unheard (the build mutes itself too: src/test/silence.ts); WebKit has no such switch.
  const browser = engine === "webkit" ? await webkit.launch() : await chromium.launch({ args: ["--mute-audio"] });
  globalThis.lines = { browser, url: server.resolvedUrls!.local[0], engine };
}, 180_000);

afterAll(async () => {
  await globalThis.lines?.browser.close();
  await server?.close();
});
