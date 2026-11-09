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
 * (Base16, foot) or after `0x` (Alacritty), `rgb()` and `rgba()`, and black, white and transparent.
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

