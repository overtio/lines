import type { ImportedTheme } from "../../../lib/plugins/types";
import { baseName, ini, yaml } from "./parse";

/* Palettes many apps share: Base16 (and Base24) schemes, KDE's color schemes, and GTK's named colors. */

const isHex = (value: string | undefined): value is string => !!value && /^#?[0-9a-f]{6}$/i.test(value);

/**
 * A Base16 or Base24 scheme (tinted-theming), the palette Linux setups theme everything from: in
 * its YAML, as `palette: base00: …` or the older flat `base00: …`. Each color's use is the
 * styling guide's: base00 the background, base05 the text, base08 to base0F red to brown.
 */
export function base16(text: string, fileName: string): ImportedTheme[] {
  const values = yaml(text);
  const base = (index: number) => {
    const key = `base0${index.toString(16).toUpperCase()}`;
    const value = values.get(`palette.${key}`) ?? values.get(key) ?? values.get(`palette.${key.toLowerCase()}`) ?? values.get(key.toLowerCase());
    return isHex(value) ? value : undefined;
  };
  const [background, foreground] = [base(0), base(5)];
  if (!background || !foreground) return [];
  return [
    {
      name: values.get("name") ?? values.get("scheme") ?? baseName(fileName),
      author: values.get("author"),
      colors: {
        background,
        foreground,
        sidebar: base(1),
        muted: base(4),
        faint: base(3),
        accent: base(0xd),
        danger: base(8),
        success: base(0xb),
        warning: base(0xa),
        info: base(0xd),
        hues: {
          red: base(8),
          orange: base(9),
          yellow: base(0xa),
          green: base(0xb),
          cyan: base(0xc),
          blue: base(0xd),
          magenta: base(0xe),
        },
        syntax: {
          keyword: base(0xe),
          string: base(0xb),
          number: base(9),
          comment: base(3),
          function: base(0xd),
          type: base(0xa),
        },
      },
    },
  ];
}

/** A KDE Plasma color scheme (`.colors`): the views' colors for the note, the windows' for the sidebar, the selection's for the accent. */
export function kde(text: string, fileName: string): ImportedTheme[] {
  const sections = ini(text);
  const color = (section: string, key: string) => {
    const value = sections.get(`Colors:${section}`)?.get(key);
    return value && /^\d+,\d+,\d+/.test(value) ? `rgb(${value.split(",").slice(0, 3).join(",")})` : undefined;
  };
  const background = color("View", "BackgroundNormal");
  const foreground = color("View", "ForegroundNormal");
  if (!background || !foreground) return [];
  const general = sections.get("General");
  return [
    {
      name: general?.get("Name") ?? general?.get("ColorScheme") ?? baseName(fileName),
      colors: {
        background,
        foreground,
        sidebar: color("Window", "BackgroundNormal"),
        sidebarForeground: color("Window", "ForegroundNormal"),
        muted: color("View", "ForegroundInactive"),
        accent: color("Selection", "BackgroundNormal") ?? color("View", "DecorationFocus"),
        danger: color("View", "ForegroundNegative"),
        success: color("View", "ForegroundPositive"),
        warning: color("View", "ForegroundNeutral"),
        info: color("View", "ForegroundLink"),
        hues: {
          red: color("View", "ForegroundNegative"),
          orange: color("View", "ForegroundNeutral"),
          green: color("View", "ForegroundPositive"),
          blue: color("View", "ForegroundLink"),
          magenta: color("View", "ForegroundVisited"),
          cyan: color("View", "DecorationFocus"),
        },
      },
    },
  ];
}

/**
 * GTK's named colors in a `gtk.css`: libadwaita's (`@define-color window_bg_color …`, or since
 * 1.6 `--window-bg-color: …`) and older themes' (`theme_bg_color`), one naming another as `@name`.
 */
export function gtk(text: string, fileName: string): ImportedTheme[] {
  const defined = new Map<string, string>();
  for (const match of text.matchAll(/@define-color\s+([\w-]+)\s+([^;]+);|--([\w-]+)\s*:\s*([^;]+);/g)) {
    defined.set((match[1] ?? match[3]).replace(/-/g, "_"), (match[2] ?? match[4]).trim());
  }
  const resolve = (value: string | undefined, depth = 0): string | undefined => {
    const reference = value && (/^@([\w-]+)$/.exec(value)?.[1] ?? /^var\(--([\w-]+)\)$/.exec(value)?.[1]);
    if (!reference) return value;
    return depth < 8 ? resolve(defined.get(reference.replace(/-/g, "_")), depth + 1) : undefined;
  };
  const get = (...names: string[]) => names.map((name) => resolve(defined.get(name))).find(Boolean);
  const background = get("view_bg_color", "theme_base_color", "window_bg_color", "theme_bg_color");
  const foreground = get("view_fg_color", "theme_text_color", "window_fg_color", "theme_fg_color");
  if (!background || !foreground) return [];
  return [
    {
      name: baseName(fileName),
      colors: {
        background,
        foreground,
        sidebar: get("sidebar_bg_color", "window_bg_color", "theme_bg_color"),
        sidebarForeground: get("sidebar_fg_color", "window_fg_color", "theme_fg_color"),
        elevated: get("popover_bg_color", "dialog_bg_color"),
        accent: get("accent_color", "accent_bg_color", "theme_selected_bg_color"),
        danger: get("error_color", "destructive_color"),
        success: get("success_color"),
        warning: get("warning_color"),
        hues: {
          red: get("red_3"),
          orange: get("orange_3"),
          yellow: get("yellow_3"),
          green: get("green_3"),
          blue: get("blue_3"),
          magenta: get("purple_3"),
        },
      },
    },
  ];
}
