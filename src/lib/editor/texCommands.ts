import { type CompletionContext, type CompletionResult, type CompletionSection, snippet } from "@codemirror/autocomplete";
import type { EditorState } from "@codemirror/state";
import { t } from "../i18n/index.svelte";
import english from "../i18n/locales/en/latex";
import type { IconName } from "../icons/icons";
import type { SlashCommand } from "./slashCommands";

/*
 * The "\" menu: typing a backslash offers LaTeX commands, the way "/" offers blocks. Picking one
 * writes it with its braces, and Tab moves on to the next pair (`\frac{…}{…}`). LaTeX notes get
 * text commands, environments and, inside math, math commands (latex.ts); Markdown notes get the
 * math commands inside math.
 */

type LatexKey = keyof typeof english;

/**
 * The words that find a command, from messages: in the app's language and in English, so English
 * words (and LaTeX's own, which are English) find it in any language.
 */
export const searchWords = (...keys: (LatexKey | undefined)[]) =>
  keys
    .filter((key) => key !== undefined)
    .map((key) => `${t(key)} ${english[key]}`.toLowerCase())
    .join(" ");

const TEXT: CompletionSection = { name: t("latex.backslash.text"), rank: 0 };
const ENVIRONMENTS: CompletionSection = { name: t("latex.backslash.environments"), rank: 1 };
const MATH: CompletionSection = { name: t("latex.backslash.math"), rank: 2 };

/**
 * A command named `name` (without its backslash) that writes `template`, where `${}` marks each
 * place to type, in the order Tab visits them. `hint` is shown on the right: what it is, or the
 * symbol it makes. A block (an environment) goes on a line of its own.
 */
function tex(
  section: CompletionSection,
  icon: IconName,
  name: string,
  hint: string,
  template: string,
  { keywords = "", block = false } = {},
): SlashCommand {
  // Tab visits the places in order, then leaves the command: \frac{${1}}{${2}}${0}.
  let place = 0;
  const write = snippet(template.replace(/\$\{([^{}]*)\}/g, (_, name: string) => `\${${++place}${name ? `:${name}` : ""}}`) + "${0}");
  return {
    name: `\\${name}`,
    hint,
    icon,
    section,
    keywords: `${name.toLowerCase()} ${hint.toLowerCase()} ${keywords}`,
    apply(view, from, to) {
      const line = view.state.doc.lineAt(from);
      const before = view.state.sliceDoc(line.from, from);
      if (block && before.trim()) {
        // After text, the environment starts on the next line.
        view.dispatch({ changes: { from, to, insert: "\n" }, selection: { anchor: from + 1 } });
        write(view, null, from + 1, from + 1);
      } else write(view, null, from, to);
    },
  };
}

/** A text command, shown with what it is (`hint`, a message) and found by it and by `keywords`. */
const text = (icon: IconName, name: string, hint: LatexKey, template: string, keywords?: LatexKey) =>
  tex(TEXT, icon, name, t(hint), template, { keywords: searchWords(hint, keywords) });

/** `\begin{name}`, with `args` after it, the body, and `\end{name}`. */
const environment = (icon: IconName, name: string, hint: LatexKey, body = "  ${}", keywords?: LatexKey, args = "") =>
  tex(ENVIRONMENTS, icon, `begin{${name}}`, t(hint), `\\begin{${name}}${args}\n${body}\n\\end{${name}}`, {
    keywords: `${name} ${searchWords(hint, keywords)}`,
    block: true,
  });

/** A math command, shown with the symbol it makes. */
const math = (name: string, symbol: string, template = `\\${name}`, keywords?: LatexKey) =>
  tex(MATH, "radical", name, symbol, template, { keywords: searchWords(keywords) });

/** A math command shown with what it is (`hint`, a message), where there's no one symbol for it. */
const mathWord = (name: string, hint: LatexKey, template: string, keywords?: LatexKey, block = false) =>
  tex(MATH, "radical", name, t(hint), template, { keywords: searchWords(hint, keywords), block });

