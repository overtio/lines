import { plugins } from "../plugins/registry.svelte";
import type { ImportedTheme, ThemeColors } from "../plugins/types";
import { parse } from "./color";
import { readThemeFile, type ThemeFile } from "./file";
import { type Scheme, themeColors } from "./palette";

/*
 * Reading themes from a file: lines' own theme files, or another app's in any format a plugin reads
 * (VS Code's, Base16's, a terminal's…). A file with a light and a dark version of a theme makes one
 * theme with both.
 */

interface Variant {
  name: string;
  author?: string;
  scheme: Scheme;
  colors: ThemeColors;
}

/** A theme's name without the scheme in it: "One" for "One Dark", "Solarized" for "Solarized (light)". */
const family = (name: string) =>
  name
    .replace(/[([]?\b(?:dark|light)\b[)\]]?/gi, " ")
    .replace(/[\s_-]+/g, " ")
    .trim();

/** The words two names start with: "Catppuccin" for "Catppuccin Latte" and "Catppuccin Mocha". */
function shared(a: string, b: string) {
  const [first, second] = [a.split(/\s+/), b.split(/\s+/)];
  const same = first.findIndex((word, i) => word !== second[i]);
  return first.slice(0, same === -1 ? first.length : same).join(" ");
}

/** Light and dark versions of a theme as one theme with both; the rest each as their own. */
function pair(variants: Variant[]): ThemeFile[] {
  const single = (variant: Variant): ThemeFile => ({
    name: variant.name,
    author: variant.author,
    [variant.scheme]: variant.colors,
  });
  const both = (light: Variant, dark: Variant, name: string): ThemeFile => ({
    name,
    author: light.author ?? dark.author,
    light: light.colors,
    dark: dark.colors,
  });
  if (variants.length === 2 && variants[0].scheme !== variants[1].scheme) {
    const [light, dark] = variants[0].scheme === "light" ? variants : [variants[1], variants[0]];
    const name = light.name === dark.name ? light.name : family(light.name) === family(dark.name) ? family(light.name) : shared(light.name, dark.name);
    return [both(light, dark, name || dark.name)];
  }
  const themes: ThemeFile[] = [];
  const paired = new Set<Variant>();
  for (const variant of variants) {
    if (paired.has(variant)) continue;
    const name = family(variant.name);
    const other = name && variants.find((each) => !paired.has(each) && each.scheme !== variant.scheme && family(each.name) === name);
    if (other) {
      paired.add(other);
      themes.push(variant.scheme === "light" ? both(variant, other, name) : both(other, variant, name));
    } else {
      themes.push(single(variant));
    }
  }
  return themes;
}

const extension = (fileName: string) => (fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase() : "");

/** The themes in a file's text, in lines' format or any a plugin reads; none if it has none lines can read. */
export async function readThemes(text: string, fileName: string): Promise<ThemeFile[]> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // Not JSON, or JSON with comments: one of the formats below.
  }
  const own = readThemeFile(json);
  if (own) return [own];
  const ext = extension(fileName);
  const formats = plugins.themeFormats;
  // Those made for files like this first, then the rest, for files named oddly (or not at all, as Ghostty's are).
  const ordered = [...formats.filter((format) => format.extensions.includes(ext)), ...formats.filter((format) => !format.extensions.includes(ext))];
  for (const format of ordered) {
    const found: ImportedTheme[] = await format.read(text, fileName).catch(() => []);
    const readable = found.filter(({ palette }) => parse(palette.background) && parse(palette.foreground));
    if (readable.length)
      return pair(
        readable.map(({ name, author, palette }) => ({
          name: name.trim() || fileName,
          author,
          ...themeColors(palette),
        })),
      );
  }
  return [];
}

/** What lines reads themes from, for saying so: lines' own files and each format's app. */
export const readableFormats = () => ["lines", ...plugins.themeFormats.map((format) => format.name)];
