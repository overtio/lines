/**
 * LaTeX notes: their slash and backslash menus and what they draw.
 *
 * `….keywords` are more words that find a menu command, separated by spaces. English's are
 * searched in every language too (texCommands.ts), so a translation needs only its own words.
 * The words a LaTeX document draws for itself (Theorem, Proof, References) aren't here: they're
 * the document's language, not the app's.
 */
export default {
  // The "/" menu's commands.
  "latex.slash.section": "Section",
  "latex.slash.section.keywords": "heading h1 title",
  "latex.slash.subsection": "Subsection",
  "latex.slash.subsection.keywords": "heading h2",
  "latex.slash.subsubsection": "Subsubsection",
  "latex.slash.subsubsection.keywords": "heading h3",
  "latex.slash.bullets": "Bullet list",
  "latex.slash.bullets.keywords": "itemize unordered ul point",
  "latex.slash.numbers": "Numbered list",
  "latex.slash.numbers.keywords": "enumerate ordered ol number",
  "latex.slash.quote": "Quote",
  "latex.slash.quote.keywords": "blockquote quotation",
  "latex.slash.math": "Math",
  "latex.slash.math.keywords": "equation formula display latex",
  "latex.slash.equations": "Equations",
  "latex.slash.equations.keywords": "align aligned equation formula",
  "latex.slash.code": "Code block",
  "latex.slash.code.keywords": "verbatim snippet pre",
  "latex.slash.table": "Table",
  "latex.slash.table.keywords": "tabular grid columns rows",
  "latex.slash.image": "Image",
  "latex.slash.image.keywords": "picture photo screenshot upload figure",
  "latex.slash.file": "File",
  "latex.slash.file.keywords": "attach attachment upload document pdf",
  "latex.slash.folder": "Folder link",
  "latex.slash.folder.keywords": "folder directory finder path local computer link open",
  "latex.slash.footnote": "Footnote",
  "latex.slash.footnote.keywords": "note aside",
  "latex.slash.link": "Link",
  "latex.slash.link.keywords": "url web href",
  "latex.slash.date": "Date",
  // Shown faintly beside Date: it writes today's date.
  "latex.slash.date.hint": "today",
  "latex.slash.date.keywords": "today time now",

  // The "\" menu's sections.
  "latex.backslash.text": "Text",
  "latex.backslash.environments": "Environments",
  "latex.backslash.math": "Math",

  // The "\" menu: what each command is, shown beside it (`\textbf` Bold).
  "latex.tex.section": "Heading 1",
  "latex.tex.section.keywords": "title",
  "latex.tex.subsection": "Heading 2",
  "latex.tex.subsubsection": "Heading 3",
  // \paragraph: a bold heading at the start of a paragraph, its text running on after it.
  "latex.tex.paragraph": "Run-in heading",
  "latex.tex.textbf": "Bold",
  "latex.tex.textbf.keywords": "strong",
  "latex.tex.emph": "Emphasis",
  "latex.tex.textit": "Italic",
  "latex.tex.texttt": "Typewriter",
  "latex.tex.texttt.keywords": "code monospace",
  "latex.tex.underline": "Underline",
  "latex.tex.textsc": "Small caps",
  "latex.tex.footnote": "Footnote",
  "latex.tex.href": "Link",
  "latex.tex.href.keywords": "url",
  // Written selected in a new \href{url}{text}, to type over.
  "latex.tex.href.text": "text",
  "latex.tex.url": "Web address",
  "latex.tex.includegraphics": "Image",
  "latex.tex.includegraphics.keywords": "picture figure",
  "latex.tex.item": "List item",
  "latex.tex.label": "Label",
  "latex.tex.ref": "Reference",
  "latex.tex.cite": "Citation",
  "latex.tex.dots.keywords": "dots ellipsis",
  "latex.tex.LaTeX.keywords": "logo",
  "latex.tex.today": "Today’s date",
  "latex.tex.today.keywords": "date",
  "latex.tex.itemize": "Bullet list",
  "latex.tex.itemize.keywords": "bullets",
  "latex.tex.enumerate": "Numbered list",
  "latex.tex.enumerate.keywords": "numbers",
  // A description list: each item a term in bold, then what it means.
  "latex.tex.description": "Terms",
  // Written selected in a new description item, \item[term], to type over.
  "latex.tex.description.term": "term",
  "latex.tex.quote": "Quote",
  "latex.tex.center": "Centered",
  "latex.tex.verbatim": "Code block",
  "latex.tex.verbatim.keywords": "code",
  "latex.tex.tabular": "Table",
  "latex.tex.tabular.keywords": "table grid",
  "latex.tex.equation": "Equation",
  "latex.tex.align": "Equations, aligned",
  "latex.tex.formula.keywords": "math formula",
  // \[ \]: math on a line of its own, centered.
  "latex.tex.displayMath": "Displayed math",
  "latex.tex.displayMath.keywords": "math formula display",

  // The "\" menu inside math. Most show the symbol they make instead.
  "latex.tex.frac.keywords": "fraction divide",
  "latex.tex.sqrt.keywords": "root",
  "latex.tex.prod.keywords": "product",
  "latex.tex.int.keywords": "integral",
  "latex.tex.lim.keywords": "limit",
  "latex.tex.left.keywords": "brackets parentheses",
  "latex.tex.binom.keywords": "choose",
  "latex.tex.text": "Text",
  "latex.tex.mathbf": "Bold",
  "latex.tex.mathbb.keywords": "blackboard",
  "latex.tex.mathcal.keywords": "calligraphic",
  // \mathrm: letters standing straight, not slanted as math sets them.
  "latex.tex.mathrm": "Upright",
  "latex.tex.mathrm.keywords": "roman",
  "latex.tex.vec.keywords": "vector",
  "latex.tex.infty.keywords": "infinity",
  "latex.tex.cdot.keywords": "dot times",
  "latex.tex.pm.keywords": "plus minus",
  "latex.tex.leq.keywords": "less",
  "latex.tex.geq.keywords": "greater",
  "latex.tex.neq.keywords": "not equal",
  "latex.tex.to.keywords": "arrow",
  "latex.tex.Rightarrow.keywords": "implies arrow",
  "latex.tex.subseteq.keywords": "subset",
  "latex.tex.cup.keywords": "union",
  "latex.tex.cap.keywords": "intersection",
  "latex.tex.greek.keywords": "greek letter",
  "latex.tex.pmatrix": "Matrix",
  "latex.tex.pmatrix.keywords": "pmatrix matrix",
  // \begin{cases}: a function defined piece by piece.
  "latex.tex.cases": "Cases",
  "latex.tex.cases.keywords": "cases piecewise",

  // A whole document's preamble, folded into a chip.
  "latex.preamble": "Preamble · {count, plural, one {# line} other {# lines}}",
  // A math block with nothing in it yet.
  "latex.emptyMath": "Empty math",
  // For screen readers, in place of a footnote's small number.
  "latex.footnote": "Footnote {number}",
  // For screen readers, in place of a drawn \cite: the keys cited.
  "latex.citation": "Citation {keys}",
  // For screen readers, in place of a drawn \ref: the label referred to.
  "latex.reference": "Reference to {label}",
  // A drawn \includegraphics (LaTeX gives an image no description of its own).
  "latex.image": "Image",
  // A drawn tabular.
  "latex.table": "Table",
};
