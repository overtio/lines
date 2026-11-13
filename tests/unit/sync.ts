import { mock } from "bun:test";
import { format, type Params } from "../../src/lib/i18n/format";
import en from "../../src/lib/i18n/locales/en";
import type { SyncRecord } from "../../src/lib/notes/storage";
import type { Note } from "../../src/lib/notes/types";
import type { NoteLanguage } from "../../src/lib/plugins/types";
import type { FolderConfig } from "../../src/lib/sync/providers";
import { stubApp } from "./stubs";

/*
 * Devices syncing through a cloud drive's folder, for sync's tests: the real notes store and sync
 * engine, with each device's notes and sync records in memory in place of IndexedDB, and the folder
 * in memory too, answering the app's folder commands as src-tauri/src/folder_sync.rs does. There's
 * one store and one engine, so devices take turns: `open()` loads a device's notes, as starting
 * lines there would.
 */

stubApp();
// In English, to read a conflicted copy's title as people would.
mock.module("../../src/lib/i18n/index.svelte", () => ({
  t: (key: string, params?: Params) => format((en as Record<string, string>)[key] ?? key, params, "en"),
  language: "en",
  locale: "en",
}));
mock.module("../../src/lib/print/parts", () => ({ el: () => null }));
mock.module("../../src/lib/a11y", () => ({ speak: () => {} }));
// Settings, which read the page's storage: only what the notes store asks for.
mock.module("../../src/lib/prefs.svelte", () => ({ prefs: { calendarEdited: false } }));
mock.module("../../src/lib/windows/channel", () => ({ announce: async () => {}, onAnnounce: async () => () => {}, windowLabel: () => "main" }));
// A folder on the web is the browser's to give.
mock.module("../../src/lib/sync/browserFolder", () => ({ BrowserFolderRemote: null, isBrowserFolder: () => false }));

/** One device's on-device database. */
interface Database {
  notes: Map<string, Note>;
  sync: Map<string, SyncRecord>;
  attachments: Map<string, { id: string }>;
}

const empty = (): Database => ({ notes: new Map(), sync: new Map(), attachments: new Map() });
let here = empty();

/** One of the database's object stores, on the device that's open. */
function objectStore<T extends { id: string }>(name: keyof Database) {
  const map = () => here[name] as unknown as Map<string, T>;
  return {
    all: async () => [...map().values()].map((value) => structuredClone(value)),
    get: async (id: string) => structuredClone(map().get(id)),
    ids: async () => [...map().keys()],
    put: async (...values: T[]) => values.forEach((value) => map().set(value.id, structuredClone(value))),
    delete: async (...ids: string[]) => ids.forEach((id) => map().delete(id)),
    clear: async () => map().clear(),
  };
}

mock.module("../../src/lib/notes/storage", () => ({
  IndexedDBStorage: class {
    #notes = objectStore<Note>("notes");
    all = this.#notes.all;
    get = this.#notes.get;
    put = this.#notes.put;
    delete = this.#notes.delete;
    rewrite = async () => {};
  },
  syncRecords: objectStore<SyncRecord>("sync"),
  attachmentStore: objectStore("attachments"),
}));

const { addTagIn, computeMeta } = await import("../../src/lib/notes/parse");
const markdown = { id: "markdown", name: "Markdown", extensions: ["md"], meta: computeMeta, addTag: addTagIn, newNote: () => "# " };

/** The languages notes can be in: Markdown, and any a test adds. */
export const languages: Partial<NoteLanguage>[] = [markdown];
const language = (id?: string) => languages.find((each) => each.id === id) ?? markdown;
mock.module("../../src/lib/plugins/registry.svelte", () => ({
  DEFAULT_LANGUAGE: "markdown",
  plugins: {
    get languages() {
      return languages;
    },
    language,
    meta: (id: string | undefined, body: string) => language(id).meta!(body),
    libraryKind: () => undefined,
  },
}));

/** The folder's files by path, the same on every device, as the drive keeps them. */
export const drive = new Map<string, { text: string; etag: string }>();
let writes = 0;

/** Something to do just before the folder's next write, as another device could. */
export const beforeWrite: { next?: (path: string) => void } = {};

type FolderArgs = { dir: string; name: string; text: string; expected?: string };

mock.module("@tauri-apps/api/core", () => ({
  invoke: async (command: string, { dir, name, text, expected }: FolderArgs) => {
    const path = `${dir}/${name}`;
    if (command === "sync_folder_list") {
      return [...drive]
        .filter(([file]) => file.startsWith(`${dir}/`) && !file.slice(dir.length + 1).includes("/"))
        .map(([file, { etag }]) => ({ name: file.slice(dir.length + 1), etag }));
    }
    if (command === "sync_folder_read") return drive.get(path) ?? null;
    if (command === "sync_folder_write") {
      const write = beforeWrite.next;
      beforeWrite.next = undefined;
      write?.(path);
      // Only over the file it was expected to be (none, if empty).
      if (expected !== undefined && (drive.get(path)?.etag ?? "") !== expected) return null;
      const file = { text, etag: `${++writes}` };
      drive.set(path, file);
      return file.etag;
    }
    if (command === "sync_folder_delete") return void drive.delete(path);
    throw new Error(`No folder command ${command}`);
  },
}));

Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
// A device with no notes starts without the welcome note.
localStorage.setItem("lines.seeded", "1");

export const { notes } = await import("../../src/lib/notes/store.svelte");
export const { sync } = await import("../../src/lib/sync/engine.svelte");
export const { serialize, deserialize } = await import("../../src/lib/sync/format");

export const FOLDER: FolderConfig = { kind: "folder", provider: "folder", name: "Drive", path: "/drive/lines" };

/** Where a note's file is in the folder. */
export const fileOf = (id: string) => `${FOLDER.path}/notes/${id}.md`;

/** A device with lines on it, syncing through the folder. */
export class Device {
  #database = empty();

  /** Starts lines here, with this device's notes. */
  async open() {
    await notes.flush();
    here = this.#database;
    await notes.load();
  }

  /** Opens lines here, if it isn't, and syncs. */
  async sync() {
    if (here !== this.#database) await this.open();
    await sync.syncNow();
  }
}

/** Devices with no notes, connected to an empty folder; the first is open. */
export async function devices(count: number) {
  // Once the last test's passes are done.
  await sync.configure(null);
  drive.clear();
  const all = Array.from({ length: count }, () => new Device());
  await all[0].open();
  await sync.configure(FOLDER);
  return all;
}

/** An edit made a moment later on another device, written to the folder as its sync would. */
export function editElsewhere(id: string, changes: Partial<Note>) {
  const file = drive.get(fileOf(id))!;
  drive.set(fileOf(id), { text: serialize({ ...deserialize(file.text, id), updatedAt: Date.now() + 1000, ...changes }), etag: `${++writes}` });
}
