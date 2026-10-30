# LaTeX notes

A note can be written in LaTeX instead of Markdown. Switch it in the note's info panel (the ⓘ button in its toolbar): **Markdown** or **LaTeX**. The note's text stays as it is; lines reads it the other way.

A LaTeX note is drawn the way a Markdown note is: the text is plain LaTeX, and commands are hidden unless the cursor is on them. `\section{Plan}` reads as a heading, `\textbf{Friday}` as bold, an `itemize` as a list, math as math. What lines doesn't draw stays as written, faint.

A note usually holds the body of a document: what goes between `\begin{document}` and `\end{document}`. Exporting or downloading it wraps it in a document that compiles with `pdflatex` (see [Export](#export)). A whole document works too, preamble and all: see [Whole documents](#whole-documents).

```latex
Trip to Rome
% #travel

\section{Plan}
We fly on \textbf{Friday} and come back \emph{Monday}.

\begin{itemize}
  \item Passport
  \item Charger
\end{itemize}

\[ \int_0^1 x^2\,dx = \frac{1}{3} \]
```

The editor's reading of LaTeX is in `src/lib/editor/latexSyntax.ts`, and what it draws in `src/lib/editor/latex.ts`. The note list's title, excerpt and counts come from `src/lib/notes/latex.ts`.

## What's drawn

| LaTeX | Drawn as |
|---|---|
| `\section{…}`, `\subsection{…}`, `\subsubsection{…}` (and `*`) at the start of a line | Headings 1–3 |
| `\textbf`, `\textit`, `\emph`, `\textsl`, `\texttt`, `\underline`, `\textsc`, `\sout`, `\paragraph` | Bold, italic, code, underlined, small capitals, struck, bold |
| `itemize`, `enumerate`, `description`, nested | Lists with bullets, numbers, or terms in bold. Nested `enumerate`s count as LaTeX does: 1., (a), i., A. `\item[–]` uses its own marker. |
| `theorem`, `lemma`, `proposition`, `corollary`, `definition`, `remark`, `example`, `claim`, `conjecture`, and those made with `\newtheorem` | A bold label (**Theorem 2 (Euler).**) and a line down the side. Numbered in order, sharing a counter as `\newtheorem{lemma}[theorem]{Lemma}` says; starred ones aren't numbered. |
| `proof` | *Proof.* (or `\begin{proof}[Solution]`'s own label), a line down the side, and ∎ at the end |
| `\cite{a, b}`, `\citep`, `\citet`, `\parencite`… | A small `[a, b]` |
| `\ref{…}`, `\eqref{…}`, `\autoref`, `\cref`… | A small chip with the label's name (`sec:intro`, `(eq:basel)`) |
| `thebibliography` with `\bibitem{key}` | A References heading, each entry after its `[key]` |
| `\verb\|code\|` | Code |
| `\caption{…}` | Smaller, muted text |
| `$…$`, `\(…\)` | Math within text |
| `$$…$$`, `\[…\]`, `equation`, `align`, `gather`, `alignat`, `multline`, `flalign`, `eqnarray`, `displaymath` (and `*`) | Displayed math, centered; a block when it's on lines of its own |
| `tabular` on lines of its own | A table, with each column aligned as its spec says (`l`, `c`, `r`). A first row with a rule under it is the header. Math in cells is drawn. |
| `quote`, `quotation`, `abstract`, `verse` | A quote |
| `center`, `flushright` | Centered or right-aligned lines |
| `verbatim`, `lstlisting`, `minted` | A code block |
| `\href{url}{text}`, `\url{…}` | Links (⌘-click to open) |
| `\footnote{…}` | A small number, then the footnote's text, smaller |
| `\includegraphics{…}` | The image, if it's an attachment (`../attachments/…`) or on the web |
| `\%`, `\&`, `\$`, `\#`, `\_`, `\{`, `\}`, `~`, `--`, `---`, ` `` `, `''`, `\ldots`, `\LaTeX` | The characters they stand for |
| Accents and letters: `\"o`, `\'{e}`, `` \`a ``, `\^o`, `\~n`, `\c{c}`, `\v{s}`, `\L`, `\o`, `\ss`, `\ae`… | ö, é, à, ô, ñ, ç, š, Ł, ø, ß, æ |
| `\label{…}` | Hidden (LaTeX prints nothing for it); on a line of its own, the line shrinks away |
| `\\` | Hidden (a line break) |
| `% comment` | Faint and italic |
| Any other command, like `\vspace{…}` or `\noindent` | As written, faint |

- With the cursor on a construct, its LaTeX shows. Clicking drawn math or a table shows its LaTeX, with displayed math redrawn below as you type.
- `\begin{…}` and `\end{…}` on lines of their own shrink to a small gap until the cursor is on them.
- Numbered environments (`equation`, `align`…) are drawn without numbers, and `\label` is left out of the math. References show the label's name, not a number.
- `\multicolumn{2}{c}{…}` in a `tabular` spans its columns; `\multirow` shows its text; booktabs rules (`\toprule`…) and `\hline` are left out.
- Math can use the note's own commands: `\newcommand{\R}{\mathbb{R}}`, `\newcommand{\abs}[1]{\lvert #1 \rvert}`, `\renewcommand`, `\def\x{…}` and `\DeclareMathOperator{\sinc}{sinc}`, anywhere in the note, preamble included.
- Each line of the LaTeX is a line on screen: a paragraph hard-wrapped in the source shows wrapped there too. LaTeX joins them; lines doesn't.
- Something that isn't closed (`\textbf{` with no `}`, an environment with no `\end`) is left as written rather than drawn, so a note never breaks while you type. A verbatim block that isn't closed runs to the end of the note.

## Writing

- Enter after an `\item` starts the next item; Enter on an empty item ends the list.
- Enter after a `\begin{…}` (or `\[`) that isn't closed yet adds the `\end{…}` (or `\]`), with the cursor between. A list starts with an `\item`.
- ⌘B, ⌘I and ⌘E put the selection in `\textbf{…}`, `\emph{…}` and `\texttt{…}`, or take it out.
- Pasting and dropping work as in Markdown notes, written as LaTeX:
  - Rows copied from a spreadsheet, pgAdmin or a web page become a `tabular`, lined up in the LaTeX, with the first row over a `\hline` and number columns right-aligned. Special characters in cells are escaped (`well_id` → `well\_id`). Undo once for the text as copied.
  - An image becomes `\includegraphics[width=\linewidth]{../attachments/…}`; any other file `\href{../attachments/…}{Name.pdf}`. `/image` and `/file` choose them from the device.
  - The link to an Unsplash photo, pasted on an empty line, becomes `\includegraphics{…}` showing the photo.
  - A web address pasted over selected text links it: `\href{https://…}{text}`.
  - In verbatim, math, a table or a comment, a paste stays as it is.
- `/` at the start of a line opens LaTeX commands: sections, lists, quote, math, equations, code, table, image, file, footnote, link and today's date.
- `\` opens a menu of commands, filtered as you type (`\te` → `\textbf`, `\textit`, `\texttt`…): styles, sections, links, footnotes and environments (`\begin{itemize}`…). Inside math it offers math instead: `\frac`, `\sqrt`, `\sum`, `\int`, arrows, relations, `\mathbb`, Greek letters and matrices, each with the symbol it makes. Picking one writes it with its braces; Tab moves to the next pair of braces, then past the command. Tab in the menu completes like a shell, as in the `/` menu. `\\` (a line break) doesn't open it.

## Whole documents

A note that has a `\begin{document}` line is a whole document, as you'd download it from arXiv or Overleaf (with its `\input` files pasted in):

- Its preamble, everything up to `\begin{document}`, folds into its title and authors (from `\title{…}` and `\author{…}`, names only) and a *Preamble · 24 lines* chip. Clicking it, or moving the cursor into it, shows its LaTeX.
- `\maketitle` is hidden, since the folded preamble shows the title; `\end{document}` shrinks away like any environment's end.
- The note list's title is the `\title`, and its excerpt and counts leave the preamble out.
- Export writes it as it is, without wrapping it again.

## Title and tags

- The title is the first line with text, as it reads: `\section{Trip to Rome}` is "Trip to Rome". It can be a plain line of text too. A whole document's title is its `\title`.
- `#` isn't allowed in LaTeX text, so tags go in comments, where LaTeX ignores them: `% #travel`. A new note made under a tag starts with its tag that way when it's switched to LaTeX.
- LaTeX notes have no todos, so they don't show in the Todo view.

## Export

Download (in the note's share menu, on the web) and Export (Settings → Sync & Data) write a LaTeX note as a `.tex` file that compiles on its own:

```latex
\documentclass{article}
\usepackage{amsmath}
\usepackage{amssymb}
\usepackage{graphicx}
\usepackage{hyperref}

\begin{document}

…the note…

\end{document}
```

`listings` is added when the note uses `lstlisting`, and `amsthm`, with a `\newtheorem` for each, when it uses `theorem`, `lemma`, `definition` and the like without defining them. A note that has a `\documentclass` of its own is written as it is. In an export, attachment paths point at the export's `attachments` folder.

## PDF

⌘P (or Share → Preview as PDF) shows a LaTeX note on pages, in either of two ways, chosen with **Typeset with** at the top:

- **lines** lays it out itself, as LaTeX lays out an article: lines join into paragraphs and a blank line starts the next; text is set in Computer Modern and justified. A whole document's `\maketitle` prints its title, authors and date. Sections, theorems (on their own counters, or shared as `\newtheorem` says), `equation`s, and figures' and tables' captions are numbered, and `\ref`, `\eqref` and `\autoref` show those numbers. Footnotes are gathered at the end. Commands it doesn't know print their last argument's text (`\textcolor{red}{word}` prints "word"), or nothing (`\vspace`, `\noindent`). Print… prints the pages, or saves them as a PDF from the print dialog. The code is in `src/lib/print/latex.ts`.
- **TeX** typesets it with pdfLaTeX, compiled to WebAssembly (BusyTeX), from the same document Export writes (with Latin Modern as its font). It runs LaTeX until references settle, and BibTeX when the note has a `\bibliography`. It has TeX Live's basic packages, `amsmath`, `amsthm`, `graphicx`, `hyperref` and `listings` among them; `booktabs` stands in with plain rules. The first time, it downloads TeX (about 125 MB); the browser keeps it. If TeX stops at an error, the preview says where, with TeX's log. Save PDF saves the PDF. The code is in `src/lib/print/tex.ts`.

## On disk

In a synced folder or bucket, a LaTeX note is a file like any other note's (`notes/<id>.md`, see [sync.md](sync.md)), with `format: latex` in its front matter and its LaTeX after it. The file keeps its name so that sync doesn't have to rename files when a note's format changes; Export writes `.tex` files.

## Examples

Settings → Sync & Data → **Add LaTeX Examples** adds three notes written in LaTeX, tagged `examples` (in `src/lib/notes/examples/`): a short paper (a whole document with a preamble, its own math commands, theorems, a table and a bibliography), lecture notes, and a problem set.
