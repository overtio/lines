/**
 * The highlighter, status and callout colors of the themes with no color of their own (Mono,
 * Graphite, Pixel, Void): lines' own, at two fifths of their color, so they sit quietly in the greys and
 * stay apart. Each is 3:1 against those themes' backgrounds, danger 4.5:1.
 */
export const quiet = {
  light: {
    "highlight-base": "#e8d9a3",
    pin: "#c79f7d",
    danger: "#9f6763",
    success: "#5c7a66",
    "callout-info": "#5c759f",
    "callout-question": "#796ba1",
    "callout-warning": "#b28b6e",
    "callout-decision": "#5a7b71",
  },
  dark: {
    "highlight-base": "#e8d9a3",
    pin: "#d0ae86",
    danger: "#ca8c8a",
    success: "#8cb49d",
    "callout-info": "#8ea4c9",
    "callout-question": "#ab9ecb",
    "callout-warning": "#d2b28c",
    "callout-decision": "#8bb5a8",
  },
};
