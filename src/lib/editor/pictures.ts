import { t } from "../i18n/index.svelte";
import english from "../i18n/locales/en/editor";
import type { Picture, PictureSource } from "../plugins/types";
import { ui } from "../ui.svelte";
import { SECTIONS, type SlashCommand } from "./slashCommands";

/*
 * Picture sources' "/" commands, which open the picture picker (components/PicturePicker.svelte)
 * where the command was typed.
 */

/** The "/" commands for `sources`, after /image in their order. */
export const pictureCommands = (sources: PictureSource[]): SlashCommand[] =>
  sources.map((source, i) => ({
    id: source.id,
    name: source.name,
    hint: "GIF",
    icon: source.icon,
    section: SECTIONS.insert,
    keywords: [t("editor.slash.pictures.keywords"), english["editor.slash.pictures.keywords"]].join(" "),
    after: i ? sources[i - 1].id : "image",
    apply(view, from, to) {
      view.dispatch({ changes: { from, to }, userEvent: "delete" });
      const at = view.coordsAtPos(from);
      if (at) ui.picturePicker = { source, view, pos: from, x: at.left, y: at.bottom + 6 };
    },
  }));

/**
 * `count` pictures from a source that gives one at random per request, asked for all at once, and a
 * few more for the repeats left out. Throws only when none came.
 */
export async function oneByOne(count: number, one: () => Promise<Picture>): Promise<Picture[]> {
  const results = await Promise.allSettled(Array.from({ length: count + 3 }, one));
  const pictures = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  if (!pictures.length) throw (results[0] as PromiseRejectedResult).reason;
  return [...new Map(pictures.map((picture) => [picture.url, picture])).values()].slice(0, count);
}
