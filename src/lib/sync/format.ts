import { ICONS, type IconName } from "../icons/icons";
import { isWrappedKey } from "../notes/noteKeys.svelte";
import { DEFAULT_LANGUAGE } from "../plugins/registry.svelte";
import type { Note, NoteLock } from "../notes/types";

/*
 * Notes are stored remotely as ordinary Markdown files with a small front
 * matter block, so a bucket of notes stays readable without lines:
 *
 *   ---
 *   id: 6f1c…
 *   created: 2026-10-28T14:43:00.000Z
 *   updated: 2026-10-28T15:02:11.000Z
 *   pinned: false
 *   trashed: false
 *   icon: rocket
 *   format: latex
 *   ---
 *   # My note
 *
 * `icon` is only there for a note that has one, and `format` for a note not written in Markdown
 * (the id of its language, which a plugin adds), so other notes stay byte for byte as they were.
 * A language this device doesn't have is kept as it is.
 *
 * A locked note's Markdown is encrypted (see notes/noteKeys.svelte.ts). What it keeps readable,
 * its title and its key (itself locked with the password), is one line of JSON, and the
 * encrypted Markdown is the body:
 *
 *   locked: {"title":"Bank","files":[],"key":{"id":"…","changed":…,"kdf":"PBKDF2-SHA256",…}}
 *   ---
 *   AWeRtq…
 */

export function serialize(note: Note): string {
  const lock = note.locked && { title: note.locked.title, files: note.locked.files, key: note.locked.key };
  return [
    "---",
    `id: ${note.id}`,
    `created: ${new Date(note.createdAt).toISOString()}`,
    `updated: ${new Date(note.updatedAt).toISOString()}`,
    `pinned: ${note.pinned}`,
    `trashed: ${note.trashed}`,
    ...(note.icon ? [`icon: ${note.icon}`] : []),
    ...(note.format ? [`format: ${note.format}`] : []),
    ...(lock ? [`locked: ${JSON.stringify(lock)}`] : []),
    "---",
    note.locked ? note.locked.sealed : note.body,
  ].join("\n");
}

export function deserialize(text: string, fallbackId: string): Note {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  const fields = new Map<string, string>();
  for (const line of match?.[1].split("\n") ?? []) {
    const colon = line.indexOf(":");
    if (colon > 0) fields.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
  }
  const time = (key: string) => {
    const ms = Date.parse(fields.get(key) ?? "");
    return Number.isNaN(ms) ? Date.now() : ms;
  };
  const icon = fields.get("icon");
  const format = fields.get("format");
  const body = match ? text.slice(match[0].length) : text;
  const locked = readLock(fields.get("locked"), body);
  return {
    id: fields.get("id") || fallbackId,
    body: locked ? "" : body,
    createdAt: time("created"),
    updatedAt: time("updated"),
    pinned: fields.get("pinned") === "true",
    trashed: fields.get("trashed") === "true",
    ...(icon && icon in ICONS ? { icon: icon as IconName } : {}),
    ...(isLanguage(format) ? { format } : {}),
    ...(locked ? { locked } : {}),
  };
}

/** A language's id, other than Markdown's, which is what a note without one is in. */
const isLanguage = (id: string | undefined): id is string => !!id && id !== DEFAULT_LANGUAGE && /^[a-z0-9][a-z0-9-]*$/.test(id);

function readLock(field: string | undefined, body: string): NoteLock | undefined {
  if (!field) return;
  try {
    const { title, files, key } = JSON.parse(field);
    if (typeof title !== "string" || !Array.isArray(files) || !isWrappedKey(key)) return;
    return { key, title, files: files.filter((file): file is string => typeof file === "string"), sealed: body.trim() };
  } catch {
    return;
  }
}

/** Fast non-cryptographic string hash (cyrb53), used to detect local edits. */
export function hash(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
