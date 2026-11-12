import { describe, expect, test } from "bun:test";
import { difference, parse } from "../../src/lib/themes/color";
import {
  colorsIn,
  filePalette,
  fromColors,
  PALETTE_SIZE,
  type PaletteFile,
  readPalette,
  readPaletteFile,
  readThemeFile,
  resolveFile,
  sameTheme,
  type ThemeFile,
  writePaletteFile,
  writeThemeFile,
} from "../../src/lib/themes/file";
import { importedColors, paletteOf, workOut } from "../../src/lib/themes/palette";
import { stubApp } from "./stubs";

/*
 * lines' theme and palette files, from before palettes too; your themes and palettes as they're kept,
 * and what changing one does to its palette, or to the themes drawn in it; themes from other apps'
 * colors; and colors' names.
 */

stubApp();
// What lines' theme files are checked with, outside a browser.
globalThis.CSS ??= { supports: (_: string, value?: string) => !!parse(value) || /^(var|color-mix)\(/.test(value ?? "") } as typeof CSS;
const { customThemes, readYours } = await import("../../src/lib/themes/custom.svelte");
const { describe: describeColor, paletteNames } = await import("../../src/lib/themes/names");

const BASE = {
  bg: "#ffffff",
  "bg-list": "#f9fbfb",
  "bg-sidebar": "#eff4f3",
  "bg-elevated": "#ffffff",
  text: "#162120",
  "text-sidebar": "#33413f",
  "text-muted": "#5b6a68",
  "text-faint": "#97a4a2",
  accent: "#0e7a7e",
  "tag-text": "#0b6a6e",
  ink: "rgb(14, 40, 38)",
};
/** A theme as files and storage had it before palettes: colors by part, and Increased contrast's. */
const OLD = {
  name: "Teal",
  author: "Someone",
  light: { ...BASE, danger: "#c0392b", "callout-info": "var(--accent)", border: "color-mix(in srgb, var(--ink) 20%, transparent)" },
  dark: { ...BASE, bg: "#131819", text: "#e3ebea", accent: "#45c4c1" },
  moreContrast: { light: { "text-muted": "#475553" } },
};

/** A theme from before palettes with more colors across light and dark than a palette has: each part a color of its own. */
const PARTS = [...Object.keys(BASE), "danger", "success", "pin", "callout-info", "callout-question", "callout-warning", "callout-decision", "syn-keyword", "syn-string", "syn-number"];
const colorsFor = (start: string) => Object.fromEntries(PARTS.map((part, i) => [part, `#${start}${(i + 16).toString(16)}80`]));
const MANY = { name: "Many", light: colorsFor("f0"), dark: colorsFor("20") };

/** The palette a theme file's `scheme` carries. */
const carried = (file: ThemeFile, scheme: "light" | "dark" = "light") => filePalette(file, scheme) as PaletteFile;

/** Each part's color as a theme file gives it, by its palette. */
function partColors(file: ThemeFile, scheme: "light" | "dark") {
  const palette = carried(file, scheme);
  return { ...file.properties?.[scheme], ...Object.fromEntries(Object.entries(file[scheme] ?? {}).map(([part, id]) => [part, palette.colors.find((entry) => entry.id === id)?.color])) };
}

describe("theme files", () => {
  test("one from before palettes still reads: a palette of its colors, each once, and every part in the color it had", () => {
    const file = readThemeFile(OLD)!;
    expect(file.name).toBe("Teal");
    expect(file.author).toBe("Someone");
    expect(carried(file)).toBe(carried(file, "dark"));
    expect(carried(file).name).toBe("Teal");
    const colors = carried(file).colors.map((entry) => entry.color);
    expect(new Set(colors).size).toBe(colors.length);
    for (const scheme of ["light", "dark"] as const) {
      const given = partColors(file, scheme);
      for (const [part, value] of Object.entries(OLD[scheme])) {
        if (value.startsWith("#") || value.startsWith("rgb")) expect(parse(given[part]), `${scheme} ${part}`).toEqual(parse(value));
        else expect(given[part], `${scheme} ${part}`).toBe(value);
      }
    }
    // Increased contrast's colors are worked out now.
    expect(JSON.stringify(file)).not.toContain("moreContrast");
  });

  test("one with more colors across light and dark than a palette has reads with a palette for each, every part in the color it had", () => {
    const file = readThemeFile(MANY, (name) => ({ light: `${name} by day`, dark: `${name} by night` }))!;
    expect([carried(file).name, carried(file, "dark").name]).toEqual(["Many by day", "Many by night"]);
    for (const scheme of ["light", "dark"] as const) {
      expect(carried(file, scheme).colors).toHaveLength(PARTS.length);
      const given = partColors(file, scheme);
      for (const part of PARTS) expect(given[part], `${scheme} ${part}`).toBe(MANY[scheme][part]);
    }
    expect(readThemeFile(JSON.parse(writeThemeFile(file)))).toEqual(file);
  });

  test("its palette goes with it, and reads back the same", () => {
    const file = readThemeFile(OLD)!;
    const again = readThemeFile(JSON.parse(writeThemeFile(file)))!;
    expect(again).toEqual(file);
    expect(sameTheme(file, again)).toBe(true);
  });

  test("one drawn in a palette lines has names it by id, and keeps the parts it has", () => {
    const file = readThemeFile({ name: "Night", palette: "nord", dark: { bg: "nord0", text: "nord4", "Bad Part": "nord1", accent: "not an id!" } })!;
    expect(file.palette).toBe("nord");
    expect(file.dark).toEqual({ bg: "nord0", text: "nord4" });
    const both = readThemeFile({ name: "Catppuccin", palette: { light: "catppuccin-light", dark: "catppuccin-dark" }, light: { bg: "base" }, dark: { bg: "base" } })!;
    expect(both.palette).toEqual({ light: "catppuccin-light", dark: "catppuccin-dark" });
  });

  test("leaves out what isn't one: colors its palette hasn't, values that aren't made from the theme's colors", () => {
    const file = readThemeFile({
      name: "Odd",
      palette: { name: "Odd", colors: [{ id: "a", color: "#123456" }, { id: "b", color: "url(https://example.com/x.png)" }, { id: "a", color: "#654321" }] },
      light: { bg: "a", text: "b", accent: "c" },
      properties: { light: { border: "color-mix(in srgb, var(--ink) 30%, transparent)", hover: "url(https://example.com/x.png)", selection: "#ff0000", "card-shadow": "none" } },
    })!;
    expect(carried(file).colors).toEqual([{ id: "a", color: "#123456" }]);
    expect(file.light).toEqual({ bg: "a" });
    expect(file.properties?.light).toEqual({ border: "color-mix(in srgb, var(--ink) 30%, transparent)", "card-shadow": "none" });
    expect(readThemeFile({ name: "Nothing", palette: { name: "Nothing", colors: [] }, light: {} })).toBeUndefined();
    expect(readThemeFile({ name: "Colors", light: { bg: "#fff" } })).toBeUndefined();
  });

  test("worked out, it shows as the theme it was", () => {
    const theme = resolveFile(readThemeFile(OLD)!);
    expect(theme.light.accent).toBe("#0e7a7e");
    expect(theme.light["callout-info"]).toBe("var(--accent)");
    expect(theme.dark.bg).toBe("#131819");
    expect(theme.moreContrast?.light?.["text-muted"]).toBeString();
  });
});

describe("palette files", () => {
  test("read back as they're written, with their colors' names", () => {
    const palette = { name: "Sea", author: "Someone", colors: [{ id: "deep", name: "Deep", color: "#123456" }, { id: "foam", color: "#e0f0f0" }] };
    expect(readPaletteFile(JSON.parse(writePaletteFile(palette)))).toEqual(palette);
  });

  test("a file with no colors lines can read isn't one", () => {
    expect(readPaletteFile({ name: "Empty", colors: [{ id: "x", color: "nope" }] })).toBeUndefined();
    expect(readPaletteFile({ colors: [{ id: "x", color: "#fff" }] })).toBeUndefined();
  });

  test("pasted or in another file, the colors written in it make one: hex and rgb(), each once, as many as a palette has", () => {
    const sea = { name: "Sea", colors: [{ id: "deep", name: "Deep", color: "#123456" }] };
    expect(readPalette(writePaletteFile(sea), "Pasted")).toEqual(sea);
    expect(colorsIn("--bg: #FFF; --text: rgb(14 122 126); accent #0e7a7e, again #0E7A7E and #12345678; not #12345 or #ggg")).toEqual(["#ffffff", "#0e7a7e", "rgb(18 52 86 / 0.471)"]);
    expect(readPalette("background = #282a36\nforeground = #f8f8f2", "Dracula")).toEqual({
      name: "Dracula",
      colors: [
        { id: "c1", color: "#282a36" },
        { id: "c2", color: "#f8f8f2" },
      ],
    });
    const many = Array.from({ length: 40 }, (_, i) => `#0000${i.toString(16).padStart(2, "0")}`).join(" ");
    expect(colorsIn(many)).toHaveLength(PALETTE_SIZE);
    expect(readPalette("no colors here", "Nothing")).toBeUndefined();
  });
});

describe("your themes", () => {
  test("kept before palettes, each reads with a palette of its colors, by its own id, every window the same", () => {
    const stored = JSON.stringify([{ ...OLD, id: "custom-abc123" }, { id: "not ours", ...OLD }]);
    const { themes, palettes } = readYours(stored, "[]");
    expect(themes.map((theme) => theme.id)).toEqual(["custom-abc123"]);
    expect(themes[0].palette).toBe("custom-abc123");
    expect(palettes.map((palette) => palette.id)).toEqual(["custom-abc123"]);
    expect(readYours(stored, "[]")).toEqual({ themes, palettes });
    // As they're saved after: as they are.
    const again = readYours(JSON.stringify(themes), JSON.stringify(palettes));
    expect(again).toEqual({ themes, palettes });
    // One with more colors than a palette has: a palette for each scheme, by its id and the scheme.
    const many = readYours(JSON.stringify([{ ...MANY, id: "custom-many1" }]), "[]");
    expect(many.themes[0].palette).toEqual({ light: "custom-many1-light", dark: "custom-many1-dark" });
    expect(many.palettes.map((palette) => palette.colors.length)).toEqual([PARTS.length, PARTS.length]);
    expect(readYours(JSON.stringify(many.themes), JSON.stringify(many.palettes))).toEqual(many);
  });

  test("a color changed changes its palette's color while only that part is drawn in it, and otherwise adds one", () => {
    const id = customThemes.add(readThemeFile(OLD)!);
    const theme = customThemes.get(id)!;
    const palette = () => customThemes.palette(paletteOf(theme, "light"))!;
    const color = (scheme: "light" | "dark", part: string) => palette().colors.find((entry) => entry.id === customThemes.get(id)![scheme]![part])?.color;
    // Only the light accent is this teal (the dark has its own): changed in place.
    const before = palette().colors.length;
    const accent = theme.light!.accent;
    customThemes.setColor(id, "light", "accent", "#2f7d32");
    expect(customThemes.get(id)!.light!.accent).toBe(accent);
    expect(color("light", "accent")).toBe("#2f7d32");
    // The light and dark backgrounds of the list share a color: a new one for the light, the dark's kept.
    customThemes.setColor(id, "light", "bg-list", "#fafafa");
    expect(color("light", "bg-list")).toBe("#fafafa");
    expect(color("dark", "bg-list")).toBe("#f9fbfb");
    expect(palette().colors.length).toBe(before + 1);
    // A color the palette has already: drawn in that one.
    customThemes.setColor(id, "light", "text-muted", "#ffffff");
    expect(customThemes.get(id)!.light!["text-muted"]).toBe(customThemes.get(id)!.light!.bg);
    // A part drawn as another is (`var(--accent)`) takes the color, and taken out, it's worked out.
    customThemes.setColor(id, "light", "callout-info", "#0000ff");
    expect(customThemes.get(id)!.properties?.light?.["callout-info"]).toBeUndefined();
    customThemes.setColor(id, "light", "callout-info", undefined);
    expect(customThemes.get(id)!.light!["callout-info"]).toBeUndefined();
    customThemes.remove(id);
    expect(customThemes.palette(paletteOf(theme, "light"))).toBeUndefined();
  });

  test("with a palette for each scheme, a color changed goes into that scheme's, and Make Dark Colors has one of its own where one would be too many", () => {
    const id = customThemes.add(readThemeFile(MANY)!);
    const [light, dark] = (["light", "dark"] as const).map((scheme) => paletteOf(customThemes.get(id)!, scheme));
    expect(light).not.toBe(dark);
    customThemes.setColor(id, "dark", "accent", "#123456");
    expect(customThemes.palette(dark)!.colors.map((entry) => entry.color)).toContain("#123456");
    expect(customThemes.palette(light)!.colors.map((entry) => entry.color)).not.toContain("#123456");
    customThemes.remove(id);
    expect([customThemes.palette(light), customThemes.palette(dark)]).toEqual([undefined, undefined]);
    const lightOnly = customThemes.add(readThemeFile({ name: "Day", light: MANY.light })!);
    customThemes.addScheme(lightOnly, "dark", MANY.dark);
    const made = customThemes.get(lightOnly)!;
    expect(typeof made.palette).toBe("object");
    expect(customThemes.palette(paletteOf(made, "dark"))!.colors).toHaveLength(PARTS.length);
    customThemes.remove(lightOnly);
  });

  test("a copy has a copy of the palette, and one drawn in a plugin's palette copies it at its first change", () => {
    const nord = { id: "nord", name: "Nord", author: "Arctic Ice Studio", colors: [{ id: "nord0", name: "Polar Night 1", color: "#2e3440" }, { id: "nord6", name: "Snow Storm 3", color: "#eceff4" }] };
    const definition = { id: "nord", name: "Nord", palette: "nord", dark: { bg: "nord0", text: "nord6" } };
    const copy = customThemes.copy(definition, (id) => (id === "nord" ? nord : undefined), "Nord Copy");
    expect(customThemes.palette(paletteOf(customThemes.get(copy)!, "dark"))?.colors).toEqual(nord.colors);
    const drawn = customThemes.add({ name: "Drawn in Nord", palette: "nord", dark: { bg: "nord0", text: "nord6" } });
    expect(customThemes.get(drawn)!.palette).toBe("nord");
    customThemes.setColor(drawn, "dark", "accent", "#88c0d0", nord);
    const own = customThemes.palette(paletteOf(customThemes.get(drawn)!, "dark"))!;
    expect(own.colors.map((entry) => entry.color)).toEqual(["#2e3440", "#eceff4", "#88c0d0"]);
    expect(nord.colors).toHaveLength(2);
    customThemes.remove(copy);
    customThemes.remove(drawn);
  });

  test("renamed, its palette is too, while it's named after it and only it is drawn in it", () => {
    const id = customThemes.add(readThemeFile(OLD)!);
    customThemes.rename(id, "Lagoon");
    expect(customThemes.palette(paletteOf(customThemes.get(id)!, "light"))?.name).toBe("Lagoon");
    customThemes.remove(id);
  });

  test("its file carries its palette, and finding one of yours by it ignores what its colors are called", () => {
    const id = customThemes.add(readThemeFile(OLD)!);
    const file = customThemes.file(id)!;
    expect(typeof file.palette).toBe("object");
    expect(customThemes.find(readThemeFile(JSON.parse(writeThemeFile(file)))!)).toBe(id);
    customThemes.remove(id);
  });
});

describe("palettes of yours", () => {
  const hex = (id: string) => customThemes.palette(id)!.colors.map((entry) => entry.color);
  /** A theme of yours drawn in palette `palette`, its light parts in these of its colors. */
  const drawnIn = (palette: string, light: Record<string, string>) => customThemes.add({ name: "Drawn", palette, light });

  test("renamed, their colors changed, named, moved and added to, up to as many as a palette has", () => {
    const id = customThemes.addPalette({ name: "Sea", colors: [{ id: "c1", color: "#123456" }] });
    customThemes.renamePalette(id, "  Deep sea ");
    customThemes.renamePalette(id, " ");
    expect(customThemes.palette(id)!.name).toBe("Deep sea");
    customThemes.setPaletteColor(id, "c1", "rgb(18 52 86 / 50%)");
    customThemes.setPaletteColor(id, "c1", "not a color");
    expect(hex(id)).toEqual(["rgb(18 52 86 / 0.5)"]);
    customThemes.nameColor(id, "c1", " Deep ");
    expect(customThemes.palette(id)!.colors[0].name).toBe("Deep");
    customThemes.nameColor(id, "c1", "");
    expect(customThemes.palette(id)!.colors[0]).not.toHaveProperty("name");
    const added = customThemes.addColor(id, "#e0f0f0")!;
    customThemes.moveColor(id, added, -1);
    customThemes.moveColor(id, added, -1);
    expect(hex(id)).toEqual(["#e0f0f0", "rgb(18 52 86 / 0.5)"]);
    // A color it has already is that one.
    expect(customThemes.addColor(id, "#E0F0F0")).toBe(added);
    for (let n = 0; customThemes.palette(id)!.colors.length < PALETTE_SIZE; n++) customThemes.addColor(id, `#8080${n.toString(16).padStart(2, "0")}`);
    expect(customThemes.addColor(id, "#ff0000")).toBeUndefined();
    expect(customThemes.palette(id)!.colors).toHaveLength(PALETTE_SIZE);
    expect(customThemes.removePalette(id)).toBe(true);
    expect(customThemes.palette(id)).toBeUndefined();
  });

  test("a color taken out, what was drawn in it is drawn in the nearest left; the last stays", () => {
    const id = customThemes.addPalette({
      name: "Three",
      colors: [
        { id: "white", color: "#ffffff" },
        { id: "teal", color: "#0e7a7e" },
        { id: "green", color: "#2f7d32" },
      ],
    });
    const theme = drawnIn(id, { bg: "white", accent: "teal" });
    customThemes.removeColor(id, "teal");
    expect(customThemes.get(theme)!.light!.accent).toBe("green");
    customThemes.removeColor(id, "green");
    customThemes.removeColor(id, "white");
    expect(hex(id)).toEqual(["#ffffff"]);
    customThemes.remove(theme);
  });

  test("a theme drawn in another palette has each part in its nearest color, and one palette for both schemes while they're the same", () => {
    const from = customThemes.addPalette({
      name: "From",
      colors: [
        { id: "a", color: "#fafafa" },
        { id: "b", color: "#0e7a7e" },
      ],
    });
    const to = customThemes.addPalette({
      name: "To",
      colors: [
        { id: "dark", color: "#202020" },
        { id: "white", color: "#ffffff" },
        { id: "teal", color: "#107070" },
      ],
    });
    const theme = customThemes.add({ name: "Both", palette: from, light: { bg: "a", accent: "b" }, dark: { bg: "b" } });
    const lookUp = (each: string) => customThemes.palette(each);
    customThemes.setPalette(theme, ["light"], to, lookUp);
    expect(customThemes.get(theme)!.palette).toEqual({ light: to, dark: from });
    expect(customThemes.get(theme)!.light).toEqual({ bg: "white", accent: "teal" });
    customThemes.setPalette(theme, ["dark"], to, lookUp);
    expect(customThemes.get(theme)!.palette).toBe(to);
    expect(customThemes.get(theme)!.dark).toEqual({ bg: "teal" });
    // A part drawn in one of the palette's colors by its id.
    customThemes.assign(theme, "light", "accent", "dark");
    expect(customThemes.get(theme)!.light!.accent).toBe("dark");
    customThemes.remove(theme);
    expect([lookUp(from), lookUp(to)]).toEqual([lookUp(from), undefined]);
    customThemes.removePalette(from);
  });

  test("deleted, the themes drawn in it are drawn in another first; without one, it stays", () => {
    const id = customThemes.addPalette({ name: "Used", colors: [{ id: "c1", color: "#0e7a7e" }] });
    const other = customThemes.addPalette({ name: "Other", colors: [{ id: "x", color: "#107070" }] });
    const theme = drawnIn(id, { accent: "c1" });
    expect(customThemes.themesIn(id).map((each) => each.id)).toEqual([theme]);
    expect(customThemes.removePalette(id)).toBe(false);
    expect(customThemes.removePalette(id, id, (each) => customThemes.palette(each))).toBe(false);
    expect(customThemes.palette(id)).toBeDefined();
    expect(customThemes.removePalette(id, other, (each) => customThemes.palette(each))).toBe(true);
    expect(customThemes.palette(id)).toBeUndefined();
    expect(customThemes.get(theme)).toMatchObject({ palette: other, light: { accent: "x" } });
    customThemes.remove(theme);
  });

  test("a color of your own for a part of a theme whose palette is full is drawn in its nearest", () => {
    const colors = Array.from({ length: PALETTE_SIZE }, (_, i) => ({ id: `c${i + 1}`, color: `#${(i * 8).toString(16).padStart(2, "0")}0000` }));
    const id = customThemes.addPalette({ name: "Full", colors });
    const theme = drawnIn(id, { bg: "c1", text: "c2", accent: "c2" });
    customThemes.setColor(theme, "light", "accent", "#f90000");
    expect(customThemes.palette(id)!.colors).toHaveLength(PALETTE_SIZE);
    expect(customThemes.get(theme)!.light!.accent).toBe("c32");
    customThemes.remove(theme);
  });
});

describe("themes from other apps", () => {
  test("make a palette of the colors they have, each once, and a theme drawn in it", () => {
    const terminal = { background: "#282a36", foreground: "#f8f8f2", accent: "#bd93f9", hues: { red: "#ff5555", green: "#50fa7b", yellow: "#f1fa8c", blue: "#bd93f9" } };
    const { scheme, colors } = importedColors(terminal);
    const file = fromColors("Dracula", undefined, { [scheme]: colors });
    const palette = carried(file).colors.map((entry) => entry.color);
    expect(new Set(palette).size).toBe(palette.length);
    expect(palette).toContain("#bd93f9");
    expect(resolveFile(file).dark).toEqual(workOut(colors));
  });
});

describe("colors", () => {
  test("how different two look: none for the same, little for near ones, most for black and white", () => {
    const of = (a: string, b: string) => difference(parse(a)!, parse(b)!);
    expect(of("#0e7a7e", "#0e7a7e")).toBe(0);
    expect(of("#0e7a7e", "#0f7a7e")).toBeLessThan(0.01);
    expect(of("#0e7a7e", "#107070")).toBeLessThan(of("#0e7a7e", "#2f7d32"));
    expect(of("#000000", "#ffffff")).toBeCloseTo(1, 2);
  });
});

describe("colors' names", () => {
  test("say a color's hue, and whether it's dark, light or pale", () => {
    const cases: [string, ReturnType<typeof describeColor>][] = [
      ["#ffffff", { hue: "white" }],
      ["#131819", { hue: "black" }],
      ["#5b6a68", { hue: "gray", tone: undefined }],
      ["#3f3f46", { hue: "gray", tone: "dark" }],
      ["#e3ebea", { hue: "gray", tone: "light" }],
      ["#0e7a7e", { hue: "teal", tone: undefined }],
      ["#000080", { hue: "blue", tone: "dark" }],
      ["#f2cdcd", { hue: "pink", tone: "pale" }],
      ["#fab387", { hue: "orange", tone: "light" }],
      ["#8b4513", { hue: "brown", tone: undefined }],
      ["#dc322f", { hue: "red", tone: undefined }],
      ["#bd93f9", { hue: "purple", tone: undefined }],
      ["#b58900", { hue: "yellow", tone: undefined }],
      ["#228b22", { hue: "green", tone: undefined }],
    ];
    for (const [color, words] of cases) expect(describeColor(parse(color)!), color).toEqual(words);
  });

  test("a palette's own names come first, and the rest are named from their colors, a second the same numbered", () => {
    // Messages here are their keys.
    const names = paletteNames({ id: "p", name: "P", colors: [{ id: "a", name: "Polar Night 1", color: "#2e3440" }, { id: "b", color: "#008080" }, { id: "c", color: "#0e7a7e" }] });
    expect([...names.values()]).toEqual(["Polar Night 1", "picker.color.teal", "picker.color.again"]);
  });
});
