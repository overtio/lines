/*
 * Encryption, with the platform's own crypto (WebCrypto): AES-256-GCM for data, and keys made
 * from a passphrase with PBKDF2-SHA-256. Used for encrypted sync (see sync/sealed.ts) and for the
 * app lock (see lock/).
 *
 * Data is never encrypted with the passphrase itself, but with a random key that the passphrase
 * locks. Changing the passphrase only locks that key again; nothing else is re-encrypted.
 */

import { t } from "./i18n/index.svelte";

/** OWASP's recommendation for PBKDF2-HMAC-SHA256 (2023). */
const ITERATIONS = 600_000;
/** The first byte of everything sealed here, so the format can change later. */
const VERSION = 1;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type Bytes = Uint8Array<ArrayBuffer>;

export const randomBytes = (length: number): Bytes => crypto.getRandomValues(new Uint8Array(length));

export const utf8 = (text: string): Bytes => encoder.encode(text);
export const fromUtf8 = (bytes: Bytes) => decoder.decode(bytes);

export function toBase64(bytes: Bytes): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function fromBase64(text: string): Bytes {
  const binary = atob(text.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** The passphrase was wrong (or what it locks was changed). */
export class WrongPassphrase extends Error {
  constructor() {
    super(t("lock.error.wrongPassphrase"));
  }
}

/** Data that was changed, damaged, or sealed with another key. */
export class Unreadable extends Error {}

export const aesKey = (raw: Bytes) => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);

/**
 * Encrypts `data`. `context` (what it is, e.g. `notes/<id>.md`) is authenticated with it, so
 * sealed data can't be passed off as something else, like one note swapped for another.
 */
export async function seal(key: CryptoKey, data: Bytes, context: string): Promise<Bytes> {
  const iv = randomBytes(12);
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: utf8(context) }, key, data);
  const out = new Uint8Array(1 + iv.length + sealed.byteLength);
  out[0] = VERSION;
  out.set(iv, 1);
  out.set(new Uint8Array(sealed), 1 + iv.length);
  return out;
}

export async function open(key: CryptoKey, sealed: Bytes, context: string): Promise<Bytes> {
  if (sealed[0] !== VERSION || sealed.length < 1 + 12 + 16) throw new Unreadable(t("lock.error.notEncrypted"));
  try {
    const data = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: sealed.subarray(1, 13), additionalData: utf8(context) },
      key,
      sealed.subarray(13),
    );
    return new Uint8Array(data);
  } catch {
    throw new Unreadable(t("lock.error.unreadable"));
  }
}

/** A random key, locked with a passphrase. Stored as is; only the passphrase opens it. */
export interface LockedKey {
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  /** The key, sealed with the one the passphrase makes. */
  key: string;
}

async function passphraseKey(passphrase: string, salt: Bytes, iterations: number) {
  const base = await crypto.subtle.importKey("raw", utf8(passphrase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function lockKey(raw: Bytes, passphrase: string): Promise<LockedKey> {
  const salt = randomBytes(16);
  const key = await passphraseKey(passphrase, salt, ITERATIONS);
  return { kdf: "PBKDF2-SHA256", iterations: ITERATIONS, salt: toBase64(salt), key: toBase64(await seal(key, raw, "key")) };
}

export async function unlockKey(locked: LockedKey, passphrase: string): Promise<Bytes> {
  if (locked.kdf !== "PBKDF2-SHA256" || !(locked.iterations >= 100_000)) throw new Unreadable(t("lock.error.unknownFormat"));
  const key = await passphraseKey(passphrase, fromBase64(locked.salt), locked.iterations);
  try {
    return await open(key, fromBase64(locked.key), "key");
  } catch {
    throw new WrongPassphrase();
  }
}

export function isLockedKey(value: unknown): value is LockedKey {
  const v = value as LockedKey | null;
  return !!v && v.kdf === "PBKDF2-SHA256" && typeof v.iterations === "number" && typeof v.salt === "string" && typeof v.key === "string";
}

/** Keys for separate jobs, made from one random key, so each is only ever used for one thing. */
export async function subkey(raw: Bytes, purpose: string, algorithm: "AES-GCM" | "HMAC"): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: utf8(purpose) },
    base,
    algorithm === "AES-GCM" ? { name: "AES-GCM", length: 256 } : { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    algorithm === "AES-GCM" ? ["encrypt", "decrypt"] : ["sign"],
  );
}

export async function hmac(key: CryptoKey, text: string): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, utf8(text)));
}
