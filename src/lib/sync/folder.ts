import { t } from "../i18n/index.svelte";
import type { Remote, RemoteObject } from "./remote";
import { SyncError } from "./remote";

/**
 * A folder on this computer that a cloud drive app keeps in sync: iCloud Drive, Google Drive,
 * Proton Drive, Dropbox, OneDrive… Notes are written as files and the drive's app does the rest.
 * Native apps only; the file access is in src-tauri/src/folder_sync.rs.
 */
export class FolderRemote implements Remote {
  constructor(readonly root: string) {}

  async #call<T>(command: string, args: Record<string, unknown>): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      return await invoke<T>(command, args);
    } catch (error) {
      // The app's native side says what went wrong in English; this says it's the folder.
      throw new SyncError(t("sync.folder.failed", { error: String(error) }));
    }
  }

  /** `notes/<id>.md` → the folder and file name. */
  #split(key: string) {
    const slash = key.lastIndexOf("/");
    return { dir: slash === -1 ? this.root : `${this.root}/${key.slice(0, slash)}`, name: key.slice(slash + 1) };
  }

  async list(prefix: string): Promise<RemoteObject[]> {
    const dir = `${this.root}/${prefix.replace(/\/$/, "")}`;
    const entries = await this.#call<{ name: string; etag: string }[]>("sync_folder_list", { dir });
    return entries.map(({ name, etag }) => ({ key: `${prefix}${name}`, etag }));
  }

  async get(key: string) {
    return this.#call<{ text: string; etag: string } | null>("sync_folder_read", this.#split(key));
  }

  async put(key: string, text: string) {
    return this.#call<string>("sync_folder_write", { ...this.#split(key), text });
  }

  async delete(key: string) {
    await this.#call<void>("sync_folder_delete", this.#split(key));
  }

  async getFile(key: string) {
    const bytes = await this.#call<ArrayBuffer>("sync_folder_read_file", this.#split(key));
    // Nothing comes back for a file that isn't there, or that the drive hasn't downloaded yet.
    return bytes.byteLength ? new Blob([bytes]) : null;
  }

  async putFile(key: string, data: Blob) {
    const { invoke } = await import("@tauri-apps/api/core");
    const { dir, name } = this.#split(key);
    try {
      // The bytes go as they are rather than as JSON; the folder is percent-encoded to fit in a header.
      await invoke("sync_folder_write_file", new Uint8Array(await data.arrayBuffer()), {
        headers: { "x-dir": encodeURIComponent(dir), "x-name": name },
      });
    } catch (error) {
      throw new SyncError(t("sync.folder.failed", { error: String(error) }));
    }
  }
}

export type DriveId = "icloud" | "google" | "proton" | "dropbox" | "onedrive" | "box" | "folder";

/** A synced cloud folder found on this computer. */
export interface CloudFolder {
  provider: DriveId;
  name: string;
  path: string;
}

export async function findCloudFolders(): Promise<CloudFolder[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<CloudFolder[]>("sync_folder_candidates");
}

/** The system folder picker; null if cancelled. */
export async function pickFolder(): Promise<string | null> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string | null>("sync_folder_pick");
}
