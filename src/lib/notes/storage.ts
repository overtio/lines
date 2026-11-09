import { fromUtf8, utf8 } from "../crypto";
import type { IconName } from "../icons/icons";
import { isSealed, openRecord, sealRecord, vault, type Sealed } from "../lock/vault";
import type { Note } from "./types";

/**
 * Where notes are persisted on this device. The web build uses IndexedDB;
 * native builds can swap in a file-system backed implementation without
 * touching the UI. Remote backends sync on top of this (see `sync/`).
 */
export interface NoteStorage {
  all(): Promise<Note[]>;
  get(id: string): Promise<Note | undefined>;
  /** Stores these notes together. */
  put(...notes: Note[]): Promise<void>;
  delete(...ids: string[]): Promise<void>;
}

const DB_NAME = "lines";
const NOTES = "notes";
const SYNC = "sync";
const ATTACHMENTS = "attachments";

export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Resolves once the transaction has committed, not just when its requests succeeded. */
export function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

let db: Promise<IDBDatabase> | undefined;

function openDB() {
  db ??= new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 3);
    open.onupgradeneeded = () => {
      const names = open.result.objectStoreNames;
      if (!names.contains(NOTES)) open.result.createObjectStore(NOTES, { keyPath: "id" });
      if (!names.contains(SYNC)) open.result.createObjectStore(SYNC, { keyPath: "id" });
      if (!names.contains(ATTACHMENTS)) open.result.createObjectStore(ATTACHMENTS, { keyPath: "id" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  return db;
}

class ObjectStore<T extends { id: string }> {
  constructor(private name: string) {}

  async #store(mode: IDBTransactionMode) {
    return (await openDB()).transaction(this.name, mode).objectStore(this.name);
  }

  async all() {
    return request((await this.#store("readonly")).getAll() as IDBRequest<T[]>);
  }

  async get(id: string) {
    return request((await this.#store("readonly")).get(id) as IDBRequest<T | undefined>);
  }

  async ids() {
    return request((await this.#store("readonly")).getAllKeys() as IDBRequest<string[]>);
  }

  async #write(change: (store: IDBObjectStore) => void) {
    const tx = (await openDB()).transaction(this.name, "readwrite");
    change(tx.objectStore(this.name));
    await committed(tx);
  }

  put(...values: T[]) {
    return this.#write((store) => values.forEach((value) => store.put(value)));
  }

  delete(...ids: string[]) {
    return this.#write((store) => ids.forEach((id) => store.delete(id)));
  }

  clear() {
    return this.#write((store) => store.clear());
  }
}

/** Notes, encrypted while the app lock is on (see lock/vault.ts). */
export class IndexedDBStorage implements NoteStorage {
  #store = new ObjectStore<Note | Sealed>(NOTES);

  async #open(value: Note | Sealed): Promise<Note> {
    return isSealed(value) ? JSON.parse(fromUtf8(await openRecord(NOTES, value))) : value;
  }

  async all() {
    return Promise.all((await this.#store.all()).map((value) => this.#open(value)));
  }

  async get(id: string) {
    const value = await this.#store.get(id);
    return value && this.#open(value);
  }

  async put(...notes: Note[]) {
    const seal = (note: Note) => sealRecord(NOTES, note.id, utf8(JSON.stringify(note)));
    await this.#store.put(...(vault.sealing ? await Promise.all(notes.map(seal)) : notes));
  }

  delete(...ids: string[]) {
    return this.#store.delete(...ids);
  }

  /** Writes every note again, encrypted or not as the lock now says. */
  async rewrite() {
    for (const id of await this.#store.ids()) {
      const note = await this.get(id);
      if (note) await this.put(note);
    }
  }
}

/** What we last exchanged with the remote for a note. */
export interface SyncRecord {
  id: string;
  /** ETag of the remote object when we last uploaded or downloaded it. */
  etag: string | null;
  /** Hash of the serialized note at that moment; differs once edited locally. */
  hash: string;
  /**
   * Its text (with its format and lock) hashed, and its pin, trash and icon, as they were then: to
   * tell which side changed what since. Records kept before lines did this don't have them.
   */
  text?: string;
  pinned?: boolean;
  trashed?: boolean;
  icon?: IconName;
}

export const syncRecords = new ObjectStore<SyncRecord>(SYNC);

/** A file a note shows, such as a pasted image. Named after its content, so it never changes. */
export interface Attachment {
  /** `<hash>.<ext>` */
  id: string;
  data: Blob;
}

/** Encrypted while the app lock is on; notes/attachments.ts reads and writes both forms. */
export const attachmentStore = new ObjectStore<Attachment | Sealed>(ATTACHMENTS);
