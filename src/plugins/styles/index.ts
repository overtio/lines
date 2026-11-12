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
import lightbulb from "./lightbulb.css?raw";
import neon from "./neon.css?raw";
import pixel from "./pixel.css?raw";
import puddle from "./puddle.css?raw";

/*
 * Whole looks for the app, beside its colors, each a preset (Settings → Presets): lines' own,
 * a 90s desktop, one-bit pixels, neon, a rainy day in a picture book and a spark of lightning. Each but lines'
 * brings a color theme made for it, and a cursor and pointer to go with it. Their fonts (SIL Open Font License) load only when a style that
 * uses them shows.
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

/**
 * A rainy day in a picture book, in its colors: the rain blue most of it is drawn on, cream paper,
 * a sweater's seafoam, Piplup's navy, a coral wall, a beak's mustard and the trees' olive, deepened
 * where they're text or a tag's icon so they read (3:1 at least on the sidebar's blue).
 */
const puddleColors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    bg: "#fcfaee",
    "bg-list": "#e3eee8",
    "bg-sidebar": "#8cc2d4",
    "bg-elevated": "#fffef7",
    text: "#14181a",
    "text-sidebar": "#0b2530",
    "text-muted": "#4f5d5c",
    "text-faint": "#7a8584",
    accent: "#1f4a85",
    "tag-text": "#a33b45",
    "tag-bg": "#f7e1dc",
    ink: "#14181a",
    "highlight-base": "#e5c460",
    "palette-red": "#a33b45",
    "palette-orange": "#9c4f22",
    "palette-yellow": "#7d620c",
    "palette-green": "#555f1f",
    "palette-blue": "#1f4a85",
    "palette-purple": "#674a88",
    "palette-gray": "#4f5d5c",
  },
  dark: {
    bg: "#132630",
    "bg-list": "#17303b",
    "bg-sidebar": "#1d3b48",
    "bg-elevated": "#224453",
    text: "#f6f3e6",
    "text-sidebar": "#e0eef2",
    "text-muted": "#abc3ca",
    "text-faint": "#7f99a1",
    accent: "#8cc8de",
    "tag-text": "#f0a9a9",
    ink: "#f6f3e6",
    "highlight-base": "#e5c460",
  },
};

/**
 * A spark of lightning, in a mouse's five colors: lemon fur for the sidebar, its shading's gold in the
 * note list's and tags' tints, red cheeks for the accent, the cedar of its stripes for tags, and black
 * ear tips for the ink lines. At night the lemon lights the dark: the accent, the ink lines, the cursor.
 */
const lightbulbColors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    bg: "#fffcee",
    "bg-list": "#fff3c4",
    "bg-sidebar": "#fad61d",
    "bg-elevated": "#fffef8",
    text: "#17120a",
    "text-sidebar": "#000000",
    "text-muted": "#5c4a1f",
    "text-faint": "#857552",
    accent: "#c0220d",
    "tag-text": "#811e09",
    "tag-bg": "#fde3b8",
    ink: "#000000",
    "highlight-base": "#fad61d",
    "palette-red": "#b8240f",
    "palette-orange": "#995400",
    "palette-yellow": "#7a6100",
    "palette-green": "#46681c",
    "palette-blue": "#245089",
    "palette-purple": "#6c3f8c",
    "palette-gray": "#5f5747",
  },
  dark: {
    bg: "#16130c",
    "bg-list": "#1c1810",
    "bg-sidebar": "#241e12",
    "bg-elevated": "#2c2517",
    text: "#fbf6e2",
    "text-sidebar": "#f7efcf",
    "text-muted": "#cbbf98",
    "text-faint": "#968b6b",
    accent: "#fad61d",
    "tag-text": "#ff8a70",
    "tag-bg": "#3a1e14",
    ink: "#fad61d",
    "highlight-base": "#e19720",
  },
};

/** Their colors, which are themes like any other, with Increased contrast's written in. */
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
  { id: "puddle", name: "Puddle", ...puddleColors },
  { id: "lightbulb", name: "Lightbulb", ...lightbulbColors },
];

const looks = (): AppStyle[] => [
  { id: "lines", name: "Lines", description: t("styles.lines") },
  {
    id: "classic",
    name: "Classic",
    description: t("styles.classic"),
    theme: "classic",
    settings: { pointerStyle: "retro" },
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
    settings: { caretShape: "block", pointerStyle: "retro" },
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
    settings: { caretShape: "thick", caretEffect: "glow", pointerTrail: "comet" },
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
  {
    id: "puddle",
    name: "Puddle",
    description: t("styles.puddle"),
    theme: "puddle",
    font: { name: "Rounded", family: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif' },
    properties: {
      "radius-scale": "1.25",
      "card-shadow": "none",
      "shadow-segment": "none",
      "shadow-menu": "none",
      "shadow-dialog": "none",
      "shadow-drawer": "none",
    },
    css: puddle,
  },
  {
    id: "lightbulb",
    name: "Lightbulb",
    description: t("styles.lightbulb"),
    theme: "lightbulb",
    settings: { caretShape: "thick", caretEffect: "sparks" },
    properties: {
      "radius-scale": "1.5",
      "card-shadow": "3px 3px 0 var(--ink)",
      "shadow-segment": "none",
      "shadow-menu": "4px 4px 0 var(--ink)",
      "shadow-dialog": "6px 6px 0 var(--ink)",
      "shadow-drawer": "none",
    },
    css: lightbulb,
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
