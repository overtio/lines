import type { EditorView } from "@codemirror/view";
import type { Paper, PaperSource } from "../plugins/types";
import PaperPicker from "./PaperPicker.svelte";
import { named, SECTIONS, type SlashCommand } from "./slashCommands";
import { openPicker } from "./webSearch";

/*
 * Research papers, found by searching a source on the web (a plugin's `papers`: arXiv) and linked
 * to from a note. Each source is a "/paper" command in Markdown and LaTeX notes, which write the
 * link their own way.
 */

/** How a note's format writes a link to a paper: Markdown's [title](url), LaTeX's \href. */
export type PaperLink = (paper: Paper) => string;

/** A paper as a Markdown link, [Attention Is All You Need](https://arxiv.org/abs/1706.03762). */
export const markdownPaperLink: PaperLink = (paper) => `[${paper.title.replace(/[[\]]/g, "\\$&")}](${paper.url})`;

/** A "/paper" command for each source, which puts the paper chosen at the cursor as `link` writes it. */
export function paperCommands(sources: readonly PaperSource[], link: PaperLink): SlashCommand[] {
  const command = named("editor.slash.paper");
  return sources.map((source) => ({
    ...command,
    id: `paper-${source.id}`,
    hint: source.name,
    icon: "graduation-cap",
    section: SECTIONS.insert,
    keywords: `${command.keywords} ${source.name}`,
    after: "link",
    apply: (view, from, to) => openPicker(view, from, to, PaperPicker, { source, onchoose: (paper: Paper) => insert(view, link(paper)) }),
  }));
}

function insert(view: EditorView, text: string) {
  if (!view.dom.isConnected || view.state.readOnly) return;
  const { from, to } = view.state.selection.main;
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: true, userEvent: "input" });
}
