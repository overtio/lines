import "@fontsource/chakra-petch/400.css";
import "@fontsource/chakra-petch/400-italic.css";
import "@fontsource/chakra-petch/600.css";
import "@fontsource/chakra-petch/700.css";
import "@fontsource/orbitron/700.css";
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/700.css";
import "@fontsource/share-tech-mono/400.css";
import "@fontsource/vt323/400.css";
import { t } from "../../lib/i18n/index.svelte";
import type { AppStyle, Plugin, Theme, ThemeColors } from "../../lib/plugins/types";
import classic from "./classic.css?raw";
import neon from "./neon.css?raw";
import pixel from "./pixel.css?raw";

/*
 * Whole looks for the app, beside its colors (Settings → Theme → Style): lines' own, a 90s desktop,
 * one-bit pixels, and neon. Each but lines' brings a color theme made for it, chosen with it. Their
 * fonts (SIL Open Font License) load only when a style that uses them shows.
 */

const classicColors: ThemeColors = {
  bg: "#ffffff",
  "bg-list": "#ffffff",
  "bg-sidebar": "#c0c0c0",
  "bg-elevated": "#c0c0c0",
  text: "#000000",
  "text-sidebar": "#000000",
  "text-muted": "#404040",
  "text-faint": "#6e6e6e",
  accent: "#000080",
  "tag-text": "#000080",
  ink: "#000000",
};

const neonColors: ThemeColors = {
  bg: "#08080f",
  "bg-list": "#0b0b16",
  "bg-sidebar": "#0e0e1c",
  "bg-elevated": "#14142a",
  text: "#e6f4ff",
  "text-sidebar": "#c9dcf2",
  "text-muted": "#93a7c4",
  "text-faint": "#64779a",
  accent: "#ff3cdc",
  "tag-text": "#24f0ff",
  ink: "#9fdcff",
};

/** Their colors, which are themes like any other. Increased contrast's as palette.ts works them out. */
const themes = (): Theme[] => [
  {
    id: "classic",
    name: "Classic",
    scheme: "light",
    light: classicColors,
    dark: classicColors,
    moreContrast: { light: { "text-muted": "#323232", "text-faint": "#4e4e4e" } },
  },
  {
    id: "pixel",
    name: "Pixel",
    light: {
      bg: "#ffffff",
      "bg-list": "#ffffff",
      "bg-sidebar": "#ffffff",
      "bg-elevated": "#ffffff",
      text: "#000000",
      "text-sidebar": "#000000",
      "text-muted": "#4a4a4a",
      "text-faint": "#7a7a7a",
      accent: "#000000",
      "tag-text": "#000000",
      ink: "#000000",
    },
    dark: {
      bg: "#000000",
      "bg-list": "#000000",
      "bg-sidebar": "#000000",
      "bg-elevated": "#000000",
      text: "#ffffff",
      "text-sidebar": "#ffffff",
      "text-muted": "#b5b5b5",
      "text-faint": "#858585",
      accent: "#ffffff",
      "tag-text": "#ffffff",
      ink: "#ffffff",
    },
    moreContrast: { light: { "text-faint": "#767676" } },
  },
  {
    id: "neon",
    name: "Neon",
    scheme: "dark",
    light: neonColors,
    dark: neonColors,
    moreContrast: { dark: { "text-faint": "#697c9e" } },
  },
];

const looks = (): AppStyle[] => [
  { id: "lines", name: "Lines", description: t("styles.lines") },
  {
    id: "classic",
    name: "Classic",
    description: t("styles.classic"),
    theme: "classic",
    font: { name: "Tahoma", family: 'Tahoma, "MS Sans Serif", "Microsoft Sans Serif", Geneva, Verdana, sans-serif' },
    properties: {
      "radius-scale": "0",
      "text-xs": "11px",
      "text-sm": "12px",
      "text-base": "12px",
      "text-md": "13px",
      "card-shadow": "none",
      "shadow-segment": "none",
      "shadow-menu": "none",
      "shadow-dialog": "none",
      "shadow-drawer": "none",
    },
    css: classic,
  },
  {
    id: "pixel",
    name: "Pixel",
    description: t("styles.pixel"),
    theme: "pixel",
    font: { name: "Pixelify Sans", family: '"Pixelify Sans", var(--font-mono)' },
    properties: {
      "font-mono": "VT323, ui-monospace, monospace",
      "radius-scale": "0",
      "card-shadow": "none",
      "shadow-segment": "none",
      "shadow-menu": "4px 4px 0 var(--text)",
      "shadow-dialog": "6px 6px 0 var(--text)",
      "shadow-drawer": "4px 0 0 var(--text)",
    },
    css: pixel,
  },
  {
    id: "neon",
    name: "Neon",
    description: t("styles.neon"),
    theme: "neon",
    font: { name: "Chakra Petch", family: '"Chakra Petch", var(--font-mono)' },
    properties: {
      "font-mono": '"Share Tech Mono", ui-monospace, monospace',
      "radius-scale": "0.25",
      "card-shadow": "0 0 0 1px color-mix(in srgb, var(--tag-text) 22%, transparent), 0 0 24px color-mix(in srgb, var(--tag-text) 8%, transparent)",
      "shadow-segment": "0 0 10px color-mix(in srgb, var(--accent) 45%, transparent)",
      "shadow-menu": "0 0 0 1px color-mix(in srgb, var(--tag-text) 45%, transparent), 0 0 28px color-mix(in srgb, var(--tag-text) 22%, transparent)",
      "shadow-dialog": "0 0 0 1px color-mix(in srgb, var(--tag-text) 45%, transparent), 0 0 60px color-mix(in srgb, var(--accent) 22%, transparent)",
    },
    css: neon,
  },
];

export const styles = (): Plugin => ({
  id: "styles",
  name: t("plugins.styles"),
  description: t("plugins.styles.description"),
  icon: "paintbrush",
  enabledByDefault: true,
  contributes: { styles: looks(), themes: themes() },
});
