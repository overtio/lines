import { request } from "../../lib/library/web";
import { pause } from "../../lib/pacing";
import type { ExportBook, ReaderDocument } from "./sources";

/*
 * Asking Readwise for everything, with the access token the person made at
 * readwise.io/access_token: sent to readwise.io and nowhere else, and kept by no one but the caller.
 * Readwise's export gives every highlight, a page of sources at a time; Reader's list every document
 * saved there, a hundred at a time, no more than 20 times a minute (its limit), and not those in its
 * Feed, which lines' Feeds has from Reader's OPML. Readwise answers web pages too (it allows any
 * origin), so this works on the web as in the apps.
 */

const API = "https://readwise.io/api";
/** How long a page may take, downloaded: an export's can be big. */
const TIMEOUT = 120_000;
/** How many times a page is asked again: when Readwise says to wait, fails (5xx), or can't be reached. */
const RETRIES = 5;
/** How long to wait before asking again the first time, then twice as long each time. */
const BACKOFF = 2_000;
/** How many times a minute Reader's list may be asked. */
const READER_LIMIT = 20;
/** Where Reader keeps what was saved: its inbox, Later, Shortlist and Archive. */
const LOCATIONS = ["new", "later", "shortlist", "archive"];

/** Why Readwise couldn't be asked: the token wasn't taken, it answered something else, or it couldn't be reached. */
export class ReadwiseError extends Error {
  constructor(
    readonly reason: "token" | "status" | "offline",
    readonly status?: number,
  ) {
    super(reason === "token" ? "Readwise didn't accept the token" : reason === "status" ? `Readwise answered ${status}` : "Readwise couldn't be reached");
  }
}

/** How it's going: pages fetched so far, and how long Readwise asked to wait, if it did. */
export interface Progress {
  pages: number;
  waiting?: number;
}

/** A turn to ask, which waits as long as it must. */
type Turn = (signal: AbortSignal) => Promise<void>;

/** Waits, if need be, so that no more than `limit` requests are made in any minute. */
function perMinute(limit: number): Turn {
  const made: number[] = [];
  return async (signal) => {
    if (made.length === limit) await pause(made.shift()! + 60_000 - Date.now(), signal);
    made.push(Date.now());
  };
}

/**
 * Readwise's answer to `url` (its JSON, with `json`), asked again (each time in its `turn`) when it
 * says to wait (429, as long as it says, which a web page can't always read), fails (5xx), or can't
 * be reached or takes too long; a while longer each time.
 */
async function get<T>(token: string, url: string, signal: AbortSignal, { json = true, turn, onWait }: { json?: boolean; turn?: Turn; onWait?: (seconds: number) => void } = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await turn?.(signal);
    let wait = BACKOFF * 2 ** attempt;
    try {
      const response = await request(url, signal, { headers: { authorization: `Token ${token}`, accept: "application/json" } }, TIMEOUT);
      if (response.status === 401 || response.status === 403) throw new ReadwiseError("token");
      if (response.ok) return (json ? await response.json() : undefined) as T;
      if (response.status !== 429 && response.status < 500) throw new ReadwiseError("status", response.status);
      if (attempt === RETRIES) throw new ReadwiseError("status", response.status);
      wait = Math.max(wait, Number(response.headers.get("retry-after")) * 1000 || 0);
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof ReadwiseError) throw error;
      // Not reached, or too slow: offline, or a page cut short.
      if (attempt === RETRIES) throw new ReadwiseError("offline");
    }
    onWait?.(Math.ceil(wait / 1000));
    await pause(wait, signal);
  }
}

/** Rejects with a ReadwiseError unless Readwise takes the token. */
export const checkToken = (token: string, signal: AbortSignal) => get<void>(token, `${API}/v2/auth/`, signal, { json: false });

/** Everything in Readwise and Reader: the export's sources of highlights, and Reader's documents saved (not its Feed). */
export async function fetchAll(token: string, signal: AbortSignal, onProgress: (progress: Progress) => void) {
  let fetched = 0;
  /** Every page of a list, following its cursor (once each: one seen again ends it), each request in its `turn`. */
  async function all<T>(address: string, turn?: Turn): Promise<T[]> {
    const results: T[] = [];
    const seen = new Set<string>();
    let cursor: string | null = null;
    do {
      const url = new URL(address);
      if (cursor) url.searchParams.set("pageCursor", cursor);
      const page = await get<{ results?: T[]; nextPageCursor?: string | null }>(token, url.href, signal, { turn, onWait: (waiting) => onProgress({ pages: fetched, waiting }) });
      results.push(...(page.results ?? []));
      if (cursor) seen.add(cursor);
      cursor = page.nextPageCursor && !seen.has(page.nextPageCursor) ? page.nextPageCursor : null;
      onProgress({ pages: ++fetched });
    } while (cursor);
    return results;
  }
  const books = await all<ExportBook>(`${API}/v2/export/`);
  const documents: ReaderDocument[] = [];
  const reader = perMinute(READER_LIMIT);
  for (const location of LOCATIONS) documents.push(...(await all<ReaderDocument>(`${API}/v3/list/?location=${location}`, reader)));
  return { books, documents };
}
