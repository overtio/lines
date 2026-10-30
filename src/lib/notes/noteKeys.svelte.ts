import { aesKey, fromBase64, fromUtf8, isLockedKey, lockKey, open, randomBytes, seal, toBase64, unlockKey, utf8, WrongPassphrase, type Bytes } from "../crypto";
import { t } from "../i18n/index.svelte";
import { referencedAttachments } from "./attachments";
import { computeMeta } from "./parse";
import type { Note, NoteLock, WrappedKey } from "./types";

/*
 * Keys for locked notes. A locked note's Markdown is encrypted with a random key, and the note
 * carries that key locked with the password (see `NoteLock`), so it opens on any device where
 * the password is typed, synced or not, encrypted sync or not. Notes locked with one password
 * share one key; changing the password locks that same key again, in every note that has it.
 *
 * Keys only live in memory, and only while locked notes are open (see locked.svelte.ts).
 */

const SETTINGS = "lines.lockedNotes";
/** Authenticated with every locked note, so nothing else encrypted with the key passes for one. */
const CONTEXT = "lines locked note";

/** This device's password for locked notes: the key it locks notes with. */
export interface NotesPassword {
  key: WrappedKey;
  /** Touch ID opens locked notes too (the Mac app). */
  touchId: boolean;
}

export function isWrappedKey(value: unknown): value is WrappedKey {
  const v = value as WrappedKey | null;
  return isLockedKey(v) && typeof v.id === "string" && typeof v.changed === "number";
}

function read(): NotesPassword | null {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS) ?? "null");
    return isWrappedKey(settings?.key) ? { touchId: false, ...settings } : null;
  } catch {
    return null;
  }
}

class NoteKeys {
  settings = $state.raw<NotesPassword | null>(read());
  /** Bumped as keys open and close. */
  revision = $state(0);
  #open = new Map<string, { key: CryptoKey; raw: Bytes }>();
  /** The newest wrapping of each key seen in notes, which may have come from another device. */
  #seen = new Map<string, WrappedKey>();

  isOpen(id: string) {
    void this.revision;
    return this.#open.has(id);
  }

  get anyOpen() {
    void this.revision;
    return this.#open.size > 0;
  }

  /** Whether this device's own key is open, so notes can be locked right away. */
  get ready() {
    return !!this.settings && this.isOpen(this.settings.key.id);
  }

  /** Whether there's a password to ask for: this device's, or one notes synced here were locked with. */
  get known() {
    void this.revision;
    return !!this.settings || this.#seen.size > 0;
  }

  /** Reads the settings again, once another window changed them (the main window, for Settings). */
  refresh() {
    this.settings = read();
  }

  save(settings: NotesPassword | null) {
    this.settings = settings;
    if (settings) localStorage.setItem(SETTINGS, JSON.stringify(settings));
    else localStorage.removeItem(SETTINGS);
  }

  /** Keeps track of a locked note's key, picking up a password changed on another device. */
  notice(note: Note) {
    const key = note.locked?.key;
    if (!key) return;
    const seen = this.#seen.get(key.id);
    if (!seen || key.changed > seen.changed) {
      this.#seen.set(key.id, key);
      if (!seen) this.revision++;
    }
    if (this.settings?.key.id === key.id && key.changed > this.settings.key.changed) this.save({ ...this.settings, key });
  }

  /** The newest wrapping of a key, which the newest password opens. */
  newest(id: string): WrappedKey | undefined {
    const own = this.settings?.key.id === id ? this.settings.key : undefined;
    const seen = this.#seen.get(id);
    return own && seen ? (seen.changed > own.changed ? seen : own) : (own ?? seen);
  }

  async add(raw: Bytes, id: string) {
    this.#open.set(id, { key: await aesKey(raw), raw });
    this.revision++;
  }

  clear() {
    if (!this.#open.size) return;
    for (const { raw } of this.#open.values()) raw.fill(0);
    this.#open.clear();
    this.revision++;
  }

  raw(id: string) {
    return this.#open.get(id)?.raw;
  }

  /** The open keys, to hand to the app's other windows. */
  shared() {
    return [...this.#open].map(([id, { raw }]) => ({ id, raw: toBase64(raw) }));
  }

  /** Opens every key the password opens; the ids it opened. */
  async unlock(password: string): Promise<string[]> {
    const ids = new Set([...(this.settings ? [this.settings.key.id] : []), ...this.#seen.keys()]);
    const opened: string[] = [];
    for (const id of ids) {
      if (this.#open.has(id)) continue;
      const wrapped = this.newest(id)!;
      try {
        await this.add(await unlockKey(wrapped, password), id);
        opened.push(id);
      } catch (error) {
        if (!(error instanceof WrongPassphrase)) throw error;
      }
    }
    // A device without a password of its own takes the one it was just given, for notes it locks.
    if (!this.settings && opened.length) {
      const newest = opened.map((id) => this.newest(id)!).sort((a, b) => b.changed - a.changed)[0];
      this.save({ key: newest, touchId: false });
    }
    return opened;
  }

  /** A new key, locked with `password`, and open. */
  async create(password: string): Promise<{ raw: Bytes; key: WrappedKey }> {
    const raw = randomBytes(32);
    const key: WrappedKey = { id: crypto.randomUUID(), changed: Date.now(), ...(await lockKey(raw, password)) };
    await this.add(raw, key.id);
    return { raw: raw.slice(), key };
  }

  /** Locks an open key with a new password. */
  async rewrap(id: string, password: string): Promise<WrappedKey> {
    const raw = this.#open.get(id)?.raw;
    if (!raw) throw new Error(t("lock.notes.notOpen"));
    const key: WrappedKey = { id, changed: Date.now(), ...(await lockKey(raw, password)) };
    this.#seen.set(id, key);
    return key;
  }

  /** Encrypts an open note's Markdown, and what the list shows of it. */
  async seal(note: Note): Promise<NoteLock> {
    const lock = note.locked!;
    const open = this.#open.get(lock.key.id);
    if (!open) throw new Error(t("lock.notes.notOpen"));
    return {
      ...lock,
      key: this.newest(lock.key.id) ?? lock.key,
      title: computeMeta(note.body, note.format).title,
      files: [...referencedAttachments([note.body])],
      sealed: toBase64(await seal(open.key, utf8(note.body), CONTEXT)),
    };
  }

  /** A locked note's Markdown, if its key is open. */
  async open(lock: NoteLock): Promise<string | null> {
    const open = this.#open.get(lock.key.id);
    if (!open || !lock.sealed) return null;
    return fromUtf8(await openSealed(open.key, lock.sealed));
  }
}

const openSealed = (key: CryptoKey, sealed: string) => open(key, fromBase64(sealed), CONTEXT);

export const noteKeys = new NoteKeys();
