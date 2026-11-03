/*
 * Reads a LaTeX note into the pieces latex.ts draws: styles, headings, lists, math, tables and so
 * on, by position. It's forgiving: anything it doesn't know is a plain command, and an argument
 * or environment that never closes is left as text, so a note being typed never breaks.
 */

interface Range {
  from: number;
  to: number;
}

/** An environment: `\begin{name}` (with its arguments) ends at `beginTo`, `\end{name}` starts at `endFrom`. */
export interface Env extends Range {
  name: string;
  beginTo: number;
  endFrom: number;
}

export interface Table extends Env {
  rows: string[][];
  /** Whether the first row is a header: a rule (\hline, \midrule…) right under it. */
  header: boolean;
  aligns: ("left" | "center" | "right" | "")[];
}

export type Span =
  | (Range & { type: "style"; cls: string; open: number; close: number })
  | (Range & { type: "heading"; level: number; open: number; close: number })
  | (Range & { type: "footnote"; open: number; close: number })
  | (Range & { type: "link"; href: string; textFrom: number; textTo: number })
  | (Range & { type: "image"; src: string })
  | (Range & { type: "math"; tex: string; display: boolean })
  | (Range & { type: "symbol"; text: string })
  | (Range & { type: "escape" | "break" | "comment" | "command" })
  /** \cite{…} (`[a, b]`) or \ref{…} and its kind (`fig:x`, `(eq:x)`): the text to draw. */
  | (Range & { type: "cite" | "ref"; text: string })
  /** `depth` counts every list it's in; `level`, the lists of its own kind (for 1., (a), i.). */
  | (Range & { type: "item"; list: string; depth: number; level: number; number: number; label?: Range })
  | (Env & { type: "env" | "verbatim" })
  | (Table & { type: "table" });

const STYLES: Record<string, string> = {
  textbf: "cm-lp-strong",
  textit: "cm-lp-em",
  textsl: "cm-lp-em",
  emph: "cm-lp-em",
  texttt: "cm-lp-code",
  underline: "cm-lt-underline",
  textsc: "cm-lt-smallcaps",
  sout: "cm-lp-strike",
  paragraph: "cm-lp-strong",
  caption: "cm-lt-caption",
  textrm: "",
  textsf: "",
  textup: "",
  textnormal: "",
  mbox: "",
};

const HEADINGS: Record<string, number> = { section: 1, subsection: 2, subsubsection: 3 };

export const SYMBOLS: Record<string, string> = {
  ldots: "…",
  dots: "…",
  LaTeX: "LaTeX",
  TeX: "TeX",
  textbackslash: "\\",
  textasciitilde: "~",
  textasciicircum: "^",
  S: "§",
  P: "¶",
  copyright: "©",
  textregistered: "®",
  texttrademark: "™",
  textendash: "–",
  textemdash: "—",
  textbullet: "•",
  ",": " ",
  " ": " ",
  L: "Ł",
  l: "ł",
  o: "ø",
  O: "Ø",
  ss: "ß",
  ae: "æ",
  AE: "Æ",
  oe: "œ",
  OE: "Œ",
  aa: "å",
  AA: "Å",
  i: "ı",
};

/** Accents on the letter after them, as combining marks: \"o, \'{e}, \c{c}. */
export const ACCENTS: Record<string, string> = {
  "'": "\u0301",
  "`": "\u0300",
  "^": "\u0302",
  '"': "\u0308",
  "~": "\u0303",
  "=": "\u0304",
  ".": "\u0307",
  u: "\u0306",
  v: "\u030c",
  H: "\u030b",
  c: "\u0327",
  k: "\u0328",
};

const MATH_ENVS = new Set(["equation", "align", "gather", "alignat", "multline", "flalign", "eqnarray", "displaymath", "math"].flatMap((name) => [name, `${name}*`]));
const VERBATIM_ENVS = new Set(["verbatim", "verbatim*", "Verbatim", "lstlisting", "minted", "comment"]);
const TABLE_ENVS = new Set(["tabular", "tabular*", "tabularx"]);
export const LIST_ENVS = new Set(["itemize", "enumerate", "description", "thebibliography"]);

/**
 * The LaTeX KaTeX should draw for a math environment. Numbered environments draw unnumbered,
 * since each is drawn on its own and every one would be (1); the rest map to what KaTeX has.
 */
