import { t } from "../i18n/index.svelte";
import { isDesktopApp } from "../platform";
import { ui, type SettingsTab } from "../ui.svelte";
import { announce, onAnnounce, windowLabel } from "./channel";

/*
 * Settings in the desktop apps is a window of its own (labelled "settings"), elsewhere a dialog
 * over the notes. The window shows the same panels, but the main window is the one that syncs,
 * locks and keeps the list: what those panels ask of sync, the app lock, locked notes and the note
 * list is done there (`forwardToMain`), and sync's state comes back to show (`serveSettings`).
 */

export const SETTINGS_LABEL = "settings";

/** This window is the Settings window. */
export const isSettingsWindow = windowLabel() === SETTINGS_LABEL;

const TABS: SettingsTab[] = ["theme", "text", "data", "shortcuts", "about"];

/** The tab the Settings window opens on, from its address. */
export function initialTab(): SettingsTab {
  const tab = new URLSearchParams(location.search).get("tab") as SettingsTab | null;
  return tab && TABS.includes(tab) ? tab : "theme";
}

/** Opens Settings on a tab: its own window in the desktop apps (brought forward if open), a dialog elsewhere. */
export async function openSettings(tab: SettingsTab) {
  if (!isDesktopApp) {
    ui.settings = tab;
    return;
  }
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const existing = await WebviewWindow.getByLabel(SETTINGS_LABEL);
  if (existing) {
    void announce({ type: "settings-tab", tab });
    await existing.unminimize();
    await existing.setFocus();
    return;
  }
  const { LogicalPosition } = await import("@tauri-apps/api/dpi");
  const window = new WebviewWindow(SETTINGS_LABEL, {
    url: `index.html?tab=${tab}`,
    title: t("settings.title"),
    width: 680,
    height: 640,
    minWidth: 420,
    minHeight: 360,
    center: true,
    // Hidden until it has drawn (it shows itself), so it never flashes white.
    visible: false,
    titleBarStyle: "overlay",
    hiddenTitle: true,
    // Centered on the tabs' row.
    trafficLightPosition: new LogicalPosition(16, 31),
  });
  void window.once("tauri://error", (event) => console.error("lines: couldn't open the Settings window", event.payload));
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
 * `after` runs once each is done there (to read again what it changed). Sync's state follows the main window's.
 */
export function forwardToMain(targets: Record<string, Target>, sync: SyncState, after: () => void) {
  const waiting = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  void onAnnounce((message) => {
    if (message.type === "reply") {
      const call = waiting.get(message.id);
      if (!call) return;
      waiting.delete(message.id);
      after();
      if (message.error === undefined) call.resolve(message.result);
      else call.reject(new Error(message.error));
    } else if (message.type === "sync-state") {
      Object.assign(sync, message.state);
    } else if (message.type === "settings-tab") {
      ui.settings = message.tab as SettingsTab;
    }
  });
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
  void announce({ type: "sync-ask" });
}

/** In the main window: does what the Settings window asks, and tells it how sync is doing. */
export function serveSettings(targets: Record<string, Target>, syncState: () => SyncState) {
  const tell = () => void announce({ type: "sync-state", state: syncState() });
  $effect.root(() => {
    $effect(tell);
  });
  void onAnnounce(async (message) => {
    if (message.type === "sync-ask") tell();
    if (message.type !== "call" || !FORWARDED[message.target]?.includes(message.method)) return;
    try {
      const method = methods(targets[message.target])[message.method] as Method;
      const result = await method.apply(targets[message.target], message.args as never[]);
      void announce({ type: "reply", id: message.id, result: result ?? null });
    } catch (e) {
      void announce({ type: "reply", id: message.id, error: e instanceof Error ? e.message : String(e) });
    }
  });
}
