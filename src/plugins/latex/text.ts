import { extractTags } from "../../lib/notes/parse";
import { scanLatex } from "./syntax";

/*
 * Notes written in LaTeX (docs/latex.md): their text as it reads, for the note list, search and
 * counts, its tags, and the whole document an export writes.
 */

/** Commands whose argument is text that reads as part of the note. */
const TEXT_COMMAND = /\\(?:textbf|textit|textsl|textsc|textsf|textrm|textup|texttt|emph|underline|(?:sub){0,2}section|(?:sub)?paragraph|caption|footnote|mbox|text)\*?\{([^{}]*)\}/g;
const HEADING = /^\s*\\(?:sub){0,2}section\*?\{/;
/** Math, kept as written: $…$, $$…$$, \(…\) and \[…\] within a line. */
const MATH = /(?<!\\)\$\$(?:\\.|[^$\\])+\$\$|(?<!\\)\$(?:\\.|[^$\\])+\$|\\\((?:[^\\]|\\(?!\)))*\\\)|\\\[(?:[^\\]|\\(?!\]))*\\\]/g;
/** `\%` and the like, kept apart while commands and braces are taken out. */
const ESCAPES = "%&$#_{}";
const kept = (char: string) => String.fromCharCode(0xe000 + ESCAPES.indexOf(char));
const SYMBOLS: Record<string, string> = {
  ldots: "…", dots: "…", LaTeX: "LaTeX", TeX: "TeX", textbackslash: "\\", S: "§", P: "¶", copyright: "©", textregistered: "®",
  texttrademark: "™", textendash: "–", textemdash: "—", textasciitilde: "~", textasciicircum: "^", L: "Ł", l: "ł", o: "ø", O: "Ø", ss: "ß", ae: "æ", AE: "Æ", oe: "œ", OE: "Œ", aa: "å", AA: "Å", i: "ı",
};
const ACCENTS: Record<string, string> = { "'": "\u0301", "`": "\u0300", "^": "\u0302", '"': "\u0308", "~": "\u0303", "=": "\u0304", ".": "\u0307", c: "\u0327", v: "\u030c", u: "\u0306" };