function mathTex(name: string, inner: string) {
  const base = name.replace(/\*$/, "");
  const body = inner.replace(/\\label\{[^{}]*\}/g, "");
  if (base === "displaymath" || base === "math") return body;
  if (base === "multline") return `\\begin{gather*}${body}\\end{gather*}`;
  if (base === "eqnarray") return `\\begin{array}{rcl}${body}\\end{array}`;
  if (base === "flalign") return `\\begin{align*}${body}\\end{align*}`;
  if (base === "alignat") return `\\begin{alignat*}${body}\\end{alignat*}`;
  return `\\begin{${base}*}${body}\\end{${base}*}`;
}

const COMMAND = /\\([A-Za-z]+\*?|[^A-Za-z])/y;

const CITES = new Set(["cite", "citep", "citet", "citealp", "citealt", "citeauthor", "citeyear", "parencite", "textcite", "autocite", "footcite"]);
const REFS = new Set(["ref", "eqref", "autoref", "cref", "Cref", "pageref", "nameref"]);
const DEFINITIONS = new Set(["newcommand", "renewcommand", "providecommand", "DeclareMathOperator"]);

/** What the note defines for the rest of it: math macros (for KaTeX) and theorem-like environments. */
export interface Definitions {
  /** `\name` → its body, with #1… for arguments, as KaTeX's `macros` takes them. */
  macros: Record<string, string>;
  /** Environment name → the label it's drawn with (`thm` → "Theorem"), and the counter it's numbered with, from \newtheorem. */
  theorems: Record<string, { label: string; counter: string }>;
}

