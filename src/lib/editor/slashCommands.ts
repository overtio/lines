import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { mount } from "svelte";
import Icon from "../icons/Icon.svelte";
import type { IconName } from "../icons/icons";
import { CALLOUTS, type CalloutKind, insertCard } from "./cards";
import { chooseFiles, chooseImages } from "./attachments";
import { insertTable } from "./tables";
import { ancestors } from "./util";

interface SlashCommand {
  name: string;
  /** The Markdown it produces, shown faintly on the right. */
  hint: string;
  icon: IconName;
  section: "Format" | "Insert";
  /** Other words that find it, e.g. "checkbox" for Todo. */
  keywords: string;
  /** Applies the command; `from`–`to` is the typed "/command". */
  apply: (view: EditorView, from: number, to: number) => void;
}

/** Any block marker a line may already start with, so a command replaces it rather than stacking. */
const BLOCK_PREFIX = /^(\s*)(?:#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)*/;

/** Turns the current line into a block (heading, list item, quote…), keeping its text. */
function setPrefix(prefix: string) {
  return (view: EditorView, from: number, to: number) => {
    const line = view.state.doc.lineAt(from);
    const text = line.text.slice(0, from - line.from) + line.text.slice(to - line.from);
    const [marker, indent] = BLOCK_PREFIX.exec(text)!;
    const content = text.slice(marker.length);
    const cursor = line.from + indent.length + prefix.length + Math.max(0, from - line.from - marker.length);
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: indent + prefix + content },
      selection: { anchor: cursor },
      userEvent: "input.format",
    });
  };
}

/**
 * Inserts text in place of the command; `|` marks where the cursor goes, or `[…]` the text to
 * select. With `ownLine`, the text replaces an empty line, or goes after a line's text.
 */
