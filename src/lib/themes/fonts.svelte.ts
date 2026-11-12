import { plugins } from "../plugins/registry.svelte";
import { FONTS } from "../prefs.svelte";
import { rule } from "./css";

/*
 * Fonts to write notes in: the system's (FONTS, app.css), then those plugins bring (plugins'
 * `fonts`). The chosen one shows by the page's `data-font`, which a plugin's font is written for
 * here; while its plugin is off, notes are in the system's font.
 */

/** Every font notes can be in, the system's first. */
export const noteFonts = () => [...FONTS, ...plugins.fonts];

/** The CSS font-family of the font `id`, or of the system's (a style's own, where it has one) if there's none by that id. */
export const fontFamily = (id: string) => noteFonts().find((font) => font.id === id)?.family ?? FONTS[0].family;

const element = document.createElement("style");
element.id = "lines-fonts";
document.head.append(element);

const ID = /^[a-z][a-z0-9-]*$/;

function showFonts() {
  const css = plugins.fonts
    .filter((font) => ID.test(font.id) && !FONTS.some((each) => each.id === font.id))
    .map((font) => rule(`:root[data-font="${font.id}"]`, { "font-text": font.family }))
    .join("\n\n");
  if (element.textContent !== css) element.textContent = css;
}

showFonts();
$effect.root(() => {
  $effect(showFonts);
});
