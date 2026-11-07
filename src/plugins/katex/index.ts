import type Katex from "katex";
// With the app's own styles: added once math first shows, a stylesheet restyles the whole page, a
// stall that shows while scrolling.
import "katex/dist/katex.min.css";
import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";

/*
 * KaTeX draws math in notes of any language: `$x^2$` and `$$` blocks in Markdown, `\[…\]` and
 * equations in LaTeX, on screen and on paper. It loads, with its fonts, once a note with math is
 * open (math.ts).
 */

let engine: typeof Katex | undefined;
let loading: Promise<void> | undefined;

/** The fonts most math is drawn with, loaded with KaTeX: fetched once math shows instead, they stall the frame that draws it. */
const FONTS = ["1em KaTeX_Main", "italic 1em KaTeX_Main", "bold 1em KaTeX_Main", "italic 1em KaTeX_Math", "1em KaTeX_AMS", "1em KaTeX_Size1", "1em KaTeX_Size2"];

async function load() {
  const [module] = await Promise.all([import("katex"), ...FONTS.map((font) => document.fonts.load(font))]);
  engine = module.default;
}

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
        load: () => (loading ??= load()),
        render(dom, tex, { display, macros }) {
          try {
            // A copy of the macros: KaTeX adds to it what the math itself defines (\gdef). Screen
            // readers read the MathML it writes alongside the drawing, which it hides from them.
            engine!.render(tex, dom, { displayMode: display, output: "htmlAndMathml", throwOnError: true, strict: "ignore", macros: { ...macros } });
          } catch (error) {
            throw new Error(error instanceof Error ? error.message.replace(/^KaTeX parse error: /, "") : String(error), { cause: error });
          }
        },
      },
    ],
  },
});
