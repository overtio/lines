import type Katex from "katex";
import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";

/*
 * KaTeX draws math in notes of any language: `$x^2$` and `$$` blocks in Markdown, `\[…\]` and
 * equations in LaTeX, on screen and on paper. It loads, with its fonts, the first time math shows.
 */

let engine: typeof Katex | undefined;
let loading: Promise<void> | undefined;

export const katex = (): Plugin => ({
  id: "katex",
  name: t("plugins.katex"),
  description: t("plugins.katex.description"),
  icon: "radical",
  enabledByDefault: true,
  contributes: {
    math: [
      {
        id: "katex",
        name: "KaTeX",
        load: () =>
          (loading ??= Promise.all([import("katex"), import("katex/dist/katex.min.css")]).then(([module]) => void (engine = module.default))),
        render(dom, tex, { display, macros }) {
          try {
            // A copy of the macros: KaTeX adds to it what the math itself defines (\gdef). Screen
            // readers read the MathML it writes alongside the drawing, which it hides from them.
            engine!.render(tex, dom, { displayMode: display, output: "htmlAndMathml", throwOnError: true, strict: "ignore", macros: { ...macros } });
          } catch (error) {
            throw new Error(error instanceof Error ? error.message.replace(/^KaTeX parse error: /, "") : String(error));
          }
        },
      },
    ],
  },
});
