import type { Feed, Post } from "./parse";

/*
 * What's kept of a feed's posts on this device: the newest KEEP, each with whether it was read.
 * Their content is kept apart (storage.ts), each under a random key of its post's own.
 */

/** How many of a feed's posts are kept, the newest. */
export const KEEP = 200;

/** A post as it's kept: all but its content, which is stored under `key`. */
export interface KeptPost extends Omit<Post, "html"> {
  key: string;
  /** Its content's fingerprint, to tell when it changed. */
  version: string;
  read: boolean;
  /** When it was first seen here: its place among posts with no date. */
  seen: number;
}

/** What's kept of a feed: what it said of itself last time, its posts, and how its fetching went. */
export interface FeedRecord extends Omit<Feed, "posts"> {
  /** What it's stored under: random, so it says nothing of the feed. */
  id: string;
  /** The feed's address, as its subscription says. */
  url: string;
  posts: KeptPost[];
  etag?: string;
  lastModified?: string;
  /** When it was last fetched, or tried. */
  checked?: number;
  /** Why the last try failed, if it did. */
  error?: string;
  /** How many tries in a row have failed. */
  failures?: number;
  /** Not to be asked again before then: as it said (429, 503), or after failing again and again. */
  retryAt?: number;
  /** It said it's gone for good (410): not asked again unless asked to. */
  gone?: boolean;
  /** When a picture was last asked for its subscriptions' notes, which had none (feeds.svelte.ts). */
  artTried?: number;
}

/** A short fingerprint of some text (FNV-1a): enough to tell a post's content changed. */
export function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(36) + text.length.toString(36);
}

/** Newest first: by date, and those with none by when they were seen. */
export const newestFirst = (a: KeptPost, b: KeptPost) => (b.date ?? b.seen) - (a.date ?? a.seen);

/**
 * A feed's posts once it's been fetched again: those it lists now, as they are now, and those it
 * no longer lists, newest first, KEEP of them. Each keeps its key and whether it was read; a new one
 * is unread, under a new key (`newKey`). Also the content to store (new or changed, by key), and the
 * keys of posts that went, to delete.
 */
export function merge(kept: readonly KeptPost[], fetched: readonly Post[], now: number, newKey: () => string = () => crypto.randomUUID()) {
  const before = new Map(kept.map((post) => [post.id, post]));
  const listed = new Set<string>();
  const changed: { key: string; html: string }[] = [];
  const posts: KeptPost[] = fetched.map(({ html, ...post }, i) => {
    listed.add(post.id);
    const was = before.get(post.id);
    const key = was?.key ?? newKey();
    const version = fingerprint(html);
    if (was?.version !== version) changed.push({ key, html });
    // Posts with no date keep the feed's order: its first is the newest.
    return { ...post, key, version, read: was?.read ?? false, seen: was?.seen ?? now - i };
  });
  posts.push(...kept.filter((post) => !listed.has(post.id)));
  posts.sort(newestFirst);
  const dropped = posts.splice(KEEP).map((post) => post.key);
  const keptKeys = new Set(posts.map((post) => post.key));
  return { posts, changed: changed.filter((content) => keptKeys.has(content.key)), dropped };
}

export const DAY = 86_400_000;

/** How long to wait after `failures` tries in a row have failed: twice as long each time, from `every`, up to a day. */
export const backoff = (failures: number, every: number) => Math.min(DAY, every * 2 ** Math.max(0, failures - 1));
