/**
 * The highlighter, status and callout colors of the themes with no color of their own (Mono,
 * Graphite, Pixel, Void): lines' own, at two fifths of their color, so they sit quietly in the greys and
 * stay apart. Each is 3:1 against those themes' backgrounds, danger 4.5:1. Their palettes for light
 * and dark have these colors, and these parts are drawn in them.
 */
export const quiet = {
  colors: {
    light: [
      { id: "quiet-yellow", color: "#e8d9a3" },
      { id: "quiet-light-brown", color: "#c79f7d" },
      { id: "quiet-red", color: "#9f6763" },
      { id: "quiet-green", color: "#5c7a66" },
      { id: "quiet-blue", color: "#5c759f" },
      { id: "quiet-purple", color: "#796ba1" },
      { id: "quiet-brown", color: "#b28b6e" },
      { id: "quiet-teal", color: "#5a7b71" },
    ],
    dark: [
      { id: "quiet-yellow", color: "#e8d9a3" },
      { id: "quiet-light-brown", color: "#d0ae86" },
      { id: "quiet-red", color: "#ca8c8a" },
      { id: "quiet-green", color: "#8cb49d" },
      { id: "quiet-blue", color: "#8ea4c9" },
      { id: "quiet-purple", color: "#ab9ecb" },
      { id: "quiet-light-brown-2", color: "#d2b28c" },
      { id: "quiet-teal", color: "#8bb5a8" },
    ],
  },
  light: {
    "highlight-base": "quiet-yellow",
    pin: "quiet-light-brown",
    danger: "quiet-red",
    success: "quiet-green",
    "callout-info": "quiet-blue",
    "callout-question": "quiet-purple",
    "callout-warning": "quiet-brown",
    "callout-decision": "quiet-teal",
  },
  dark: {
    "highlight-base": "quiet-yellow",
    pin: "quiet-light-brown",
    danger: "quiet-red",
    success: "quiet-green",
    "callout-info": "quiet-blue",
    "callout-question": "quiet-purple",
    "callout-warning": "quiet-light-brown-2",
    "callout-decision": "quiet-teal",
  },
};
