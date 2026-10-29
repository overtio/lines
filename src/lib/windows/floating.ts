import { SvelteSet } from "svelte/reactivity";
import { notes } from "../notes/store.svelte";
import { isDesktopApp } from "../platform";

/** Where a floating note sits. Saved per note. */
export interface FloatingState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  /** Still open when the app quit, so it reopens next launch. */
  open: boolean;
}

const KEY = "lines.floating";
const DEFAULTS: FloatingState = { width: 360, height: 420, open: false };

/** Floating notes need real windows, so they're for the desktop apps only. */
export const canFloat = isDesktopApp;

export const floatingLabel = (id: string) => `note-${id}`;

/** Notes open in floating windows right now (as the main window knows it). */
export const floatingOpen = new SvelteSet<string>();

function readAll(): Record<string, FloatingState> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function floatingState(id: string): FloatingState {
  return { ...DEFAULTS, ...readAll()[id] };
}

export function saveFloatingState(id: string, changes: Partial<FloatingState>) {
  const all = readAll();
  all[id] = { ...DEFAULTS, ...all[id], ...changes };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage full: the window just won't remember its place.
  }
}

/** Floats a note, or puts it back in the main window if it's already floating. */
export async function toggleFloating(id: string) {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const existing = await WebviewWindow.getByLabel(floatingLabel(id));
  if (existing) await existing.close();
  else await openFloating(id);
}

/** Opens a note in its own small window, or brings it forward if it's already open. */
export async function openFloating(id: string) {
  const [{ WebviewWindow }, { LogicalPosition }] = await Promise.all([
    import("@tauri-apps/api/webviewWindow"),
    import("@tauri-apps/api/dpi"),
  ]);
  const label = floatingLabel(id);
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.unminimize();
    await existing.setFocus();
    return;
  }
  const state = floatingState(id);
  saveFloatingState(id, { open: true });
  floatingOpen.add(id);
  const window = new WebviewWindow(label, {
    // The window reads which note to show from its label.
    url: "index.html",
    title: notes.get(id)?.meta.title || "Untitled",
    width: state.width,
    height: state.height,
    ...(state.x !== undefined && state.y !== undefined ? { x: state.x, y: state.y } : { center: true }),
    minWidth: 240,
    minHeight: 160,
    // Floating notes stay above other windows and follow you to every desktop, like a
    // Picture in Picture video (see also set_follows_desktops, for full-screen apps).
    alwaysOnTop: true,
    visibleOnAllWorkspaces: true,
    // Hidden until the note has drawn (the window shows itself), so it never flashes white.
    visible: false,
    // See-through when window opacity is turned down in Settings.
    transparent: true,
    titleBarStyle: "overlay",
    hiddenTitle: true,
    // Centered on the floating note's 36px title bar.
    trafficLightPosition: new LogicalPosition(14, 20),
    // Lets images be dropped into the note, rather than the window taking the drop.
    dragDropEnabled: false,
  });
  void window.once("tauri://error", (event) => {
    console.error("Couldn't open the note's window", event.payload);
    // Otherwise it would look floating, and be retried on every launch.
    saveFloatingState(id, { open: false });
    floatingOpen.delete(id);
  });
}

/** Reopens the floating notes that were open when the app last quit. */
export function restoreFloating() {
  for (const [id, state] of Object.entries(readAll())) {
    const entry = notes.get(id);
    if (state.open && entry && !entry.note.trashed) void openFloating(id);
  }
}
