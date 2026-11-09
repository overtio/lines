import { t } from "../i18n/index.svelte";
import { committed, request } from "../notes/storage";
import type { KeyboardSound, KeyClip, KeySounds } from "../plugins/types";
import { announce, onAnnounce } from "../windows/channel";
import { V1_KEYS } from "./v1keys";

/*
 * Sound packs of your own: Mechvibes' (mechvibes.com, and the many people share), read from a .zip
 * or a folder in either of its formats: V1, its keys by number, and V2, by the names browsers give
 * them; one sound file for every key, or one for each. Kept on this device in a database of their
 * own, which erasing the notes leaves, as it leaves the other settings.
 */

/** A pack's files by their path in it. */
export type PackFiles = Map<string, Uint8Array<ArrayBuffer>>;

/** Where a key's sound is: a file, and the part of it from `start` to `end`, in ms (all of it without them). */
interface Segment {
  file: string;
  start?: number;
  end?: number;
}

interface Pack {
  id: string;
  name: string;
  author?: string;
  /** Each key's sounds, going down and coming up, by `KeyboardEvent.code`. */
  keys: Record<string, { press?: Segment; release?: Segment }>;
  files: Record<string, Blob>;
}

const AUDIO_TYPES: Record<string, string> = { ogg: "audio/ogg", wav: "audio/wav", mp3: "audio/mpeg", flac: "audio/flac", m4a: "audio/mp4" };

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const timing = (pair: unknown): [number, number] | undefined =>
  Array.isArray(pair) && pair.length === 2 && pair.every((n) => typeof n === "number" && Number.isFinite(n)) ? [pair[0], pair[1]] : undefined;

/** A pack's name and keys from its config.json, in either of Mechvibes' formats. */
function readConfig(config: Record<string, unknown>) {
  const keys: Pack["keys"] = {};
  const definitions = config.definitions ?? config.defs;
  if (definitions && typeof definitions === "object") {
    // V2: by name, each with one segment (pressed) or two (pressed, then let go), in the pack's file or the key's own.
    const multi = config.definition_method === "multi";
    for (const [code, definition] of Object.entries(definitions as Record<string, unknown>)) {
      if (!definition || typeof definition !== "object") continue;
      const { audio_file: own, timing: segments } = definition as { audio_file?: unknown; timing?: unknown };
      const file = (multi && text(own)) || text(config.audio_file);
      if (!file) continue;
      if (!Array.isArray(segments) || !segments.length) {
        if (multi) keys[code] = { press: { file } };
        continue;
      }
      // More than two plays nothing, as in Mechvibes.
      if (segments.length > 2) continue;
      const [press, release] = segments.map(timing);
      keys[code] = { press: press && { file, start: press[0], end: press[1] }, release: release && { file, start: release[0], end: release[1] } };
    }
  } else if (config.defines && typeof config.defines === "object") {
    // V1: by number, as [start, length] in the pack's file, or each key's own file; a number with a
    // leading zero ("030") is the key let go.
    const multi = config.key_define_type === "multi";
    const sound = text(config.sound);
    for (const [number, value] of Object.entries(config.defines as Record<string, unknown>)) {
      const code = V1_KEYS[Number(number)];
      const release = number.length > 1 && number.startsWith("0");
      const span = timing(value);
      const segment: Segment | undefined = multi ? (text(value) ? { file: text(value)! } : undefined) : span && sound ? { file: sound, start: span[0], end: span[0] + span[1] } : undefined;
      // A key a pack names twice (the numpad's with Num Lock off) keeps its first sound.
      if (code && segment) (keys[code] ??= {})[release ? "release" : "press"] ??= segment;
    }
  }
  return { name: text(config.name), author: text(config.author) ?? text(config.m_author), keys };
}

