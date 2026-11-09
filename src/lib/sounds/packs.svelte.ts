import { t } from "../i18n/index.svelte";
import { committed, request } from "../notes/storage";
import type { KeyboardSound, KeyClip, KeySounds } from "../plugins/types";
import { announce, onAnnounce } from "../windows/channel";
import { type Pack, type PackFiles, readPack, type Segment } from "./mechvibes";

/*
 * Sound packs of your own, Mechvibes' (mechvibes.com), read from a .zip or a folder (mechvibes.ts)
 * and kept on this device in a database of their own, which erasing the notes leaves, as it leaves
 * the other settings.
 */

/** A pack's sounds, decoded for `context`; a file the system can't play leaves its keys silent, all of them an error. */
async function soundsOf(pack: Pack, context: BaseAudioContext): Promise<KeySounds> {
  const buffers = new Map<string, AudioBuffer>();
  await Promise.all(
    Object.entries(pack.files).map(async ([name, file]) => {
      try {
        // A copy: decoding takes the bytes it's given. (Packs added before were kept as Blobs.)
        const data = file instanceof Blob ? await file.arrayBuffer() : file.data.slice(0);
        buffers.set(name, await context.decodeAudioData(data));
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

/** How a pack's id starts. */
const PACK = "pack-";

class SoundPacks {
  /** Your packs, as keyboards to choose after the plugins'. */
  keyboards = $state<KeyboardSound[]>([]);
  /** Whether they've been read from the database. */
  loaded = $state(false);

  constructor() {
    if (typeof indexedDB === "undefined") return;
    void this.#load();
    void onAnnounce((message) => {
      if (message.type === "sound-packs") void this.#load();
    });
  }

  async #load() {
    try {
      const tx = await store("readonly");
      const packs = await request(tx.objectStore("packs").getAll() as IDBRequest<Pack[]>);
      this.keyboards = packs.sort((a, b) => a.name.localeCompare(b.name)).map(asKeyboard);
    } finally {
      this.loaded = true;
    }
  }

  /** Whether `id` is a pack's, not read yet: not to be taken for another keyboard meanwhile. */
  reading(id: string) {
    return !this.loaded && id.startsWith(PACK);
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
    const pack: Pack = { id: `${PACK}${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`, ...readPack(files, fallbackName) };
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
