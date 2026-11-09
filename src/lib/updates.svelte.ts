import { notes } from "./notes/store.svelte";
import { isDesktopApp } from "./platform";
import { prefs } from "./prefs.svelte";

/*
 * The desktop apps updating themselves. The work is done in Rust (src-tauri/src/updates.rs), which
 * tells every window how it's going; this is what Settings and the sidebar show of it, and the
 * main window's regular checks while automatic updates are on.
 */

export type UpdateStatus =
  | { kind: "unsupported" | "idle" | "checking" | "upToDate" }
  /** `due`: when it's been out long enough to install on its own (ms), or null if it won't. */
  | { kind: "available"; version: string; due: number | null }
  /** `progress` from 0 to 1, once the size is known. */
  | { kind: "downloading"; version: string; progress: number | null }
  /** Downloaded: it's installed when lines quits. */
  | { kind: "ready"; version: string }
  | { kind: "failed"; error: string };

/** The first check waits for lines to have started; the rest come a few hours apart. */
const FIRST_CHECK = 30_000;
const CHECK_EVERY = 6 * 60 * 60_000;

const invoke = async <T>(command: string, args?: Record<string, unknown>) => (await import("@tauri-apps/api/core")).invoke<T>(command, args);

class Updates {
  /** Unsupported until Rust says otherwise: on the web, on phones, and in development builds. */
  status = $state<UpdateStatus>({ kind: "unsupported" });
  readonly #heard: Promise<void>;

  constructor() {
    this.#heard = isDesktopApp ? this.#listen().catch((error) => console.error("lines: couldn't ask about updates", error)) : Promise.resolve();
  }

  async #listen() {
    const { listen } = await import("@tauri-apps/api/event");
    await listen<UpdateStatus>("updates", (event) => (this.status = event.payload));
    this.status = await invoke<UpdateStatus>("updates_status");
  }

  get supported() {
    return this.status.kind !== "unsupported";
  }

  /** Looks for a newer version; with automatic updates on, downloads one that's been out long enough. */
  check() {
    return invoke<UpdateStatus>("updates_check", { waitDays: prefs.updateWait, download: prefs.autoUpdate });
  }

  /** Automatic updates turned off: one downloaded isn't installed as lines quits any more, but still offered. */
  async forget() {
    await invoke("updates_forget");
    return this.check();
  }

  /** Gets the newest version without waiting, and restarts into it. */
  async installNow() {
    const status = await invoke<UpdateStatus>("updates_check", { waitDays: 0, download: true });
    if (status.kind === "ready") await this.restart();
  }

  /** Restarts into the update that's ready, once what's typed is saved. A failure shows as the status. */
  async restart() {
    await notes.flush();
    await invoke("updates_restart").catch((error) => console.error("lines: couldn't install the update", error));
  }

  /** In the main window: checks soon after starting, then every few hours, while automatic updates are on. */
  async watch() {
    await this.#heard;
    if (!this.supported) return;
    const check = () => {
      if (prefs.autoUpdate) void this.check();
    };
    setTimeout(check, FIRST_CHECK);
    setInterval(check, CHECK_EVERY);
  }
}

export const updates = new Updates();
