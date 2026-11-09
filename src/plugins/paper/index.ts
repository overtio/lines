import { t } from "../../lib/i18n/index.svelte";
import type { PaperLayer, PaperStyle, Plugin } from "../../lib/plugins/types";

/*
 * Paper to write on (Settings → Paper): patterns drawn behind a note in the color and opacity chosen,
 * a fine line or dot every `--paper-step` (ruled lines under each row of text instead), and textures
 * as faint as real paper's, from SVG noise.
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
];

export const paper = (): Plugin => ({
  id: "paper",
  name: t("plugins.paper"),
  description: t("plugins.paper.description"),
  icon: "notebook-text",
  enabledByDefault: true,
  contributes: { paperStyles: styles() },
});