/** Text outside math as it reads: commands taken out, their text kept. */
export function latexText(text: string) {
  let out = text
    .replace(/\\verb\*?([^\sA-Za-z*])(.*?)\1/g, "$2")
    .replace(/\\bibitem(?:\[[^\]]*\])?\{([^{}]*)\}/g, "[$1]")
    .replace(/\\href\{[^{}]*\}\{([^{}]*)\}/g, "$1")
    .replace(/\\url\{([^{}]*)\}/g, "$1")
    .replace(/\\item\s*\[([^\]]*)\]/g, "$1")
    .replace(/\\(?:begin|end)\{[^{}]*\}(?:\[[^\]]*\]|\{[^{}]*\})*/g, "");
  // Inside out, for styles inside styles.
  for (let before = ""; before !== out; ) {
    before = out;
    out = out.replace(TEXT_COMMAND, "$1").replace(/\\multi(?:column|row)\{[^{}]*\}\{[^{}]*\}\{([^{}]*)\}/g, "$1");
  }
  return out
    // Accented letters: \"o, \'{e}, \c{c}.
    .replace(/\\(['`^"~=.]|[cvu](?=[{ ]))\s?\{?([A-Za-z])\}?/g, (_, accent: string, letter: string) => (letter + ACCENTS[accent]).normalize("NFC"))
    .replace(/\\\\(?:\[[^\]]*\])?/g, "")
    // A table's cells, apart.
    .replace(/(?<!\\)&/g, "\t")
    .replace(/\\([%&$#_{}])/g, (_, char: string) => kept(char))
    .replace(/\\([A-Za-z]+)(?![A-Za-z]) ?/g, (all, name: string) => SYMBOLS[name] ?? all)
    // Every other command, with its arguments.
    .replace(/\\[A-Za-z]+\*?(?:\[[^\]]*\]|\{[^{}]*\})*\s?/g, "")
    .replace(/[{}]/g, "")
    .replace(/[\ue000-\ue006]/g, (char) => ESCAPES[char.charCodeAt(0) - 0xe000])
    .replace(/~/g, " ")
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/``/g, "“")
    .replace(/''/g, "”");
}

/** A line's comment, from the first `%` that isn't `\%`. */
function withoutComment(line: string) {
  const at = /(?<!\\)%/.exec(line);
  return at ? line.slice(0, at.index) : line;
}

/** A line of a LaTeX note as it reads, and whether it's a heading. A line that's all markup is empty. */
export function latexLine(line: string): { text: string; heading: boolean } {
  const code = withoutComment(line);
  let text = "";
  let last = 0;
  for (const math of code.matchAll(MATH)) {
    text += latexText(code.slice(last, math.index)) + math[0];
    last = math.index + math[0].length;
  }
  text += latexText(code.slice(last));
  return { text: text.trimEnd(), heading: HEADING.test(code) };
}

/** Each line of a LaTeX note as it reads (`latexLine`). */
export const latexLines = (body: string) => body.split("\n").map(latexLine);

/** The `begin{document}` line of a whole document, which ends its preamble. */
export const DOCUMENT_BEGIN = /^[^%\n]*\\begin\{document\}.*$/m;
/** A command's argument, with braces inside it (two deep). */
const ARGUMENT = "\\s*(?:\\[[^\\]]*\\])?\\{((?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*)\\}";

/** A preamble's `\title{…}`, or the names in its `\author{…}` (each author's first line, without affiliations), as they read. */
export function preambleField(preamble: string, field: "title" | "author"): string | null {
  const match = new RegExp(`\\\\${field}${ARGUMENT}`).exec(preamble);
  if (!match) return null;
  const tidy = (text: string) => latexText(text).replace(/\s+/g, " ").trim();
  if (field === "title") return tidy(match[1].replace(/\\\\/g, " "));
  const names = match[1].split(/\\and\b/i).map((author) => tidy(author.split("\\\\")[0]));
  return names.filter(Boolean).join(" · ") || null;
}

/** A whole document with what its `\title{…}` says changed by `mark`; null for a note without one. */
export function markTitle(body: string, mark: (title: string) => string): string | null {
  const begin = DOCUMENT_BEGIN.exec(body);
  const match = begin && new RegExp(`\\\\title${ARGUMENT}`).exec(body.slice(0, begin.index));
  if (!match) return null;
  const end = match.index + match[0].length - 1;
  return body.slice(0, end - match[1].length) + mark(match[1]) + body.slice(end);
}

/**
 * What a LaTeX note says: for a whole document, what's between \begin{document} and
 * \end{document}, and its \title; otherwise the whole note, with no title of its own.
 */
export function latexContent(body: string): { text: string; title: string | null } {
  const begin = DOCUMENT_BEGIN.exec(body);
  if (!begin) return { text: body, title: null };
  const text = body.slice(begin.index + begin[0].length).replace(/\\end\{document\}[^]*$/, "");
  return { text, title: preambleField(body.slice(0, begin.index), "title") };
}

/** A LaTeX note as plain text. */
export function latexPlainText(body: string): string {
  const { text, title } = latexContent(body);
  return (title ? `${title}\n\n` : "") + latexLines(text)
    .map((line) => line.text)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A LaTeX note's tags, in its comments as the editor draws them (`% #work`): not in verbatim or a code listing, where they're text. */
export function latexTags(body: string): string[] {
  if (!/%.*#/.test(body)) return [];
  const comments = scanLatex(body).spans.filter((span) => span.type === "comment");
  return extractTags(comments.map((span) => body.slice(span.from, span.to).replace(/^%+/, "")).join("\n"));
}

/**
 * A LaTeX note as a document that compiles on its own: the note goes between \begin{document} and
 * \end{document}, after the packages for what lines draws. A note that's a whole document already
 * (it has a \documentclass) is left as it is.
 */
export function latexDocument(body: string): string {
  if (/^\s*\\documentclass/m.test(body)) return body;
  const packages = ["amsmath", "amssymb", "graphicx"];
  if (/\\begin\{lstlisting\}/.test(body)) packages.push("listings");
  // Theorems and proofs, as lines draws them, unless the note defines its own.
  const theorems = [...new Set(body.match(/(?<=\\begin\{)(?:theorem|lemma|proposition|corollary|definition|remark|example|claim|conjecture|proof)(?=\*?\})/g))];
  if (theorems.length) packages.push("amsthm");
  packages.push("hyperref");
  const defined = (name: string) => new RegExp(`\\\\newtheorem\\*?\\{${name}\\}`).test(body);
  const newTheorems = theorems
    .filter((name) => name !== "proof" && !defined(name))
    .map((name) => `\\newtheorem{${name}}{${name[0].toUpperCase()}${name.slice(1)}}`);
  return [
    "\\documentclass{article}",
    ...packages.map((name) => `\\usepackage{${name}}`),
    ...newTheorems,
    "",
    "\\begin{document}",
    "",
    body.trim(),
    "",
    "\\end{document}",
    "",
  ].join("\n");
}

/** Text written so LaTeX shows it as it is: its special characters escaped (`50%` → `50\\%`). */
export function latexEscape(text: string): string {
  const named: Record<string, string> = { "\\": "\\textbackslash{}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}" };
  return text.replace(/[\\&%$#_{}~^]/g, (char) => named[char] ?? `\\${char}`);
}