function insert(snippet: string | (() => string), ownLine = false) {
  return (view: EditorView, from: number, to: number) => {
    const raw = typeof snippet === "function" ? snippet() : snippet;
    const caret = raw.indexOf("|");
    const text = raw.replace("|", "");
    const line = view.state.doc.lineAt(from);
    const rest = (line.text.slice(0, from - line.from) + line.text.slice(to - line.from)).trim();
    // Where `text` starts once the changes are applied.
    let start: number;
    let changes;
    if (ownLine && rest) {
      // Keep the line's text, and put the block after it with a blank line between.
      changes = [{ from, to }, { from: line.to, insert: "\n\n" + text }];
      start = line.to - (to - from) + 2;
    } else if (ownLine) {
      // A divider right under text would turn that text into a heading.
      const above = line.number > 1 ? view.state.doc.line(line.number - 1).text.trim() : "";
      const gap = above && text.startsWith("---") ? "\n" : "";
      changes = { from: line.from, to: line.to, insert: gap + text };
      start = line.from + gap.length;
    } else {
      changes = { from, to, insert: text };
      start = from;
    }
    const select = /\[(.+?)\]\(/.exec(text);
    const selection =
      caret >= 0
        ? EditorSelection.cursor(start + caret)
        : select
          ? EditorSelection.range(start + select.index + 1, start + select.index + 1 + select[1].length)
          : EditorSelection.cursor(start + text.length);
    view.dispatch({ changes, selection, userEvent: "input" });
  };
}

/** A callout of `kind` (see cards.ts), found by its name or by `keywords`. */
function callout(kind: CalloutKind, keywords: string): SlashCommand {
  const { label, short, icon } = CALLOUTS[kind];
  return {
    name: label,
    hint: `:::${short}`,
    icon,
    section: "Insert",
    keywords: `callout ${keywords}`,
    apply: (view, from, to) => insertCard(view, from, to, kind),
  };
}

const COMMANDS: SlashCommand[] = [
  { name: "Text", hint: "", icon: "type", section: "Format", keywords: "paragraph plain normal body", apply: setPrefix("") },
  { name: "Heading 1", hint: "#", icon: "heading-1", section: "Format", keywords: "h1 title big", apply: setPrefix("# ") },
  { name: "Heading 2", hint: "##", icon: "heading-2", section: "Format", keywords: "h2 subtitle", apply: setPrefix("## ") },
  { name: "Heading 3", hint: "###", icon: "heading-3", section: "Format", keywords: "h3 small", apply: setPrefix("### ") },
  { name: "Todo", hint: "- [ ]", icon: "list-todo", section: "Format", keywords: "task checkbox check checklist", apply: setPrefix("- [ ] ") },
  { name: "Bullet list", hint: "-", icon: "list", section: "Format", keywords: "unordered ul point dash", apply: setPrefix("- ") },
  { name: "Numbered list", hint: "1.", icon: "list-ordered", section: "Format", keywords: "ordered ol number", apply: setPrefix("1. ") },
  { name: "Quote", hint: ">", icon: "text-quote", section: "Format", keywords: "blockquote citation", apply: setPrefix("> ") },
  { name: "Code block", hint: "```", icon: "code", section: "Insert", keywords: "snippet pre fence", apply: insert("```\n|\n```", true) },
  {
    name: "Diagram",
    hint: "mermaid",
    icon: "workflow",
    section: "Insert",
    keywords: "mermaid flowchart chart graph sequence",
    apply: insert("```mermaid\nflowchart LR\n  A[Idea] --> B[Note]|\n```", true),
  },
  { name: "Card", hint: ":::", icon: "panel-top", section: "Insert", keywords: "box panel section block callout container", apply: insertCard },
  callout("info", "note tip hint about fyi"),
  callout("question", "ask open unknown unsure help"),
  callout("warning", "caution careful attention alert important"),
  callout("error", "danger problem bug failure broken"),
  callout("decision", "decided choice agreed resolved outcome"),
  { name: "Table", hint: "| |", icon: "table", section: "Insert", keywords: "grid columns rows spreadsheet", apply: insertTable },
  { name: "Image", hint: "![]()", icon: "image", section: "Insert", keywords: "picture photo screenshot upload", apply: chooseImages },
  { name: "File", hint: "[]()", icon: "paperclip", section: "Insert", keywords: "attach attachment upload document pdf", apply: chooseFiles },
  { name: "Divider", hint: "---", icon: "minus", section: "Insert", keywords: "rule line separator hr break", apply: insert("---\n", true) },
  { name: "Link", hint: "[](…)", icon: "link", section: "Insert", keywords: "url web href", apply: insert("[link text](https://)") },
  { name: "Tag", hint: "#", icon: "hash", section: "Insert", keywords: "hashtag label", apply: insert("#") },
  {
    name: "Date",
    hint: "today",
    icon: "calendar",
    section: "Insert",
    keywords: "today time now",
    apply: insert(() => new Date().toLocaleDateString(undefined, { dateStyle: "long" })),
  },
];

/** Code, links and URLs where a "/" is just a slash. */
const LITERAL_NODES = new Set(["FencedCode", "CodeBlock", "InlineCode", "CodeText", "URL", "Link"]);

function slashSource(context: CompletionContext): CompletionResult | null {
  // A "/" at the start of a line or after a space, so "and/or" and URLs never trigger it.
  const typed = context.matchBefore(/(?:^|\s)\/[\p{L}\p{N}-]*$/u);
  if (!typed) return null;
  for (const node of ancestors(context.state, context.pos, -1)) {
    if (LITERAL_NODES.has(node.name)) return null;
  }
  const slash = typed.from + typed.text.indexOf("/");
  const query = context.state.sliceDoc(slash + 1, context.pos).toLowerCase();
  // After text, a lone "/" is more likely just a slash: wait for a letter, so Enter still
  // starts a new line instead of applying the first command.
  const line = context.state.doc.lineAt(slash);
  if (!query && line.text.slice(0, slash - line.from).replace(BLOCK_PREFIX, "")) return null;
  const matches = COMMANDS.map((command) => {
    const name = command.name.toLowerCase();
    const rank = !query
      ? 1
      : name.startsWith(query)
        ? 3
        : name.split(" ").some((w) => w.startsWith(query))
          ? 2
          : command.keywords.split(" ").some((w) => w.startsWith(query))
            ? 1
            : 0;
    return { command, rank };
  })
    .filter((m) => m.rank > 0)
    .sort((a, b) => b.rank - a.rank);
  if (!matches.length) return null;
  return {
    from: slash + 1,
    filter: false,
    options: matches.map(({ command, rank }) => ({
      label: command.name,
      detail: command.hint,
      boost: rank,
      section: query ? undefined : command.section,
      apply: (view: EditorView, _completion: Completion, _from: number, to: number) => command.apply(view, slash, to),
    })),
  };
}

const iconNodes = new Map<string, HTMLElement>();

/** One mounted icon per command, reused each time the menu redraws. */
function renderIcon(completion: Completion) {
  const name = COMMANDS.find((c) => c.name === completion.label)?.icon;
  if (!name) return null;
  let node = iconNodes.get(name);
  if (!node) {
    node = document.createElement("span");
    node.className = "cm-slash-icon";
    mount(Icon, { target: node, props: { name, size: 16, strokeWidth: 1.75 } });
    iconNodes.set(name, node);
  }
  return node;
}

/** Type "/" at the start of a line (or after a space) to turn it into a todo, quote, heading… */
export const slashCommands = autocompletion({
  override: [slashSource],
  icons: false,
  closeOnBlur: true,
  // Open at once and let a quick "/quo⏎" go straight through.
  activateOnTypingDelay: 0,
  interactionDelay: 0,
  addToOptions: [{ render: renderIcon, position: 20 }],
  tooltipClass: () => "cm-slash-menu",
});
