/*
 * Colors as numbers, for working out themes: reading the ways apps write them, mixing them, and
 * measuring contrast as WCAG does. OKLCH, for changing a color's lightness while keeping its hue.
 */

/** Red, green and blue from 0 to 255, and alpha from 0 to 1. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const BLACK: Rgb = { r: 0, g: 0, b: 0, a: 1 };
export const WHITE: Rgb = { r: 255, g: 255, b: 255, a: 1 };

const NAMES: Record<string, string> = {
  black: "000000",
  white: "ffffff",
  transparent: "00000000",
};

/**
 * A color as CSS or another app writes it, or undefined: `#rgb`, `#rrggbbaa`, hex without the `#`
 * (Base16, foot) or after `0x` (Alacritty), `rgb()` and `rgba()`, black, white and transparent, and
 * `color(srgb …)`, as browsers give a `color-mix()` they've worked out.
 */
export function parse(text: string | undefined | null): Rgb | undefined {
  if (typeof text !== "string") return;
  const value = text.trim().toLowerCase();
  const hexDigits = NAMES[value] ?? /^(?:#|0x)?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(value)?.[1];
  if (hexDigits) {
    const full = hexDigits.length <= 4 ? [...hexDigits].map((digit) => digit + digit).join("") : hexDigits;
    const [r, g, b, a = 255] = full.match(/../g)!.map((pair) => parseInt(pair, 16));
    return { r, g, b, a: a / 255 };
  }
  const srgb = /^color\(srgb\s+([^)]*)\)$/.exec(value)?.[1].split(/[\s/]+/).filter(Boolean);
  if (srgb) {
    const [r, g, b, a = 1] = srgb.map((part) => (part.endsWith("%") ? parseFloat(part) / 100 : parseFloat(part)));
    return [r, g, b, a].every(Number.isFinite) ? { r: r * 255, g: g * 255, b: b * 255, a: Math.min(1, Math.max(0, a)) } : undefined;
  }
  const args = /^rgba?\(([^)]*)\)$/
    .exec(value)?.[1]
    .split(/[\s,/]+/)
    .filter(Boolean);
  if (!args || args.length < 3) return;
  const channel = (part: string, scale: number) => (part.endsWith("%") ? (parseFloat(part) / 100) * scale : parseFloat(part));
  const [r, g, b] = args.slice(0, 3).map((part) => channel(part, 255));
  const a = args[3] === undefined ? 1 : channel(args[3], 1);
  return [r, g, b, a].every(Number.isFinite) ? { r, g, b, a: Math.min(1, Math.max(0, a)) } : undefined;
}

const clamp = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

/** As `#rrggbb`, alpha dropped. */
export const hex = ({ r, g, b }: Rgb) => `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("")}`;

/** `amount` (0 to 1) of `b` in `a`, as CSS's `color-mix(in srgb, …)`. */
export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  const at = (from: number, to: number) => from + (to - from) * amount;
  return { r: at(a.r, b.r), g: at(a.g, b.g), b: at(a.b, b.b), a: at(a.a, b.a) };
}

/** What's seen of `color` drawn over `base`. */
export const over = (color: Rgb, base: Rgb): Rgb => ({
  ...mix(base, color, color.a),
  a: base.a,
});

const linear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const gamma = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** WCAG's relative luminance. */
export const luminance = ({ r, g, b }: Rgb) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

/** WCAG's contrast ratio, from 1 to 21. */
export function contrast(a: Rgb, b: Rgb) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Whether light text reads better on it than dark. */
export const isDark = (color: Rgb) => contrast(color, WHITE) > contrast(color, BLACK);

/** OKLCH: perceived lightness (0 to 1), chroma, and hue in degrees. */
export interface Lch {
  l: number;
  c: number;
  h: number;
}

export function toLch(color: Rgb): Lch {
  const [r, g, b] = [color.r, color.g, color.b].map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    c: Math.hypot(A, B),
    h: (Math.atan2(B, A) * 180) / Math.PI,
  };
}

