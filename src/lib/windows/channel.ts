import { isTauri } from "../platform";

/**
 * Messages between the app's windows: the main window, Settings and any floating notes. They share one
 * on-device database, so a note's message only says which changed, and each window reloads it from
 * there. Settings, plugins and the language, kept in local storage, which WebKit brings up to date
 * in other windows only a moment later, come in the message, so they apply at once.
 */
export type WindowMessage =
  /** A note was saved or deleted. `local` means by the person (so it should sync), not by sync itself. */
  | { type: "note"; id: string; local: boolean }
  /** An image was stored (pasted, or downloaded by sync). */
  | { type: "attachment"; id: string }
  /** Show this note in the main window. */
  | { type: "show"; id: string }
  /** Preferences changed (theme, text, window look): all of them, as saved. */
  | { type: "prefs"; prefs: string }
  /** The app's language was chosen (i18n/index.svelte.ts). */
  | { type: "language"; choice: string }
  /** Your own themes changed (themes/custom.svelte.ts): all of them, as saved. */
  | { type: "themes"; themes: string }
  /** A plugin was turned on or off (plugins/registry.svelte.ts): which are, by choice. */
  | { type: "plugins"; choices: Record<string, boolean> }
  /** A floating note's window opened or closed. */
  | { type: "floating"; id: string; open: boolean }
  /** The app lock locked lines, or was turned on or off: save, and start over. */
  | { type: "lock" }
  /** The main window was unlocked; a locked floating note can open now. */
  | { type: "unlocked" }
  /** Someone is using a floating note, so the main window shouldn't lock for being idle. */
  | { type: "activity" }
  /** Locked notes were opened, with these keys (see notes/locked.svelte.ts). */
  | { type: "notes-unlocked"; keys: { id: string; raw: string }[] }
  /** Locked notes were locked again. */
  | { type: "notes-locked" }
  /** A window that just opened asks whether locked notes are open. */
  | { type: "notes-ask" }
  /** The Settings window should show this tab (see settings.svelte.ts). */
  | { type: "settings-section"; section: string }
  /** The Settings window asks the main window to do something, and hears how it went. */
  | { type: "call"; id: string; target: string; method: string; args: unknown[] }
  | { type: "reply"; id: string; result?: unknown; error?: string; state: import("./settings.svelte").LockState }
  /** How sync is doing in the main window, and the Settings window asking for it. */
  | { type: "sync-state"; state: import("./settings.svelte").SyncState }
  | { type: "sync-ask" }
  /** A spreadsheet's grid started or stopped writing a formula where a reference can go (plugins/spreadsheet/pointing.svelte.ts). */
  | { type: "sheet-writer"; writing: boolean; note: string }
  /** Cells pointed at in another window for it, in the sheet called `sheet`. */
  | { type: "sheet-point"; sheet: string; anchor: { row: number; column: number }; corner: { row: number; column: number } }
  /** That formula finished from the window cells were pointed at in: kept (Return, a click elsewhere) or not (Esc). */
  | { type: "sheet-done"; keep: boolean };

const EVENT = "lines:window";
const self = crypto.randomUUID();

/** The Tauri label of this window: "main", "settings", or "note-<id>" for a floating note. */
export function windowLabel(): string {
  if (!isTauri) return "main";
  const internals = (window as unknown as { __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: string } } } })
    .__TAURI_INTERNALS__;
  return internals?.metadata?.currentWindow?.label ?? "main";
}

let channel: BroadcastChannel | undefined;

export async function announce(message: WindowMessage) {
  if (isTauri) {
    const { emit } = await import("@tauri-apps/api/event");
    await emit(EVENT, { ...message, from: self });
  } else {
    channel ??= new BroadcastChannel(EVENT);
    channel.postMessage(message);
  }
}

export async function onAnnounce(handler: (message: WindowMessage) => void) {
  if (isTauri) {
    const { listen } = await import("@tauri-apps/api/event");
    // Tauri also delivers our own events back to us; skip those.
    return listen<WindowMessage & { from: string }>(EVENT, ({ payload }) => payload.from !== self && handler(payload));
  }
  channel ??= new BroadcastChannel(EVENT);
  const listener = (event: MessageEvent<WindowMessage>) => handler(event.data);
  channel.addEventListener("message", listener);
  return () => channel?.removeEventListener("message", listener);
}
