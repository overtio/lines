import { tick } from "svelte";
import { t } from "../i18n/index.svelte";
import type { LockSettings } from "../lock/lock.svelte";
import type { NotesPassword } from "../notes/noteKeys.svelte";
import { isDesktopApp } from "../platform";
import { prefs, type SettingsOpens } from "../prefs.svelte";
import { sectionOf, type SettingsSection } from "../components/settings/sections";
import { ui } from "../ui.svelte";
import { announce, onAnnounce, windowLabel } from "./channel";

/*
 * Settings is a dialog over the notes, or in the desktop apps, if chosen (Settings → General), a
 * window of its own (labelled "settings"). The window shows the same panels, but the main window is the one that syncs,
 * locks and keeps the list: what those panels ask of sync, the app lock, locked notes and the note
 * list is done there (`forwardToMain`), and sync's state comes back to show (`serveSettings`).
 */

export const SETTINGS_LABEL = "settings";

/** This window is the Settings window. */
export const isSettingsWindow = windowLabel() === SETTINGS_LABEL;

/** The section the Settings window opens on, from its address. */
export const initialSection = () => sectionOf(new URLSearchParams(location.search).get("section"));

/** Opens Settings on a section: a dialog over the notes, or its own window (brought forward if open) where that's chosen. */
export async function openSettings(section: SettingsSection = "general") {
  if (!isDesktopApp || prefs.settingsOpens === "overlay") {
    ui.settings = section;
    return;
  }
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const existing = await WebviewWindow.getByLabel(SETTINGS_LABEL);
  if (existing) {
    void announce({ type: "settings-section", section });
    await existing.unminimize();
    await existing.setFocus();
    return;
  }
  const { LogicalPosition } = await import("@tauri-apps/api/dpi");
  const window = new WebviewWindow(SETTINGS_LABEL, {
    url: `index.html?section=${section}`,
    title: t("settings.title"),
    width: 860,
    height: 640,
    // Room for the list of sections beside a section, which a narrower window would stack.
    minWidth: 700,
    minHeight: 360,
    center: true,
    // Hidden until it has drawn (it shows itself), so it never flashes white.
    visible: false,
    titleBarStyle: "overlay",
    hiddenTitle: true,
    // As in the main window: centered on the title row, over the list of sections.
    trafficLightPosition: new LogicalPosition(20, 28),
  });
  void window.once("tauri://error", (event) => console.error("lines: couldn't open the Settings window", event.payload));
}

/**
 * Settings to open this way from now on, and moved there now, on General where this is chosen: the
 * window closes and the dialog opens over the notes in the main window, or the other way round.
 */
export async function setSettingsOpens(where: SettingsOpens) {
  prefs.settingsOpens = where;
  // Saved and sent to the other windows first.
  await tick();
  if (isSettingsWindow && where === "overlay") {
    await announce({ type: "open-settings", section: "general" });
    await closeSettings();
  } else if (!isSettingsWindow && where === "window" && ui.settings) {
    ui.settings = null;
    await openSettings("general");
  }
}

/** Closes Settings: the window, or the dialog. */
export async function closeSettings() {
  if (!isSettingsWindow) {
    ui.settings = null;
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}

type Method = (...args: never[]) => unknown;
type Target = object;
const methods = (target: Target) => target as Record<string, unknown>;

/** What the Settings window may ask the main window to do, by object and method. */
const FORWARDED: Record<string, string[]> = {
  sync: ["configure", "encrypt", "unlockLibrary", "decrypt", "changePassphrase", "syncNow"],
  lock: ["enable", "disable", "changePassphrase", "setAfter", "setTouchId", "lockNow"],
  lockedNotes: ["unlock", "changePassword", "reset", "setTouchId"],
  notes: ["addSamples", "reset", "setFilter"],
};

/**
 * The app lock's and locked notes' settings as the main window has them after a call, sent with
 * its reply: read from storage, they could still be the old ones in this window for a moment.
 */
export interface LockState {
  lock: LockSettings | null;
  noteKeys: NotesPassword | null;
}

/** Sync's state as Settings shows it. */
export interface SyncState {
  config: unknown;
  status: string;
  error: string | null;
  lastSynced: number | null;
  encryptionIssue: unknown;
}

/**
 * In the Settings window: these objects' forwarded methods run in the main window instead, and
 * `after` takes up the lock settings each leaves there. Sync's state follows the main window's;
 * this resolves once it's first heard.
 */
export async function forwardToMain(targets: Record<string, Target>, sync: SyncState, after: (state: LockState) => void) {
  const waiting = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  for (const [name, names] of Object.entries(FORWARDED)) {
    for (const method of names) {
      methods(targets[name])[method] = (...args: unknown[]) =>
        new Promise((resolve, reject) => {
          const id = crypto.randomUUID();
          waiting.set(id, { resolve, reject });
          void announce({ type: "call", id, target: name, method, args });
        });
    }
  }
  let heard!: () => void;
  const synced = new Promise<void>((resolve) => (heard = resolve));
  // Listening before asking, so the answer isn't missed.
  await onAnnounce((message) => {
    if (message.type === "reply") {
      const call = waiting.get(message.id);
      if (!call) return;
      waiting.delete(message.id);
      after(message.state);
      if (message.error === undefined) call.resolve(message.result);
      else call.reject(new Error(message.error));
    } else if (message.type === "sync-state") {
      Object.assign(sync, message.state);
      heard();
    } else if (message.type === "settings-section") {
      ui.settings = sectionOf(message.section);
    }
  });
  void announce({ type: "sync-ask" });
  return synced;
}

/** In the main window: does what the Settings window asks, and tells it how sync is doing. */
export function serveSettings(targets: Record<string, Target>, syncState: () => SyncState, lockState: () => LockState) {
  const tell = () => void announce({ type: "sync-state", state: syncState() });
  $effect.root(() => {
    $effect(tell);
  });
  void onAnnounce(async (message) => {
    if (message.type === "sync-ask") tell();
    if (message.type === "open-settings") ui.settings = sectionOf(message.section);
    if (message.type !== "call" || !FORWARDED[message.target]?.includes(message.method)) return;
    try {
      const method = methods(targets[message.target])[message.method] as Method;
      const result = await method.apply(targets[message.target], message.args as never[]);
      void announce({ type: "reply", id: message.id, result: result ?? null, state: lockState() });
    } catch (e) {
      void announce({ type: "reply", id: message.id, error: e instanceof Error ? e.message : String(e), state: lockState() });
    }
  });
}
