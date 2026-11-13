import { fromBase64, fromUtf8, open, seal, toBase64, utf8, type Bytes } from "../crypto";
import { t } from "../i18n/index.svelte";

/*
 * What the app lock encrypts on this device: notes, attachments, feeds' posts, and the sync settings
 * (with their keys). While the lock is on, everything is written encrypted with the device key, which
 * only exists in memory once lines is unlocked. Reading takes either form, so turning the lock on
 * or off can rewrite things one at a time, and pick up where it left off.
 */

let key: CryptoKey | null = null;
let sealing = false;

export const vault = {
  /** Whether what's written now is encrypted. */
  get sealing() {
    return sealing;
  },
  /** The device key once unlocked: what's written from now on is encrypted with it. */
  use(next: CryptoKey | null) {
    key = next;
    sealing = next !== null;
  },
  /** While the lock is turned off: the key still reads, but nothing more is written with it. */
  stopSealing() {
    sealing = false;
  },
};

/** A record stored encrypted, under its plain id. */
export interface Sealed {
  id: string;
  sealed: Bytes;
}

export const isSealed = (value: object): value is Sealed => "sealed" in value;

export async function sealRecord(store: string, id: string, data: Bytes): Promise<Sealed> {
  if (!key) throw new Error(t("lock.screen.title"));
  return { id, sealed: await seal(key, data, `${store}/${id}`) };
}

export async function openRecord(store: string, record: Sealed): Promise<Bytes> {
  if (!key) throw new Error(t("lock.screen.title"));
  return open(key, record.sealed, `${store}/${record.id}`);
}

/** A JSON value kept in localStorage: encrypted while the lock is on. */
export async function readSecret<T>(name: string): Promise<T | null> {
  try {
    const value = JSON.parse(localStorage.getItem(name) ?? "null");
    if (value && typeof value.sealed === "string") {
      return JSON.parse(fromUtf8(await openRecord("local", { id: name, sealed: fromBase64(value.sealed) })));
    }
    return value;
  } catch (error) {
    console.error(`lines: couldn't read ${name}`, error);
    return null;
  }
}

export async function writeSecret(name: string, value: unknown) {
  if (value === null || value === undefined) return localStorage.removeItem(name);
  const json = JSON.stringify(value);
  const stored = sealing ? JSON.stringify({ sealed: toBase64((await sealRecord("local", name, utf8(json))).sealed) }) : json;
  localStorage.setItem(name, stored);
}
