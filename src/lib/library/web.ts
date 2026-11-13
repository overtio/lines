import { isTauri, webFetch } from "../platform";
import { REPO, VERSION } from "../release";
import { type Page, readPage } from "./page";

/*
 * Asking the web what a link is, for the library's sources (src/plugins/): only what's needed (the
 * link, an id, the words searched for), and in the apps as lines, which some services ask of apps
 * that call them (MusicBrainz, Wikimedia). A browser says what it is itself, and nothing else is sent.
 */

/** Who's asking: lines, and where its source is. Never anything about whoever uses it. */
export const CLIENT = `lines/${VERSION} (${REPO})`;

/** How much of a page is looked through: its head and well past it, what it says about itself being near the top. */
const PAGE_CHARACTERS = 3_000_000;

/** An answer that isn't what was asked for: a server's error, or something else. */
export class LookupError extends Error {}

async function ask(url: string, signal: AbortSignal, accept: string) {
  const fetch = await webFetch();
  return fetch(url, { signal, headers: { accept, ...(isTauri && { "user-agent": CLIENT }) } });
}

/** What a service answers in JSON; null if it has nothing there (404). Rejects offline, or on any other error. */
export async function getJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  const response = await ask(url, signal, "application/json");
  if (response.status === 404) return null;
  if (!response.ok) throw new LookupError(`${new URL(url).hostname} answered ${response.status}`);
  return (await response.json()) as T;
}

/** What a page says about itself (page.ts); null if it isn't a page (an image, a PDF) or isn't there. */
export async function getPage(url: string, signal: AbortSignal): Promise<Page | null> {
  const response = await ask(url, signal, "text/html,application/xhtml+xml");
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) throw new LookupError(`${new URL(url).hostname} answered ${response.status}`);
  if (!/html/i.test(response.headers.get("content-type") ?? "text/html")) return null;
  const html = await response.text();
  return readPage(html.slice(0, PAGE_CHARACTERS), response.url || url);
}
