import { plugins } from "../plugins/registry.svelte";
import { FONTS, prefs } from "../prefs.svelte";
import { rule } from "./css";
import { type FormattingFont, formattingFamily } from "./formattingFonts";
import { canDraw } from "./installedFonts";

/*
 * Fonts to write notes in: the system's (FONTS, app.css), then those plugins bring (plugins'
 * `fonts`). The chosen one shows by the page's `data-font`, which a plugin's font is written for
 * here; while its plugin is off, notes are in the system's font. Formatting's own fonts are set
 * here too, as the custom properties editor.css draws it in.
 */

/** Every font notes can be in, the system's first. */
export const noteFonts = () => [...FONTS, ...plugins.fonts];

/** A font's name as Settings shows it: the system's is a style's own, where it has one. */
export const fontName = (font: { id: string; name: string }) => (font.id === "system" ? (plugins.style(prefs.style)?.font?.name ?? font.name) : font.name);

/** A font a plugin that's off brings, by its id, with that plugin's name: what a font chosen by id is while it's none of noteFonts(). */
export function fontOff(id: string) {
  for (const plugin of plugins.all) {
    const font = plugin.contributes.fonts?.find((each) => each.id === id);
    if (font) return { name: font.name, plugin: plugin.name };
  }
}

/** The CSS font-family of the font `id`, or of the system's (a style's own, where it has one) if there's none by that id. */
export const fontFamily = (id: string) => noteFonts().find((font) => font.id === id)?.family ?? FONTS[0].family;

const element = document.createElement("style");
element.id = "lines-fonts";
document.head.append(element);

const ID = /^[a-z][a-z0-9-]*$/;

function showFonts() {
  const fonts = noteFonts();
  // One this device hasn't, or whose plugin is off, is as none chosen.
  const formatting = Object.entries(prefs.formattingFonts).flatMap(([part, choice]) => {
    const family = "installed" in choice && !canDraw(choice.installed) ? undefined : formattingFamily(part as FormattingFont, choice, fonts);
    return family ? [[`font-${part}`, family]] : [];
  });
  const css = [
    ...plugins.fonts.filter((font) => ID.test(font.id) && !FONTS.some((each) => each.id === font.id)).map((font) => rule(`:root[data-font="${font.id}"]`, { "font-text": font.family })),
    rule(":root", Object.fromEntries(formatting)),
  ]
    .filter(Boolean)
    .join("\n\n");
  if (element.textContent !== css) element.textContent = css;
}

showFonts();
$effect.root(() => {
  $effect(showFonts);
});
