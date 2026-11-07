import { fromBase64, unlockKey, WrongPassphrase } from "../crypto";
import { native } from "../lock/lock.svelte";
import { checkPassphrase } from "../sync/engine.svelte";
import { t } from "../i18n/index.svelte";
import { announce } from "../windows/channel";
import { noteKeys } from "./noteKeys.svelte";
import { notes } from "./store.svelte";

/*
 * Locked notes, like in Apple Notes: one password (or Touch ID, on the Mac) opens them all, and
 * they stay open until they're locked again, by hand or after a while without use. The keys are
 * in noteKeys.svelte.ts; what a locked note looks like, in notes/types.ts.
 *
 * Opening or locking them happens in every window at once: the app's floating notes, or other
 * tabs on the web, hear about it over the window channel.
 */

/** Open locked notes close again after this long without use. */
export const CLOSE_AFTER = 5 * 60_000;
const ACTIVITY = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;

export class WrongPassword extends Error {
  constructor(message = t("lock.error.wrongPassword")) {
    super(message);
  }
}

/** What the password dialog asks for: a new password, or the one there is; then what happens next. */
export interface PasswordRequest {
  purpose: "set" | "open";
  after: () => void;
}

class LockedNotes {
  /** Locking a note needs the password first (see NotesPasswordDialog.svelte). */
  asking = $state.raw<PasswordRequest | null>(null);

  #timer: ReturnType<typeof setTimeout> | undefined;
  #lastActive = Date.now();
  #watching = false;

  /** Locks a note. Right away while locked notes are open; otherwise once the password is given (or set). */
  lockNote(id: string) {
    if (noteKeys.ready) return void notes.lock(id);
    this.asking = { purpose: noteKeys.known ? "open" : "set", after: () => void notes.lock(id) };
  }

  /** Sets the password for locked notes on this device, the first time a note is locked. */
  async setUp(password: string) {
    checkPassphrase(password);
    const { key } = await noteKeys.create(password);
    noteKeys.save({ key, touchId: false });
    await this.#opened();
  }

  /**
   * Opens every locked note the password opens. Asked from a locked note (`key`), it fails unless
   * that one opens too: notes can be locked with an old password, or one from another device.
   */
  async unlock(password: string, key?: string) {
    const opened = await noteKeys.unlock(password);
    if (opened.length) await this.#opened();
    if (key ? !noteKeys.isOpen(key) : !opened.length) {
      throw new WrongPassword(
        opened.length ? t("lock.error.otherPassword") : undefined,
      );
    }
  }

  /** Asks for Touch ID; false if it was cancelled. */
  async unlockWithTouchId(): Promise<boolean> {
    const settings = noteKeys.settings;
    if (!settings?.touchId) return false;
    const raw = new Uint8Array(await native<ArrayBuffer>("touch_id_unlock", { which: "notes" }));
    if (!raw.byteLength) return false;
    await noteKeys.add(raw, settings.key.id);
    await this.#opened();
    return true;
  }

  /** Locks every open locked note, in every window. */
  async close(everywhere = true) {
    clearTimeout(this.#timer);
    if (!noteKeys.anyOpen) return;
    await notes.closeLocked();
    noteKeys.clear();
    if (everywhere) void announce({ type: "notes-locked" });
  }

  /** Keys another window opened locked notes with. */
  async adopt(keys: { id: string; raw: string }[]) {
    let added = false;
    for (const { id, raw } of keys) {
      if (noteKeys.isOpen(id)) continue;
      await noteKeys.add(fromBase64(raw), id);
      added = true;
    }
    if (added) await this.#opened(false);
  }

  /** Locks the key with a new password, in every note that has it. They sync, and the new password opens them everywhere. */
  async changePassword(current: string, next: string) {
    checkPassphrase(next);
    const settings = noteKeys.settings;
    if (!settings) return;
    const { id } = settings.key;
    try {
      const raw = await unlockKey(noteKeys.newest(id)!, current);
      if (!noteKeys.isOpen(id)) await noteKeys.add(raw, id);
    } catch (error) {
      throw error instanceof WrongPassphrase ? new WrongPassword() : error;
    }
    const key = await noteKeys.rewrap(id, next);
    noteKeys.save({ ...settings, key });
    await notes.rekey(key);
    await this.#opened();
  }

  /**
   * A new password, for when the old one is forgotten. Notes are locked with it from now on;
   * those already locked still need the old one.
   */
  async reset(password: string) {
    checkPassphrase(password);
    const touchId = noteKeys.settings?.touchId ?? false;
    await this.close();
    const { raw, key } = await noteKeys.create(password);
    noteKeys.save({ key, touchId });
    if (touchId) {
      await native("touch_id_keep", { which: "notes", key: Array.from(raw) }).catch(() => noteKeys.save({ key, touchId: false }));
    }
    raw.fill(0);
    await this.#opened();
  }

  /** Lets Touch ID open locked notes too. Turning it on needs them open. */
  async setTouchId(on: boolean) {
    const settings = noteKeys.settings;
    if (!settings) return;
    if (on) {
      const raw = noteKeys.raw(settings.key.id);
      if (!raw) throw new Error(t("lock.notes.notOpen"));
      await native("touch_id_keep", { which: "notes", key: Array.from(raw) });
    } else {
      await native("touch_id_forget", { which: "notes" });
    }
    noteKeys.save({ ...settings, touchId: on });
  }

  async #opened(share = true) {
    await notes.openLocked();
    if (share) void announce({ type: "notes-unlocked", keys: noteKeys.shared() });
    this.#watch();
  }

  /* Closing again after a while without use, in each window by itself. */

  #watch() {
    if (!this.#watching) {
      this.#watching = true;
      for (const type of ACTIVITY) addEventListener(type, () => (this.#lastActive = Date.now()), { capture: true, passive: true });
      // Timers can sleep with the app in the background; check the time when it's back.
      document.addEventListener("visibilitychange", () => this.#check());
      addEventListener("focus", () => this.#check());
    }
    this.#lastActive = Date.now();
    this.#schedule();
  }

  #schedule() {
    clearTimeout(this.#timer);
    if (noteKeys.anyOpen) this.#timer = setTimeout(() => this.#check(), Math.max(1000, this.#lastActive + CLOSE_AFTER - Date.now()));
  }

  #check() {
    if (!noteKeys.anyOpen) return;
    if (Date.now() - this.#lastActive >= CLOSE_AFTER) void this.close(false);
    else this.#schedule();
  }
}

export const lockedNotes = new LockedNotes();
