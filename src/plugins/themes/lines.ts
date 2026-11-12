import type { WithPalette } from "./builtIn";

/**
 * Lines, the theme lines starts with and falls back to: deep teal on cool, quiet greys. On its own,
 * as the website (site/) is drawn in it too.
 */
export const lines: WithPalette = {
  id: "lines",
  name: "Lines",
  palette: {
    light: {
      colors: [
        { id: "white", color: "#ffffff" },
        { id: "dark-gray", color: "#162120" },
        { id: "light-gray", color: "#eff4f3" },
        { id: "teal", color: "#0e7a7e" },
        { id: "dark-gray-2", color: "#33413f" },
        { id: "gray", color: "#5b6a68" },
        { id: "teal-2", color: "#0b6a6e" },
        { id: "dark-gray-3", color: "#0e2826" },
      ],
    },
    dark: {
      colors: [
        { id: "white", color: "#ffffff" },
        { id: "black", color: "#131819" },
        { id: "light-gray", color: "#e3ebea" },
        { id: "dark-gray", color: "#232b2c" },
        { id: "teal", color: "#45c4c1" },
        { id: "gray", color: "#94a3a1" },
        { id: "teal-2", color: "#74d8d4" },
      ],
    },
  },
  light: {
    bg: "white",
    "bg-sidebar": "light-gray",
    "bg-elevated": "white",
    text: "dark-gray",
    "text-sidebar": "dark-gray-2",
    "text-muted": "gray",
    accent: "teal",
    "tag-text": "teal-2",
    ink: "dark-gray-3",
  },
  dark: {
    bg: "black",
    "bg-elevated": "dark-gray",
    text: "light-gray",
    "text-muted": "gray",
    accent: "teal",
    "tag-text": "teal-2",
    ink: "white",
  },
};