export const TEXT_COMMANDS: SlashCommand[] = [
  text("heading-1", "section", "latex.tex.section", "\\section{${}}", "latex.tex.section.keywords"),
  text("heading-2", "subsection", "latex.tex.subsection", "\\subsection{${}}"),
  text("heading-3", "subsubsection", "latex.tex.subsubsection", "\\subsubsection{${}}"),
  text("type", "paragraph", "latex.tex.paragraph", "\\paragraph{${}}"),
  text("bold", "textbf", "latex.tex.textbf", "\\textbf{${}}", "latex.tex.textbf.keywords"),
  text("italic", "emph", "latex.tex.emph", "\\emph{${}}"),
  text("italic", "textit", "latex.tex.textit", "\\textit{${}}"),
  text("code", "texttt", "latex.tex.texttt", "\\texttt{${}}", "latex.tex.texttt.keywords"),
  text("type", "underline", "latex.tex.underline", "\\underline{${}}"),
  text("type", "textsc", "latex.tex.textsc", "\\textsc{${}}"),
  text("message-circle", "footnote", "latex.tex.footnote", "\\footnote{${}}"),
  text("link", "href", "latex.tex.href", `\\href{\${url}}{\${${t("latex.tex.href.text")}}}`, "latex.tex.href.keywords"),
  text("link", "url", "latex.tex.url", "\\url{${}}"),
  text("image", "includegraphics", "latex.tex.includegraphics", "\\includegraphics[width=\\linewidth]{${}}", "latex.tex.includegraphics.keywords"),
  text("list", "item", "latex.tex.item", "\\item ${}"),
  text("tag", "label", "latex.tex.label", "\\label{${}}"),
  text("link", "ref", "latex.tex.ref", "\\ref{${}}"),
  text("book-open", "cite", "latex.tex.cite", "\\cite{${}}"),
  tex(TEXT, "type", "ldots", "…", "\\ldots{}", { keywords: searchWords("latex.tex.dots.keywords") }),
  tex(TEXT, "type", "LaTeX", "LaTeX", "\\LaTeX{}", { keywords: searchWords("latex.tex.LaTeX.keywords") }),
  text("calendar", "today", "latex.tex.today", "\\today{}", "latex.tex.today.keywords"),
  environment("list", "itemize", "latex.tex.itemize", "  \\item ${}", "latex.tex.itemize.keywords"),
  environment("list-ordered", "enumerate", "latex.tex.enumerate", "  \\item ${}", "latex.tex.enumerate.keywords"),
  environment("list", "description", "latex.tex.description", `  \\item[\${${t("latex.tex.description.term")}}] \${}`),
  environment("text-quote", "quote", "latex.tex.quote"),
  environment("type", "center", "latex.tex.center", "  ${}"),
  environment("code", "verbatim", "latex.tex.verbatim", "${}", "latex.tex.verbatim.keywords"),
  environment("table", "tabular", "latex.tex.tabular", "  ${} & ${} \\\\\n  ${} & ${} \\\\", "latex.tex.tabular.keywords", "{${ll}}"),
  environment("radical", "equation*", "latex.tex.equation", "  ${}", "latex.tex.formula.keywords"),
  environment("radical", "align*", "latex.tex.align", "  ${} &= ${} \\\\\n  ${} &= ${}", "latex.tex.formula.keywords"),
  text("radical", "[", "latex.tex.displayMath", "\\[ ${} \\]", "latex.tex.displayMath.keywords"),
];

export const MATH_COMMANDS: SlashCommand[] = [
  math("frac", "a⁄b", "\\frac{${}}{${}}", "latex.tex.frac.keywords"),
  math("sqrt", "√", "\\sqrt{${}}", "latex.tex.sqrt.keywords"),
  math("sum", "∑", "\\sum_{${}}^{${}}"),
  math("prod", "∏", "\\prod_{${}}^{${}}", "latex.tex.prod.keywords"),
  math("int", "∫", "\\int_{${}}^{${}}", "latex.tex.int.keywords"),
  math("lim", "lim", "\\lim_{${} \\to ${}}", "latex.tex.lim.keywords"),
  math("left(", "( )", "\\left( ${} \\right)", "latex.tex.left.keywords"),
  math("binom", "(n k)", "\\binom{${}}{${}}", "latex.tex.binom.keywords"),
  mathWord("text", "latex.tex.text", "\\text{${}}"),
  mathWord("mathbf", "latex.tex.mathbf", "\\mathbf{${}}"),
  math("mathbb", "ℝ", "\\mathbb{${}}", "latex.tex.mathbb.keywords"),
  math("mathcal", "𝒞", "\\mathcal{${}}", "latex.tex.mathcal.keywords"),
  mathWord("mathrm", "latex.tex.mathrm", "\\mathrm{${}}", "latex.tex.mathrm.keywords"),
  math("hat", "x̂", "\\hat{${}}"),
  math("bar", "x̄", "\\bar{${}}"),
  math("vec", "x⃗", "\\vec{${}}", "latex.tex.vec.keywords"),
  math("overline", "x̅", "\\overline{${}}"),
  math("infty", "∞", undefined, "latex.tex.infty.keywords"),
  math("partial", "∂"),
  math("nabla", "∇"),
  math("cdot", "·", undefined, "latex.tex.cdot.keywords"),
  math("times", "×"),
  math("div", "÷"),
  math("pm", "±", undefined, "latex.tex.pm.keywords"),
  math("leq", "≤", undefined, "latex.tex.leq.keywords"),
  math("geq", "≥", undefined, "latex.tex.geq.keywords"),
  math("neq", "≠", undefined, "latex.tex.neq.keywords"),
  math("approx", "≈"),
  math("equiv", "≡"),
  math("to", "→", undefined, "latex.tex.to.keywords"),
  math("Rightarrow", "⇒", undefined, "latex.tex.Rightarrow.keywords"),
  math("iff", "⇔"),
  math("in", "∈"),
  math("notin", "∉"),
  math("subseteq", "⊆", undefined, "latex.tex.subseteq.keywords"),
  math("cup", "∪", undefined, "latex.tex.cup.keywords"),
  math("cap", "∩", undefined, "latex.tex.cap.keywords"),
  math("forall", "∀"),
  math("exists", "∃"),
  math("emptyset", "∅"),
  math("cdots", "⋯", undefined, "latex.tex.dots.keywords"),
  math("ldots", "…", undefined, "latex.tex.dots.keywords"),
  ...(
    [
      ["alpha", "α"], ["beta", "β"], ["gamma", "γ"], ["delta", "δ"], ["epsilon", "ϵ"], ["varepsilon", "ε"], ["zeta", "ζ"],
      ["eta", "η"], ["theta", "θ"], ["kappa", "κ"], ["lambda", "λ"], ["mu", "μ"], ["nu", "ν"], ["xi", "ξ"], ["pi", "π"],
      ["rho", "ρ"], ["sigma", "σ"], ["tau", "τ"], ["phi", "ϕ"], ["varphi", "φ"], ["chi", "χ"], ["psi", "ψ"], ["omega", "ω"],
      ["Gamma", "Γ"], ["Delta", "Δ"], ["Theta", "Θ"], ["Lambda", "Λ"], ["Pi", "Π"], ["Sigma", "Σ"], ["Phi", "Φ"], ["Psi", "Ψ"], ["Omega", "Ω"],
    ] as const
  ).map(([name, glyph]) => math(name, glyph, undefined, "latex.tex.greek.keywords")),
  mathWord("begin{pmatrix}", "latex.tex.pmatrix", "\\begin{pmatrix}\n  ${} & ${} \\\\\n  ${} & ${}\n\\end{pmatrix}", "latex.tex.pmatrix.keywords", true),
  mathWord("begin{cases}", "latex.tex.cases", "\\begin{cases}\n  ${} & ${} \\\\\n  ${} & ${}\n\\end{cases}", "latex.tex.cases.keywords", true),
];

