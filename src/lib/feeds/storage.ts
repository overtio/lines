import { fromUtf8, utf8 } from "../crypto";
import { isSealed, openRecord, sealRecord, vault, type Sealed } from "../lock/vault";
import { database, ObjectStore } from "../notes/storage";
import type { Episode } from "../player/player.svelte";
import type { BookPlace } from "../plugins/types";
import type { FeedMarks } from "./marks";
import type { FeedRecord } from "./posts";

/*
 * Feeds' posts on this device, in a database of their own (`lines-feeds`): a record for each feed
 * (what it said of itself, its posts but their content, which were read and dismissed), each post's
 * content apart, read when it's opened, each feed's marks as they sync (marks.ts), where each
 * episode was stopped, with the one in the player (player/player.svelte.ts), and where each book was
 * left (books/reading.svelte.ts). Each is stored under a random id, and with the app lock on,
 * encrypted like notes (lock/vault.ts), so nothing kept says what's subscribed to, read or listened to.
 */

export const FEEDS_DB = "lines-feeds";
const FEEDS = "feeds";
const POSTS = "posts";
const POSITIONS = "positions";
const MARKS = "marks";

interface Content {
  id: string;
  html: string;
}

/** A feed's marks (marks.ts). */
export interface MarksRecord {
  id: string;
  feed: string;
  marks: FeedMarks;
}

/** Where an episode was stopped, by its key (its post's, or its note's id). */
export interface Position {
  id: string;
  /** In seconds. */
  at: number;
  /** It was listened to the end. */
  played: boolean;
  duration?: number;
}

/** The episode in the player, kept among the positions under an id no key is. */
const IN_PLAYER = "in-player";
interface InPlayer {
  id: typeof IN_PLAYER;
  episode: Episode;
}

/** Where a book kept with a note was left (books/reading.svelte.ts), by the note's id, kept among the positions. */
export interface BookPosition {
  id: string;
  /** The book's file, its attachment's name: a note with another file starts that one at its start. */
  book: string;
  place: BookPlace;
  /** How far it's been read, 0 to 1: pages turned, not places gone to. */
  furthest: number;
}

const isBook = (value: Position | InPlayer | BookPosition): value is BookPosition => "book" in value;

const open = database(FEEDS_DB, 3, [FEEDS, POSTS, POSITIONS, MARKS]);
const feedStore = new ObjectStore<FeedRecord | Sealed>(FEEDS, open);
const postStore = new ObjectStore<Content | Sealed>(POSTS, open);
const positionStore = new ObjectStore<Position | InPlayer | BookPosition | Sealed>(POSITIONS, open);
const markStore = new ObjectStore<MarksRecord | Sealed>(MARKS, open);

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
    await feedStore.put(await seal(FEEDS, record));
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
    await feedStore.delete(record.id);
  },

  /** Every feed's marks. */
  async marks(): Promise<MarksRecord[]> {
    return Promise.all((await markStore.all()).map((value) => unseal<MarksRecord>(MARKS, value)));
  },

  async putMarks(record: MarksRecord) {
    await markStore.put(await seal(MARKS, record));
  },

  deleteMarks(id: string) {
    return markStore.delete(id);
  },

  /** Where each episode was stopped, and the one that was in the player, if one was. */
  async positions(): Promise<{ positions: Position[]; inPlayer?: Episode; books: BookPosition[] }> {
    const all = await Promise.all((await positionStore.all()).map((value) => unseal<Position | InPlayer | BookPosition>(POSITIONS, value)));
    const inPlayer = all.find((each): each is InPlayer => each.id === IN_PLAYER);
    return { positions: all.filter((each): each is Position => each !== inPlayer && !isBook(each)), inPlayer: inPlayer?.episode, books: all.filter(isBook) };
  },

  async putPosition(position: Position | BookPosition) {
    await positionStore.put(await seal(POSITIONS, position));
  },

  /** Keeps which episode is in the player (none, once it's closed). */
  async putInPlayer(episode: Episode | null) {
    if (episode) await positionStore.put(await seal(POSITIONS, { id: IN_PLAYER, episode }));
    else await positionStore.delete(IN_PLAYER);
  },

  /** Writes everything again, encrypted or not as the app lock now says. */
  async rewrite() {
    const stores = [
      [FEEDS, feedStore],
      [POSTS, postStore],
      [POSITIONS, positionStore],
      [MARKS, markStore],
    ] as [string, ObjectStore<{ id: string } | Sealed>][];
    for (const [name, store] of stores) {
      for (const id of await store.ids()) {
        const value = await store.get(id);
        if (value) await store.put(await seal(name, await unseal<{ id: string }>(name, value)));
      }
    }
  },
};
