import { mock } from "bun:test";
import { readFileSync } from "node:fs";

/*
 * What a module imports for the app, which a unit test outside a page doesn't have: messages (as
 * their keys), the platform (a page that isn't the app's, nothing in it doing anything) and the
 * plugins (none on: they read the page's storage). Mocks are the whole run's, every file's, so each
 * test that needs them asks for all of them here, with its own `platform` in place of any; a module
 * mocked again later has the same exports.
 */

const platformPath = new URL("../../src/lib/platform.ts", import.meta.url).pathname;
/** Every name the platform module exports, so a stub of it misses none another module imports. */
const NAMES = [...readFileSync(platformPath, "utf8").matchAll(/^export (?:const|async function|function) (\w+)/gm)].map((match) => match[1]);

export function stubApp(platform: Record<string, unknown> = {}) {
  mock.module("../../src/lib/i18n/index.svelte", () => ({ t: (key: string) => key, language: "en", locale: "en" }));
  const stubs: Record<string, unknown> = Object.fromEntries(NAMES.map((name) => [name, /^(is|can)[A-Z]/.test(name) ? false : name === "modKey" || name === "newNoteKey" ? "" : () => undefined]));
  mock.module("../../src/lib/platform", () => ({ ...stubs, coarsePointer: { matches: false }, reducedMotion: { matches: false }, ...platform }));
  mock.module("../../src/lib/plugins/registry.svelte", () => ({ DEFAULT_LANGUAGE: "markdown", plugins: { libraryKind: () => undefined, librarySources: [] } }));
}