/** A pack from its files: the config.json nearest the top, and the sounds it names. Throws if it isn't one. */
export function readPack(files: PackFiles, fallbackName: string): Omit<Pack, "id"> {
  const configPath = [...files.keys()]
    .filter((path) => /(^|\/)config\.json$/i.test(path) && !path.startsWith("__MACOSX/"))
    .sort((a, b) => a.split("/").length - b.split("/").length)[0];
  if (!configPath) throw new Error("A sound pack has a config.json");
  const folder = configPath.slice(0, configPath.lastIndexOf("/") + 1);
  const { name, author, keys } = readConfig(JSON.parse(new TextDecoder().decode(files.get(configPath))) as Record<string, unknown>);
  // The sounds it names, beside its config.json, kept by the names it gives them.
  const byPath = new Map([...files].map(([path, bytes]) => [path.toLowerCase(), bytes]));
  const found: Pack["files"] = {};
  for (const key of Object.values(keys)) {
    for (const segment of [key.press, key.release]) {
      if (!segment || segment.file in found) continue;
      const bytes = byPath.get((folder + segment.file.replace(/^\.\//, "")).toLowerCase());
      const extension = segment.file.split(".").pop()!.toLowerCase();
      if (bytes) found[segment.file] = new Blob([bytes], { type: AUDIO_TYPES[extension] ?? "" });
    }
  }
  for (const [code, key] of Object.entries(keys)) {
    if (key.press && !found[key.press.file]) delete key.press;
    if (key.release && !found[key.release.file]) delete key.release;
    if (!key.press && !key.release) delete keys[code];
  }
  if (!Object.keys(keys).length) throw new Error("A sound pack's config.json names sounds it has");
  return { name: name ?? fallbackName, author, keys, files: found };
}

/** A pack's sounds, decoded for `context`; a file the system can't play leaves its keys silent, all of them an error. */
async function soundsOf(pack: Pack, context: BaseAudioContext): Promise<KeySounds> {
  const buffers = new Map<string, AudioBuffer>();
  await Promise.all(
    Object.entries(pack.files).map(async ([name, blob]) => {
      try {
        buffers.set(name, await context.decodeAudioData(await blob.arrayBuffer()));
      } catch {
        // Not a format this system plays (OGG on some); its keys stay silent.
      }
    }),
  );
  if (!buffers.size) throw new Error("None of the pack's sounds can be played here");
  const clip = (segment?: Segment): KeyClip | undefined => {
    const buffer = segment && buffers.get(segment.file);
    if (!buffer) return undefined;
    if (segment.start === undefined) return { buffer };
    const offset = segment.start / 1000;
    return offset < buffer.duration ? { buffer, offset, duration: Math.min(segment.end! / 1000, buffer.duration) - offset } : undefined;
  };
  // A key the pack has no sound for sounds like one of its letters (or else any key it has).
  const letters = Object.keys(pack.keys).filter((code) => /^Key[A-Z]$/.test(code) && pack.keys[code].press);
  const stand = letters.length ? letters : Object.keys(pack.keys).filter((code) => pack.keys[code].press);
  const instead = () => pack.keys[stand[Math.floor(Math.random() * stand.length)]]?.press;
  return {
    press: (code) => clip(pack.keys[code]?.press ?? instead()),
    release: (code) => clip(pack.keys[code]?.release),
  };
}

let db: Promise<IDBDatabase> | undefined;

function store(mode: IDBTransactionMode) {
  db ??= new Promise((resolve, reject) => {
    const open = indexedDB.open("lines-sounds", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("packs", { keyPath: "id" });
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  return db.then((database) => database.transaction("packs", mode));
}

const asKeyboard = (pack: Pack): KeyboardSound => ({
  id: pack.id,
  name: pack.name,
  description: pack.author ? t("settings.soundPackBy", { author: pack.author }) : undefined,
  load: (context) => soundsOf(pack, context),
});

class SoundPacks {
  /** Your packs, as keyboards to choose after the plugins'. */
  keyboards = $state<KeyboardSound[]>([]);

  constructor() {
    if (typeof indexedDB === "undefined") return;
    void this.#load();
    void onAnnounce((message) => {
      if (message.type === "sound-packs") void this.#load();
    });
  }

  async #load() {
    const tx = await store("readonly");
    const packs = await request(tx.objectStore("packs").getAll() as IDBRequest<Pack[]>);
    this.keyboards = packs.sort((a, b) => a.name.localeCompare(b.name)).map(asKeyboard);
  }

  async #write(change: (packs: IDBObjectStore) => void) {
    const tx = await store("readwrite");
    change(tx.objectStore("packs"));
    await committed(tx);
    await this.#load();
    void announce({ type: "sound-packs" });
  }

  /** Adds the pack in `files` (a .zip's or a folder's) and returns its id; throws if it isn't a pack. */
  async add(files: PackFiles, fallbackName: string) {
    const pack: Pack = { id: `pack-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`, ...readPack(files, fallbackName) };
    await this.#write((packs) => packs.put(pack));
    return pack.id;
  }

  remove(id: string) {
    return this.#write((packs) => packs.delete(id));
  }

  owns(id: string) {
    return this.keyboards.some((keyboard) => keyboard.id === id);
  }
}

export const soundPacks = new SoundPacks();
