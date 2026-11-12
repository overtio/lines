import type { ImportedTheme } from "../../../lib/plugins/types";
import { baseName, ini, jsonc, keyValues, plist, toml, yaml } from "./parse";

/*
 * Terminals' color schemes: a background, a text color and sixteen ANSI colors, in each terminal's
 * own file format. iTerm2-Color-Schemes has hundreds of them in all these formats.
 */

type Color = string | undefined;

/** A theme from a terminal's colors: the ANSI ones are red, green, yellow, blue, magenta and cyan at 1 to 6, and grey at 8. */
function terminal(name: string, background: Color, foreground: Color, ansi: Color[], author?: string): ImportedTheme[] {
  if (!background || !foreground) return [];
  return [
    {
      name,
      author,
      colors: {
        background,
        foreground,
        faint: ansi[8],
        hues: {
          red: ansi[1],
          green: ansi[2],
          yellow: ansi[3],
          blue: ansi[4],
          magenta: ansi[5],
          cyan: ansi[6],
        },
        syntax: { comment: ansi[8], type: ansi[6] },
      },
    },
  ];
}

const NAMES = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
const range = (count: number) => Array.from({ length: count }, (_, i) => i);
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
/** `0.5` as a channel from 0 to 255. */
const channel = (value: unknown) => Math.round(Math.min(1, Math.max(0, Number(value))) * 255);

/** iTerm2's `.itermcolors`: each color a dictionary of its red, green and blue from 0 to 1. */
export function iterm(text: string, fileName: string): ImportedTheme[] {
  const scheme = plist(text);
  if (!isObject(scheme)) return [];
  const color = (key: string) => {
    const value = scheme[key];
    if (!isObject(value)) return;
    return `rgb(${channel(value["Red Component"])}, ${channel(value["Green Component"])}, ${channel(value["Blue Component"])})`;
  };
  return terminal(
    baseName(fileName),
    color("Background Color"),
    color("Foreground Color"),
    range(16).map((i) => color(`Ansi ${i} Color`)),
  );
}

