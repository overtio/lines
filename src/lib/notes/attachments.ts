import { isSealed, openRecord, sealRecord, vault } from "../lock/vault";
import { isDesktopApp, isTauri, download, saveFile } from "../platform";
import { announce } from "../windows/channel";
import { attachmentStore } from "./storage";
import type { Note } from "./types";

/*
 * Images and files in notes. Each one is stored on the device under a name made from its content
 * (`<hash>.<ext>`) and written into the note as ordinary Markdown, an image or a link:
 *
 *   ![](../attachments/3f9c….png)
 *   [Report.pdf](../attachments/a01b….pdf)
 *
 * The path is relative to where synced notes live (`notes/<id>.md` next to `attachments/`), so a
 * synced folder or bucket reads correctly in other Markdown apps. Since a name always means the
 * same bytes, syncing an attachment is only ever copying it to whichever side lacks it.
 */

export const ATTACHMENT_PATH = "../attachments/";

/** The image types notes show, and the extension each is saved with. */
const IMAGES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/svg+xml": "svg",
};

/** The type stored with an attachment, by extension; anything else is plain bytes. */
const TYPES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(IMAGES).map(([type, ext]) => [ext, type])),
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  zip: "application/zip",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
};

/**
 * What the browser may show in a tab of its own on the web. Not HTML, SVG or text: a page opened
 * from here would run as this site, with the notes and storage keys it can reach.
 */
const VIEWABLE = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "audio/mpeg", "audio/mp4", "audio/wav", "video/mp4", "video/webm"]);

/** A plain attachment name, as the sync folder also requires. */
const NAME = /^[0-9a-f]{32}\.[a-z0-9]{1,10}$/;

export const isAttachmentName = (name: string) => NAME.test(name);

export const isImage = (file: Blob) => file.type in IMAGES;

/**
 * An image's description (or a video's name), and the width it's shown at when one follows a bar,
 * as Obsidian writes it: `![Lake at dawn|400](…)`, `[Sky.mp4|400](…)`. A height (`|400x300`) is
 * read and left out: images and videos keep their shape.
 */
export function imageSize(label: string): { alt: string; width: number | null } {
  const match = /^(.*?)\s*\|\s*(\d{1,5})(?:\s*x\s*\d{1,5})?\s*$/.exec(label);
  return match && Number(match[2]) > 0 ? { alt: match[1], width: Number(match[2]) } : { alt: label, width: null };
}

/** An image's label with its width set, or without one (null) for the image's own size. */
export function withWidth(label: string, width: number | null) {
  const { alt } = imageSize(label);
  return width ? `${alt}|${width}` : alt;
}

/** The attachment a link or image points at, if it's one of ours. */
export function attachmentName(src: string): string | null {
  if (!src.startsWith(ATTACHMENT_PATH)) return null;
  const name = src.slice(ATTACHMENT_PATH.length);
  return NAME.test(name) ? name : null;
}

/** A link to an attachment: `](../attachments/…)` in Markdown, `{../attachments/…}` in LaTeX. */
const REFERENCE = /(?:\]\(|\{)\.\.\/attachments\/([0-9a-f]{32}\.[a-z0-9]+)[)}]/g;

/** Every attachment these notes show or link to. */
export function referencedAttachments(bodies: Iterable<string>): Set<string> {
  const names = new Set<string>();
  for (const body of bodies) for (const [, name] of body.matchAll(REFERENCE)) if (NAME.test(name)) names.add(name);
  return names;
}

/** Every attachment these notes show, locked ones included (they list theirs). */
export function usedAttachments(notes: Iterable<Note>): Set<string> {
  const names = new Set<string>();
  for (const note of notes) {
    for (const name of note.locked && !note.locked.open ? note.locked.files : referencedAttachments([note.body])) names.add(name);
  }
  return names;
}

/** The extension a file is saved with: its own, if it's a plain one. */
function extension(file: Blob) {
  if (file.type in IMAGES) return IMAGES[file.type];
  const ext = file instanceof File ? /\.([a-z0-9]{1,10})$/i.exec(file.name)?.[1].toLowerCase() : undefined;
  return ext ?? "bin";
}

/** Saves an image or file and returns its name; the same one saved twice is stored once. */
export async function saveAttachment(file: Blob): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
  const hex = Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const name = `${hex}.${extension(file)}`;
  await putAttachment(name, file);
  return name;
}

/** An attachment's extension: `csv` for `3b8a….csv`. */
export const extensionOf = (name: string) => name.slice(name.lastIndexOf(".") + 1);

const typeOf = (name: string) => TYPES[extensionOf(name)] ?? "application/octet-stream";

export type MediaKind = "audio" | "video";

/** Whether an attachment is audio or video, which notes play; null for any other file. */
export function mediaKind(name: string): MediaKind | null {
  const kind = typeOf(name).split("/")[0];
  return kind === "audio" || kind === "video" ? kind : null;
}

