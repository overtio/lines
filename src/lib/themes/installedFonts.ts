import { isTauri } from "../platform";

/*
 * Fonts installed on this device, to write notes in (Settings → Typography → Font family). The
 * apps ask the system for its list (src-tauri/src/fonts.rs); browsers that can (Chrome, Edge) ask
 * the person first (Local Font Access), and in the rest a font is chosen by typing its name. One
 * chosen is kept by its family name, and notes fall back to the system's font where it isn't
 * installed, a preset's from another computer say.
 */

/** A family's name as kept in settings: trimmed, short, and nothing that could end the CSS it's put in. */
export function familyName(value: unknown): string {
  if (typeof value !== "string") return "";
  const name = value.trim();
  return name.length <= 100 && /^[^\p{Cc};{}<>"\\]*$/u.test(name) ? name : "";
}

/** The CSS font-family of an installed family: it, or `fallback` (the system's, a style's own) where it isn't installed. */
export const installedFamily = (name: string, fallback = "var(--font-system)") => `"${name}", ${fallback}`;

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** Families once each, in alphabetical order, without the system's hidden ones (".SF NS"). */
export function tidyFamilies(names: Iterable<string>): string[] {
  const families = new Map<string, string>();
  for (const name of names) {
    const family = familyName(name);
    if (family && !family.startsWith(".") && !families.has(family.toLowerCase())) families.set(family.toLowerCase(), family);
  }
  return [...families.values()].sort(collator.compare);
}

/** The fonts (by default, families' names) whose names have `query` in them: those starting with it first, then those with a word starting with it. */
export function matching<T>(fonts: readonly T[], query: string, name: (font: T) => string = String): T[] {
  const typed = query.trim().toLowerCase();
  if (!typed) return [...fonts];
  const rank = (font: T) => {
    const words = name(font).toLowerCase();
    if (words.startsWith(typed)) return 0;
    if (words.includes(` ${typed}`)) return 1;
    return words.includes(typed) ? 2 : -1;
  };
  const ranked = fonts.map((font) => ({ font, rank: rank(font) })).filter(({ rank }) => rank >= 0);
  return ranked.sort((a, b) => a.rank - b.rank).map(({ font }) => font);
}

type LocalFonts = { queryLocalFonts?: () => Promise<{ family: string }[]> };

let listing: Promise<string[] | null> | undefined;

/**
 * The families installed here, in alphabetical order, or null where they can't be listed: a
 * browser without Local Font Access (Safari, Firefox), or whose person said no, and Android. Kept
 * for the window once listed; asked again otherwise, as the person may say yes the next time. In
 * a browser it asks the person, so it's called as they open the picker: the browser wants a click
 * or key press behind it.
 */
export function listInstalledFonts() {
  return (listing ??= list());
}

async function list() {
  const local = (window as LocalFonts).queryLocalFonts;
  const listed = isTauri
    ? import("@tauri-apps/api/core").then(({ invoke }) => invoke<string[]>("installed_fonts"))
    : local?.call(window).then((fonts) => fonts.map((font) => font.family));
  const families = tidyFamilies((await listed?.catch(() => null)) ?? []);
  if (families.length) return families;
  listing = undefined;
  return null;
}

let probe: CanvasRenderingContext2D | null | undefined;
const SAMPLE = "mmmmmmmmmmlli1WQ@#Aa";

/**
 * Whether this page can draw text in the family `name`: it measures differently from each generic
 * font, which is what text falls back to without it. Safari can't use fonts the person installed
 * (only the system's), so there it says what the browser can, not what's on the computer.
 */
export function canDraw(name: string): boolean {
  probe ??= document.createElement("canvas").getContext("2d");
  if (!probe || !familyName(name)) return false;
  const context = probe;
  const width = (family: string) => {
    context.font = `40px ${family}`;
    return context.measureText(SAMPLE).width;
  };
  return ["monospace", "serif", "sans-serif"].some((generic) => width(`"${name}", ${generic}`) !== width(generic));
}
