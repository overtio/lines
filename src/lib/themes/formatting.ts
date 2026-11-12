/*
 * The formatting in a note a theme can give a color of its own, in Markdown and LaTeX notes alike:
 * each by its custom property (app.css), and the class editor.css draws it with. Unset, each is in
 * the color of the text around it, but for those app.css gives one (a link's is the accent).
 */
export const FORMATTING: readonly (readonly [key: string, selector: string])[] = [
  ...[1, 2, 3, 4, 5, 6].map((level) => [`text-h${level}`, `.cm-lp-h${level}`] as const),
  ["text-bold", ".cm-lp-strong"],
  ["text-italic", ".cm-lp-em"],
  ["text-strike", ".cm-lp-strike"],
  ["text-underline", ".cm-lp-underline"],
  ["text-highlight", ".cm-lp-highlight"],
  ["text-code", ".cm-lp-code"],
  ["text-link", ".cm-lp-link"],
  ["text-mention", ".cm-lp-mention"],
  ["text-quote", ".cm-lp-quote"],
  ["text-bullet", ".cm-lp-bullet"],
  ["text-number", ".cm-lp-list-number"],
];

export const FORMATTING_COLORS = FORMATTING.map(([key]) => key);
