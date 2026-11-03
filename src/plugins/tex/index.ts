import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";
import { texAvailable, typesetTex } from "./typeset";

/*
 * TeX typesetting: a LaTeX note's PDF made by pdfLaTeX itself (typeset.ts), as an alternative to
 * lines' own pages in its PDF preview.
 */

export const tex = (): Plugin => ({
  id: "tex",
  name: t("plugins.tex"),
  description: t("plugins.tex.description"),
  icon: "printer",
  enabledByDefault: true,
  requires: ["latex"],
  contributes: {
    typesetters: [
      {
        id: "tex",
        name: "TeX",
        languages: ["latex"],
        download: t("print.texDownloadSize"),
        available: texAvailable,
        typeset: typesetTex,
      },
    ],
  },
});
