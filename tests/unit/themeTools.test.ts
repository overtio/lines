import { describe, expect, test } from "bun:test";
import { contrast, hex, parse, toLch } from "../../src/lib/themes/color";
import { resolveFile } from "../../src/lib/themes/file";
import { resolveTheme } from "../../src/lib/themes/palette";
import { points, swatches, themeFromSwatches } from "../../src/lib/themes/swatches";
import { base16, gtk as readGtk } from "../../src/plugins/themes/formats/desktops";
import { vscode as readVscode } from "../../src/plugins/themes/formats/editors";
import { readSwatchFile, toFile, writeSwatchFile } from "../../tools/themes/swatch-file";
import { base24 } from "../../tools/themes/targets/base24";
import { slug } from "../../tools/themes/targets/common";
import { gtk } from "../../tools/themes/targets/gtk";
import { vscode } from "../../tools/themes/targets/vscode";
import { stubApp } from "./stubs";

stubApp();
const { contributions } = await import("../../src/plugins/themes/builtIn");
const { themes } = await import("../../src/plugins/themes/themes");

/** RGBA bytes for a picture of `colors`, `count` pixels of each. */
const picture = (...colors: [string, number][]) =>
  new Uint8Array(
    colors.flatMap(([value, count]) => {
      const { r, g, b } = parse(value)!;
      return Array.from({ length: count }, () => [r, g, b, 255]).flat();
    }),
  );

const same = (a: string | undefined, b: string | undefined) => expect(hex(parse(a)!)).toBe(hex(parse(b)!));

/** One of lines' themes, as it shows. */
const shown = (id: string) => {
  const { themes: all, palettes } = contributions(themes());
  const theme = all.find((each) => each.id === id)!;
  return resolveTheme(theme, (each) => palettes.find((palette) => palette.id === each));
};
const greenWorld = shown("green-world");

describe("swatches", () => {
  // A dark scene in shades of violet, with a small glowing leaf.
  const scene = picture(["#1c1726", 4000], ["#2a2238", 3000], ["#3b2846", 2000], ["#241d30", 2000], ["#8a5e84", 600], ["#91d24e", 80]);

  test("keep a small vivid patch beside the wide washes of color", () => {
    const found = swatches(points(scene), 4);
    expect(found).toHaveLength(4);
    expect(found.some(({ h, c }) => c > 0.1 && h > 110 && h < 150)).toBe(true);
  });

  test("are most plentiful first, and share out every pixel", () => {
    const found = swatches(points(scene), 5);
    const weights = found.map((swatch) => swatch.weight);
    expect(weights).toEqual(found.map((swatch) => swatch.weight).sort((a, b) => b - a));
    expect(found.reduce((sum, swatch) => sum + swatch.weight, 0)).toBeCloseTo(1, 5);
  });

  test("are as many as the picture has, when it has fewer", () => {
    expect(swatches(points(picture(["#ff0000", 10], ["#0000ff", 10])), 16)).toHaveLength(2);
  });

  test("survive their file, and make a theme that reads", () => {
    const file = toFile("Scene", ["scene.png"], swatches(points(scene), 6));
    const read = readSwatchFile(JSON.parse(JSON.stringify(file)))!;
    expect(read.name).toBe("Scene");
    expect(read.swatches).toHaveLength(6);
    const theme = resolveFile(themeFromSwatches(read.swatches, read.name));
    expect(contrast(parse(theme.dark.accent)!, parse(theme.dark.bg)!)).toBeGreaterThanOrEqual(4.5);
    const written = writeSwatchFile(file);
    expect(Object.keys(written)).toEqual(["scene.swatch.json", "scene.gpl", "scene.svg"]);
    expect(written["scene.gpl"]).toStartWith("GIMP Palette\nName: Scene\n");
  });

  test("a file that isn't one is nothing", () => {
    expect(readSwatchFile({ name: "Theme", light: {} })).toBeUndefined();
    expect(readSwatchFile(null)).toBeUndefined();
  });
});

describe("themes for other apps", () => {
  const theme = greenWorld;

  test("VS Code reads its themes back as the theme's colors", () => {
    const files = vscode(theme);
    const manifest = files["package.json"] as { contributes: { themes: { uiTheme: string; path: string }[] } };
    expect(manifest.contributes.themes.map((each) => each.uiTheme)).toEqual(["vs", "vs-dark"]);
    for (const scheme of ["light", "dark"] as const) {
      const json = files[`themes/green-world-${scheme}-color-theme.json`];
      const [read] = readVscode(JSON.stringify(json), "theme.json");
      same(read.colors.background, theme[scheme].bg);
      same(read.colors.foreground, theme[scheme].text);
      same(read.colors.sidebar, theme[scheme]["bg-sidebar"]);
      same(read.colors.accent, theme[scheme].accent);
      same(read.colors.syntax?.keyword, theme[scheme]["syn-keyword"]);
    }
  });

  test("GTK reads its colors back, and GTK 4's follow the system's style", () => {
    const files = gtk(theme);
    for (const scheme of ["light", "dark"] as const) {
      const [read] = readGtk(files[`gtk-3.0/${scheme}.css`] as string, "gtk.css");
      same(read.colors.background, theme[scheme].bg);
      same(read.colors.foreground, theme[scheme].text);
      same(read.colors.accent, theme[scheme].accent);
    }
    const modern = files["gtk-4.0/gtk.css"] as string;
    expect(modern).toContain("@media (prefers-color-scheme: dark)");
    expect(modern).toContain(`--view-bg-color: ${theme.dark.bg};`);
  });

  test("Base24 reads back as a Base16 scheme, its hues readable", () => {
    const files = base24(theme);
    for (const scheme of ["light", "dark"] as const) {
      const yaml = files[`green-world-${scheme}.yaml`] as string;
      expect(yaml).toContain(`variant: "${scheme}"`);
      expect(yaml.match(/^ {2}base[0-9A-F]{2}: "#[0-9a-f]{6}"$/gm)).toHaveLength(24);
      const [read] = base16(yaml, "scheme.yaml");
      same(read.colors.background, theme[scheme].bg);
      same(read.colors.foreground, theme[scheme].text);
      for (const hue of Object.values(read.colors.hues!)) expect(contrast(parse(hue)!, parse(theme[scheme].bg)!)).toBeGreaterThanOrEqual(3);
    }
  });

  test("colors a theme leaves out are lines' own", () => {
    const dark = vscode(shown("lines"))["themes/lines-dark-color-theme.json"] as { colors: Record<string, string> };
    // app.css's dark --danger.
    expect(dark.colors.errorForeground).toBe("#ff6369");
    expect(toLch(parse(dark.colors["terminal.ansiRed"])!).c).toBeGreaterThan(0.1);
  });

  test("are named for files", () => {
    expect(slug("Green World")).toBe("green-world");
    expect(slug("Café  Noir!")).toBe("cafe-noir");
    expect(slug("…")).toBe("theme");
  });
});
