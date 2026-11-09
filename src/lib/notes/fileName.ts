import { t } from "../i18n/index.svelte";

/** Names Windows keeps for devices, which no file may have, whatever follows the first dot. */
const RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\.|$)/i;

/** As long as a name is made, in characters, and in bytes with room for its extension (systems allow 255). */
const MOST_CHARACTERS = 100;
const MOST_BYTES = 200;
const encoder = new TextEncoder();

/**
 * A title made safe as a file name on every system: "Trip: Rome/Paris?" → "Trip - Rome-Paris".
 * Composed, as macOS treats "é" typed either way as the same name. `fallback` if nothing's left.
 */
export function fileName(title: string, fallback = t("list.untitled")) {
  const safe = title
    .normalize("NFC")
    .replace(/[\\/]+/g, "-")
    .replace(/\s*:\s*/g, " - ")
    .replace(/[*?"<>|]+/g, "")
    // oxlint-disable-next-line no-control-regex -- control characters are what it takes out
    .replace(/[\s\u0000-\u001f]+/g, " ")
    .replace(/^[.\s-]+|[.\s-]+$/g, "");
  // By character, so an emoji isn't cut in half.
  let name = "";
  let bytes = 0;
  for (const character of Array.from(safe).slice(0, MOST_CHARACTERS)) {
    bytes += encoder.encode(character).length;
    if (bytes > MOST_BYTES) break;
    name += character;
  }
  name = name.trim();
  return !name ? fallback : RESERVED.test(name) ? `_${name}` : name;
}
