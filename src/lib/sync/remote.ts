/**
 * Where synced notes live: a bucket or a cloud drive folder. Keys are paths like `notes/<id>.md`
 * and `attachments/<hash>.png`.
 */
export interface Remote {
  /** Every object under `prefix`, with a tag that changes whenever its content does. */
  list(prefix: string): Promise<RemoteObject[]>;
  get(key: string): Promise<{ text: string; etag: string | null } | null>;
  /** Returns the new tag, if known. */
  put(key: string, text: string): Promise<string | null>;
  delete(key: string): Promise<void>;
  /** Images and other files; null if it's not there (yet). */
  getFile(key: string): Promise<Blob | null>;
  putFile(key: string, data: Blob): Promise<void>;
  /** Where a file is stored, for a remote that doesn't use the key as is (an encrypted one). */
  fileKey?(key: string): Promise<string>;
}

export interface RemoteObject {
  key: string;
  etag: string;
}

/** A problem worth showing as-is in the Sync settings. */
export class SyncError extends Error {}
