/**
 * A page break in Markdown, as lines writes it: a comment on a line of its own, which other apps
 * show as nothing, and which ends on its line (an HTML block, such as a `<div>`, would take the
 * lines after it up to a blank one).
 */
export const PAGE_BREAK = "<!-- pagebreak -->";

/** That, or the empty `<div>` Obsidian's, Typora's and VS Code's PDF exports break pages at. */
const WRITTEN = [
  /^\s*<!--\s*page-?break\s*-->\s*$/i,
  /^\s*<div\s+style\s*=\s*(["'])\s*(?:page-)?break-(?:after|before)\s*:\s*(?:always|page)\s*;?\s*\1\s*>\s*<\/div>\s*$/i,
];

/** Whether a line of Markdown is a page break. */
export const isPageBreak = (line: string) => WRITTEN.some((pattern) => pattern.test(line));

/** LaTeX's, on a line of their own. */
export const LATEX_PAGE_BREAK = /^\s*\\(?:newpage|clearpage|cleardoublepage|pagebreak)\s*$/;
