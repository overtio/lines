import type { Mermaid } from "mermaid";
import { drawingFromDiagram } from "../../lib/editor/drawings";
import { lookKey } from "../../lib/editor/rendered";
import { insert, named, SECTIONS } from "../../lib/editor/slashCommands";
import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";

/*
 * Mermaid diagrams: a ```mermaid code block drawn as its diagram, in the theme's colors on screen
 * and in black and white on paper. Mermaid is large, so it loads the first time a note has one.
 * A diagram's button opens a copy of it in Excalidraw, to draw on by hand.
 */

let loading: Promise<Mermaid> | undefined;
/** Loads Mermaid, once. */
const loadMermaid = () => (loading ??= import("mermaid").then((module) => module.default));

/* The theme's colors, as the solid hex colors Mermaid needs. */

let probe: HTMLElement | undefined;
let canvas: CanvasRenderingContext2D | undefined;

/** `css` (any color, `var()` and `color-mix()` included) drawn over the note's background. */
function solid(css: string) {
  if (!probe || !canvas) {
    probe = document.createElement("span");
    probe.hidden = true;
    document.body.append(probe);
    const element = document.createElement("canvas");
    element.width = element.height = 1;
    canvas = element.getContext("2d", { willReadFrequently: true })!;
  }
  const computed = (value: string) => {
    probe!.style.color = value;
    return getComputedStyle(probe!).color;
  };
  canvas.fillStyle = computed("var(--bg)");
  canvas.fillRect(0, 0, 1, 1);
  canvas.fillStyle = computed(css);
  canvas.fillRect(0, 0, 1, 1);
  const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Reading the colors forces style recalculations, so it's done once per look. */
let screen: { look: string; config: ReturnType<typeof readTheme> } | undefined;

function screenTheme() {
  const look = lookKey();
  if (screen?.look !== look) screen = { look, config: readTheme() };
  return screen.config;
}

function readTheme() {
  solid("var(--bg)");
  probe!.style.fontFamily = "var(--font-text)";
  const fontFamily = getComputedStyle(probe!).fontFamily;
  const mix = (color: string, amount: number) => solid(`color-mix(in srgb, ${color} ${amount}%, var(--bg))`);
  const text = solid("var(--text)");
  const background = solid("var(--bg)");
  return {
    fontFamily,
    look: "classic" as const,
    themeVariables: {
      darkMode: document.documentElement.dataset.scheme === "dark",
      fontFamily,
      fontSize: "15px",
      background,
      edgeLabelBackground: background,
      labelBackgroundColor: background,
      // Flat, like the rest of the note.
      dropShadow: "none",
      primaryColor: mix("var(--accent)", 14),
      primaryBorderColor: mix("var(--accent)", 60),
      primaryTextColor: text,
      secondaryColor: mix("var(--ink)", 8),
      tertiaryColor: mix("var(--ink)", 4),
      lineColor: solid("var(--text-muted)"),
      textColor: text,
      noteBkgColor: mix("var(--highlight-base)", 22),
      noteBorderColor: mix("var(--highlight-base)", 60),
      noteTextColor: text,
    },
  };
}

/** On paper: black lines and text, light fills. */
const PAPER = {
  look: "classic" as const,
  themeVariables: {
    darkMode: false,
    fontSize: "14px",
    background: "#ffffff",
    edgeLabelBackground: "#ffffff",
    labelBackgroundColor: "#ffffff",
    dropShadow: "none",
    primaryColor: "#eef1f6",
    primaryBorderColor: "#7d8796",
    primaryTextColor: "#1a1a1a",
    secondaryColor: "#f3f3f3",
    tertiaryColor: "#f8f8f8",
    lineColor: "#555555",
    textColor: "#1a1a1a",
    noteBkgColor: "#fff5c4",
    noteBorderColor: "#d8c25a",
    noteTextColor: "#1a1a1a",
    // Pie slices, apart from each other in print and in grey.
    pie1: "#9dbbe6",
    pie2: "#f0c48a",
    pie3: "#a8d5ac",
    pie4: "#e3a3a8",
    pie5: "#c5b3e3",
    pie6: "#96d0cf",
    pie7: "#e8d58f",
    pie8: "#c9c9c9",
    pieStrokeColor: "#ffffff",
    pieOuterStrokeColor: "#ffffff",
  },
};

let ids = 0;

async function render(source: string, { paper }: { paper: boolean }) {
  const id = `lines-mermaid-${++ids}`;
  const mermaid = await loadMermaid();
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", suppressErrorRendering: true, theme: "base", ...(paper ? PAPER : screenTheme()) });
  try {
    return (await mermaid.render(id, source)).svg;
  } catch (error) {
    // What Mermaid leaves in the page when it fails.
    document.getElementById(id)?.remove();
    document.getElementById(`d${id}`)?.remove();
    const text = error instanceof Error ? error.message : String(error);
    // Where the error is, without Mermaid's list of every token it would have accepted.
    throw new Error(text.replace(/\nExpecting [^]*$/, ""));
  }
}

export const mermaid = (): Plugin => ({
  id: "mermaid",
  name: t("plugins.mermaid"),
  description: t("plugins.mermaid.description"),
  icon: "workflow",
  enabledByDefault: true,
  contributes: {
    renderers: [
      {
        id: "mermaid",
        name: "Mermaid",
        languages: ["mermaid"],
        label: t("editor.diagram"),
        render,
        actions: [{ label: t("editor.drawing.fromDiagram"), icon: "shapes", run: drawingFromDiagram }],
      },
    ],
    markdown: [
      {
        commands: [
          {
            ...named("editor.slash.diagram"),
            after: "codeBlock",
            hint: "mermaid",
            icon: "workflow",
            section: SECTIONS.insert,
            apply: insert("```mermaid\nflowchart LR\n  A[Idea] --> B[Note]|\n```", true),
          },
        ],
      },
    ],
  },
});
