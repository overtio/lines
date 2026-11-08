import { insert, named, SECTIONS } from "../../lib/editor/slashCommands";
import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";

/*
 * WaveDrom: a ```wavedrom code block, written in WaveJSON, drawn as a timing diagram, a register's
 * bit fields or a logic circuit (draw.ts), in the theme's colors on screen and WaveDrom's own on
 * paper. WaveDrom loads the first time a note has one.
 */

let loading: Promise<typeof import("./draw")> | undefined;

export const wavedrom = (): Plugin => ({
  id: "wavedrom",
  name: t("plugins.wavedrom"),
  description: t("plugins.wavedrom.description"),
  icon: "activity",
  enabledByDefault: true,
  contributes: {
    renderers: [
      {
        id: "wavedrom",
        name: "WaveDrom",
        languages: ["wavedrom"],
        label: t("editor.diagram"),
        render: async (source, { paper }) => (await (loading ??= import("./draw"))).draw(source, paper),
      },
    ],
    markdown: [
      {
        commands: [
          {
            ...named("editor.slash.timing"),
            after: "diagram",
            hint: "wavedrom",
            icon: "activity",
            section: SECTIONS.insert,
            apply: insert(
              '```wavedrom\n{ signal: [\n  { name: "clk", wave: "p......" },\n  { name: "data", wave: "x.34.5x", data: ["A", "B", "C"] },\n  { name: "ready", wave: "0.1..0." }|\n] }\n```',
              true,
            ),
          },
        ],
      },
    ],
  },
});
