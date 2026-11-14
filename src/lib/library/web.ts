import { withTimeout } from "../pacing";
import { isTauri, webFetch } from "../platform";
import { plugins } from "../plugins/registry.svelte";
import { REPO, VERSION } from "../release";
import { absolute, type Page, readPage } from "./page";

/*
 * Asking the web what a link is, for the library's sources (src/plugins/): only what's needed (the
 * link, an id, the words searched for), and in the apps as lines, which some services ask of apps
 * that call them (MusicBrainz, Wikimedia). A browser says what it is itself, and nothing else is sent.
 * Each request gives up after a while, so one that never answers holds nothing up.
 */

/** Who's asking: lines, and where its source is. Never anything about whoever uses it. */
export const CLIENT = `lines/${VERSION} (${REPO})`;

/** How long a request waits for an answer. */
const TIMEOUT = 15_000;

/** How much of a page is looked through: its head and well past it, what it says about itself being near the top. */
const PAGE_CHARACTERS = 3_000_000;

/** An answer that isn't what was asked for: a server's error, or something else. */
export class LookupError extends Error {}

/** Asks for `url` (as lines, in the apps), giving up after a while or once `signal` aborts. */
export async function request(url: string, signal: AbortSignal, init: RequestInit = {}): Promise<Response> {
  const fetch = await webFetch();
  const headers = { ...(init.headers as Record<string, string>), ...(isTauri && { "user-agent": CLIENT }) };
  return fetch(url, { ...init, headers, signal: withTimeout(signal, TIMEOUT) });
}

/** What a service answers in JSON; null if it has nothing there (404). Rejects offline, or on any other error. */
export async function getJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  const response = await request(url, signal, { headers: { accept: "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new LookupError(`${new URL(url).hostname} answered ${response.status}`);
  return (await response.json()) as T;
}

/** What a page says about itself (page.ts); null if it isn't a page (an image, a PDF) or isn't there. */
export async function getPage(url: string, signal: AbortSignal): Promise<Page | null> {
  const response = await request(url, signal, { headers: { accept: "text/html,application/xhtml+xml" } });
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) throw new LookupError(`${new URL(url).hostname} answered ${response.status}`);
  if (!/html/i.test(response.headers.get("content-type") ?? "text/html")) return null;
  const html = await response.text();
  return readPage(html.slice(0, PAGE_CHARACTERS), response.url || url);
}

/**
 * What the page at `url` says of itself in a few words, for a link shown with none of its own (a
 * feed's post that's only a link, as Hacker News' are): its description, and its picture where
 * it's one to ask. Null when it says neither.
 */
export async function pageSummary(url: string, signal: AbortSignal): Promise<{ description?: string; image?: string } | null> {
  const page = await getPage(url, signal);
  if (!page) return null;
  const said = (...keys: string[]) => keys.map((key) => page.meta.get(key)?.trim()).find(Boolean);
  const description = said("og:description", "twitter:description", "description");
  const picture = said("og:image", "og:image:url", "twitter:image");
  const image = picture && absolute(picture, page.url);
  return description || image ? { description, image: image && isPublic(image) ? image : undefined } : null;
}

/** Whether lines reads what pages say of themselves: while Web Pages is on, which it can be only in the apps. */
export const readsPages = () => plugins.librarySources.some((source) => source.id === "web-pages");

/**
 * What a page says about itself, for what only its page adds to what a source found: in the apps
 * (web pages can't read other sites'), and nothing if it can't be read. Rejects only once `signal` aborts.
 */
export async function pageInApps(url: string, signal: AbortSignal): Promise<Page | null> {
  if (!isTauri) return null;
  return getPage(url, signal).catch(() => {
    signal.throwIfAborted();
    return null;
  });
}

/**
 * Whether an address a page gave (its picture, its oEmbed) is one to ask: on the web at large over
 * https, not this computer or the network it's on, which a page could otherwise have the apps ask.
 */
export function isPublic(address: string): boolean {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  // A name with a dot in it (not `localhost`, nor an IPv6 address, `[::1]`) that isn't a local network's.
  if (url.protocol !== "https:" || !/^[^[\]]+\.[^.]+$/.test(host) || /\.(?:local|localhost|internal|home|lan)$/.test(host)) return false;
  const ipv4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host);
  if (!ipv4) return true;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  return !(a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127));
}
