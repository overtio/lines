import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/400-italic.css";
import "@fontsource/fira-sans/500.css";
import "@fontsource/fira-sans/600.css";
import "@fontsource/fira-sans/700.css";
import "@fontsource/fira-sans/700-italic.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/400-italic.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-sans/700-italic.css";
import "./agave.css";
import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";

/*
 * Fonts to write notes in (Settings → Typography → Font family), beside the system's: IBM Plex Sans, Fira
 * Sans and Agave, a monospaced one. They come with lines (SIL Open Font License), so they look the
 * same on every computer and offline, and each file loads only once text is shown in it.
 */
export const fonts = (): Plugin => ({
  id: "fonts",
  name: t("plugins.fonts"),
  description: t("plugins.fonts.description"),
  icon: "type",
  enabledByDefault: true,
  contributes: {
    fonts: [
      { id: "ibm-plex-sans", name: "IBM Plex Sans", family: '"IBM Plex Sans", var(--font-system)' },
      { id: "fira-sans", name: "Fira Sans", family: '"Fira Sans", var(--font-system)' },
      { id: "agave", name: "Agave", family: "Agave, var(--font-mono)" },
    ],
  },
});
