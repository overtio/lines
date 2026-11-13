import { mount, unmount } from "svelte";
import App from "./App.svelte";
import "./app.css";
import { prefs } from "./lib/prefs.svelte";
import "./lib/themes/show.svelte";
import "./lib/paper.svelte";
// Before the styles, whose rules come after it in the page and outrank it.
import "./lib/editor/editor.css";
import "./lib/themes/styles.svelte";
import "./lib/themes/fonts.svelte";
import "./lib/sounds/typing.svelte";
import "./lib/cursors.svelte";
import "./lib/mascot/pet.svelte";
import FloatingNote from "./lib/components/FloatingNote.svelte";
import Settings from "./lib/components/settings/Settings.svelte";
import LockedNote from "./lib/components/LockedNote.svelte";
import LockScreen from "./lib/components/LockScreen.svelte";
import { feeds } from "./lib/feeds/feeds.svelte";
import { player } from "./lib/player/player.svelte";
import { lock } from "./lib/lock/lock.svelte";
import { arrived, removeUnusedAttachments } from "./lib/notes/attachments";
import { lockedNotes } from "./lib/notes/locked.svelte";
import { noteKeys } from "./lib/notes/noteKeys.svelte";
import { notes } from "./lib/notes/store.svelte";
import { isDesktopApp, isMacApp, isTauri } from "./lib/platform";
import { plugins } from "./lib/plugins/registry.svelte";
import { sync } from "./lib/sync/engine.svelte";
import { announce, onAnnounce, windowLabel } from "./lib/windows/channel";
import { canFloat, floatingOpen, restoreFloating } from "./lib/windows/floating";
import { closeSettings, forwardToMain, initialSection, isSettingsWindow, serveSettings } from "./lib/windows/settings.svelte";
import { ui } from "./lib/ui.svelte";
import { updates } from "./lib/updates.svelte";

if (isMacApp) document.documentElement.dataset.platform = "mac-app";

// Something dragged in and let go where nothing takes it (the editor takes files and text, the panes
// and the sidebar a note: panes.svelte.ts) is dropped nowhere, not opened in lines' place. Text
// fields take what they take.
for (const type of ["dragover", "drop"] as const) {
  addEventListener(type, (event) => {
    const target = event.target as Element | null;
    const editable = target?.closest("[contenteditable]")?.getAttribute("contenteditable");
    if (event.defaultPrevented || target?.closest("input, textarea") || editable === "true" || editable === "") return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
  });
}

if (isTauri) {
  // The webview's own right-click menu (Reload, Inspect Element) isn't part of the app. Keep it
  // only where it helps: in text you can edit (spelling, Cut, Copy, Paste) or have selected. What a
  // note draws in its text (a spreadsheet's grid, a table, a diagram) is in the editor's editable
  // text but not editable itself, so the nearest contenteditable decides.
  addEventListener("contextmenu", (event) => {
    const target = event.target as Element | null;
    const editable = target?.closest("[contenteditable]")?.getAttribute("contenteditable");
    if (target?.closest("input, textarea") || editable === "true" || editable === "" || getSelection()?.isCollapsed === false) return;
    event.preventDefault();
  });
  // F12 opens the inspector in debug builds (View → Developer Tools in the Mac app).
  addEventListener("keydown", (event) => {
    if (event.key !== "F12") return;
    event.preventDefault();
    void import("@tauri-apps/api/core").then(({ invoke }) => invoke("toggle_devtools"));
  });
  // Quitting the Mac app waits for every window to store what's typed in it, and where the episode playing is (src-tauri/src/quit.rs).
  if (isMacApp) {
    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen("quit", async () => {
        await Promise.all([notes.leave(), player.keep()]);
        await (await import("@tauri-apps/api/core")).invoke("quit_ready");
      }),
    );
  }
}

if (import.meta.env.DEV) Object.assign(window, { lines: { notes, sync, lock, lockedNotes, noteKeys, plugins, updates } });
// The benchmarks' helpers (scripts/bench.mjs) and the browser tests' (tests/browser/), only in builds made for them.
if (import.meta.env.MODE === "bench") await import("./bench/harness");
if (import.meta.env.MODE === "test") await import("./test/harness");

/** A floating note's window is labelled "note-<id>", Settings' "settings"; the main window "main". */
const label = windowLabel();
const floatingId = label.startsWith("note-") ? label.slice("note-".length) : null;
const isMain = !floatingId && !isSettingsWindow;

// Closing the main window (and so quitting, on Windows and Linux) waits for what's typed in it to be stored, and where the episode playing is.
if (isDesktopApp && isMain) {
  void import("@tauri-apps/api/window").then(({ getCurrentWindow }) =>
    getCurrentWindow().onCloseRequested(async () => {
      await Promise.all([notes.leave(), player.keep()]);
    }),
  );
}

// Every window shares one database; this keeps them in step.
void onAnnounce(async (message) => {
  if (message.type === "lock") {
    // Locked, or the lock was turned on or off: whatever this window had in memory goes.
    await Promise.all([notes.flush(), player.keep()]);
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
  } else if (message.type === "play" && isMain) {
    player.play(message.episode);
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
    ui.settings = initialSection();
    const synced = forwardToMain({ sync, lock, lockedNotes, notes, feeds }, sync, (state) => {
      lock.settings = state.lock;
      noteKeys.settings = state.noteKeys;
    });
    // Sync's panels start from what the main window says, so they wait to hear it (a moment at most).
    await Promise.race([synced, new Promise((resolve) => setTimeout(resolve, 1000))]);
    mount(Settings, { target, props: { windowed: true } });
    if (lock.enabled) watchActivity();
    void closeWithMain();
  } else {
    mount(App, { target });
    if (lock.enabled) lock.watch();
    void updates.watch();
  }

  await notes.load();
  performance.mark("lines:notes-loaded");
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
  // Only the main window fetches feeds, as it syncs, and plays episodes.
  void feeds.start().catch((error) => console.error("lines: couldn't read the feeds kept", error));
  void player.load();
  // Settings, in its own window, asks this one to sync, lock and add notes.
  if (isTauri) {
    serveSettings(
      { sync, lock, lockedNotes, notes, feeds },
      () => ({
        config: sync.config,
        status: sync.status,
        error: sync.error,
        lastSynced: sync.lastSynced,
        encryptionIssue: sync.encryptionIssue,
        missing: sync.missing,
      }),
      () => ({ lock: lock.settings, noteKeys: noteKeys.settings }),
    );
  }
  if (canFloat) void restoreFloating();
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
