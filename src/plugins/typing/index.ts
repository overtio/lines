import { mount, unmount } from "svelte";
import { showCode } from "../../lib/editor/util";
import { insert, named, SECTIONS } from "../../lib/editor/slashCommands";
import { t } from "../../lib/i18n/index.svelte";
import type { BlockEditor, EditableBlock, Plugin } from "../../lib/plugins/types";
import { el } from "../../lib/print/parts";
import { passageOf } from "./drill.svelte";
import Practice from "./Practice.svelte";

/*
 * Typing practice: a ```typing code block, its text a passage, drawn in a note as a drill to type
 * it over (Practice.svelte), timed, with the speed, the accuracy and the keys missed, and the best
 * speed it's been typed at. Any text can be one: a quote, a page of a book, code. Other Markdown
 * apps show the text, and so does paper.
 */

function editor(dom: HTMLElement, block: EditableBlock): BlockEditor {
  const practice = mount(Practice, { target: dom, props: { block } });
  return {
    update: () => practice.update(),
    focus: () => practice.focus(),
    destroy: () => void unmount(practice),
  };
}

/** A passage to start from, in the app's language: one of a few, so each new block isn't the same. */
const sample = () => t((["typing.sample1", "typing.sample2", "typing.sample3"] as const)[Math.floor(Math.random() * 3)]);

export const typing = (): Plugin => ({
  id: "typing",
  name: t("plugins.typing"),
  description: t("plugins.typing.description"),
  icon: "keyboard",
  enabledByDefault: true,
  contributes: {
    renderers: [
      {
        id: "typing",
        name: t("plugins.typing"),
        languages: ["typing"],
        label: t("typing.label"),
        // On paper, the passage as a quote.
        render: async (source) => el("blockquote", "doc-typing", passageOf(source)),
        editor,
        actions: [{ label: t("typing.editText"), icon: "pencil", run: showCode }],
      },
    ],
    markdown: [
      {
        commands: [
          {
            ...named("editor.slash.typing"),
            after: "timing",
            hint: "typing",
            icon: "keyboard",
            section: SECTIONS.insert,
            // The cursor below it, so it shows as a drill to go up into.
            apply: insert(() => `\`\`\`typing\n${sample()}\n\`\`\`\n|`, true),
          },
        ],
      },
    ],
  },
});