const MATH_ENV = "(?:equation|align|gather|alignat|multline|flalign|eqnarray|displaymath|math|aligned|[pbv]?matrix|cases)\\*?";

/** Whether `text` (a paragraph up to the cursor) leaves math open: a `$`, `$$`, `\(`, `\[` or math environment not closed yet. */
export function inOpenMath(text: string) {
  const plain = text.replace(/\\[\\$]/g, "");
  const display = plain.split("$$").length - 1;
  const inline = plain.replace(/\$\$/g, "").split("$").length - 1;
  const count = (open: string, close: string) => plain.split(open).length - plain.split(close).length;
  const environments = (word: string) => plain.match(new RegExp(`\\\\${word}\\{${MATH_ENV}\\}`, "g"))?.length ?? 0;
  return (
    display % 2 === 1 ||
    inline % 2 === 1 ||
    count("\\(", "\\)") > 0 ||
    count("\\[", "\\]") > 0 ||
    environments("begin") > environments("end")
  );
}

/** The paragraph before `pos`: from just after the last blank line. */
export function paragraphBefore(state: EditorState, pos: number) {
  let line = state.doc.lineAt(pos);
  while (line.number > 1) {
    const above = state.doc.line(line.number - 1);
    if (!above.text.trim()) break;
    line = above;
  }
  return state.sliceDoc(line.from, pos);
}

/**
 * The "\" menu's options: `commands(state, pos)` says which commands fit where the backslash is
 * (`pos`), or null for none (text in a Markdown note, code). Matches go by name, case first.
 */
export const backslashSource =
  (commands: (state: EditorState, pos: number) => SlashCommand[] | null) =>
  (context: CompletionContext): CompletionResult | null => {
    const typed = context.matchBefore(/\\[A-Za-z]*$/);
    // `\\` is a line break, not the start of a command.
    if (!typed || context.state.sliceDoc(typed.from - 1, typed.from) === "\\") return null;
    const list = commands(context.state, typed.from);
    if (!list) return null;
    const query = typed.text.slice(1);
    const lower = query.toLowerCase();
    const matches = list
      .map((command) => {
        const name = command.name.slice(1);
        const rank = !query
          ? 1
          : name.startsWith(query)
            ? 4
            : name.toLowerCase().startsWith(lower)
              ? 3
              : command.keywords.split(" ").some((word) => word && word.startsWith(lower))
                ? 2
                : 0;
        return { command, rank };
      })
      .filter((match) => match.rank > 0)
      // Shorter names first among equals: \in before \infty.
      .sort((a, b) => b.rank - a.rank || a.command.name.length - b.command.name.length);
    if (!matches.length) return null;
    return {
      from: typed.from,
      filter: false,
      options: matches.map(({ command }, i) => ({
        label: command.name,
        detail: command.hint,
        boost: -i,
        section: query ? undefined : command.section,
        apply: (view, _completion, _from, to) => command.apply(view, typed.from, to),
      })),
    };
  };