export function scanLatex(text: string): { spans: Span[]; definitions: Definitions } {
  const spans: Span[] = [];
  const definitions: Definitions = { macros: {}, theorems: {} };
  /** Environments open at the current position, innermost last, with their item count. */
  const open: { span: Env & { type: "env" }; items: number }[] = [];

  const lineEnd = (pos: number) => {
    const end = text.indexOf("\n", pos);
    return end < 0 ? text.length : end;
  };
  const atLineStart = (pos: number) => /^[ \t]*$/.test(text.slice(text.lastIndexOf("\n", pos - 1) + 1, pos));
  const blankLine = (pos: number) => /^\n[ \t]*\n/.test(text.slice(pos, pos + 200));

  /** The end (just past `}`) of the brace group starting at `pos`, or -1. Groups don't run past a blank line. */
  function group(pos: number) {
    if (text[pos] !== "{") return -1;
    let depth = 0;
    for (let i = pos; i < text.length; i++) {
      const c = text[i];
      if (c === "\\") i++;
      else if (c === "%") i = lineEnd(i) - 1;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) return i + 1;
      else if (c === "\n" && blankLine(i)) return -1;
    }
    return -1;
  }

  /** The end of an optional `[…]` argument at `pos` (on one line), or `pos` if there's none. */
  function optional(pos: number) {
    if (text[pos] !== "[") return pos;
    const close = text.indexOf("]", pos);
    return close < 0 || close > lineEnd(pos) ? pos : close + 1;
  }

  /** Past any arguments right after `pos`: `[…]` and `{…}`, with no space before them. */
  function args(pos: number) {
    for (;;) {
      const next = text[pos] === "[" ? optional(pos) : group(pos);
      if (next <= pos) return pos;
      pos = next;
    }
  }

  /** Where `close` (a closing delimiter of math) is, from `pos`, skipping escapes; -1 past a blank line. */
  function find(close: string, pos: number) {
    for (let i = pos; i < text.length; i++) {
      if (text.startsWith(close, i)) return i;
      if (text[i] === "\\") i++;
      else if (text[i] === "\n" && blankLine(i)) return -1;
    }
    return -1;
  }

  function scan(from: number, to: number) {
    let i = from;
    while (i < to) {
      const c = text[i];
      if (c === "%") {
        const end = lineEnd(i);
        spans.push({ type: "comment", from: i, to: end });
        i = end;
      } else if (c === "$") {
        const display = text[i + 1] === "$";
        const size = display ? 2 : 1;
        const close = find(display ? "$$" : "$", i + size);
        if (close > i + size && close + size <= to) {
          spans.push({ type: "math", from: i, to: close + size, tex: text.slice(i + size, close), display });
          i = close + size;
        } else i += size;
      } else if (c === "\\") {
        i = command(i, to);
      } else if (c === "-" && text[i + 1] === "-") {
        const size = text[i + 2] === "-" ? 3 : 2;
        spans.push({ type: "symbol", from: i, to: i + size, text: size === 3 ? "—" : "–" });
        i += size;
      } else if ((c === "`" || c === "'") && text[i + 1] === c) {
        spans.push({ type: "symbol", from: i, to: i + 2, text: c === "`" ? "“" : "”" });
        i += 2;
      } else if (c === "~") {
        spans.push({ type: "symbol", from: i, to: i + 1, text: " " });
        i++;
      } else i++;
    }
  }

  /** Reads the command at `start` and what it takes; returns where reading goes on. */
  function command(start: number, to: number): number {
    COMMAND.lastIndex = start;
    const match = COMMAND.exec(text);
    if (!match) return start + 1;
    const name = match[1];
    let pos = start + match[0].length;

    if (name === "(" || name === "[") {
      const close = find(name === "(" ? "\\)" : "\\]", pos);
      if (close < 0 || close + 2 > to) return pos;
      spans.push({ type: "math", from: start, to: close + 2, tex: text.slice(pos, close), display: name === "[" });
      return close + 2;
    }
    if (name === "\\") {
      pos = optional(pos);
      spans.push({ type: "break", from: start, to: pos });
      return pos;
    }
    if (name in ACCENTS) {
      // The letter right after it (\"o), or in braces (\"{o}); a letter accent like \c needs braces or a space.
      const braced = /^\{(\\?[A-Za-z])\}/.exec(text.slice(pos, pos + 4));
      const bare = braced ? null : (name.length === 1 ? /^[A-Za-z]/ : /^ [A-Za-z]/).exec(text.slice(pos, pos + 2));
      const letter = braced?.[1] ?? (bare ? bare[0].trim() : null);
      if (letter) {
        const end = pos + (braced ?? bare)![0].length;
        const base = letter.startsWith("\\") ? (SYMBOLS[letter.slice(1)] ?? letter.slice(1)) : letter;
        spans.push({ type: "symbol", from: start, to: end, text: (base + ACCENTS[name]).normalize("NFC") });
        return end;
      }
    }
    if (name in SYMBOLS) {
      // \LaTeX{} keeps its braces with it; a command word takes the space after it, as in LaTeX (\L ukasz).
      const end = group(pos) === pos + 2 ? pos + 2 : /^[A-Za-z]/.test(name) && text[pos] === " " ? pos + 1 : pos;
      spans.push({ type: "symbol", from: start, to: end, text: SYMBOLS[name] });
      return end;
    }
    if (name.length === 1 && "%&$#_{}".includes(name)) {
      spans.push({ type: "escape", from: start, to: pos });
      return pos;
    }
    if (name === "begin") return beginEnv(start, pos, to);
    if (name === "end") return endEnv(start, pos);
    if (name === "item" || name === "bibitem") return readItem(start, pos, name === "bibitem");
    if (name === "verb" || name === "verb*") {
      // \verb|code|: anything between two of the same character, on one line.
      const close = /[^\sA-Za-z*]/.test(text[pos] ?? "") ? text.indexOf(text[pos], pos + 1) : -1;
      if (close > 0 && close < lineEnd(pos)) {
        spans.push({ type: "style", cls: "cm-lp-code", from: start, to: close + 1, open: pos + 1, close });
        return close + 1;
      }
    }

    const base = name.replace(/\*$/, "");
    const heading = base in HEADINGS && atLineStart(start);
    if (heading || base in STYLES || base === "footnote") {
      const argFrom = heading ? optional(pos) : pos;
      const close = group(argFrom);
      if (close > 0 && close <= to) {
        const range = { from: start, to: close, open: argFrom + 1, close: close - 1 };
        if (heading) spans.push({ type: "heading", level: HEADINGS[base], ...range });
        else if (base === "footnote") spans.push({ type: "footnote", ...range });
        else spans.push({ type: "style", cls: STYLES[base], ...range });
        scan(argFrom + 1, close - 1);
        return close;
      }
    }
    if (DEFINITIONS.has(base) || name === "def" || base === "newtheorem") {
      const end = name === "def" ? def(pos) : base === "newtheorem" ? newTheorem(pos) : define(base, pos);
      if (end > 0) {
        spans.push({ type: "command", from: start, to: end });
        return end;
      }
    }
    if (CITES.has(base) || REFS.has(base)) {
      // \cite[p.~3]{key}: the note in brackets is left out.
      const argFrom = optional(optional(pos));
      const close = group(argFrom);
      if (close > 0 && close <= to) {
        const keys = text.slice(argFrom + 1, close - 1).split(",").map((key) => key.trim()).join(", ");
        if (CITES.has(base)) spans.push({ type: "cite", from: start, to: close, text: `[${keys}]` });
        else spans.push({ type: "ref", from: start, to: close, text: base === "eqref" ? `(${keys})` : keys });
        return close;
      }
    }
    if (name === "href" || name === "url") {
      const first = group(pos);
      const second = name === "href" && first > 0 ? group(first) : first;
      if (first > 0 && second > 0 && second <= to) {
        const href = text.slice(pos + 1, first - 1);
        const textFrom = name === "href" ? first + 1 : pos + 1;
        spans.push({ type: "link", from: start, to: second, href, textFrom, textTo: second - 1 });
        if (name === "href") scan(first + 1, second - 1);
        return second;
      }
    }
    if (name === "includegraphics") {
      const argFrom = optional(pos);
      const close = group(argFrom);
      if (close > 0 && close <= to) {
        spans.push({ type: "image", from: start, to: close, src: text.slice(argFrom + 1, close - 1).trim() });
        return close;
      }
    }
    // Anything else, with its arguments: \label{…}, \maketitle, \vspace{1em}.
    const end = Math.min(args(pos), to);
    spans.push({ type: "command", from: start, to: end });
    return end;
  }

  function beginEnv(start: number, pos: number, to: number): number {
    const nameEnd = group(pos);
    if (nameEnd < 0) {
      spans.push({ type: "command", from: start, to: pos });
      return pos;
    }
    const name = text.slice(pos + 1, nameEnd - 1).trim();
    const beginTo = args(nameEnd);
    const closing = `\\end{${name}}`;
    if (MATH_ENVS.has(name) || VERBATIM_ENVS.has(name) || TABLE_ENVS.has(name)) {
      const endFrom = text.indexOf(closing, beginTo);
      const closed = endFrom >= 0 && endFrom + closing.length <= to;
      if (MATH_ENVS.has(name) && closed) {
        const tex = mathTex(name, text.slice(beginTo, endFrom));
        spans.push({ type: "math", from: start, to: endFrom + closing.length, tex, display: !name.startsWith("math") });
        return endFrom + closing.length;
      }
      if (VERBATIM_ENVS.has(name)) {
        // Verbatim to its end, or to the end of the note if it never closes.
        const env = { name, from: start, beginTo, endFrom: closed ? endFrom : text.length, to: closed ? endFrom + closing.length : text.length };
        spans.push({ type: "verbatim", ...env });
        return env.to;
      }
      if (TABLE_ENVS.has(name) && closed) {
        const spec = text.slice(nameEnd, beginTo);
        spans.push({ type: "table", name, from: start, beginTo, endFrom, to: endFrom + closing.length, ...tableOf(spec, text.slice(beginTo, endFrom)) });
        return endFrom + closing.length;
      }
    }
    const span = { type: "env" as const, name, from: start, beginTo, endFrom: text.length, to: text.length };
    spans.push(span);
    open.push({ span, items: 0 });
    return beginTo;
  }

  function endEnv(start: number, pos: number): number {
    const nameEnd = group(pos);
    const name = nameEnd > 0 ? text.slice(pos + 1, nameEnd - 1).trim() : "";
    let at = open.length - 1;
    while (at >= 0 && open[at].span.name !== name) at--;
    if (at < 0) {
      spans.push({ type: "command", from: start, to: Math.max(nameEnd, pos) });
      return Math.max(nameEnd, pos);
    }
    // Environments inside it that never closed end with it.
    for (const env of open.splice(at)) {
      env.span.endFrom = start;
      env.span.to = nameEnd;
    }
    return nameEnd;
  }

  /** An \item, or a \bibitem[label]{key} in a bibliography (its label is the key, unless it has one). */
  function readItem(start: number, pos: number, bibliography = false): number {
    const lists = open.filter((env) => LIST_ENVS.has(env.span.name));
    const list = lists.at(-1);
    if (!list) {
      spans.push({ type: "command", from: start, to: pos });
      return pos;
    }
    let labelEnd = optional(pos);
    let label = labelEnd > pos ? { from: pos + 1, to: labelEnd - 1 } : undefined;
    if (bibliography) {
      const keyEnd = group(labelEnd);
      if (keyEnd < 0) {
        spans.push({ type: "command", from: start, to: pos });
        return pos;
      }
      label ??= { from: labelEnd + 1, to: keyEnd - 1 };
      labelEnd = keyEnd;
    }
    const end = text[labelEnd] === " " ? labelEnd + 1 : labelEnd;
    const level = lists.filter((env) => env.span.name === list.span.name).length;
    spans.push({ type: "item", from: start, to: end, list: list.span.name, depth: lists.length, level, number: ++list.items, label });
    if (label) scan(label.from, label.to);
    return end;
  }

  /**
   * \newcommand{\name}[2]{body} (or \renewcommand, \providecommand, \DeclareMathOperator{\name}{text}),
   * from `pos` just after the command's name; returns where it ends, or -1 if it isn't one.
   */
  function define(name: string, pos: number): number {
    if (text[pos] === "*") pos++;
    let macro: string;
    if (text[pos] === "{") {
      const end = group(pos);
      if (end < 0) return -1;
      macro = text.slice(pos + 1, end - 1).trim();
      pos = end;
    } else {
      const match = /^\\[A-Za-z]+/.exec(text.slice(pos, pos + 100));
      if (!match) return -1;
      macro = match[0];
      pos += macro.length;
    }
    // The number of arguments, then a default for the first: [2][x].
    pos = optional(optional(pos));
    const end = group(pos);
    if (end < 0 || !/^\\[A-Za-z]+$/.test(macro)) return -1;
    const body = text.slice(pos + 1, end - 1);
    definitions.macros[macro] = name === "DeclareMathOperator" ? `\\operatorname{${body}}` : body;
    return end;
  }

  /** \def\name#1{body}, from just after \def. */
  function def(pos: number): number {
    const match = /^\\([A-Za-z]+)((?:#\d)*)\{/.exec(text.slice(pos, pos + 100));
    if (!match) return -1;
    const end = group(pos + match[0].length - 1);
    if (end < 0) return -1;
    definitions.macros[`\\${match[1]}`] = text.slice(pos + match[0].length, end - 1);
    return end;
  }

  /** \newtheorem{name}[counter]{Label}, from just after its name. */
  function newTheorem(pos: number): number {
    if (text[pos] === "*") pos++;
    const nameEnd = group(pos);
    if (nameEnd < 0) return -1;
    const name = text.slice(pos + 1, nameEnd - 1).trim();
    // \newtheorem{lemma}[theorem]{Lemma} counts along with theorems.
    const labelFrom = optional(nameEnd);
    const labelEnd = group(labelFrom);
    if (labelEnd < 0) return -1;
    const counter = labelFrom > nameEnd ? text.slice(nameEnd + 1, labelFrom - 1).trim() : name;
    definitions.theorems[name] = { label: text.slice(labelFrom + 1, labelEnd - 1).trim(), counter };
    return optional(labelEnd);
  }

  scan(0, text.length);
  return { spans, definitions };
}

/** A tabular's rows of cells (still LaTeX) and its columns' alignment, from its column spec (`{|l|c|r|}`). */
function tableOf(spec: string, inner: string): { rows: string[][]; header: boolean; aligns: Table["aligns"] } {
  const columns = (/\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*$/.exec(spec)?.[1] ?? "").replace(/[@>]\{[^{}]*\}|[|!]/g, "");
  const aligns: Table["aligns"] = [];
  for (const match of columns.matchAll(/([lcrX])|[pmb]\{[^{}]*\}/g)) {
    aligns.push(match[1] === "c" ? "center" : match[1] === "r" ? "right" : match[1] ? "left" : "");
  }
  const RULE = /\\(?:hline|toprule|midrule|bottomrule)\b|\\cline\{[^{}]*\}/g;
  const lines = inner
    .replace(/(?<!\\)%.*$/gm, "")
    .split(/(?<!\\)\\\\(?:\[[^\]]*\])?/)
    .map((row) => ({ rule: new RegExp(`^\\s*(?:${RULE.source})`).test(row), cells: row.replace(RULE, "").split(/(?<!\\)&/).map((cell) => cell.trim()) }))
    .filter((row, i) => i === 0 || row.cells.some(Boolean) || row.rule);
  const rows = lines.map((row) => row.cells).filter((cells) => cells.some(Boolean));
  // The row after the first one with text starts with a rule.
  const first = lines.findIndex((row) => row.cells.some(Boolean));
  const header = first >= 0 && rows.length > 1 && !!lines[first + 1]?.rule;
  return { rows, header, aligns };
}
