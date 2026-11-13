import { isTauri, webFetch } from "../platform";
import { REPO, VERSION } from "../release";

/*
 * Fetching a feed, or a page that may say where its feed is, politely: asking whether it changed
 * since the last time (its ETag and Last-Modified), and giving up on one that takes too long.
 */

/** What a feed said of its version last time, to ask whether it changed since. */
export interface Validators {
  etag?: string;
  lastModified?: string;
}

export type Response =
  | { changed: false }
  | {
      changed: true;
      text: string;
      /** Where it was found, after redirects. */
      url: string;
      type: string;
      validators: Validators;
    };

export class FetchError extends Error {
  constructor(
    message: string,
    /** The HTTP status it answered with, if it answered. */
    readonly status?: number,
    /** When it said to ask again, if it did (429, 503). */
    readonly retryAt?: number,
  ) {
    super(message);
  }
}

/** Feeds bigger than this aren't read: a podcast's whole history is a few megabytes at most. */
const MAX_BYTES = 30 * 1024 * 1024;
const TIMEOUT = 30_000;
/** How the apps introduce themselves: lines and where it's from, nothing about whoever uses it. */
const USER_AGENT = `lines/${VERSION} (+${REPO})`;

/** The text's encoding: its byte order mark's, its XML declaration's, the server's, else UTF-8. */
export function encodingOf(bytes: Uint8Array, contentType: string): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8";
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 200));
  const declared = /^<\?xml[^>]*encoding=["']([\w.:-]+)["']/i.exec(head)?.[1] ?? /charset=["']?([\w.:-]+)/i.exec(contentType)?.[1];
  if (!declared) return "utf-8";
  try {
    return new TextDecoder(declared).encoding;
  } catch {
    return "utf-8";
  }
}

/**
 * Fetches `url`, unless it hasn't changed since `validators` (in the apps, which ask; browsers ask
 * by themselves, from what they've kept). Throws FetchError if it can't be, or answers with an error.
 */
export async function fetchFeed(url: string, validators: Validators = {}, signal?: AbortSignal): Promise<Response> {
  const fetch = await webFetch();
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(new FetchError("timeout")), TIMEOUT);
  const abort = () => timeout.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    // Headers of a page's own would make the browser ask the site's leave first (CORS), which few feeds give.
    const headers: Record<string, string> = isTauri
      ? {
          "User-Agent": USER_AGENT,
          Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.8, */*;q=0.5",
          ...(validators.etag && { "If-None-Match": validators.etag }),
          ...(validators.lastModified && { "If-Modified-Since": validators.lastModified }),
        }
      : {};
    let response: globalThis.Response;
    try {
      response = await fetch(url, { headers, signal: timeout.signal, ...(!isTauri && { cache: "no-cache" as const }) });
    } catch (error) {
      if (timeout.signal.aborted) throw timeout.signal.reason;
      // In a browser, a site that doesn't let web pages read it fails just as one that isn't there.
      throw new FetchError(isTauri ? String(error) : "blocked");
    }
    const etag = response.headers.get("etag") ?? undefined;
    if (response.status === 304 || (etag && etag === validators.etag)) return { changed: false };
    if (!response.ok) {
      const after = response.headers.get("retry-after");
      const seconds = Number(after);
      const retryAt = after ? (Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(after) || undefined) : undefined;
      throw new FetchError(`HTTP ${response.status}`, response.status, retryAt);
    }
    if (Number(response.headers.get("content-length")) > MAX_BYTES) throw new FetchError("too big");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw new FetchError("too big");
    const type = response.headers.get("content-type") ?? "";
    return {
      changed: true,
      text: new TextDecoder(encodingOf(bytes, type)).decode(bytes),
      url: response.url || url,
      type,
      validators: { etag, lastModified: response.headers.get("last-modified") ?? undefined },
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
