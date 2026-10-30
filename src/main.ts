import { mount, unmount } from "svelte";
import App from "./App.svelte";
import "./app.css";
import { prefs } from "./lib/prefs.svelte";
import "./lib/editor/editor.css";
import FloatingNote from "./lib/components/FloatingNote.svelte";
import Settings from "./lib/components/Settings.svelte";
import LockedNote from "./lib/components/LockedNote.svelte";
import LockScreen from "./lib/components/LockScreen.svelte";
import { lock } from "./lib/lock/lock.svelte";
import { arrived, removeUnusedAttachments } from "./lib/notes/attachments";
import { lockedNotes } from "./lib/notes/locked.svelte";
import { noteKeys } from "./lib/notes/noteKeys.svelte";
import { notes } from "./lib/notes/store.svelte";
import { isMacApp, isTauri } from "./lib/platform";
import { sync } from "./lib/sync/engine.svelte";
import { announce, onAnnounce, windowLabel } from "./lib/windows/channel";
import { canFloat, floatingOpen, restoreFloating } from "./lib/windows/floating";
import { closeSettings, forwardToMain, initialTab, isSettingsWindow, serveSettings } from "./lib/windows/settings.svelte";
import { ui } from "./lib/ui.svelte";

if (isMacApp) document.documentElement.dataset.platform = "mac-app";

if (isTauri) {
  // The webview's own right-click menu (Reload, Inspect Element) isn't part of the app. Keep it
  // only where it helps: in text you can edit (spelling, Cut, Copy, Paste) or have selected.
  addEventListener("contextmenu", (event) => {
    const target = event.target as Element | null;
    if (target?.closest('input, textarea, [contenteditable="true"]') || getSelection()?.isCollapsed === false) return;
    event.preventDefault();
  });
  // F12 opens the inspector in debug builds (View → Developer Tools in the Mac app).
  addEventListener("keydown", (event) => {
    if (event.key !== "F12") return;
    event.preventDefault();
    void import("@tauri-apps/api/core").then(({ invoke }) => invoke("toggle_devtools"));
  });
}

if (import.meta.env.DEV) Object.assign(window, { lines: { notes, sync, lock, lockedNotes, noteKeys } });

/** A floating note's window is labelled "note-<id>", Settings' "settings"; the main window "main". */
const label = windowLabel();
const floatingId = label.startsWith("note-") ? label.slice("note-".length) : null;
const isMain = !floatingId && !isSettingsWindow;

// Every window shares one database; this keeps them in step.
void onAnnounce(async (message) => {
  if (message.type === "lock") {
    // Locked, or the lock was turned on or off: whatever this window had in memory goes.
    await notes.flush();
    location.reload();
  } else if (message.type === "unlocked") {
    if (lock.locked && !isMain) location.reload();
  } else if (message.type === "activity") {
    lock.active();
  }
  if (lock.locked) return;
  if (message.type === "note") {
    void notes.reload(message.id, message.local);
  } else if (message.type === "attachment") {
    arrived(message.id);
  } else if (message.type === "notes-unlocked") {
    void lockedNotes.adopt(message.keys);
  } else if (message.type === "notes-locked") {
    void lockedNotes.close(false);
  } else if (message.type === "notes-ask") {
    if (noteKeys.anyOpen) void announce({ type: "notes-unlocked", keys: noteKeys.shared() });
  } else if (message.type === "floating") {
    if (message.open) floatingOpen.add(message.id);
    else floatingOpen.delete(message.id);
  } else if (message.type === "show" && isMain) {
    notes.show(message.id);
    if (isTauri) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().unminimize();
      await getCurrentWindow().setFocus();
    }
  }
});

const target = document.getElementById("app")!;

async function start() {
  if (lock.locked && isSettingsWindow) {
    // Settings only opens with lines unlocked; locked since, it closes.
    if (!(await lock.adopt().catch(() => false))) return closeSettings();
  }
  if (lock.locked) {
    if (floatingId) {
      // Opened with the main window already unlocked, or else wait for it to be (see "unlocked" above).
      if (!(await lock.adopt().catch(() => false))) return mount(LockedNote, { target });
    } else {
      const screen = mount(LockScreen, { target });
      await lock.unlocked;
      await unmount(screen, { outro: false });
    }
  }
  if (floatingId) {
    mount(FloatingNote, { target, props: { id: floatingId } });
    if (lock.enabled) watchActivity();
  } else if (isSettingsWindow) {
    ui.settings = initialTab();
    forwardToMain({ sync, lock, lockedNotes, notes }, sync, () => {
      lock.refresh();
      noteKeys.refresh();
    });
    mount(Settings, { target, props: { windowed: true } });
    if (lock.enabled) watchActivity();
    void closeWithMain();
  } else {
    mount(App, { target });
    if (lock.enabled) lock.watch();
  }

  await notes.load();
  // Locked notes open in another window open here too.
  void announce({ type: "notes-ask" });
  // Only the main window syncs; it hears about edits made in floating notes above.
  if (!isMain || !notes.ready) return;
  // Before syncing, which may bring in attachments for notes this list doesn't have yet.
  await removeUnusedAttachments(notes.entries.map((e) => e.note)).catch((error) =>
    console.error("lines: couldn't clean up attachments", error),
  );
  await sync.load();
  sync.start();
  // Settings, in its own window, asks this one to sync, lock and add notes.
  if (isTauri) {
    serveSettings({ sync, lock, lockedNotes, notes }, () => ({
      config: sync.config,
      status: sync.status,
      error: sync.error,
      lastSynced: sync.lastSynced,
      encryptionIssue: sync.encryptionIssue,
    }));
  }
  if (canFloat) restoreFloating();
}

/** Settings belongs to the main window: closing that closes it too. */
async function closeWithMain() {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const main = await WebviewWindow.getByLabel("main");
  void main?.once("tauri://destroyed", () => void closeSettings());
}

/** Typing in a floating note (or in Settings) keeps the main window from locking for being idle. */
function watchActivity() {
  let last = 0;
  const active = () => {
    if (Date.now() - last < 20_000) return;
    last = Date.now();
    void announce({ type: "activity" });
  };
  for (const type of ["pointerdown", "keydown"]) addEventListener(type, active, { capture: true, passive: true });
}

void start();

// Native windows start hidden and appear once the page is built and their look applied, so they
// never flash white or the wrong shape. (Hidden windows get no animation frames, so no rAF here.)
// Floating notes show themselves the same way.
if (isTauri && !floatingId) {
  void prefs.windowReady.then(async () => (await import("@tauri-apps/api/window")).getCurrentWindow().show());
}