/** The kind of audio or video an attachment link points at; null for any other link. */
export function mediaLink(href: string): MediaKind | null {
  const name = attachmentName(href);
  return name ? mediaKind(name) : null;
}

/** Stores an attachment (one saved here, or downloaded by sync) and tells every window. */
export async function putAttachment(name: string, data: Blob) {
  await store(name, data);
  arrived(name);
  void announce({ type: "attachment", id: name });
}

/** Encrypted while the app lock is on. */
async function store(name: string, data: Blob) {
  const type = typeOf(name);
  await attachmentStore.put(
    vault.sealing
      ? await sealRecord("attachments", name, new Uint8Array(await data.arrayBuffer()))
      : { id: name, data: data.type === type ? data : new Blob([data], { type }) },
  );
}

export async function getAttachment(name: string): Promise<Blob | null> {
  const value = await attachmentStore.get(name);
  if (!value) return null;
  const type = typeOf(name);
  if (isSealed(value)) return new Blob([await openRecord("attachments", value)], { type });
  // One stored before its kind was known here (a FLAC file, say) gets its type now, which WebKit needs to play it.
  return value.data.type === type ? value.data : new Blob([value.data], { type });
}

/** Writes every attachment again, encrypted or not as the lock now says. */
export async function rewriteAttachments() {
  for (const name of await attachmentNames()) {
    const data = await getAttachment(name);
    if (data) await store(name, data);
  }
}

export const attachmentNames = () => attachmentStore.ids();

/* Showing them. */

const urls = new Map<string, Promise<string | null>>();
const waiting = new Map<string, Set<() => void>>();

/** A URL for showing an attachment, or null while it isn't on this device. */
export function attachmentURL(name: string): Promise<string | null> {
  let url = urls.get(name);
  if (!url) {
    url = getAttachment(name).then((data) => {
      if (!data) urls.delete(name);
      return data && URL.createObjectURL(data);
    });
    urls.set(name, url);
  }
  return url;
}

/** Calls `callback` when an attachment that wasn't here arrives (from sync, or another window). */
export function whenArrived(name: string, callback: () => void) {
  let set = waiting.get(name);
  if (!set) waiting.set(name, (set = new Set()));
  set.add(callback);
  return () => set.delete(callback);
}

/** An attachment was stored, here or in another window. */
export function arrived(name: string) {
  const callbacks = waiting.get(name);
  waiting.delete(name);
  for (const callback of callbacks ?? []) callback();
}

/**
 * Opens an attachment: in its own app on the Mac, in a browser tab on the web where that's safe
 * (else it downloads), and into Documents on iPhone. `label` is what the note calls it, used as
 * its file name.
 */
export async function openAttachment(name: string, label: string) {
  const data = await getAttachment(name);
  if (!data) return;
  const fileName = attachmentFileName(name, label);
  if (isDesktopApp) {
    const { invoke } = await import("@tauri-apps/api/core");
    const bytes = new Uint8Array(await data.arrayBuffer());
    await invoke("open_attachment", bytes, { headers: { "x-name": name, "x-file-name": encodeURIComponent(fileName) } });
  } else if (isTauri) {
    await saveFile(fileName, new Uint8Array(await data.arrayBuffer()), data.type);
  } else if (VIEWABLE.has(data.type)) {
    const url = URL.createObjectURL(data);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } else {
    download(fileName, data, data.type);
  }
}

/** What an attachment is called as a file: what the note calls it (`label`), made safe, with its extension. */
export function attachmentFileName(name: string, label: string) {
  const ext = extensionOf(name);
  // oxlint-disable-next-line no-control-regex -- control characters are what it takes out
  label = label.replace(/[/\\:\u0000-\u001f]/g, "-").trim().replace(/^\.+/, "") || name;
  return label.toLowerCase().endsWith(`.${ext}`) ? label : `${label}.${ext}`;
}

/** Held by every tab lines is open in, so one can tell whether it's the only one. */
const OPEN = "lines.open";

/**
 * Deletes the attachments no note shows any more, trashed ones included. Run at launch, so an
 * attachment whose Markdown was deleted can still come back with undo for as long as the app is
 * open; so not while lines is open in another tab too.
 */
export async function removeUnusedAttachments(notes: Iterable<Note>) {
  const remove = async () => {
    const used = usedAttachments(notes);
    const unused = (await attachmentNames()).filter((name) => !used.has(name));
    if (unused.length) await attachmentStore.delete(...unused);
  };
  if (!("locks" in navigator)) return remove();
  await navigator.locks.request(OPEN, { ifAvailable: true }, (alone) => alone && remove());
  void navigator.locks.request(OPEN, { mode: "shared" }, () => new Promise(() => {}));
}
