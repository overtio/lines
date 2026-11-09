import type { Theme } from "../../lib/plugins/types";

/**
 * Lines, the theme lines starts with and falls back to: deep teal on cool, quiet greys. On its own,
 * as the website (site/) is drawn in it too.
 */
export const lines: Theme = {
  id: "lines",
  name: "Lines",
  light: {
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
  },
  dark: {
    bg: "#131819",
    "bg-list": "#171d1e",
    "bg-sidebar": "#1c2324",
    "bg-elevated": "#232b2c",
    text: "#e3ebea",
    "text-sidebar": "#ccd7d5",
    "text-muted": "#94a3a1",
    "text-faint": "#61706e",
    accent: "#45c4c1",
    "tag-text": "#74d8d4",
    ink: "#ffffff",
  },
  moreContrast: {
    light: {
      "text-muted": "#475553",
      "text-faint": "#586463",
    },
    dark: {
      "text-muted": "#a1afad",
      "text-faint": "#808d8b",
    },
  },
};
