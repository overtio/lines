import { fromUtf8, toHex, utf8 } from "../crypto";
import { isSealed, openRecord, sealRecord, vault, type Sealed } from "../lock/vault";
import { database, ObjectStore } from "../notes/storage";
import type { FeedRecord } from "./posts";

/*
 * Feeds' posts on this device, in a database of their own (`lines-feeds`): a record for each feed
 * (what it said of itself, its posts but their content, which were read), and each post's content
 * apart, read when it's opened. Each is stored under a hash of what it is, and with the app lock on,
 * encrypted like notes (lock/vault.ts), so nothing kept says what's subscribed to or read.
 */

export const FEEDS_DB = "lines-feeds";
const FEEDS = "feeds";
const POSTS = "posts";

interface Content {
  id: string;
  html: string;
}

const open = database(FEEDS_DB, 1, [FEEDS, POSTS]);
const feedStore = new ObjectStore<(FeedRecord & { id: string }) | Sealed>(FEEDS, open);
const postStore = new ObjectStore<Content | Sealed>(POSTS, open);

/** What something is stored under: a hash of it, which says nothing of it. */
export async function storageKey(text: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", utf8(text)))).slice(0, 32);
}

async function seal<T extends { id: string }>(store: string, value: T): Promise<T | Sealed> {
  return vault.sealing ? sealRecord(store, value.id, utf8(JSON.stringify(value))) : value;
}

async function unseal<T>(store: string, value: T | Sealed): Promise<T> {
  return isSealed(value as object) ? JSON.parse(fromUtf8(await openRecord(store, value as Sealed))) : (value as T);
}

export const feedStorage = {
  /** Every feed kept. */
  all(): Promise<FeedRecord[]> {
    return feedStore.all().then((values) => Promise.all(values.map((value) => unseal<FeedRecord>(FEEDS, value))));
  },

  async put(record: FeedRecord) {
    await feedStore.put(await seal(FEEDS, { ...record, id: await storageKey(record.url) }));
  },

  /** A post's content, by its key. */
  async content(key: string): Promise<string | undefined> {
    const value = await postStore.get(key);
    return value && (await unseal<Content>(POSTS, value)).html;
  },

  async putContents(contents: Content[]) {
    if (contents.length) await postStore.put(...(await Promise.all(contents.map((content) => seal(POSTS, content)))));
  },

  deleteContents(keys: string[]) {
    return keys.length ? postStore.delete(...keys) : Promise.resolve();
  },

  /** A feed and its posts, gone. */
  async delete(record: FeedRecord) {
    await this.deleteContents(record.posts.map((post) => post.key));
    await feedStore.delete(await storageKey(record.url));
  },

  /** Writes everything again, encrypted or not as the app lock now says. */
  async rewrite() {
    const stores = [
      [FEEDS, feedStore],
      [POSTS, postStore],
    ] as [string, ObjectStore<{ id: string } | Sealed>][];
    for (const [name, store] of stores) {
      for (const id of await store.ids()) {
        const value = await store.get(id);
        if (value) await store.put(await seal(name, await unseal<{ id: string }>(name, value)));
      }
    }
  },
};
