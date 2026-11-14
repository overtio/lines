import { onPhoneOrTablet } from "./device";

export const isTauri = "__TAURI_INTERNALS__" in window;
/** The demo website (`bun run build:site`): the web app with the feature tour, saving only to a folder. */
export const isSite = import.meta.env.VITE_SITE === "1";

const ua = navigator.userAgent;
export const isApple = /Mac|iPhone|iPad|iPod/.test(ua);
const isMobile = onPhoneOrTablet(ua, navigator.maxTouchPoints);

/** The native macOS app, where the window draws traffic lights over our content. */
export const isMacApp = isTauri && /Macintosh/.test(ua) && !isMobile;

/** A touch screen is the main pointer; it may change, so read `.matches` when it matters. */
export const coarsePointer = matchMedia("(pointer: coarse)");

/**
 * Reduced motion is turned on in the system. app.css stops CSS transitions for it; animations run
 * from script (Web Animations, Svelte transitions, waits for a slide) check this themselves.
 */
export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

export const modKey = isApple ? "⌘" : "Ctrl+";

/** The Mac, Windows or Linux app (not the web, and not phones or tablets). */
export const isDesktopApp = isTauri && !isMobile;

/** The system print dialog: in browsers, and in the desktop apps (not on iPhone or iPad). */
export const canPrint = !isTauri || isDesktopApp;

/**
 * Browsers keep ⌘N / Ctrl+N for opening a new window and don't let pages have it,
 * so the web app uses ⌥N / Alt+N for a new note. The native apps get the usual shortcut.
 */
export const newNoteKey = isTauri ? `${modKey}N` : isApple ? "⌥N" : "Alt+N";

export function isNewNoteShortcut(event: KeyboardEvent) {
  if (event.shiftKey) return false;
  if (isTauri) return (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "n";
  // By key position, since ⌥N on a Mac types a dead key rather than "n".
  return event.altKey && !event.metaKey && !event.ctrlKey && event.code === "KeyN";
}

const SAFE_URL = /^(https?:|mailto:|tel:)/i;

let nativeFetch: Promise<typeof fetch> | undefined;

/**
 * `fetch` for other sites (a sync bucket, Unsplash). In the native apps requests go through Rust,
 * so the site needs no CORS setup for lines; in the browser they're plain fetches.
 */
export function webFetch(): Promise<typeof fetch> {
  if (!isTauri) return Promise.resolve(fetch.bind(window));
  return (nativeFetch ??= import("@tauri-apps/plugin-http").then((module) => module.fetch as typeof fetch));
}

export async function openExternal(url: string) {
  if (!SAFE_URL.test(url)) return;
  if (isTauri) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Saves a file through the browser's downloads. */
export function download(filename: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename: string, text: string, type = "text/markdown") {
  download(filename, text, `${type};charset=utf-8`);
}

/**
 * Saves a file: a normal download on the web, or straight into Downloads in the apps (Documents
 * on iPhone), never overwriting. Returns the saved path in the apps, null on the web.
 */
export async function saveFile(filename: string, data: Uint8Array<ArrayBuffer>, type: string): Promise<string | null> {
  if (!isTauri) {
    download(filename, data, type);
    return null;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("save_export", data, { headers: { "x-file-name": encodeURIComponent(filename) } });
}

/** Whether every address a site's name stands for is on the web at large, as the system looks it up (the apps); true elsewhere, where the browser keeps pages off this computer's network. */
export async function hostIsPublic(host: string): Promise<boolean> {
  if (!isTauri) return true;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("host_is_public", { host });
}

/** The paths of what was last dragged from Finder, which a page isn't told (the Mac app); none elsewhere. */
export async function droppedPaths(): Promise<string[]> {
  if (!isMacApp) return [];
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string[]>("dropped_paths");
}

/** A folder chosen with the system's picker, to link to (the Mac app), `prompt` on its button and `message` above. */
export async function pickLinkFolder(prompt: string, message: string): Promise<string | null> {
  if (!isMacApp) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string | null>("pick_link_folder", { prompt, message });
}

/**
 * Opens a folder or file on this computer (a note's link to it) in the desktop apps: a folder in
 * Finder, a file in its app. Whether it did, the path isn't there, it couldn't be opened, or nothing
 * here can open one.
 */
export async function openPath(path: string): Promise<"opened" | "missing" | "failed" | "unavailable"> {
  if (!isDesktopApp) return "unavailable";
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    await invoke("open_local", { path });
    return "opened";
  } catch (error) {
    if (error === "missing") return "missing";
    console.error(`Couldn't open ${path}:`, error);
    return "failed";
  }
}

/** Shows a saved file in Finder (or the system's file manager). */
export async function revealFile(path: string) {
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(path);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older webviews: fall back to a hidden textarea.
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}