/** Alacritty's colors, in its TOML or (before 0.13) YAML: `[colors.primary]`, `[colors.normal]`, `[colors.bright]`. */
export function alacritty(text: string, fileName: string): ImportedTheme[] {
  const values = fileName.toLowerCase().endsWith(".toml") || /^\s*\[/m.test(text) ? toml(text) : yaml(text);
  const get = (key: string) => {
    const value = values.get(`colors.${key}`);
    return typeof value === "string" ? value : undefined;
  };
  const ansi = [...NAMES.map((name) => get(`normal.${name}`)), ...NAMES.map((name) => get(`bright.${name}`))];
  return terminal(baseName(fileName), get("primary.background"), get("primary.foreground"), ansi);
}

/** Kitty's `.conf`: `background #282a36`, `color0` to `color15`, and its name in a `## name:` comment. */
export function kitty(text: string, fileName: string): ImportedTheme[] {
  const values = new Map(keyValues(text, "space"));
  const meta = (key: string) => new RegExp(`^##\\s*${key}:\\s*(.+)$`, "m").exec(text)?.[1].trim();
  return terminal(
    meta("name") ?? baseName(fileName),
    values.get("background"),
    values.get("foreground"),
    range(16).map((i) => values.get(`color${i}`)),
    meta("author"),
  );
}

/** Ghostty's themes: `background = #282a36`, and `palette = 0=#21222c` for each ANSI color. */
export function ghostty(text: string, fileName: string): ImportedTheme[] {
  const values = keyValues(text, "=");
  // The last setting of each wins, as in Ghostty.
  const settings = new Map(values);
  const ansi: Color[] = [];
  for (const [key, value] of values) {
    const entry = key === "palette" && /^(\d+)\s*=\s*(\S+)$/.exec(value);
    if (entry) ansi[Number(entry[1])] = entry[2];
  }
  return terminal(baseName(fileName), settings.get("background"), settings.get("foreground"), ansi);
}

/** WezTerm's color schemes in TOML: `[colors]` with `ansi` and `brights` lists, and its name under `[metadata]`. */
export function wezterm(text: string, fileName: string): ImportedTheme[] {
  const values = toml(text);
  const list = (key: string) => {
    const value = values.get(`colors.${key}`);
    return Array.isArray(value) ? value : [];
  };
  const get = (key: string) => {
    const value = values.get(key);
    return typeof value === "string" ? value : undefined;
  };
  return terminal(
    get("metadata.name") ?? baseName(fileName),
    get("colors.background"),
    get("colors.foreground"),
    [...list("ansi"), ...list("brights")],
    get("metadata.author"),
  );
}

/** Windows Terminal's schemes: one scheme's JSON, or its settings with all of them in `schemes`. */
export function windowsTerminal(text: string, fileName: string): ImportedTheme[] {
  const json = jsonc(text);
  const schemes = isObject(json) && Array.isArray(json.schemes) ? json.schemes : [json];
  return schemes.flatMap((scheme: unknown) => {
    if (!isObject(scheme) || !("brightBlack" in scheme || "purple" in scheme)) return [];
    const get = (key: string) => (typeof scheme[key] === "string" ? scheme[key] : undefined);
    const names = ["black", "red", "green", "yellow", "blue", "purple", "cyan", "white"];
    const ansi = [...names.map(get), ...names.map((name) => get(`bright${name[0].toUpperCase()}${name.slice(1)}`))];
    return terminal(get("name") ?? baseName(fileName), get("background"), get("foreground"), ansi);
  });
}

/** X resources (`~/.Xresources`): `*.background: #282a36`, `URxvt*color0: …`, with `#define`d names. */
export function xresources(text: string, fileName: string): ImportedTheme[] {
  const defines = new Map([...text.matchAll(/^#define\s+(\S+)\s+(\S+)/gm)].map((match) => [match[1], match[2]]));
  const values = new Map<string, string>();
  for (const match of text.matchAll(/^(?:[\w-]*[*.])*(foreground|background|color\d{1,2})\s*:\s*(\S+)/gm)) {
    values.set(match[1], defines.get(match[2]) ?? match[2]);
  }
  return terminal(
    baseName(fileName),
    values.get("background"),
    values.get("foreground"),
    range(16).map((i) => values.get(`color${i}`)),
  );
}

/** foot's `foot.ini`: `[colors]`, or `[colors-dark]` and `[colors-light]` for both, colors in hex without `#`. */
export function foot(text: string, fileName: string): ImportedTheme[] {
  const sections = ini(text);
  return ["colors", "colors-dark", "colors-light"].flatMap((name) => {
    const section = sections.get(name);
    if (!section) return [];
    const ansi = [...range(8).map((i) => section.get(`regular${i}`)), ...range(8).map((i) => section.get(`bright${i}`))];
    return terminal(baseName(fileName), section.get("background"), section.get("foreground"), ansi);
  });
}

/** Konsole's `.colorscheme` (KDE's terminal): a section for each color, as `Color=40,42,54`. */
export function konsole(text: string, fileName: string): ImportedTheme[] {
  const sections = ini(text);
  const color = (section: string) => {
    const value = sections.get(section)?.get("Color");
    return value && /^\d+,\d+,\d+/.test(value) ? `rgb(${value.split(",").slice(0, 3).join(",")})` : undefined;
  };
  const ansi = [...range(8).map((i) => color(`Color${i}`)), ...range(8).map((i) => color(`Color${i}Intense`))];
  return terminal(sections.get("General")?.get("Description") ?? baseName(fileName), color("Background"), color("Foreground"), ansi);
}

/** pywal's `colors.json`, the colors it took from a wallpaper. */
export function pywal(text: string, fileName: string): ImportedTheme[] {
  const json = jsonc(text);
  if (!isObject(json) || !isObject(json.special) || !isObject(json.colors)) return [];
  const { special, colors } = json;
  const get = (from: Record<string, unknown>, key: string) => (typeof from[key] === "string" ? from[key] : undefined);
  const wallpaper = get(json, "wallpaper");
  return terminal(
    wallpaper ? baseName(wallpaper) : baseName(fileName),
    get(special, "background"),
    get(special, "foreground"),
    range(16).map((i) => get(colors, `color${i}`)),
  );
}
