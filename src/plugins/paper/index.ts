import { t, type MessageKey } from "../../lib/i18n/index.svelte";
import type { PaperLayer, PaperStyle, Plugin } from "../../lib/plugins/types";

/*
 * Paper to write on (Settings → Paper): patterns drawn behind a note in the color and opacity chosen,
 * a fine line or dot every `--paper-step` (ruled lines under each row of text instead), textures as
 * faint as real paper's, from SVG noise, and backdrops behind the page, of soft glows of color.
 */

const STEP = "var(--paper-step)";
/** The pattern's color at the opacity chosen, times `weight`: more for dots, being small, less for a grid's finer lines. */
const ink = (weight = 1) => `color-mix(in srgb, var(--paper-color) calc(var(--paper-opacity) * ${weight * 100}%), transparent)`;

/** Lines across (`to bottom`) or down (`to right`), one at the start of every tile. */
const lines = (direction: "bottom" | "right", color: string, size: string): PaperLayer => ({
  image: `linear-gradient(to ${direction}, ${color} 1px, transparent 1px)`,
  size,
});

const dots = (position?: string, size = `${STEP} ${STEP}`): PaperLayer => ({
  image: `radial-gradient(circle at 1.5px 1.5px, ${ink(2.5)} 1.1px, transparent 1.6px)`,
  size,
  position,
});

/**
 * Noise as fine as paper's grain, or as linen's threads, in black on light and white on dark: one
 * SVG tile per `frequencies` (x and y), each at an opacity that keeps it a texture rather than a mark.
 */
function noise(scheme: "light" | "dark", frequencies: string[], strength: number): PaperLayer {
  const color = scheme === "dark" ? 1 : 0;
  const alpha = scheme === "dark" ? strength * 0.7 : strength;
  const layers = frequencies
    .map(
      (frequency, i) =>
        `<filter id="n${i}"><feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="3" stitchTiles="stitch"/>` +
        `<feColorMatrix values="0 0 0 0 ${color} 0 0 0 0 ${color} 0 0 0 0 ${color} ${alpha} 0 0 0 ${-alpha / 2}"/></filter>` +
        `<rect width="100%" height="100%" filter="url(#n${i})"/>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">${layers}</svg>`;
  return { image: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, size: "240px 240px" };
}

/** Soft spots of color over a base, as light glows across a wall: `spots` are [x%, y%, color]. */
const glow = (base: string, spots: [number, number, string][]): PaperLayer[] => [
  ...spots.map(([x, y, color]) => ({ image: `radial-gradient(circle at ${x}% ${y}%, ${color} 0, transparent 60%)`, size: "100% 100%" })),
  { image: `linear-gradient(${base}, ${base})`, size: "100% 100%" },
];

/** Backdrops, each with its light and its darker self. */
const BACKDROPS: { id: string; light: Parameters<typeof glow>; dark: Parameters<typeof glow> }[] = [
  {
    id: "dawn",
    light: ["#fbe9dc", [[12, 18, "#ffcfae"], [88, 12, "#f6bfd6"], [72, 88, "#d8c5f4"], [18, 92, "#fde3c2"]]],
    dark: ["#22171d", [[12, 18, "#6a3a3a"], [88, 12, "#5a2d4b"], [72, 88, "#3e2d66"], [18, 92, "#5b3b26"]]],
  },
  {
    id: "lagoon",
    light: ["#dcf1f0", [[15, 15, "#a4e2de"], [85, 25, "#b5d4f6"], [60, 90, "#cdf3e1"]]],
    dark: ["#0d1d22", [[15, 15, "#0f4f57"], [85, 25, "#163a6a"], [60, 90, "#0e4a3b"]]],
  },
  {
    id: "dusk",
    light: ["#efe4fd", [[10, 80, "#c3a0ff"], [80, 15, "#ffd08a"], [90, 85, "#ffb0cf"], [35, 20, "#b9c4ff"]]],
    dark: ["#1a1030", [[10, 80, "#5b2bb5"], [80, 15, "#a35a10"], [90, 85, "#8e1f57"], [35, 20, "#2a3a8f"]]],
  },
  {
    id: "meadow",
    light: ["#eaf3df", [[20, 20, "#c6e4a3"], [80, 30, "#f3edb3"], [50, 90, "#b5dfc6"]]],
    dark: ["#141d15", [[20, 20, "#2e562a"], [80, 30, "#4e5420"], [50, 90, "#1d4836"]]],
  },
  {
    id: "night",
    light: ["#dfe4f6", [[20, 25, "#b6c2f2"], [80, 70, "#d4c0ef"], [55, 10, "#c5daf3"]]],
    dark: ["#0b0e1f", [[20, 25, "#1c2a77"], [80, 70, "#4a1c6a"], [55, 10, "#0d4766"]]],
  },
  {
    id: "mist",
    light: ["#eef0f2", [[20, 20, "#e0e6ec"], [80, 80, "#f4f0ea"], [70, 15, "#e5ecee"]]],
    dark: ["#191b1e", [[20, 20, "#23282e"], [80, 80, "#2b2926"], [70, 15, "#222a2c"]]],
  },
];

const styles = (): PaperStyle[] => [
  {
    id: "lines",
    name: t("plugins.paper.lines"),
    kind: "pattern",
    perLine: true,
    // A rule along the bottom of each row of text.
    layers: () => [{ image: `linear-gradient(to bottom, transparent calc(1lh - 1px), ${ink()} 0)`, size: "100% 1lh" }],
  },
  {
    id: "dots",
    name: t("plugins.paper.dots"),
    kind: "pattern",
    layers: () => [dots()],
  },
  {
    id: "squares",
    name: t("plugins.paper.squares"),
    kind: "pattern",
    layers: () => [lines("bottom", ink(0.85), `${STEP} ${STEP}`), lines("right", ink(0.85), `${STEP} ${STEP}`)],
  },
  {
    id: "graph",
    name: t("plugins.paper.graph"),
    kind: "pattern",
    // A darker line every fifth, over the others.
    layers: () => {
      const major = `calc(${STEP} * 5) calc(${STEP} * 5)`;
      return [lines("bottom", ink(1.15), major), lines("right", ink(1.15), major), lines("bottom", ink(0.5), `${STEP} ${STEP}`), lines("right", ink(0.5), `${STEP} ${STEP}`)];
    },
  },
  {
    id: "isometric",
    name: t("plugins.paper.isometric"),
    kind: "pattern",
    // Dots at the corners of triangles: every other row moved half a step along.
    layers: () => {
      const size = `${STEP} calc(${STEP} * 1.732)`;
      return [dots("0 0", size), dots(`calc(${STEP} / 2) calc(${STEP} * 0.866)`, size)];
    },
  },
  {
    id: "grain",
    name: t("plugins.paper.grain"),
    kind: "texture",
    layers: (scheme) => [noise(scheme, ["0.8"], 0.16)],
  },
  {
    id: "linen",
    name: t("plugins.paper.linen"),
    kind: "texture",
    layers: (scheme) => [noise(scheme, ["0.9 0.04", "0.04 0.9"], 0.1)],
  },
  ...BACKDROPS.map(
    ({ id, light, dark }): PaperStyle => ({
      id,
      name: t(`plugins.paper.${id}` as MessageKey),
      kind: "backdrop",
      layers: (scheme) => glow(...(scheme === "dark" ? dark : light)),
    }),
  ),
];

export const paper = (): Plugin => ({
  id: "paper",
  name: t("plugins.paper"),
  description: t("plugins.paper.description"),
  icon: "notebook-text",
  enabledByDefault: true,
  contributes: { paperStyles: styles() },
});
