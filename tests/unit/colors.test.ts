import { describe, expect, test } from "bun:test";
import { BLACK, contrast, fromHsv, grey, hex, inverted, isDark, luminance, over, parse, readableOn, toHsv, WHITE } from "../../src/lib/themes/color";
import { MORE_CONTRAST, other, paneColors, rule, themeCss } from "../../src/lib/themes/css";
import { moreContrast, otherScheme, themeColors } from "../../src/lib/themes/palette";
import { pictureName, themeFromPixels } from "../../src/lib/themes/picture";
import type { Theme, ThemeColors } from "../../src/lib/plugins/types";

const on = (a: string | undefined, b: string | undefined) => contrast(parse(a)!, parse(b)!);

describe("color", () => {
  test("reads the ways colors are written", () => {
    expect(parse("#fff")).toEqual(WHITE);
    expect(parse("#00000080")?.a).toBeCloseTo(0.5, 2);
    expect(parse("0x336699")).toEqual({ r: 0x33, g: 0x66, b: 0x99, a: 1 });
    expect(parse("336699")).toEqual({ r: 0x33, g: 0x66, b: 0x99, a: 1 });
    expect(parse("rgb(10 20 30 / 50%)")).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parse("rgba(10, 20, 30, 0.25)")).toEqual({ r: 10, g: 20, b: 30, a: 0.25 });
    expect(parse("transparent")?.a).toBe(0);
    // As browsers give a color-mix() they've worked out.
    expect(parse("color(srgb 1 0.5 0 / 0.045)")).toEqual({ r: 255, g: 127.5, b: 0, a: 0.045 });
    expect(parse("color(srgb 0 0 0)")).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    for (const unreadable of ["oklch(50% 0.1 200)", "var(--x)", "", "#ggg", undefined, null]) expect(parse(unreadable)).toBeUndefined();
  });

  test("measures contrast as WCAG does", () => {
    expect(contrast(BLACK, WHITE)).toBeCloseTo(21, 5);
    expect(contrast(WHITE, WHITE)).toBe(1);
    expect(contrast(parse("#767676")!, WHITE)).toBeCloseTo(4.54, 2);
  });

  test("draws a see-through color over what's under it", () => {
    expect(hex(over({ r: 0, g: 0, b: 0, a: 0.5 }, WHITE))).toBe("#808080");
  });

  test("Monochrome's grey is as light as the color", () => {
    for (const value of ["#d53c40", "#0e7a7e", "#ffd60a", "#5b3fd1"]) {
      const color = parse(value)!;
      expect(luminance(grey(color))).toBeCloseTo(luminance(color), 2);
    }
  });

  test("Invert keeps the contrast between any two colors, and turns light to dark", () => {
    const colors = ["#ffffff", "#162120", "#0e7a7e", "#d53c40", "#ffd60a", "#767676"].map((value) => parse(value)!);
    // As near as colors of 8 bits a channel can be.
    for (const a of colors) for (const b of colors) expect(Math.abs(contrast(inverted(a), inverted(b)) / contrast(a, b) - 1)).toBeLessThan(0.01);
    expect(isDark(inverted(WHITE))).toBe(true);
  });

  test("makes a color readable on a background, keeping it if it already is", () => {
    const pale = parse("#9fd8d8")!;
    expect(contrast(readableOn(pale, WHITE, 4.5), WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(readableOn(BLACK, WHITE, 4.5)).toEqual(BLACK);
  });

  test("turns colors into hue, saturation and value, and back", () => {
    const hsv = (value: string) => toHsv(parse(value)!);
    expect(hsv("#ff0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hsv("#00ff00")).toEqual({ h: 120, s: 1, v: 1 });
    expect(hsv("#ff00ff")).toEqual({ h: 300, s: 1, v: 1 });
    const blue = hsv("#336699");
    expect([blue.h, blue.s, blue.v].map((n) => Math.round(n * 1000) / 1000)).toEqual([210, 0.667, 0.6]);
    // Greys have no hue, black no saturation either.
    expect(hsv("#808080")).toEqual({ h: 0, s: 0, v: 128 / 255 });
    expect(hsv("#000000")).toEqual({ h: 0, s: 0, v: 0 });
    expect(hex(fromHsv({ h: 360, s: 1, v: 1 }))).toBe("#ff0000");
    expect(hex(fromHsv({ h: 30, s: 0.5, v: 0.5 }))).toBe("#806040");
    for (const value of ["#0e7a7e", "#d53c40", "#ffd60a", "#5b3fd1", "#ffffff", "#162120", "#97a4a2"]) expect(hex(fromHsv(hsv(value)))).toBe(value);
  });
});

/** Colors a few themes made for other apps have: one light, one dark, one with a pale accent. */
const PALETTES = [
  { background: "#fdf6e3", foreground: "#657b83", accent: "#268bd2", hues: { red: "#dc322f", green: "#859900", yellow: "#b58900" } },
  { background: "#282a36", foreground: "#f8f8f2", accent: "#bd93f9", hues: { red: "#ff5555", green: "#50fa7b", yellow: "#f1fa8c" } },
  { background: "#ffffff", foreground: "#222222", accent: "#ffd60a" },
];

describe("palette", () => {
  test("a theme from another app's colors reads: tags on their chips, text on accent buttons", () => {
    for (const palette of PALETTES) {
      const { scheme, colors } = themeColors(palette);
      expect(scheme).toBe(isDark(parse(palette.background)!) ? "dark" : "light");
      const chip = over({ ...parse(colors.accent)!, a: scheme === "dark" ? 0.14 : 0.1 }, parse(colors.bg)!);
      expect(contrast(parse(colors["tag-text"])!, chip)).toBeGreaterThanOrEqual(4.5);
      expect(on(colors["on-accent"], colors.accent)).toBeGreaterThanOrEqual(scheme === "light" && palette.accent === "#ffd60a" ? 4.5 : 3);
    }
  });

  test("Increased contrast reaches its ratios on the note, the list and the sidebar", () => {
    for (const palette of PALETTES) {
      const { colors } = themeColors(palette);
      const more = { ...colors, ...moreContrast(colors) } as ThemeColors;
      for (const surface of ["bg", "bg-list", "bg-sidebar"]) {
        expect(on(more.text, more[surface])).toBeGreaterThanOrEqual(9);
        expect(on(more["text-muted"], more[surface])).toBeGreaterThanOrEqual(7);
        expect(on(more["text-faint"], more[surface])).toBeGreaterThanOrEqual(4.5);
        expect(on(more.accent, more[surface])).toBeGreaterThanOrEqual(4.5);
      }
      expect(on(more["on-accent"], more.accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("the other scheme's colors are the other way round, and read", () => {
    for (const palette of PALETTES) {
      const { scheme, colors } = themeColors(palette);
      const flipped = otherScheme(colors);
      expect(isDark(parse(flipped.bg)!)).toBe(scheme === "light");
      expect(on(flipped.text, flipped.bg)).toBeGreaterThanOrEqual(7);
      expect(on(flipped.accent, flipped.bg)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("theme CSS", () => {
  test("a rule leaves out names and values that could break out of it", () => {
    const css = rule(":root", { accent: "#123456", "bad name": "#000", text: "red; } body { color: blue", ink: "#000" });
    expect(css).toBe(":root {\n  --accent: #123456;\n  --ink: #000;\n}");
    expect(rule(":root", {})).toBe("");
  });

  test("Increased contrast's colors come after every theme's, and each theme's own after those", () => {
    const theme = { id: "t", name: "T", light: { accent: "#111111" }, dark: { accent: "#eeeeee" }, moreContrast: { light: { accent: "#000000" } } } as unknown as Theme;
    const css = themeCss([theme, { ...theme, id: "Bad Id" }]);
    const order = [':root[data-theme="t"] {', ':root[data-theme][data-scheme="light"][data-contrast="more"]', ':root[data-theme="t"][data-scheme="light"][data-contrast="more"]'].map((part) => css.indexOf(part));
    expect(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1]))).toBe(true);
    expect(css).not.toContain("Bad Id");
  });
});

describe("dark panes", () => {
  const light = themeColors(PALETTES[0]).colors;
  const dark = themeColors(PALETTES[1]).colors;
  const both = { id: "both", name: "Both", light, dark, moreContrast: { dark: { text: "#ffffff" } } } as Theme;

  test("take the theme's colors for its other scheme", () => {
    expect(other("light")).toBe("dark");
    expect(paneColors(both, "light", false)).toBe(dark);
    expect(paneColors(both, "dark", false)).toBe(light);
  });

  test("with Increased contrast's, every theme's and the theme's own", () => {
    const colors = paneColors(both, "light", true);
    expect(colors.border).toBe(MORE_CONTRAST.dark.border);
    expect(colors.text).toBe("#ffffff");
  });

  test("work out dark colors for a theme with light ones only", () => {
    const only = { id: "only", name: "Only", scheme: "light", light, dark: light } as Theme;
    const colors = paneColors(only, "light", true);
    expect(isDark(parse(colors.bg)!)).toBe(true);
    expect(on(colors.text, colors["bg-sidebar"])).toBeGreaterThanOrEqual(9);
    expect(on(colors["on-accent"], colors.accent)).toBeGreaterThanOrEqual(4.5);
  });
});

/** RGBA bytes for a picture of `colors`, `count` pixels of each. */
function picture(...colors: [string, number][]) {
  return colors.flatMap(([value, count]) => {
    const { r, g, b, a } = parse(value)!;
    return Array.from({ length: count }, () => [r, g, b, Math.round(a * 255)]).flat();
  });
}

describe("a theme from a picture", () => {
  test("reads, light and dark: text 7:1, its accent 4.5:1", () => {
    const sunset = themeFromPixels(picture(["#f28c38", 300], ["#6a3d9a", 400], ["#1d1b3a", 500], ["#ffd27a", 80]), "Sunset");
    for (const [scheme, colors] of [["light", sunset.light], ["dark", sunset.dark]] as const) {
      expect(isDark(parse(colors!.bg)!)).toBe(scheme === "dark");
      expect(on(colors!.text, colors!.bg)).toBeGreaterThanOrEqual(7);
      expect(on(colors!.accent, colors!.bg)).toBeGreaterThanOrEqual(4.5);
      expect(on(colors!["text-muted"], colors!.bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(sunset.name).toBe("Sunset");
  });

  test("takes its accent from the picture's most vivid plentiful color", () => {
    const forest = themeFromPixels(picture(["#2f5d34", 600], ["#a8c97f", 300], ["#d9d4c7", 400]), "Forest");
    const { r, g, b } = parse(forest.light!.accent)!;
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  test("a picture without color makes a theme in greys", () => {
    const grey = themeFromPixels(picture(["#202020", 200], ["#808080", 200], ["#e0e0e0", 200]), "Grey");
    const { r, g, b } = parse(grey.light!.accent)!;
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(12);
  });

  test("one color, or one pixel, is enough", () => {
    expect(() => themeFromPixels(picture(["#0e7a7e", 1]), "Teal")).not.toThrow();
  });

  test("a see-through picture has no colors to read", () => {
    expect(() => themeFromPixels(picture(["#ff000000", 50]), "Clear")).toThrow();
    expect(() => themeFromPixels([], "Empty")).toThrow();
  });

  test("is named after the file", () => {
    expect(pictureName("Lake_at-dawn.JPEG")).toBe("Lake at dawn");
    expect(pictureName("wallpaper")).toBe("wallpaper");
  });
});
