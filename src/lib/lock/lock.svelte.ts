import { aesKey, isLockedKey, lockKey, randomBytes, unlockKey, type Bytes, type LockedKey } from "../crypto";
import { rewriteAttachments } from "../notes/attachments";
import { notes, noteStorage } from "../notes/store.svelte";
import { isDesktopApp, isMacApp } from "../platform";
import { checkPassphrase, sync } from "../sync/engine.svelte";
import { announce } from "../windows/channel";
import { vault } from "./vault";

/*
 * The app lock. While it's on, what lines keeps on this device is encrypted (see vault.ts) with
 * a random device key, which the passphrase (or Touch ID, on the Mac) unlocks when lines opens.
 * The key only lives in memory: locking simply starts every window over.
 *
 * In the desktop apps, floating notes are windows of their own. Once the main window is
 * unlocked it hands the key to the app's native side (src-tauri/src/lock.rs), where they pick it up.
 */

const KEY = "lines.lock";

export interface LockSettings extends LockedKey {
  /** Minutes without use before lines locks itself; 0 for only when it quits. */
  after: number;
  /** Touch ID unlocks it too (the Mac app). */
  touchId: boolean;
}

export const LOCK_AFTER = [1, 5, 15, 60, 0];

function read(): LockSettings | null {
  try {
    const settings = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return isLockedKey(settings) ? { after: 5, touchId: false, ...settings } : null;
  } catch {
    return null;
  }
}

export async function native<T>(command: string, args?: Bytes | Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

/** Touch ID can unlock lines here: the Mac app, on a Mac that has it. */
export const touchIdAvailable: Promise<boolean> = isMacApp
  ? native<boolean>("touch_id_available").catch(() => false)
  : Promise.resolve(false);

const ACTIVITY = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;

class AppLock {
  settings = $state.raw<LockSettings | null>(read());
  locked = $state(this.settings !== null);

  #resolve!: () => void;
  /** Resolves once lines is unlocked: right away if the lock is off. */
  unlocked = new Promise<void>((resolve) => (this.#resolve = resolve));
  #lastActive = Date.now();
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    if (!this.locked) this.#resolve();
  }

  get enabled() {
    return this.settings !== null;
  }

  /** Reads the settings again, once another window changed them (the main window, for Settings). */
  refresh() {
    this.settings = read();
  }

  #save(settings: LockSettings | null) {
    this.settings = settings;
    if (settings) localStorage.setItem(KEY, JSON.stringify(settings));
    else localStorage.removeItem(KEY);
  }

  async unlock(passphrase: string) {
    if (!this.settings) return;
    await this.#open(await unlockKey(this.settings, passphrase));
  }

  /** Asks for Touch ID; false if it was cancelled. */
  async unlockWithTouchId(): Promise<boolean> {
    if (!this.settings?.touchId) return false;
    const raw = new Uint8Array(await native<ArrayBuffer>("touch_id_unlock"));
    if (!raw.byteLength) return false;
    await this.#open(raw);
    return true;
  }

  /** In a floating note: the key the main window was unlocked with, if it has been. */
  async adopt(): Promise<boolean> {
    const raw = new Uint8Array(await native<ArrayBuffer>("lock_shared"));
    if (!raw.byteLength) return false;
    vault.use(await aesKey(raw));
    this.locked = false;
    this.#resolve();
    return true;
  }

  async #open(raw: Bytes) {
    vault.use(await aesKey(raw));
    if (isDesktopApp) {
      await native("lock_share", raw);
      void announce({ type: "unlocked" });
    }
    this.locked = false;
    this.#resolve();
  }

  /** Turns the lock on: everything here is encrypted from now on. */
  async enable(passphrase: string) {
    checkPassphrase(passphrase);
    if (this.settings) return;
    const raw = randomBytes(32);
    // Saved before anything is encrypted, so if lines stops halfway the passphrase still opens it all.
    this.#save({ ...(await lockKey(raw, passphrase)), after: 5, touchId: false });
    vault.use(await aesKey(raw));
    if (isDesktopApp) await native("lock_share", raw);
    await this.#rewrite();
    this.watch();
  }

  /** Turns the lock off, after checking the passphrase: everything is stored as before. */
  async disable(passphrase: string) {
    if (!this.settings) return;
    await unlockKey(this.settings, passphrase);
    vault.stopSealing();
    if (isDesktopApp) await native("lock_forget");
    await this.#rewrite();
    if (this.settings.touchId) await native("touch_id_forget").catch(() => {});
    this.#save(null);
    vault.use(null);
    clearTimeout(this.#timer);
    void announce({ type: "unlocked" });
  }

  async changePassphrase(current: string, next: string) {
    checkPassphrase(next);
    if (!this.settings) return;
    const raw = await unlockKey(this.settings, current);
    this.#save({ ...this.settings, ...(await lockKey(raw, next)) });
  }

  setAfter(after: number) {
    if (!this.settings) return;
    this.#save({ ...this.settings, after });
    this.#schedule();
  }

  /** Lets Touch ID unlock lines too, with the key it's unlocked with now. */
  async setTouchId(on: boolean) {
    if (!this.settings) return;
    await native(on ? "touch_id_remember" : "touch_id_forget");
    this.#save({ ...this.settings, touchId: on });
  }

  /** Locks every window: once what's typed is saved, they start over, locked. */
  async lockNow() {
    if (!this.settings) return;
    await notes.flush();
    if (isDesktopApp) await native("lock_forget");
    await announce({ type: "lock" });
    location.reload();
  }

  /**
   * Writes everything again, encrypted or not as the vault now says. Floating notes start over
   * first, so none of them writes the old way after their note was rewritten.
   */
  async #rewrite() {
    await announce({ type: "lock" });
    await new Promise((resolve) => setTimeout(resolve, 400));
    await notes.flush();
    await noteStorage.rewrite();
    await rewriteAttachments();
    await sync.rewrite();
  }

  /* Locking after a while without use. */

  /** Starts watching for use, in the main window once unlocked. */
  watch() {
    for (const type of ACTIVITY) addEventListener(type, () => this.active(), { capture: true, passive: true });
    // Timers can sleep with the app in the background; check the time when it's back.
    document.addEventListener("visibilitychange", () => this.#check());
    addEventListener("focus", () => this.#check());
    this.#schedule();
  }

  /** Someone used lines, here or in a floating note. The timer catches up when it fires. */
  active() {
    this.#lastActive = Date.now();
  }

  #schedule() {
    clearTimeout(this.#timer);
    const after = this.settings?.after;
    if (!after) return;
    this.#timer = setTimeout(() => this.#check(), Math.max(1000, this.#lastActive + after * 60_000 - Date.now()));
  }

  #check() {
    const after = this.settings?.after;
    if (!after || this.locked) return;
    if (Date.now() - this.#lastActive >= after * 60_000) void this.lockNow();
    else this.#schedule();
  }
}

export const lock = new AppLock();
