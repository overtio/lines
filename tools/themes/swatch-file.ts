import { fromLch, hex, isDark, parse, toLch } from "../../src/lib/themes/color";
import type { Swatch } from "../../src/lib/themes/swatches";
import { slug, type Written } from "./targets/common";

/*
 * A swatch: the colors pictures or a video have, most plentiful first, each with its share of their
 * pixels. Written as JSON (`.swatch.json`, which adapt.ts makes themes of), as a GIMP palette
 * (`.gpl`, which GIMP, Inkscape, Krita and Aseprite read) and as a picture of it (`.svg`).
 */

export interface SwatchFile {
  name: string;
  /** The files and links its colors came from. */
  sources: string[];
  colors: { color: string; share: number }[];
}

export const toFile = (name: string, sources: string[], found: Swatch[]): SwatchFile => ({
  name,
  sources,
  colors: found.map((swatch) => ({ color: hex(fromLch(swatch)), share: Math.round(swatch.weight * 10000) / 10000 })),
});

/** A swatch file's colors as swatches; undefined if it isn't one. */
export function readSwatchFile(json: unknown): { name: string; swatches: Swatch[] } | undefined {
  const file = json as Partial<SwatchFile> | null;
  if (typeof file?.name !== "string" || !Array.isArray(file.colors)) return;
  const swatches = file.colors.flatMap(({ color, share }) => {
    const rgb = parse(color);
    return rgb && typeof share === "number" ? [{ ...toLch(rgb), weight: share }] : [];
  });
  return swatches.length ? { name: file.name, swatches } : undefined;
}

/** A band of the colors, each as wide as its share, over rows of tiles with their hex. */
function picture({ name, colors }: SwatchFile) {
  const [tile, gap, band, columns] = [72, 8, 32, Math.min(colors.length, 8)];
  const width = columns * (tile + gap) - gap;
  const height = band + Math.ceil(colors.length / columns) * (tile + gap);
  let x = 0;
  const shares = colors.map(({ color, share }) => {
    const rect = `<rect x="${x.toFixed(1)}" width="${(share * width + 0.5).toFixed(1)}" height="${band}" fill="${color}"/>`;
    x += share * width;
    return rect;
  });
  const tiles = colors.map(({ color }, i) => {
    const [left, top] = [(i % columns) * (tile + gap), band + gap + Math.floor(i / columns) * (tile + gap)];
    const ink = isDark(parse(color)!) ? "#ffffff" : "#000000";
    return `<rect x="${left}" y="${top}" width="${tile}" height="${tile}" rx="6" fill="${color}"/><text x="${left + tile / 2}" y="${top + tile - 10}" fill="${ink}" fill-opacity="0.8" text-anchor="middle">${color}</text>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="ui-monospace, Menlo, monospace" font-size="11">`,
    `<title>${name.replace(/[<&]/g, "")}</title>`,
    `<clipPath id="band"><rect width="${width}" height="${band}" rx="6"/></clipPath>`,
    `<g clip-path="url(#band)">${shares.join("")}</g>`,
    ...tiles,
    "</svg>",
    "",
  ].join("\n");
}

/** GIMP's palette: a color a line, its red, green and blue, then its name. */
function gpl({ name, colors }: SwatchFile) {
  const rows = colors.map(({ color, share }) => {
    const { r, g, b } = parse(color)!;
    return `${[r, g, b].map((channel) => String(channel).padStart(3)).join(" ")}\t${color} (${(share * 100).toFixed(1)}%)`;
  });
  return ["GIMP Palette", `Name: ${name}`, `Columns: ${Math.min(colors.length, 8)}`, "#", ...rows, ""].join("\n");
}

export function writeSwatchFile(file: SwatchFile): Written {
  const base = slug(file.name);
  return { [`${base}.swatch.json`]: file, [`${base}.gpl`]: gpl(file), [`${base}.svg`]: picture(file) };
}
