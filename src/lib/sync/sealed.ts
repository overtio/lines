import {
  fromBase64,
  fromUtf8,
  hmac,
  isLockedKey,
  open,
  seal,
  subkey,
  toBase64,
  toHex,
  Unreadable,
  utf8,
  type Bytes,
  type LockedKey,
} from "../crypto";
import { t } from "../i18n/index.svelte";
import { SyncError, type Remote, type RemoteObject } from "./remote";

/*
 * End-to-end encrypted sync. Notes and attachments are encrypted on the device before they're
 * uploaded, with a random library key that only the passphrase unlocks, so the bucket or drive
 * only ever holds what it can't read:
 *
 *   encryption.json              the library key, locked with the passphrase
 *   notes/<id>.enc               a note, encrypted (base64 text)
 *   attachments/<name>.enc       an attachment, encrypted; named by a keyed hash, so not even
 *                                its content hash or type shows
 *
 * Each device unlocks the library key once and keeps it. Note ids are random, so they stay as
 * they are. What does show: how many notes and attachments there are, their sizes, and when
 * they change.
 */

export const KEY_FILE = "encryption.json";
export const SEALED = ".enc";

/** `encryption.json`, as stored in the bucket or folder. */
export interface KeyFile extends LockedKey {
  format: "lines-encryption";
  version: 1;
  /** Changes only when encryption is set up anew, so devices can tell. */
  id: string;
}

/** What a device keeps once it has unlocked a library. */
export interface LibraryKey {
  id: string;
  /** The library key itself, base64. */
  key: string;
}

export async function readKeyFile(store: Remote, root: string): Promise<KeyFile | null> {
  const file = await store.get(root + KEY_FILE);
  if (!file) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.text);
  } catch {
    parsed = null;
  }
  const key = parsed as KeyFile | null;
  if (!isLockedKey(key) || key.format !== "lines-encryption" || typeof key.id !== "string") {
    throw new SyncError(t("sync.error.keyFileDamaged", { file: KEY_FILE }));
  }
  return key;
}

export async function writeKeyFile(store: Remote, root: string, file: KeyFile) {
  await store.put(root + KEY_FILE, JSON.stringify(file, null, 2) + "\n");
}

/** A remote seen through encryption: callers use plain keys and contents; the store gets neither. */
export class SealedRemote implements Remote {
  private constructor(
    private store: Remote,
    private root: string,
    private content: CryptoKey,
    private names: CryptoKey,
  ) {}

  static async open(store: Remote, root: string, library: LibraryKey) {
    const raw = fromBase64(library.key);
    const [content, names] = await Promise.all([
      subkey(raw, "lines sync content v1", "AES-GCM"),
      subkey(raw, "lines sync names v1", "HMAC"),
    ]);
    return new SealedRemote(store, root, content, names);
  }

  /** What a key is, without the folder it's in, as sealed with the data: `notes/<id>.md`. */
  #context(key: string) {
    return key.startsWith(this.root) ? key.slice(this.root.length) : key;
  }

  /** Notes keep their id (`notes/<id>.md` → `notes/<id>.enc`); attachments get a keyed hash. */
  async fileKey(key: string): Promise<string> {
    const slash = key.lastIndexOf("/");
    const [dir, name] = [key.slice(0, slash + 1), key.slice(slash + 1)];
    // Only notes: an attached .md file's name is its content hash, which stays hidden.
    if (this.#context(dir) === "notes/" && name.endsWith(".md")) return dir + name.slice(0, -".md".length) + SEALED;
    return dir + toHex((await hmac(this.names, this.#context(key))).subarray(0, 16)) + SEALED;
  }

  async #open(data: Bytes, key: string) {
    try {
      return await open(this.content, data, this.#context(key));
    } catch (error) {
      if (error instanceof Unreadable) {
        throw new SyncError(t("sync.error.undecryptable", { file: this.#context(key) }));
      }
      throw error;
    }
  }

  /** What's stored, under the stored keys: `fileKey` says which one a plain key is. */
  async list(prefix: string): Promise<RemoteObject[]> {
    return (await this.store.list(prefix)).filter((object) => object.key.endsWith(SEALED));
  }

  /** A drive's copy of a note is still sealed with the note's name, `writtenAs`. */
  async get(key: string, writtenAs = key) {
    return this.#read(await this.fileKey(key), writtenAs);
  }

  /** A drive's copy of a file whose name is hidden, stored as `stored`: sealed with the file's name, `key`. */
  getCopy(stored: string, key: string) {
    return this.#read(stored, key);
  }

  async #read(stored: string, writtenAs: string) {
    const object = await this.store.get(stored);
    if (!object) return null;
    let data: Bytes;
    try {
      data = fromBase64(object.text);
    } catch {
      throw new SyncError(t("sync.error.notSealed", { file: this.#context(writtenAs) }));
    }
    return { text: fromUtf8(await this.#open(data, writtenAs)), etag: object.etag };
  }

  async put(key: string, text: string, expected?: string | null) {
    return this.store.put(await this.fileKey(key), toBase64(await seal(this.content, utf8(text), this.#context(key))), expected);
  }

  async delete(key: string) {
    await this.store.delete(await this.fileKey(key));
  }

  async getFile(key: string) {
    const data = await this.store.getFile(await this.fileKey(key));
    return data && new Blob([await this.#open(new Uint8Array(await data.arrayBuffer()), key)]);
  }

  async putFile(key: string, data: Blob) {
    const sealed = await seal(this.content, new Uint8Array(await data.arrayBuffer()), this.#context(key));
    await this.store.putFile(await this.fileKey(key), new Blob([sealed]));
  }
}
