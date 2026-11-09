import { V1_KEYS } from "./v1keys";

/*
 * Mechvibes' sound packs (mechvibes.com, and the many people share), as files: a config.json in
 * either of its formats, V1, its keys by number, and V2, by the names browsers give them; and one
 * sound file for every key, or one for each. packs.svelte.ts keeps them.
 */

/** A pack's files by their path in it. */
export type PackFiles = Map<string, Uint8Array<ArrayBuffer>>;

/** Where a key's sound is: a file, and the part of it from `start` to `end`, in ms (all of it without them). */
export interface Segment {
  file: string;
  start?: number;
  end?: number;
}

/** A sound file, as bytes and their type: what every browser's database keeps (Safari's private windows don't keep a Blob). */
export interface PackFile {
  type: string;
  data: ArrayBuffer;
}

export interface Pack {
  id: string;
  name: string;
  author?: string;
  /** Each key's sounds, going down and coming up, by `KeyboardEvent.code`. */
  keys: Record<string, { press?: Segment; release?: Segment }>;
  files: Record<string, PackFile>;
}

const AUDIO_TYPES: Record<string, string> = { ogg: "audio/ogg", wav: "audio/wav", mp3: "audio/mpeg", flac: "audio/flac", m4a: "audio/mp4" };

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const timing = (pair: unknown): [number, number] | undefined =>
  Array.isArray(pair) && pair.length === 2 && pair.every((n) => typeof n === "number" && Number.isFinite(n)) ? [pair[0], pair[1]] : undefined;
/** The part of `file` from `start` to `end`, in ms; none for a part that's empty or backwards, which a broken pack can have. */
const part = (file: string, start: number, end: number): Segment | undefined => (start >= 0 && end > start ? { file, start, end } : undefined);

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
      keys[code] = { press: press && part(file, ...press), release: release && part(file, ...release) };
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
      const segment: Segment | undefined = multi ? (text(value) ? { file: text(value)! } : undefined) : span && sound ? part(sound, span[0], span[0] + span[1]) : undefined;
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
      if (bytes) found[segment.file] = { type: AUDIO_TYPES[extension] ?? "", data: bytes.slice().buffer };
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
