import type { MathResolver } from "pele";
import { lookKey } from "../../lib/editor/rendered";
import { t } from "../../lib/i18n/index.svelte";
import { plugins } from "../../lib/plugins/registry.svelte";
import type { Plugin } from "../../lib/plugins/types";
import { diagramError, mermaidBlocks } from "../mermaid/blocks";

/*
 * Mermaid diagrams drawn by Pele (pele.run), small and fast: a ```mermaid code block drawn as its
 * diagram, with its own layout. Its colors are CSS variables, set to the theme's on screen, so they
 * follow it, and to black and white on paper. Pele loads the first time a note has a diagram, and
 * each kind of diagram the first time one shows.
 */

let loading: Promise<typeof import("pele/lazy")> | undefined;
const loadPele = () => (loading ??= import("pele/lazy"));

/** On screen, the theme's colors, as Mermaid's are (plugins/mermaid). */
const SCREEN = {
  "--pele-bg": "var(--bg)",
  "--pele-fg": "var(--text)",
  "--pele-muted": "var(--text-muted)",
  "--pele-line": "var(--text-muted)",
  "--pele-surface": "color-mix(in srgb, var(--accent) 14%, var(--bg))",
  "--pele-surface-alt": "color-mix(in srgb, var(--ink) 5%, var(--bg))",
  "--pele-border": "color-mix(in srgb, var(--accent) 60%, var(--bg))",
  "--pele-accent": "var(--accent)",
  "--pele-critical": "var(--danger)",
};

/** On paper: black lines and text, light fills. */
const PAPER = {
  "--pele-bg": "#ffffff",
  "--pele-fg": "#1a1a1a",
  "--pele-muted": "#555555",
  "--pele-line": "#555555",
  "--pele-surface": "#eef1f6",
  "--pele-surface-alt": "#f6f6f6",
  "--pele-border": "#7d8796",
};

/** Sets Pele's colors on the diagram itself, so it's drawn the same wherever it goes. */
const colored = (svg: string, colors: Record<string, string>) =>
  svg.replace(/^<svg\b[^>]*? style="/, (start) => start + Object.entries(colors).map(([name, value]) => `${name}:${value};`).join(""));

/** The fonts labels are measured in, as the note's text is drawn: read once per look. */
let fonts: { look: string; text: string; mono: string } | undefined;

function readFonts() {
  const look = lookKey();
  if (fonts?.look !== look) {
    const style = getComputedStyle(document.documentElement);
    fonts = { look, text: style.getPropertyValue("--font-text").trim(), mono: style.getPropertyValue("--font-mono").trim() };
  }
  return fonts;
}

/** Math in labels (`$$x^2$$`), drawn by the math engine that's on, measured for Pele to place. */
async function mathResolver(): Promise<MathResolver | undefined> {
  const engine = plugins.math;
  if (!engine) return undefined;
  await engine.load();
  return (tex, size) => {
    const dom = document.createElement("span");
    dom.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:${size}px`;
    document.body.append(dom);
    try {
      engine.render(dom, tex, { display: false, macros: {} });
      const { width, height } = dom.getBoundingClientRect();
      return { html: dom.innerHTML, width, height };
    } catch {
      // Shown as written.
      return null;
    } finally {
      dom.remove();
    }
  };
}

let ids = 0;

async function render(source: string, { paper }: { paper: boolean }) {
  const [pele, math] = await Promise.all([loadPele(), source.includes("$$") ? mathResolver() : undefined]);
  const { text, mono } = readFonts();
  try {
    const { svg } = await pele.renderAsync(source, {
      fontFamily: text,
      fontFamilyMono: mono,
      fontSize: paper ? 14 : 15,
      idPrefix: `lines-pele-${++ids}-`,
      // As written: a diagram that goes across stays across in a narrow note.
      autoDirection: false,
      // Followed, a link would open in lines' own window, in its place.
      links: false,
      math,
    });
    return colored(svg, paper ? PAPER : SCREEN);
  } catch (error) {
    throw diagramError(error);
  }
}

export const pele = (): Plugin => ({
  id: "pele",
  name: t("plugins.pele"),
  description: t("plugins.pele.description"),
  icon: "workflow",
  enabledByDefault: true,
  alternatives: ["mermaid"],
  contributes: mermaidBlocks({ id: "pele", name: "Pele", render }),
});
