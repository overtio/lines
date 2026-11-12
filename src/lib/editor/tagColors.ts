import type { Looks } from "../notes/looks";
import { paletteVar } from "../palette";

/*
 * Tags in a note in the colors chosen for them in the sidebar, as it shows them: the icon in the
 * color, on a tint of it, the name in the text's color (readable as the note's text is). A rule a
 * tag, matched by its name (`data-tag`, livePreview.ts and tables.ts) and the names of the tags
 * nested in it, which have its color until they're given their own: deeper tags' rules come later,
 * so theirs win. One stylesheet for every note in the window, so a color chosen shows at once.
 */

/** The stylesheet for `looks`' tag colors. */
export function tagColorCss(looks: Looks): string {
  const colored = Object.entries(looks.tags)
    .filter(([, look]) => look.color)
    .sort(([a], [b]) => a.split("/").length - b.split("/").length);
  if (!colored.length) return "";
  const tags = colored.map(([tag]) => `[data-tag=${JSON.stringify(tag)}],[data-tag^=${JSON.stringify(`${tag}/`)}]`);
  return [
    `.cm-lp-tag:is(${tags.join(",")}){color:var(--text);background:color-mix(in srgb,var(--tag-look) var(--tag-tint),transparent)}`,
    `.cm-lp-tag:is(${tags.join(",")}) .cm-lp-tag-icon{color:var(--tag-look);opacity:1}`,
    ...colored.map(([, look], i) => `.cm-lp-tag:is(${tags[i]}){--tag-look:${paletteVar(look.color!)}}`),
  ].join("\n");
}

/** The window's stylesheet of tag colors, put in its head the first time. */
export function tagColorSheet(): HTMLStyleElement {
  let sheet = document.querySelector<HTMLStyleElement>("style[data-tag-colors]");
  if (!sheet) {
    sheet = document.createElement("style");
    sheet.dataset.tagColors = "";
    document.head.append(sheet);
  }
  return sheet;
}
