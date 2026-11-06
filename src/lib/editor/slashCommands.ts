import {
  acceptCompletion,
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  type CompletionSection,
  type CompletionSource,
  completionStatus,
  currentCompletions,
  moveCompletionSelection,
  setSelectedCompletion,
  startCompletion,
} from "@codemirror/autocomplete";
import { EditorSelection, type EditorState, Prec } from "@codemirror/state";
import { type EditorView, keymap } from "@codemirror/view";
import { mount } from "svelte";
import Icon from "../icons/Icon.svelte";
import type { IconName } from "../icons/icons";
import { locale, type MessageKey, t } from "../i18n/index.svelte";
import english from "../i18n/locales/en/editor";
import { CALLOUTS, type CalloutKind, insertCard } from "./cards";
import { chooseFiles, chooseImages } from "./attachments";
import { newDrawing } from "./drawings";
import { editProperties, type IconCompletion, mentionKeys, mentionSource } from "./objects";
import { insertTable } from "./tables";
import { backslashSource, inOpenMath, MATH_COMMANDS, paragraphBefore, TEXT_COMMANDS } from "./texCommands";
import { ancestors } from "./util";

export interface SlashCommand {
  /** Names it to other commands, which can say to come after it (`after`). */
  id: string;
  /** Its name, in the app's language. */
  name: string;
  /** The Markdown it produces, shown faintly on the right. */
  hint: string;
  icon: IconName;
  section: CompletionSection;
  /** Other words that find it, e.g. "checkbox" for Todo, in the app's language and in English. */
  keywords: string;
  /** Applies the command; `from`–`to` is the typed "/command". */
  apply: (view: EditorView, from: number, to: number) => void;
  /** A plugin's command goes after this one in the menu (by id), or else at the end. */
  after?: string;
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
export function insert(snippet: string | (() => string), ownLine = false) {
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

/** The menu's sections, in this order whatever they're called in the app's language. */
export const SECTIONS = {
  format: { name: t("editor.section.format"), rank: 0 } satisfies CompletionSection,
  insert: { name: t("editor.section.insert"), rank: 1 } satisfies CompletionSection,
};
const { format: FORMAT, insert: INSERT } = SECTIONS;

type Named = keyof typeof english & `editor.${"slash" | "callout"}.${string}`;

/**
 * A command's id and name, from the message `key`, and the words that find it (`key.keywords`): the
 * language's own, and English's name and words too, so what English speakers type works in any language.
 */
export function named(key: Named) {
  const words = `${key}.keywords` as MessageKey;
  return {
    id: key.slice(key.lastIndexOf(".") + 1),
    name: t(key as MessageKey),
    keywords: [t(words), english[key], english[words as Named]].join(" "),
  };
}

/** A callout of `kind` (see cards.ts), found by its name or by its keywords. */
function callout(kind: CalloutKind): SlashCommand {
  const { short, icon } = CALLOUTS[kind];
  return {
    ...named(`editor.callout.${kind}`),
    hint: `:::${short}`,
    icon,
    section: INSERT,
    apply: (view, from, to) => insertCard(view, from, to, kind),
  };
}

const COMMANDS: SlashCommand[] = [
  { ...named("editor.slash.text"), hint: "", icon: "type", section: FORMAT, apply: setPrefix("") },
  { ...named("editor.slash.heading1"), hint: "#", icon: "heading-1", section: FORMAT, apply: setPrefix("# ") },
  { ...named("editor.slash.heading2"), hint: "##", icon: "heading-2", section: FORMAT, apply: setPrefix("## ") },
  { ...named("editor.slash.heading3"), hint: "###", icon: "heading-3", section: FORMAT, apply: setPrefix("### ") },
  { ...named("editor.slash.todo"), hint: "- [ ]", icon: "list-todo", section: FORMAT, apply: setPrefix("- [ ] ") },
  { ...named("editor.slash.bulletList"), hint: "-", icon: "list", section: FORMAT, apply: setPrefix("- ") },
  { ...named("editor.slash.numberedList"), hint: "1.", icon: "list-ordered", section: FORMAT, apply: setPrefix("1. ") },
  { ...named("editor.slash.quote"), hint: ">", icon: "text-quote", section: FORMAT, apply: setPrefix("> ") },
  { ...named("editor.slash.codeBlock"), hint: "```", icon: "code", section: INSERT, apply: insert("```\n|\n```", true) },
  { ...named("editor.slash.math"), hint: "$$", icon: "radical", section: INSERT, apply: insert("$$\n|\n$$", true) },
  { ...named("editor.slash.card"), hint: ":::", icon: "panel-top", section: INSERT, apply: insertCard },
  callout("info"),
  callout("question"),
  callout("warning"),
  callout("error"),
  callout("decision"),
  { ...named("editor.slash.table"), hint: "| |", icon: "table", section: INSERT, apply: insertTable },
  { ...named("editor.slash.image"), hint: "![]()", icon: "image", section: INSERT, apply: chooseImages },
  { ...named("editor.slash.file"), hint: "[]()", icon: "paperclip", section: INSERT, apply: chooseFiles },
  { ...named("editor.slash.drawing"), hint: "Excalidraw", icon: "pencil", section: INSERT, apply: newDrawing },
  { ...named("editor.slash.divider"), hint: "---", icon: "minus", section: INSERT, apply: insert("---\n", true) },
  { ...named("editor.slash.link"), hint: "[](…)", icon: "link", section: INSERT, apply: insert(`[${t("editor.slash.link.text")}](https://)`) },
  { ...named("editor.slash.tag"), hint: "#", icon: "hash", section: INSERT, apply: insert("#") },
  { ...named("editor.slash.mention"), hint: "@", icon: "at-sign", section: INSERT, apply: insert("@") },
  {
    ...named("editor.slash.typeTable"),
    hint: "@type.",
    icon: "shapes",
    section: INSERT,
    apply: (view, from, to) => {
      insert("@type.", true)(view, from, to);
      startCompletion(view);
    },
  },
  { ...named("editor.slash.properties"), hint: "---", icon: "table-properties", section: INSERT, apply: editProperties },
  {
    ...named("editor.slash.date"),
    hint: t("editor.slash.date.hint"),
    icon: "calendar",
    section: INSERT,
    // Written the way the app's language writes dates.
    apply: insert(() => new Date().toLocaleDateString(locale, { dateStyle: "long" })),
  },
];


/** Lowercase and without accents, so "/parrafo" finds "párrafo" and "/ecran" "écran". */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Code, links and URLs where a "/" is just a slash. */
const LITERAL_NODES = new Set(["FencedCode", "CodeBlock", "InlineCode", "CodeText", "URL", "Link"]);

/** The menu's options for what's typed: `commands`, unless the "/" is in code or a link. */
const slashSource = (commands: SlashCommand[]) => (context: CompletionContext): CompletionResult | null => {
  // A "/" at the start of a line or after a space, so "and/or" and URLs never trigger it.
  const typed = context.matchBefore(/(?:^|\s)\/[\p{L}\p{N}-]*$/u);
  if (!typed) return null;
  for (const node of ancestors(context.state, context.pos, -1)) {
    if (LITERAL_NODES.has(node.name)) return null;
  }
  const slash = typed.from + typed.text.indexOf("/");
  const query = fold(context.state.sliceDoc(slash + 1, context.pos));
  // After text, a lone "/" is more likely just a slash: wait for a letter, so Enter still
  // starts a new line instead of applying the first command.
  const line = context.state.doc.lineAt(slash);
  if (!query && line.text.slice(0, slash - line.from).replace(BLOCK_PREFIX, "")) return null;
  const matches = commands.map((command) => {
    const name = fold(command.name);
    const rank = !query
      ? 1
      : name.startsWith(query)
        ? 3
        : name.split(" ").some((w) => w.startsWith(query))
          ? 2
          : fold(command.keywords).split(" ").some((w) => w.startsWith(query))
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
    options: matches.map(({ command, rank }): HintedCompletion => ({
      label: command.name,
      hint: command.hint,
      boost: rank,
      section: query ? undefined : command.section,
      apply: (view: EditorView, _completion: Completion, _from: number, to: number) => command.apply(view, slash, to),
    })),
  };
};

const iconNodes = new Map<string, HTMLElement>();

/** One mounted icon per command (or note, in the "@" menu), reused each time the menu redraws. */
const renderIcon = (commands: SlashCommand[]) => (completion: Completion) => {
  const name = "icon" in completion ? (completion as IconCompletion).icon : commands.find((c) => c.name === completion.label)?.icon;
  if (!name) return null;
  let node = iconNodes.get(name);
  if (!node) {
    node = document.createElement("span");
    node.className = "cm-slash-icon";
    mount(Icon, { target: node, props: { name, size: 16, strokeWidth: 1.75 } });
    iconNodes.set(name, node);
  }
  return node;
};

/** A "/" command in the menu, with its Markdown shown faintly on the right. */
interface HintedCompletion extends Completion {
  hint: string;
}

/**
 * The Markdown a "/" command makes (`- [ ]`, `| |`), drawn where CodeMirror draws a detail but
 * hidden from screen readers, which would otherwise read "Todo, dash, bracket, bracket".
 */
function renderHint(completion: Completion) {
  const hint = (completion as Partial<HintedCompletion>).hint;
  if (!hint) return null;
  const el = document.createElement("span");
  el.className = "cm-completionDetail";
  el.setAttribute("aria-hidden", "true");
  el.textContent = hint;
  return el;
}

/** What's been typed after the "/" before the cursor, or a "\" command and its backslash, while the menu is open. */
const TYPED = /(?:^|\s)\/([\p{L}\p{N}-]*)$|(?<!\\)(\\[A-Za-z]*)$/u;

/**
 * Tab completes like a shell: with one command left it runs it, otherwise it fills in as much of
 * the name as the commands left have in common (`/he` → `/heading`), and once there's nothing more
 * to fill in it moves to the next command. Only names starting with what's typed count, not
 * keywords, so `/to` is Todo even though "today" finds Date too. The "\" menu works the same way
 * (`\sub` → `\subs`).
 */
function tabComplete(view: EditorView) {
  if (completionStatus(view.state) !== "active") return false;
  const { head } = view.state.selection.main;
  const line = view.state.doc.lineAt(head);
  // In the "@" menu (whose options have their icons with them), Tab takes the note or property chosen.
  if (currentCompletions(view.state).some((option) => "icon" in option)) return acceptCompletion(view);
  const typed = TYPED.exec(line.text.slice(0, head - line.from));
  const query = (typed?.[1] ?? typed?.[2])?.toLowerCase();
  if (query === undefined) return false;
  const names = currentCompletions(view.state).map((option) => option.label);
  const starting = names.filter((name) => name.toLowerCase().startsWith(query));
  const left = starting.length ? starting : names;
  if (left.length === 1) {
    view.dispatch({ effects: setSelectedCompletion(names.indexOf(left[0])) });
    return acceptCompletion(view);
  }
  // As far as the names agree, and only as far as can be typed after a "/" (no spaces), or in a command.
  let common = left[0].toLowerCase();
  for (const name of left) while (!name.toLowerCase().startsWith(common)) common = common.slice(0, -1);
  common = (typed![2] !== undefined ? /^\\[a-z]*/ : /^[\p{L}\p{N}-]*/u).exec(common)![0];
  if (starting.length && common.length > query.length) {
    const insert = common.slice(query.length);
    view.dispatch({ changes: { from: head, insert }, selection: { anchor: head + insert.length }, userEvent: "input.type" });
    return true;
  }
  return moveCompletionSelection(true)(view);
}

const tabKeymap = Prec.highest(
  keymap.of([
    { key: "Tab", run: tabComplete },
    { key: "Shift-Tab", run: (view) => completionStatus(view.state) === "active" && moveCompletionSelection(false)(view) },
  ]),
);

/** Math in a Markdown note, where "\" offers math commands: `$…$`, a `$$` block, ```math, or a `$` not closed yet. */
function markdownMath(state: EditorState, pos: number) {
  for (const node of ancestors(state, pos, -1)) {
    if (node.name === "InlineMath" || node.name === "MathBlock") return MATH_COMMANDS;
    if (node.name === "FencedCode") return /^\s*```\s*math\b/i.test(state.doc.lineAt(node.from).text) ? MATH_COMMANDS : null;
    if (node.name !== "CodeText" && LITERAL_NODES.has(node.name)) return null;
  }
  return inOpenMath(paragraphBefore(state, pos)) ? MATH_COMMANDS : null;
}

/**
 * A "/" menu of `commands`, at the start of a line (or after a space), and a "\" menu from
 * `backslash`: where the backslash is, the commands it offers, or null for none (texCommands.ts).
 * `others` are more menus, like Markdown's "@" (objects.ts): CodeMirror takes one set of them.
 */
export const slashMenu = (
  commands: SlashCommand[],
  backslash: (state: EditorState, pos: number) => SlashCommand[] | null,
  others: CompletionSource[] = [],
) => {
  const all = [...commands, ...TEXT_COMMANDS, ...MATH_COMMANDS];
  return [
    autocompletion({
      override: [slashSource(commands), backslashSource(backslash), ...others],
      icons: false,
      closeOnBlur: true,
      // Open at once and let a quick "/quo⏎" go straight through.
      activateOnTypingDelay: 0,
      interactionDelay: 0,
      addToOptions: [
        { render: renderIcon(all), position: 20 },
        { render: renderHint, position: 80 },
      ],
      tooltipClass: () => "cm-slash-menu",
    }),
    tabKeymap,
  ];
};

/**
 * `commands` with `added` ones (plugins'), each after the command it names, or at the end. Several
 * after the same one keep their plugins' order.
 */
function withAdded(commands: SlashCommand[], added: SlashCommand[]) {
  const all = [...commands];
  for (const command of added) {
    let at = command.after ? all.findIndex((each) => each.id === command.after) : -1;
    if (at < 0) at = all.length - 1;
    else while (all[at + 1]?.after === command.after) at++;
    all.splice(at + 1, 0, command);
  }
  return all;
}

/**
 * Type "/" at the start of a line (or after a space) to turn it into a todo, quote, heading…, or
 * whatever plugins add (`added`); "\" in math for math commands; "@" to mention another note.
 */
export const slashCommands = (added: SlashCommand[]) => [
  // Before the menu, whose own keys are just as high in precedence.
  mentionKeys,
  slashMenu(withAdded(COMMANDS, added), markdownMath, [mentionSource]),
];
