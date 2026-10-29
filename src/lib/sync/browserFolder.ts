import type { Remote, RemoteObject } from "./remote";
import { SyncError } from "./remote";

/*
 * A folder on this computer, on the web: the browser's File System Access API (Chrome, Edge and
 * other Chromium browsers) lets lines read and write a folder the person picks. Notes go in it as
 * files, as the desktop apps' cloud drive folders do (folder.ts).
 *
 * The browser hands over a handle to the folder, not a path, so the handle is kept in IndexedDB
 * and the sync config holds its id (`browser:<id>`). After a reload the browser may ask again
 * before lines can use the folder, which takes a click (see `allowFolder`).
 */

type Permission = "granted" | "denied" | "prompt";

/** The parts of the API that TypeScript's DOM types don't have yet. */
interface PermissionHandle {
  queryPermission(options: { mode: "readwrite" }): Promise<Permission>;
  requestPermission(options: { mode: "readwrite" }): Promise<Permission>;
}

type DirectoryHandle = FileSystemDirectoryHandle & PermissionHandle & { values(): AsyncIterable<FileSystemHandle> };

declare global {
  interface Window {
    showDirectoryPicker?(options: { id?: string; mode: "readwrite" }): Promise<DirectoryHandle>;
  }
}

export const PREFIX = "browser:";

/** Whether this browser can save to a folder. */
export const canUseFolders = typeof window.showDirectoryPicker === "function";

export const isBrowserFolder = (path: string) => path.startsWith(PREFIX);

/* Folder handles, kept in a database of their own. */

const DB_NAME = "lines-folders";
const STORE = "folders";

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

async function saveHandle(id: string, handle: DirectoryHandle) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(handle, id);
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

async function loadHandle(id: string): Promise<DirectoryHandle | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as DirectoryHandle | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** The browser's folder picker; the folder's name and the path to save in the sync config, or null if cancelled. */
export async function pickBrowserFolder(): Promise<{ name: string; path: string } | null> {
  if (!window.showDirectoryPicker) throw new SyncError("This browser can't save to a folder. Try Chrome or Edge.");
  let handle: DirectoryHandle;
  try {
    handle = await window.showDirectoryPicker({ id: "lines", mode: "readwrite" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }
  const id = crypto.randomUUID();
  await saveHandle(id, handle);
  return { name: handle.name, path: PREFIX + id };
}

/** Whether lines may use the folder now, or needs a click first (`allowFolder`). */
export async function folderAllowed(path: string): Promise<boolean> {
  const handle = await loadHandle(path.slice(PREFIX.length));
  return !!handle && (await handle.queryPermission({ mode: "readwrite" })) === "granted";
}

/** Asks the browser to let lines use the folder again. Call it from a click. */
export async function allowFolder(path: string): Promise<boolean> {
  const handle = await loadHandle(path.slice(PREFIX.length));
  return !!handle && (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

/** A tag that changes whenever the file does. */
const etagOf = (file: File) => `${file.lastModified}-${file.size}`;

export class BrowserFolderRemote implements Remote {
  #root: Promise<DirectoryHandle> | undefined;

  constructor(readonly path: string) {}

  #handle() {
    this.#root ??= (async () => {
      const handle = await loadHandle(this.path.slice(PREFIX.length));
      if (!handle) throw new SyncError("The folder isn't available any more. Choose it again in Settings → Sync & Data.");
      if ((await handle.queryPermission({ mode: "readwrite" })) !== "granted") {
        this.#root = undefined;
        throw new SyncError(`lines needs your permission to use “${handle.name}” again. Open Settings → Sync & Data and allow it.`);
      }
      return handle;
    })();
    return this.#root;
  }

  /** The folder `key` is in (created when `create`), and the file's name. */
  async #locate(key: string, create: boolean): Promise<{ dir: FileSystemDirectoryHandle; name: string } | null> {
    const parts = key.split("/");
    const name = parts.pop()!;
    let dir: FileSystemDirectoryHandle = await this.#handle();
    try {
      for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
    } catch (error) {
      if (!create && error instanceof DOMException && error.name === "NotFoundError") return null;
      throw error;
    }
    return { dir, name };
  }

  async #file(key: string): Promise<File | null> {
    const place = await this.#locate(key, false);
    if (!place) return null;
    try {
      return await (await place.dir.getFileHandle(place.name)).getFile();
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") return null;
      throw error;
    }
  }

  async #write(key: string, data: Blob | string) {
    const { dir, name } = (await this.#locate(key, true))!;
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
    return handle.getFile();
  }

  async list(prefix: string): Promise<RemoteObject[]> {
    const place = await this.#locate(`${prefix.replace(/\/$/, "")}/x`, false);
    if (!place) return [];
    const objects: RemoteObject[] = [];
    for await (const entry of (place.dir as DirectoryHandle).values()) {
      // Drives and editors leave their own files about (".DS_Store", "note.md.tmp"…).
      if (entry.kind !== "file" || entry.name.startsWith(".")) continue;
      const file = await (entry as FileSystemFileHandle).getFile();
      objects.push({ key: `${prefix}${entry.name}`, etag: etagOf(file) });
    }
    return objects;
  }

  async get(key: string) {
    const file = await this.#file(key);
    return file && { text: await file.text(), etag: etagOf(file) };
  }

  async put(key: string, text: string) {
    return etagOf(await this.#write(key, text));
  }

  async delete(key: string) {
    const place = await this.#locate(key, false);
    if (!place) return;
    try {
      await place.dir.removeEntry(place.name);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
    }
  }

  async getFile(key: string) {
    return this.#file(key);
  }

  async putFile(key: string, data: Blob) {
    await this.#write(key, data);
  }
}