function lchToLinear({ l: L, c, h }: Lch) {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** An OKLCH color as sRGB, with its chroma lowered as far as it takes to be one. */
export function fromLch(lch: Lch): Rgb {
  const l = Math.min(1, Math.max(0, lch.l));
  const fits = (c: number) => lchToLinear({ l, c, h: lch.h }).every((channel) => channel >= -1e-4 && channel <= 1 + 1e-4);
  let c = lch.c;
  if (!fits(c)) {
    let [low, high] = [0, c];
    for (let step = 0; step < 20; step++) {
      c = (low + high) / 2;
      if (fits(c)) low = c;
      else high = c;
    }
    c = low;
  }
  const [r, g, b] = lchToLinear({ l, c, h: lch.h }).map((channel) => clamp(gamma(Math.min(1, Math.max(0, channel)))));
  return { r, g, b, a: 1 };
}

/**
 * `color`, mixed toward `toward` a step at a time until it reaches `ratio` against each of
 * `backgrounds`; as it is if it already does, and `toward` itself if nothing short of it does.
 */
export function reach(color: Rgb, backgrounds: Rgb[], ratio: number, toward: Rgb): Rgb {
  const enough = (candidate: Rgb) => backgrounds.every((background) => contrast(candidate, background) >= ratio);
  for (let step = 0; step <= 100; step++) {
    const candidate = mix(color, toward, step / 100);
    if (enough(candidate)) return candidate;
  }
  return toward;
}

/** `color` made lighter or darker, its hue kept, until it reaches `ratio` against `background`. */
export function readableOn(color: Rgb, background: Rgb, ratio: number): Rgb {
  if (contrast(color, background) >= ratio) return color;
  const lch = toLch(color);
  const target = isDark(background) ? 1 : 0;
  for (let step = 1; step <= 50; step++) {
    const candidate = fromLch({
      ...lch,
      l: lch.l + ((target - lch.l) * step) / 50,
    });
    if (contrast(candidate, background) >= ratio) return candidate;
  }
  return isDark(background) ? WHITE : BLACK;
}

/** As CSS: `#rrggbb`, or `rgb()` with its alpha when it's see-through. */
export const css = (color: Rgb) =>
  color.a >= 1 ? hex(color) : `rgb(${[color.r, color.g, color.b].map(clamp).join(" ")} / ${Math.round(color.a * 1000) / 1000})`;

/** The grey as light as `color` to WCAG, so it has the same contrast with any other color. */
export function grey(color: Rgb): Rgb {
  const value = clamp(gamma(luminance(color)));
  return { r: value, g: value, b: value, a: color.a };
}

/**
 * `color` turned around, white for black: its luminance mirrored so that any two colors turned
 * have the contrast they had ((L + 0.05) becomes 0.0525 / (L + 0.05)), its hue and chroma kept.
 */
export function inverted(color: Rgb): Rgb {
  const target = 0.0525 / (luminance(color) + 0.05) - 0.05;
  const lch = toLch(color);
  let [low, high] = [0, 1];
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2;
    if (luminance(fromLch({ ...lch, l: middle })) < target) low = middle;
    else high = middle;
  }
  return { ...fromLch({ ...lch, l: (low + high) / 2 }), a: color.a };
}

/** Hue in degrees (0 to 360), saturation and value (0 to 1): how a color picker lays colors out. */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

/** A color as hue, saturation and value; a grey's hue is 0. */
export function toHsv({ r, g, b }: Rgb): Hsv {
  const [red, green, blue] = [r, g, b].map((channel) => Math.min(1, Math.max(0, channel / 255)));
  const max = Math.max(red, green, blue);
  const range = max - Math.min(red, green, blue);
  let h = 0;
  if (range) {
    if (max === red) h = ((green - blue) / range + 6) % 6;
    else if (max === green) h = (blue - red) / range + 2;
    else h = (red - green) / range + 4;
  }
  return { h: h * 60, s: max ? range / max : 0, v: max };
}

/** A hue, saturation and value as an opaque color. */
export function fromHsv({ h, s, v }: Hsv): Rgb {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    return 255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return { r: channel(5), g: channel(3), b: channel(1), a: 1 };
}
