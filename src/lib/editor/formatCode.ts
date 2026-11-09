import { type EditorView, WidgetType } from "@codemirror/view";
import type { Plugin } from "prettier";
import { mount, unmount } from "svelte";
import Icon from "../icons/Icon.svelte";
import { speak } from "../a11y";
import { t } from "../i18n/index.svelte";
import { fenceCode } from "./rendered";
import { ancestors } from "./util";

/*
 * Tidying the code in a code block: JSON (as is, numbers and all), SQL with sql-formatter, and
 * JavaScript, TypeScript, CSS, HTML, YAML, GraphQL and Markdown with Prettier. Each formatter
 * loads the first time it's used.
 */

type Formatter = (code: string) => Promise<string>;

/**
 * JSON, two spaces per level. It's checked with JSON.parse but laid out from the text itself,
 * so long numbers keep every digit and keys keep their order and escapes.
 */
const json: Formatter = async (code) => {
  JSON.parse(code);
  let out = "";
  let depth = 0;
  const newline = () => "\n" + "  ".repeat(depth);
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"') {
      let end = i + 1;
      while (code[end] !== '"') end += code[end] === "\\" ? 2 : 1;
      out += code.slice(i, end + 1);
      i = end;
    } else if (ch === "{" || ch === "[") {
      // Empty ones stay {} and [].
      const close = /^\s*([}\]])/.exec(code.slice(i + 1));
      if (close) {
        out += ch + close[1];
        i += close[0].length;
      } else {
        depth++;
        out += ch + newline();
      }
    } else if (ch === "}" || ch === "]") {
      depth--;
      out += newline() + ch;
    } else if (ch === ",") out += "," + newline();
    else if (ch === ":") out += ": ";
    else if (!/\s/.test(ch)) out += ch;
  }
  return out;
};

const prettier =
  (parser: string, plugins: () => Promise<unknown>[]): Formatter =>
  async (code) => {
    const [{ format }, ...loaded] = await Promise.all([import("prettier/standalone"), ...plugins()]);
    return format(code, { parser, plugins: loaded as Plugin[], printWidth: 80 });
  };

const estree = () => import("prettier/plugins/estree");
const babel = () => [import("prettier/plugins/babel"), estree()];
const typescript = () => [import("prettier/plugins/typescript"), estree()];
const postcss = () => [import("prettier/plugins/postcss")];

const sql =
  (language: string): Formatter =>
  async (code) => {
    const { format } = await import("sql-formatter");
    return format(code, { language: language as never, keywordCase: "preserve" });
  };

/** Formatters by the language names people write after ```. */
const FORMATTERS: Record<string, Formatter> = {
  json,
  javascript: prettier("babel", babel),
  js: prettier("babel", babel),
  jsx: prettier("babel", babel),
  mjs: prettier("babel", babel),
  cjs: prettier("babel", babel),
  typescript: prettier("typescript", typescript),
  ts: prettier("typescript", typescript),
  tsx: prettier("typescript", typescript),
  css: prettier("css", postcss),
  scss: prettier("scss", postcss),
  less: prettier("less", postcss),
  html: prettier("html", () => [import("prettier/plugins/html")]),
  yaml: prettier("yaml", () => [import("prettier/plugins/yaml")]),
  yml: prettier("yaml", () => [import("prettier/plugins/yaml")]),
  graphql: prettier("graphql", () => [import("prettier/plugins/graphql")]),
  gql: prettier("graphql", () => [import("prettier/plugins/graphql")]),
  markdown: prettier("markdown", () => [import("prettier/plugins/markdown")]),
  md: prettier("markdown", () => [import("prettier/plugins/markdown")]),
  sql: sql("sql"),
  postgres: sql("postgresql"),
  postgresql: sql("postgresql"),
  psql: sql("postgresql"),
  pgsql: sql("postgresql"),
  mysql: sql("mysql"),
  mariadb: sql("mariadb"),
  sqlite: sql("sqlite"),
  tsql: sql("transactsql"),
  mssql: sql("transactsql"),
  sqlserver: sql("transactsql"),
  plsql: sql("plsql"),
  oracle: sql("plsql"),
  bigquery: sql("bigquery"),
  snowflake: sql("snowflake"),
  redshift: sql("redshift"),
  duckdb: sql("duckdb"),
  clickhouse: sql("clickhouse"),
  trino: sql("trino"),
  spark: sql("spark"),
  hive: sql("hive"),
};

