import type { ThemeColors } from "../../src/lib/plugins/types";
import { BLACK, fromLch, hex, isDark, mix, over, parse, readableOn, type Rgb, toLch, WHITE } from "../../src/lib/themes/color";
import type { Scheme } from "../../src/lib/themes/palette";

/*
 * A lines theme's colors for one scheme, every one of them: those the theme leaves out are lines'
 * own (app.css), as the app shows them. What other apps' themes are written from.
 */

const APP_CSS = await Bun.file(new URL("../../src/app.css", import.meta.url)).text();

/** The custom properties in the rule for `selector` in app.css. */
function properties(selector: RegExp): Record<string, string> {
  const body = new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`).exec(APP_CSS)?.[1] ?? "";
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}

const DEFAULTS: Record<Scheme, Record<string, string>> = {
  light: properties(/:root,\s*\[data-scheme\]/),
  dark: { ...properties(/:root,\s*\[data-scheme\]/), ...properties(/:root\[data-scheme="dark"\],\s*\[data-scheme="dark"\]/) },
};

/** A value as a color: what `parse` reads, `var(--name)`, and `color-mix(in srgb, a N%, b)`. */
function evaluate(value: string, lookup: (name: string) => Rgb | undefined): Rgb | undefined {
  const reference = /^var\(--([\w-]+)\)$/.exec(value)?.[1];
  if (reference) return lookup(reference);
  const mixed = /^color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%,\s*(.+)\)$/.exec(value);
  if (mixed) {
    const [a, b] = [mixed[1], mixed[3]].map((part) => evaluate(part.trim(), lookup));
    return a && b && mix(b, a, parseFloat(mixed[2]) / 100);
  }
  return parse(value);
}

/** Whether the tools can read `value` as a color, for checking a theme file. */
export const readable = (value: string) => !!evaluate(value, () => BLACK);

/** A theme's colors for `scheme`, each drawn over its background, by app.css's names. Throws for a color neither has. */
export function resolve(colors: ThemeColors, scheme: Scheme) {
  const cache = new Map<string, Rgb>();
  const get = (name: string, depth = 0): Rgb => {
    const known = cache.get(name);
    if (known) return known;
    if (depth > 8) throw new Error(`--${name} names itself`);
    const lookup = (other: string) => get(other, depth + 1);
    const color = [colors[name], DEFAULTS[scheme][name]].reduce<Rgb | undefined>((found, value) => found ?? (value ? evaluate(value, lookup) : undefined), undefined);
    if (!color) throw new Error(`The theme has no color for --${name}`);
    const seen = name === "bg" ? over(color, WHITE) : color.a < 1 ? over(color, get("bg")) : color;
    cache.set(name, seen);
    return seen;
  };
  return get;
}

export type Colors = ReturnType<typeof resolve>;

/** `color` at `alpha`, as `#rrggbbaa`. */
export const alpha = (color: Rgb, amount: number) => `${hex(color)}${Math.round(amount * 255).toString(16).padStart(2, "0")}`;

/** `color` a step lighter, its hue kept: a terminal's bright colors. */
export const brighter = (color: Rgb, step = 0.08) => {
  const lch = toLch(color);
  return fromLch({ ...lch, l: lch.l + step });
};

/** The hues terminals and Base16 name, from the theme's callouts and statuses, each reading at least 3:1 on its background. */
export function hues(get: Colors) {
  const bg = get("bg");
  const readable = (name: string) => readableOn(get(name), bg, 3);
  const orange = readable("pin");
  const { l, c, h } = toLch(orange);
  return {
    red: readable("danger"),
    orange,
    yellow: readableOn(get("highlight-base"), bg, 3),
    green: readable("success"),
    cyan: readable("callout-decision"),
    blue: readable("callout-info"),
    magenta: readable("callout-question"),
    brown: readableOn(fromLch({ l: l * 0.8, c: c * 0.6, h }), bg, 3),
  };
}

/** Neutrals from the background to the text and past it: Base16's base00 to base07, and two past the background (Base24's base10, base11). */
export function ramp(get: Colors) {
  const [bg, text] = [get("bg"), get("text")];
  const dark = isDark(bg);
  const [beyondText, beyondBg] = dark ? [WHITE, BLACK] : [BLACK, WHITE];
  return {
    background: [mix(bg, beyondBg, 0.4), mix(bg, beyondBg, 0.8)],
    neutrals: [bg, get("bg-sidebar"), mix(bg, text, 0.16), get("text-faint"), get("text-muted"), text, mix(text, beyondText, 0.4), mix(text, beyondText, 0.8)],
  };
}
