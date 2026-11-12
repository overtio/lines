import { speak } from "../a11y";
import { fromBase64, lockKey, randomBytes, toBase64, unlockKey } from "../crypto";
import { t } from "../i18n/index.svelte";
import { readSecret, writeSecret } from "../lock/vault";
import { attachmentNames, getAttachment, putAttachment, usedAttachments } from "../notes/attachments";
import { LOOKS_FILE, readLooks, writeLooks } from "../notes/looks";
import { looks } from "../notes/looks.svelte";
import { noteKeys } from "../notes/noteKeys.svelte";
import { TITLE_LINES } from "../notes/title";
import { isBlank, notes, opened } from "../notes/store.svelte";
import { syncRecords, type SyncRecord } from "../notes/storage";
import type { Note } from "../notes/types";
import { plugins } from "../plugins/registry.svelte";
import { deserialize, hash, serialize } from "./format";
import { BrowserFolderRemote, isBrowserFolder } from "./browserFolder";
import { FolderRemote } from "./folder";
import { isFolder, normalizeConfig, sameLocation, type SyncConfig } from "./providers";
import { SyncError, type Remote, type RemoteObject } from "./remote";
import { S3Remote } from "./s3";
import { KEY_FILE, readKeyFile, SEALED, SealedRemote, writeKeyFile, type KeyFile } from "./sealed";

/** The bucket or cloud folder a config points at, and where its notes and their attachments live in it. */
function place(config: SyncConfig) {
  const root = isFolder(config) ? "" : config.prefix;
  const store: Remote = !isFolder(config)
    ? new S3Remote(config)
    : isBrowserFolder(config.path)
      ? new BrowserFolderRemote(config.path)
      : new FolderRemote(config.path);
  return { store, root, dir: `${root}notes/`, attachmentDir: `${root}attachments/` };
}

/** The same, with `remote` for reading and writing notes: through encryption, if it's on. */
async function connect(config: SyncConfig) {
  const where = place(config);
  const remote = config.encryption ? await SealedRemote.open(where.store, where.root, config.encryption) : where.store;
  return { ...where, remote };
}

/*
 * Sync between this device and a bucket or cloud drive folder.
 *
 * The device stays the source of truth for the UI, so the app is instant and
 * works offline. Each pass lists the bucket and compares every note with what
 * we last exchanged (its ETag and a content hash):
 *
 *   changed here only    → upload
 *   changed there only   → download
 *   changed on both      → keep the newer edit, save the other as a "conflicted copy"
 *   deleted on one side  → delete on the other, unless the other side edited it since
 *
 * No server, no tombstones: deletions are inferred from the sync records.
 *
 * Attachments (images and files) are named after their content, so they never change: each pass uploads the ones the
 * notes here show that the remote lacks, and downloads the ones they show that this device lacks.
 *
 * Tags' and types' icons and colors are one file, `library.json`, merged choice by choice (looks.ts).
 *
 * With end-to-end encryption on (see sealed.ts), the same happens through a SealedRemote. Turning
 * it on or off rewrites the whole remote, so it's never half one and half the other for long:
 * each pass checks `encryption.json` first, and a device that doesn't match stops and says why.
 */

const CONFIG_KEY = "lines.sync";
/** Set after turning encryption off, until the encrypted copies are all removed. */
const LEFTOVERS_KEY = "lines.sync.leftovers";
const DEBOUNCE = 2_000;
const INTERVAL = 60_000;
const CONCURRENCY = 6;

export type SyncStatus = "off" | "idle" | "syncing" | "error" | "offline";

/**
 * Why sync is waiting on the person over encryption: the notes there are encrypted and this
 * device needs the passphrase (`locked`), or a new one since it was set up again elsewhere
 * (`rekeyed`), or encryption was turned off on another device (`turned-off`).
 */
export type EncryptionIssue = "locked" | "rekeyed" | "turned-off";

/** Kept with the app lock's other secrets, since it holds the storage keys (see lock/vault.ts). */
async function loadConfig(): Promise<SyncConfig | null> {
  const config = await readSecret<SyncConfig>(CONFIG_KEY);
  const fields = config?.kind === "folder" ? ["path"] : ["endpoint", "bucket", "prefix", "region", "accessKeyId", "secretAccessKey"];
  return config && fields.every((field) => typeof (config as unknown as Record<string, unknown>)[field] === "string") ? config : null;
}

const MIN_PASSPHRASE = 8;