/** The formatter for a code block, from its language; code with none that is JSON is JSON. */
export function formatterFor(info: string, code: string): Formatter | null {
  const language = /\S*/.exec(info.trim())![0].toLowerCase();
  if (language) return FORMATTERS[language] ?? null;
  return /^\s*[[{]/.test(code) && isJSON(code) ? json : null;
}

function isJSON(code: string) {
  try {
    JSON.parse(code);
    return true;
  } catch {
    return false;
  }
}

/**
 * The code block whose first line `pos` is on: its code, the lines it's on, and what each of them
 * starts with in a list item or a quote (the item's indent, or `> `).
 */
function codeBlockAt(view: EditorView, pos: number) {
  const { doc } = view.state;
  for (const node of ancestors(view.state, pos, 1)) {
    if (node.name !== "FencedCode") continue;
    const info = node.getChild("CodeInfo");
    const lines = node.getChildren("CodeText");
    if (!lines.length) return null;
    // As a line with code on it starts (a blank one can do without), with a space after a `>` so
    // the code's own indent isn't read as part of the quote's marker.
    const written = lines.find((line) => doc.sliceString(line.from, line.to).trim()) ?? lines[0];
    const prefix = doc.sliceString(doc.lineAt(written.from).from, written.from).replace(/>$/, "> ");
    return {
      info: info ? doc.sliceString(info.from, info.to) : "",
      code: fenceCode(node, doc),
      from: doc.lineAt(lines[0].from).from,
      to: doc.lineAt(lines[lines.length - 1].to).to,
      prefix,
    };
  }
  return null;
}

const mounted = new WeakMap<HTMLElement, Record<string, unknown>>();

/** The button in a code block's top right corner, next to Copy, that tidies its code. */
export class FormatWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM(view: EditorView) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-lp-copy cm-lp-code-copy cm-lp-code-format";
    button.title = t("editor.formatCode");
    button.setAttribute("aria-label", t("editor.formatCode"));
    mounted.set(button, mount(Icon, { target: button, props: { name: "wand-sparkles", size: 14, strokeWidth: 2 } }));
    let shown: ReturnType<typeof setTimeout> | undefined;
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", async () => {
      const block = codeBlockAt(view, view.posAtDOM(button));
      const format = block && formatterFor(block.info, block.code);
      if (!block || !format || view.state.readOnly) return;
      const { code } = block;
      button.classList.add("is-busy");
      delete button.dataset.error;
      try {
        const tidy = (await format(code)).trimEnd();
        // Only if the code is still what was formatted.
        const now = codeBlockAt(view, view.posAtDOM(button));
        if (tidy !== code && now?.code === code) {
          const insert = tidy
            .split("\n")
            .map((line) => (line ? now.prefix + line : now.prefix.trimEnd()))
            .join("\n");
          view.dispatch({ changes: { from: now.from, to: now.to, insert }, userEvent: "input.format" });
        }
        speak(t("editor.codeFormatted"));
      } catch (error) {
        // The first line of the parser's message says what's wrong and where.
        const message = error instanceof Error ? error.message : String(error);
        button.dataset.error = t("editor.formatFailed", { error: message.split("\n")[0].replace(/\s*\(\d+:\d+\)$/, "") });
        // Drawn under the button, out of a screen reader's way, so said too.
        speak(button.dataset.error);
        clearTimeout(shown);
        shown = setTimeout(() => delete button.dataset.error, 4000);
      } finally {
        button.classList.remove("is-busy");
      }
    });
    return button;
  }
  destroy(dom: HTMLElement) {
    const icon = mounted.get(dom);
    if (icon) void unmount(icon);
  }
  ignoreEvent() {
    return true;
  }
}
