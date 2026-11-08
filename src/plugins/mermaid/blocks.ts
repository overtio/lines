import { drawingFromDiagram } from "../../lib/editor/drawings";
import { insert, named, SECTIONS } from "../../lib/editor/slashCommands";
import { t } from "../../lib/i18n/index.svelte";
import type { Contributions, Renderer } from "../../lib/plugins/types";

/*
 * What a plugin that draws ```mermaid blocks adds, whichever engine draws them (Pele, or Mermaid
 * itself): the blocks drawn as diagrams, their button that copies one into a drawing, and /diagram.
 */

export const mermaidBlocks = (renderer: Pick<Renderer, "id" | "name" | "render">): Contributions => ({
  renderers: [
    {
      ...renderer,
      languages: ["mermaid"],
      label: t("editor.diagram"),
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
});

/** A diagram's error, where it is, without the list of every token that would have done there. */
export const diagramError = (error: unknown) =>
  new Error((error instanceof Error ? error.message : String(error)).replace(/\nExpecting [^]*$/, ""), { cause: error });