/** Long enough to be worth having; the forms say so before it gets here. */
export function checkPassphrase(passphrase: string) {
  if (passphrase.length < MIN_PASSPHRASE) throw new SyncError(t("sync.error.tooShort", { count: MIN_PASSPHRASE }));
}

/** Runs `run` over `items` a few at a time. After a failure the rest are skipped, and it only
 * settles once every worker has stopped, so a failed pass can't overlap the next one. */
async function pool<T>(items: T[], run: (item: T) => Promise<void>) {
  const queue = [...items];
  let failed = false;
  const worker = async () => {
    for (let item = queue.shift(); item !== undefined && !failed; item = queue.shift()) {
      try {
        await run(item);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  const results = await Promise.allSettled(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;
}

/**
 * Runs `work` with no other pass running, in any of the browser's tabs: they share this device's
 * notes and sync records, so two passes at once would each make the same conflicted copy.
 */
function alone<T>(work: () => Promise<T>): Promise<T> {
  return "locks" in navigator ? navigator.locks.request("lines.sync", work) : work();
}

function conflictCopy(note: Note): Note {
  const copy = { ...note, id: crypto.randomUUID(), createdAt: Date.now(), pinned: false };
  // A locked note that isn't open can't be changed; its title can.
  if (note.locked && !note.locked.open) {
    return { ...copy, locked: { ...note.locked, title: t("sync.conflicted", { title: note.locked.title || t("sync.untitled") }) } };
  }
  return { ...copy, body: markConflicted(note), ...(note.locked ? { locked: { ...note.locked, sealed: "" } } : {}) };
}

/**
 * The note's text with its title marked as a conflicted copy's: where its language keeps the title
 * (a LaTeX document's \title), or on the line it reads the title from: not a properties line, nor a
 * spreadsheet's cells. Failing that, a Markdown note's first line with text; a note in another
 * language is left as it is, rather than have a line changed that it may need as it is.
 */
function markConflicted({ body, format }: Note): string {
  const own = plugins.language(format).markTitle?.(body, (title) => t("sync.conflicted", { title }));
  if (own) return own;
  const meta = (text: string) => plugins.meta(format, text);
  const plain = (text: string) => text.replace(/\s+/g, " ").trim();
  const lines = body.split("\n");
  const marked = (i: number) => [...lines.slice(0, i), t("sync.conflicted", { title: lines[i] }), ...lines.slice(i + 1)].join("\n");
  const wanted = plain(t("sync.conflicted", { title: meta(body).title }));
  for (let i = 0; i < Math.min(lines.length, TITLE_LINES); i++) {
    const text = marked(i);
    if (plain(meta(text).title) === wanted) return text;
  }
  if (format) return body;
  const first = lines.findIndex((line) => line.trim());
  return first === -1 ? `# ${t("sync.conflictedCopy")}\n${body}` : marked(first);
}

/** A note's text, format and lock: all it says but its dates and what `merge` takes apart from them; hashed. */
const textOf = (note: Note) => hash(serialize({ ...note, updatedAt: 0, pinned: false, trashed: false, inbox: undefined, icon: undefined, color: undefined }));

/** What a sync record keeps of a note as synced, so `merge` can tell later what each side changed. */
const baseOf = (note: Note) => ({ text: textOf(note), pinned: note.pinned, trashed: note.trashed, inbox: note.inbox, icon: note.icon, color: note.color });

/**
 * A note changed on both sides since it was synced as `base`, made one: its text from the side that
 * edited it, its pin, trash, Inbox, icon and color from the side that changed each (pinning or locking it isn't an
 * edit). Text edited on both sides is the newer edit's, and the other comes back as `older`, for a
 * conflicted copy. A lock on either side stays: sync never turns a locked note back into plain text.
 */
async function merge(here: Note, there: Note, base: SyncRecord | undefined): Promise<{ merged: Note; older?: Note }> {
  there = await opened(there);
  const edited = (note: Note) =>
    !base?.text || (textOf(note) !== base.text && !(note.locked?.open && textOf({ ...note, locked: undefined }) === base.text));
  let text: Note;
  if (!edited(there)) text = here;
  else if (!edited(here)) text = there;
  // Edited on both: the locked one, or else the newer edit.
  else if (!here.locked !== !there.locked) text = here.locked ? here : there;
  else text = there.updatedAt > here.updatedAt ? there : here;
  let other = text === here ? there : here;
  if (other.locked && !text.locked) {
    // The edit goes into the other side's lock, if its key is open here; if not, the locked one stays as it is.
    if (other.locked.open) text = { ...text, locked: await noteKeys.seal({ ...text, locked: other.locked }) };
    else [text, other] = [other, text];
  }
  // Here's if both changed it. A record from before lines kept these doesn't say: as the side whose text is kept.
  // Not in the Inbox is written as no field at all, so it's the same as false.
  const same = (a: unknown, b: unknown) => a === b || (!a && !b);
  const pick = <K extends "pinned" | "trashed" | "inbox" | "icon" | "color">(field: K) =>
    (base?.text ? !same(here[field], base[field]) : text === here) ? here[field] : there[field];
  return {
    merged: { ...text, pinned: pick("pinned"), trashed: pick("trashed"), inbox: pick("inbox"), icon: pick("icon"), color: pick("color") },
    older: edited(other) ? other : undefined,
  };
}

/** What the person calls where notes sync to: the drive or folder, or the bucket. */
const placeName = (config: SyncConfig) => (isFolder(config) ? config.name : config.bucket);

class SyncEngine {
  config = $state.raw<SyncConfig | null>(null);
  status = $state<SyncStatus>("off");
  error = $state<string | null>(null);
  lastSynced = $state<number | null>(null);
  encryptionIssue = $state<EncryptionIssue | null>(null);

  #running: Promise<void> | null = null;
  /** A follow-up pass requested while one was running; repeated requests share it. */
  #queued: Promise<void> | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;
  /** While encryption is turned on or off, no other pass may run. */
  #paused = false;
  /** Connected just now: screen readers hear once the first pass is done. */
  #settingUp = false;
  /** The connection as last saved or read here, to tell when another tab changed it. */
  #saved: string | null = null;

  /** Reads the saved connection. Once lines is unlocked, if the app lock is on. */
  async load() {
    this.#saved = localStorage.getItem(CONFIG_KEY);
    this.config = await loadConfig();
    this.status = this.config ? "idle" : "off";
  }

  /** Saves the connection again, encrypted or not as the app lock now says. */
  async rewrite() {
    await this.#save(this.config);
  }

  async #save(config: SyncConfig | null) {
    await writeSecret(CONFIG_KEY, config);
    this.#saved = localStorage.getItem(CONFIG_KEY);
  }

  /** Takes up a connection another tab saved since, if one did; whether it had. */
  async #followOtherTab() {
    if (localStorage.getItem(CONFIG_KEY) === this.#saved) return false;
    await this.load();
    return true;
  }

  start() {
    notes.onLocalChange(() => this.schedule());
    looks.onChange(() => this.schedule());
    window.addEventListener("online", () => void this.syncNow());
    window.addEventListener("offline", () => this.config && (this.status = "offline"));
    window.addEventListener("focus", () => {
      if (!this.lastSynced || Date.now() - this.lastSynced > 15_000) void this.syncNow();
    });
    setInterval(() => void this.syncNow(), INTERVAL);
    void this.syncNow();
  }

  /**
   * Connect to a bucket (or disconnect with `null`). Local notes are never deleted by this.
   * The first pass starts in the background; its progress shows as the sync status.
   */
  async configure(config: SyncConfig | null) {
    const previous = this.config;
    // No pass may start with the old config once its records are cleared, including one
    // that's queued behind the running pass.
    this.config = null;
    clearTimeout(this.#timer);
    await (this.#queued ?? this.#running);
    let next = config && normalizeConfig(config);
    // The encryption key only means something where it came from.
    if (next) {
      const same = previous?.encryption && sameLocation(previous, next);
      next = { ...next, encryption: same ? previous.encryption : undefined };
    }
    await alone(async () => {
      await syncRecords.clear();
      localStorage.removeItem(LEFTOVERS_KEY);
      await this.#save(next);
    });
    this.config = next;
    this.error = null;
    this.encryptionIssue = null;
    this.lastSynced = null;
    this.status = this.config ? "idle" : "off";
    this.#settingUp = !!this.config;
    if (this.config) void this.syncNow();
  }

  /** Check access (credentials, or folder permissions) without changing any notes. */
  async test(config: SyncConfig) {
    const { store, dir } = place(normalizeConfig(config));
    await store.list(dir);
  }

  /*
   * End-to-end encryption. Turning it on or off waits for the running pass, brings in everything
   * from other devices first, and then rewrites the remote in the other form.
   */

  /** Encrypts the notes in the bucket or folder from now on, with a new passphrase. */
  async encrypt(passphrase: string) {
    checkPassphrase(passphrase);
    await this.#exclusive(async (config) => {
      if (config.encryption) return;
      await this.#pass(config);
      const { store, root } = place(config);
      const raw = randomBytes(32);
      const id = crypto.randomUUID();
      const file: KeyFile = { format: "lines-encryption", version: 1, id, ...(await lockKey(raw, passphrase)) };
      // The key file goes first: from then on, other devices stop until they have the passphrase.
      await writeKeyFile(store, root, file);
      // Every note goes up again, encrypted; the plain copies are removed after.
      await this.#switch({ ...config, encryption: { id, key: toBase64(raw) } });
      await store.delete(root + LOOKS_FILE);
    });
  }

  /** Unlocks notes that were encrypted on another device. */
  async unlockLibrary(passphrase: string) {
    await this.#exclusive(async (config) => {
      const { store, root } = place(config);
      const file = await readKeyFile(store, root);
      if (!file) throw new SyncError(t("sync.error.notEncrypted"));
      const raw = await unlockKey(file, passphrase);
      // Starting over, like connecting again: nothing here is taken as deleted there.
      await this.#switch({ ...config, encryption: { id: file.id, key: toBase64(raw) } });
    });
  }

  /** Stops encrypting: the notes in the bucket or folder go back to plain Markdown files. */
  async decrypt() {
    await this.#exclusive(async (config) => {
      if (!config.encryption) return;
      const { store, root } = place(config);
      const file = await readKeyFile(store, root);
      if (file?.id === config.encryption.id) {
        // Everything comes here first, since the encrypted copies are about to go.
        await this.#pass(config);
        const { remote } = await connect(config);
        await store.delete(await remote.fileKey!(root + LOOKS_FILE));
        // Without the key file, other devices stop before they'd see notes go missing.
        await store.delete(root + KEY_FILE);
        localStorage.setItem(LEFTOVERS_KEY, "1");
      }
      await this.#switch({ ...config, encryption: undefined });
    });
  }

  /** Locks the notes' key with a new passphrase. Every device keeps syncing; new ones need the new passphrase. */
  async changePassphrase(passphrase: string) {
    checkPassphrase(passphrase);
    await this.#exclusive(async (config) => {
      if (!config.encryption) return;
      const { store, root } = place(config);
      const file = await readKeyFile(store, root);
      if (file?.id !== config.encryption.id) throw new SyncError(t("sync.error.changedElsewhere"));
      await writeKeyFile(store, root, { ...file, ...(await lockKey(fromBase64(config.encryption.key), passphrase)) });
    });
  }

  /** Runs `work` with no pass running or starting, then syncs. */
  async #exclusive(work: (config: SyncConfig) => Promise<void>) {
    const config = this.config;
    if (!config || this.#paused) return;
    this.#paused = true;
    clearTimeout(this.#timer);
    try {
      await (this.#queued ?? this.#running);
      await alone(async () => {
        if (await this.#followOtherTab()) return;
        this.status = "syncing";
        await work(config);
      });
    } finally {
      this.#paused = false;
      void this.syncNow();
    }
  }

  /** Switches to the same place with encryption on or off. Records are cleared, as when connecting. */
  async #switch(config: SyncConfig) {
    await syncRecords.clear();
    this.config = config;
    await this.#save(config);
    this.encryptionIssue = null;
  }

  schedule() {
    if (!this.config) return;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.syncNow(), DEBOUNCE);
  }

  /** Run a full pass that starts after this call, so it includes every change made so far. */
  syncNow(): Promise<void> {
    if (this.#running) {
      this.#queued ??= this.#running.then(() => {
        this.#queued = null;
        return this.syncNow();
      });
      return this.#queued;
    }
    const config = this.config;
    if (!config || !notes.ready || this.#paused) return Promise.resolve();
    clearTimeout(this.#timer);
    this.#running = alone(() => this.#run(config)).finally(() => (this.#running = null));
    return this.#running;
  }

  async #run(config: SyncConfig) {
    if (await this.#followOtherTab()) {
      if (this.config) void this.syncNow();
      return;
    }
    // A cloud folder is on disk; its drive app catches up when the connection returns.
    if (!navigator.onLine && !isFolder(config)) {
      this.status = "offline";
      return;
    }
    this.status = "syncing";
    try {
      await this.#pass(config);
      if (this.config !== config) return;
      this.status = "idle";
      this.error = null;
      this.encryptionIssue = null;
      this.lastSynced = Date.now();
      if (this.#settingUp) {
        this.#settingUp = false;
        speak(t("sync.spoken.ready", { place: placeName(config) }));
      }
    } catch (error) {
      if (this.config !== config) return;
      console.error("lines: sync failed", error);
      const message = error instanceof SyncError ? error.message : t("sync.error.failed", { error: String(error) });
      // Out of sight, so said aloud; once, not again on every pass that fails the same way.
      if (message !== this.error) speak(t("sync.spoken.problem", { error: message }));
      this.status = "error";
      this.error = message;
    }
  }

  /** Stops the pass, before it changes anything, if the remote isn't encrypted the way this device expects. */
  async #checkEncryption(config: SyncConfig, store: Remote, root: string, listed: RemoteObject[], attachmentDir: string) {
    const file = await readKeyFile(store, root);
    const sealedThere = listed.some((object) => object.key.endsWith(SEALED));
    if (config.encryption) {
      if (!file && sealedThere) {
        throw new SyncError(t("sync.error.keyFileMissing", { file: KEY_FILE }));
      }
      // Never silently back to plain: whoever can change the bucket could make that happen.
      if (!file) {
        this.encryptionIssue = "turned-off";
        throw new SyncError(t("sync.error.turnedOff"));
      }
      if (file.id !== config.encryption.id) {
        this.encryptionIssue = "rekeyed";
        throw new SyncError(t("sync.error.rekeyed"));
      }
    } else if (!file && sealedThere && localStorage.getItem(LEFTOVERS_KEY)) {
      // Encryption was turned off here; the encrypted copies are no longer needed.
      await pool(listed.filter((object) => object.key.endsWith(SEALED)), (object) => store.delete(object.key));
      const attachments = (await store.list(attachmentDir)).filter((object) => object.key.endsWith(SEALED));
      await pool(attachments, (object) => store.delete(object.key));
      localStorage.removeItem(LEFTOVERS_KEY);
    } else if (file || sealedThere) {
      this.encryptionIssue = "locked";
      throw new SyncError(t("sync.error.encrypted"));
    }
  }

  async #pass(config: SyncConfig) {
    const { store, remote, root, dir, attachmentDir } = await connect(config);
    const keyOf = (id: string) => `${dir}${id}.md`;

    await notes.flush();
    const listed = await store.list(dir);
    await this.#checkEncryption(config, store, root, listed, attachmentDir);
    const ext = config.encryption ? SEALED : ".md";
    const remoteById = new Map<string, RemoteObject>();
    for (const object of listed) {
      const name = object.key.slice(dir.length);
      if (!name.includes("/") && name.endsWith(ext) && name.length > ext.length) remoteById.set(name.slice(0, -ext.length), object);
    }
    const records = new Map((await syncRecords.all()).map((r) => [r.id, r]));
    // Notes were synced, yet the remote has none: far more likely a drive that's signed out or
    // a wrong folder than every note deleted elsewhere. Deleting them all here would be worse.
    if (remoteById.size === 0 && records.size > 0) {
      throw new SyncError(t("sync.error.missing"));
    }
    // A locked note edited a moment ago is still being encrypted; it syncs on the next pass.
    const local = notes.entries.map((e) => e.note).filter((note) => (note.locked ? !!note.locked.sealed : !isBlank(note.body)));
    const localIds = new Set(notes.entries.map((e) => e.note.id));

    const record = (note: Note, etag: string | null, text = serialize(note)) =>
      syncRecords.put({ id: note.id, etag, hash: hash(text), ...baseOf(note) });

    /**
     * Uploads the note over what was there, `expected` by its tag (null: nothing). Not if another
     * device wrote it since (false): the next pass, in a moment, brings that in and compares.
     */
    const upload = async (note: Note, expected: string | null) => {
      const text = serialize(note);
      const etag = await remote.put(keyOf(note.id), text, expected);
      if (etag === false) {
        this.schedule();
        return false;
      }
      await record(note, etag, text);
      return true;
    };

    const download = async (id: string) => {
      const object = await remote.get(keyOf(id));
      return object && { ...object, note: { ...deserialize(object.text, id), id } };
    };

    /** Apply a remote version, unless the note was edited while we were busy. */
    const applyIfUnchanged = async (id: string, expected: string | null, note: Note) => {
      await notes.flush();
      const current = notes.get(id);
      return (current ? serialize(current.note) : null) === expected && notes.applyRemote(note);
    };

    await pool(local, async (note) => {
      const text = serialize(note);
      const localHash = hash(text);
      const last: SyncRecord | undefined = records.get(note.id);
      const object = remoteById.get(note.id);
      const dirty = !last || last.hash !== localHash;

      if (!object) {
        if (last && !dirty) {
          // Deleted on another device, and untouched here since.
          await notes.flush();
          if (notes.get(note.id) && serialize(notes.get(note.id)!.note) === text) {
            await notes.removeRemote(note.id);
          }
          await syncRecords.delete(note.id);
        } else {
          await upload(note, null);
        }
        return;
      }

      if (last && last.etag === object.etag) {
        if (dirty) await upload(note, object.etag);
        return;
      }

      const fetched = await download(note.id);
      if (!fetched) return;
      const remoteHash = hash(fetched.text);
      const etag = fetched.etag ?? object.etag;

      if (last && remoteHash === last.hash) {
        // Same content; only the ETag was unknown or different.
        await syncRecords.put({ ...last, etag });
        if (dirty) await upload(note, etag);
      } else if (remoteHash === localHash) {
        await record(note, etag, text);
      } else if (!dirty) {
        if (await applyIfUnchanged(note.id, text, fetched.note)) await record(fetched.note, etag, fetched.text);
      } else {
        // Changed on both sides. Nothing is lost: see `merge`.
        const { merged, older } = await merge(note, fetched.note, last);
        const mergedText = serialize(merged);
        if (mergedText === text) {
          // Not if another device wrote it since: the next pass brings that in and merges again.
          if (!(await upload(note, etag))) return;
        } else {
          if (!(await applyIfUnchanged(note.id, text, merged))) return;
          // The note here is the merge now, so the older edit is kept as a copy even if this upload has to wait.
          if (mergedText === fetched.text) await record(fetched.note, etag, fetched.text);
          else await upload(merged, etag);
        }
        if (older) await notes.insert(conflictCopy(older));
      }
    });

    const remoteOnly = [...remoteById].filter(([id]) => !localIds.has(id));
    await pool(remoteOnly, async ([id, object]) => {
      const last = records.get(id);
      if (last && last.etag === object.etag) {
        // Deleted here.
        await remote.delete(keyOf(id));
        await syncRecords.delete(id);
        return;
      }
      const fetched = await download(id);
      if (!fetched) return;
      if (last && hash(fetched.text) === last.hash) {
        await remote.delete(keyOf(id));
        await syncRecords.delete(id);
      } else if (!notes.get(id)) {
        // New on another device, or edited there after we deleted it here.
        if (await notes.applyRemote(fetched.note)) await record(fetched.note, fetched.etag ?? object.etag, fetched.text);
      }
    });

    for (const id of records.keys()) {
      if (!localIds.has(id) && !remoteById.has(id)) await syncRecords.delete(id);
    }

    if (config.encryption) {
      // Plain copies from before encryption, or from a device that hadn't heard yet. That
      // device still has its notes, and uploads them encrypted once it has the passphrase.
      await pool(listed.filter((object) => object.key.endsWith(".md")), (object) => store.delete(object.key));
    }
    await this.#syncLooks(remote, root);
    await this.#syncAttachments(remote, store, attachmentDir, !!config.encryption);
  }

  /** Brings in other devices' icons and colors, and writes back the merge if it's new to them. */
  async #syncLooks(remote: Remote, root: string) {
    const key = root + LOOKS_FILE;
    const there = await remote.get(key);
    if (there) looks.merge(readLooks(there.text));
    const text = writeLooks(looks.looks);
    if (text === there?.text) return;
    // Not over a version written since (false): the next pass merges that in.
    if ((await remote.put(key, text, there ? (there.etag ?? undefined) : null)) === false) this.schedule();
  }

  async #syncAttachments(remote: Remote, store: Remote, dir: string, encrypted: boolean) {
    const used = usedAttachments(notes.entries.map((e) => e.note));
    if (!used.size && !encrypted) return;
    const listed = await store.list(dir);
    if (encrypted) await pool(listed.filter((object) => !object.key.endsWith(SEALED)), (object) => store.delete(object.key));
    const there = new Set(listed.map((object) => object.key));
    const here = new Set(await attachmentNames());
    await pool([...used], async (name) => {
      const key = dir + name;
      const stored = there.has((await remote.fileKey?.(key)) ?? key);
      if (here.has(name) && !stored) {
        const data = await getAttachment(name);
        if (data) await remote.putFile(key, data);
      } else if (!here.has(name) && stored) {
        const data = await remote.getFile(key);
        if (data) await putAttachment(name, data);
      }
    });
  }
}

export const sync = new SyncEngine();
