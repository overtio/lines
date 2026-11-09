import { plugins } from "./plugins/registry.svelte";
import type { PaperStyle } from "./plugins/types";
import { prefs, type PaperSpacing } from "./prefs.svelte";
import { css, parse } from "./themes/color";
import { shownColor } from "./themes/show.svelte";

/*
 * The paper notes are written on (Settings → Paper): the pattern and texture chosen, from plugins,
 * set here as custom properties that editor.css draws behind every note's page, or under each of its
 * lines for a pattern drawn per line. A pattern's lines are a line of text apart, or three quarters
 * or one and a half of one, so they grow with the text, and in the color and opacity chosen.
 */

export const PAPER_SPACINGS: Record<PaperSpacing, number> = { small: 0.75, medium: 1, large: 1.5 };

/** Papers as CSS's background properties, the first over the next; none if none are chosen. */
export function paperBackground(styles: (PaperStyle | undefined)[], scheme: "light" | "dark") {
  const layers = styles.flatMap((style) => style?.layers(scheme) ?? []);
  if (!layers.length) return undefined;
  return {
    image: layers.map((layer) => layer.image).join(", "),
    size: layers.map((layer) => layer.size).join(", "),
    position: layers.map((layer) => layer.position ?? "0 0").join(", "),
  };
}

/** The color patterns are drawn in: the theme's ink or accent, or your own as Monochrome and Invert show it. */
function paperColor() {
  const custom = parse(prefs.paperCustomColor);
  if (prefs.paperColor === "custom" && custom) return css(shownColor(custom));
  return prefs.paperColor === "accent" ? "var(--accent)" : "var(--ink)";
}

const PROPERTIES = ["--paper-step", "--paper-light", "--paper-dark", "--paper-size", "--paper-position", "--paper-lines", "--paper-lines-size"];

function showPaper() {
  const root = document.documentElement;
  for (const name of PROPERTIES) root.style.removeProperty(name);
  // Always set, for Settings' previews too.
  root.style.setProperty("--paper-color", paperColor());
  root.style.setProperty("--paper-opacity", String(prefs.paperOpacity));
  const pattern = plugins.paperStyle(prefs.paperPattern);
  const texture = plugins.paperStyle(prefs.paperTexture);
  const lines = pattern?.perLine ? paperBackground([pattern], "light") : undefined;
  const page = [pattern?.perLine ? undefined : pattern, texture];
  const light = paperBackground(page, "light");
  const dark = paperBackground(page, "dark");
  root.toggleAttribute("data-paper", !!light);
  root.toggleAttribute("data-paper-lines", !!lines);
  if (lines) {
    root.style.setProperty("--paper-lines", lines.image);
    root.style.setProperty("--paper-lines-size", lines.size);
  }
  if (!light || !dark) return;
  // On the root with the images, where their var(--paper-step) is worked out, from the text's size and line height.
  root.style.setProperty("--paper-step", `calc(var(--editor-size) * var(--editor-line-height) * ${PAPER_SPACINGS[prefs.paperSpacing]})`);
  // Light and dark differ only in a texture's color; the scheme shown picks one (editor.css).
  root.style.setProperty("--paper-light", light.image);
  root.style.setProperty("--paper-dark", dark.image);
  root.style.setProperty("--paper-size", light.size);
  root.style.setProperty("--paper-position", light.position);
}

showPaper();
$effect.root(() => {
  $effect(showPaper);
});
