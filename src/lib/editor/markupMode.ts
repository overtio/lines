import { Facet } from "@codemirror/state";
import type { MarkdownMode } from "../prefs.svelte";

/**
 * How a note shows its markup (Settings → Editor → Markdown), which what draws it asks: as written,
 * only colored ("source", nothing drawn); drawn with all of it in sight ("visible"); drawn, and
 * hidden but where the cursor is ("live"); or drawn and never seen ("hidden", Markdown notes:
 * hiddenMarkdown.ts; LaTeX notes show theirs as in "live").
 */
export const markupMode = Facet.define<MarkdownMode, MarkdownMode>({ combine: (values) => values[0] ?? "live" });
