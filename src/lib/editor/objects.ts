import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  closeCompletion,
  completionStatus,
  selectedCompletionIndex,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { type EditorState, Prec, StateEffect, StateField } from "@codemirror/state";
import { closeHoverTooltips, type EditorView, hoverTooltip, keymap, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { mount, unmount } from "svelte";
import Icon from "../icons/Icon.svelte";
import type { IconName } from "../icons/icons";
import {
  type FrontMatter,
  frontMatter,
  MENTION,
  mentionKey,
  mentionOf,
  nameOf,
  propertyOf,
  readMention,
  readTypeRef,
  typeLabel,
  wikiLinkOf,
} from "../notes/properties";
import { plainLine } from "../notes/stats";
import { locale, t } from "../i18n/index.svelte";
import { type Entry, notes } from "../notes/store.svelte";
import { typeIcons } from "../notes/tagIcons.svelte";
import { speak } from "../a11y";
import { announce, windowLabel } from "../windows/channel";
import { ancestors } from "./util";

/*
 * Objects in the editor (see notes/properties.ts): the note's front matter, read from its first
 * lines, and mentions of other notes, `@Oleks`, `[[Oleks]]` and `@Oleks.fullname`, drawn as their
 * titles and values. livePreview.ts places them.
 */

function readFront(state: EditorState) {
  const { doc } = state;
  return frontMatter(doc.sliceString(0, doc.line(Math.min(doc.lines, 101)).to));
}

/** The note's front matter, if it has one. */
export const frontMatterField = StateField.define<FrontMatter | null>({
  create: readFront,
  update: (value, tr) => (tr.docChanged ? readFront(tr.state) : value),
});

/** Other notes' titles, icons, types or properties changed, so mentions are drawn again. */
export const objectsChanged = StateEffect.define<null>();

/** The icon a note shows where it's mentioned: its own, its type's, or a page. */
export function iconOf({ note, meta }: Entry): IconName {
  return note.icon ?? (meta.type ? typeIcons.get(meta.type) : "file-text");
}

/**
 * Text as it reads: no Markdown, and mentions as what they show, notes' titles and properties'
 * values. A value mentioning another is followed twice at most, so two that mention each other end.
 */
export function valueText(text: string, depth = 0): string {
  const resolved = text.replace(MENTION, (written) => {
    const mention = readMention(written);
    const entry = mention && notes.find(mention.name);
    if (!mention || !entry) return written;
    if (!mention.key) return mention.shown ?? (entry.meta.title || written);
    const property = depth < 2 && !entry.note.locked ? propertyOf(entry.meta.properties, mention.key) : undefined;
    return (property && valueText(property.value, depth + 1)) || written;
  });
  return plainLine(resolved).trim();
}

const icons = new WeakMap<HTMLElement, Record<string, unknown>>();

/** A mention drawn as the note's title (with its icon), or as the property's value; or a type's chip. */
export class MentionWidget extends WidgetType {
  constructor(
    readonly id: string,
    readonly text: string,
    readonly icon: IconName | null,
    readonly tip: string,
    /** For a type's chip (`@type.recipe`), the type, which it opens rather than a note. */
    readonly type = "",
    /** What screen readers say for it, when that's more than its tooltip. */
    readonly label = tip,
  ) {
    super();
  }
  eq(other: MentionWidget) {
    return (
      other.id === this.id &&
      other.text === this.text &&
      other.icon === this.icon &&
      other.tip === this.tip &&
      other.type === this.type &&
      other.label === this.label
    );
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = this.icon ? "cm-lp-mention" : "cm-lp-mention cm-lp-mention-value";
    if (this.type) el.dataset.type = this.type;
    else el.dataset.note = this.id;
    el.title = this.tip;
    // It opens what it mentions (⌘-click); named for screen readers, which don't read a title.
    el.setAttribute("role", "link");
    el.setAttribute("aria-label", this.label);
    if (this.icon) {
      const target = document.createElement("span");
      target.className = "cm-lp-mention-icon";
      el.append(target);
      icons.set(el, mount(Icon, { target, props: { name: this.icon, size: 14, strokeWidth: 2 } }));
    }
    el.append(this.text);
    return el;
  }
  destroy(dom: HTMLElement) {
    const icon = icons.get(dom);
    if (icon) void unmount(icon);
  }
  // A click puts the cursor here, which shows what's written; ⌘-click opens the note (livePreview.ts).
  ignoreEvent() {
    return false;
  }
}

/**
 * How the mention written as `text` is drawn: a widget, or why it can't be (shown as written). A
 * mention of a note there isn't gets a card on hover instead (`missingNotes`), which says so.
 */
export function drawMention(text: string): { widget: MentionWidget } | { missing: string | null } {
  const ref = readTypeRef(text);
  if (ref) {
    const count = notes.ofType(ref.type).length;
    const label = typeLabel(ref.type);
    if (!count) return { missing: t("editor.mention.noneOfType", { type: ref.type }) };
    const tip = t("editor.mention.type", { type: label, count });
    return { widget: new MentionWidget("", label, typeIcons.get(notes.ofType(ref.type)[0].meta.type), tip, ref.type) };
  }
  const mention = readMention(text);
  const entry = mention && notes.find(mention.name);
  if (!mention || !entry) return { missing: null };
  const { note, meta } = entry;
  const title = meta.title || t("editor.untitled");
  const tip = meta.type ? t("editor.mention.note", { title, type: typeLabel(meta.type) }) : title;
  // A wiki link shows its own text if it has some (`[[Ada Lovelace|Ada]]`), the title on hover.
  if (!mention.key) return { widget: new MentionWidget(note.id, mention.shown ?? title, iconOf(entry), tip) };
  if (note.locked) return { missing: t("editor.mention.locked", { title }) };
  const property = propertyOf(meta.properties, mention.key);
  const value = property && valueText(property.value);
  if (!value) {
    return {
      missing: property
        ? t("editor.mention.noValueYet", { title, key: property.key })
        : t("editor.mention.noKey", { title, key: mention.key }),
    };
  }
  const label = t("editor.mention.value", { value, title, key: property.key });
  return { widget: new MentionWidget(note.id, value, null, t("editor.mention.property", { title, key: property.key }), "", label) };
}

/** Opens the note, in the main window (from a floating note, too). */
export function openNote(id: string) {
  if (windowLabel().startsWith("note-")) void announce({ type: "show", id });
  else notes.show(id);
}

/** Shows the notes of a type in the list, as choosing it in the sidebar does (in the main window). */
export function openType(type: string) {
  const found = notes.ofType(type)[0]?.meta.type;
  if (found && !windowLabel().startsWith("note-")) notes.setFilter({ kind: "type", type: found });
}

/** Lists a tag's notes, as choosing it in the sidebar does. Not in a note's own window, which has no list. */
export function openTag(tag: string) {
  if (!windowLabel().startsWith("note-")) notes.setFilter({ kind: "tag", tag });
}

/** A menu option, with the icon the menu shows before it (null for none). */
export interface IconCompletion extends Completion {
  icon: IconName | null;
}

/** An "@" being typed, and the name after it (after a "[" for a title with spaces). */
const TYPING_MENTION = /(?<![\p{L}\p{M}\p{N}_./\\@`])@(\[[^\]\n]*|[\p{L}\p{M}\p{N}_-]*)$/u;
/** A wiki link being typed, `[[` and the name after it (not an embed, `![[`). */
const TYPING_WIKI = /(?<![!\\])\[\[([^[\]\n|#]*)$/u;
/** A mention followed by a "." and the start of a property's key. */
const TYPING_KEY = /(?<![\p{L}\p{M}\p{N}_./\\@`])@(?:\[([^\]\n]+)\]|([\p{L}\p{N}_][\p{L}\p{M}\p{N}_-]*))\.([\p{L}\p{M}\p{N}_-]*)$/u;
/** Where an "@" is just an "@". */
const LITERAL = new Set(["FencedCode", "CodeBlock", "InlineCode", "CodeText", "URL"]);
const MAX_OPTIONS = 40;

/**
 * The "@" menu: other notes by title, the ones with a type first; after `@Name.`, that note's
 * properties. Like the "/" menu, a lone "@" after text waits for a letter, so it can stay an "@".
 * `[[` opens the same menu of notes at once, and writes a wiki link.
 */
export function mentionSource(context: CompletionContext): CompletionResult | null {
  for (const node of ancestors(context.state, context.pos, -1)) if (LITERAL.has(node.name)) return null;
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);

  const typingKey = TYPING_KEY.exec(before);
  // `@type.` and the start of a type: the types there are, for a table of one (typeTables.ts).
  if (typingKey && !typingKey[1] && typingKey[2].toLowerCase() === "type") {
    const query = typingKey[3].toLowerCase().replace(/_/g, " ");
    const options = notes.types
      .filter(({ type }) => type.startsWith(query))
      .map(({ type, count }): IconCompletion => ({ label: type.replace(/\s+/g, "_"), detail: count.toLocaleString(locale), icon: typeIcons.get(type) }));
    return options.length ? { from: context.pos - typingKey[3].length, filter: false, options } : null;
  }
  if (typingKey) {
    const entry = notes.find(typingKey[1] ?? typingKey[2]);
    if (!entry?.meta.properties.length) return null;
    const query = typingKey[3].toLowerCase();
    const options = entry.meta.properties
      .filter((property) => mentionKey(property.key).toLowerCase().startsWith(query))
      .map((property): IconCompletion => ({ label: mentionKey(property.key), detail: valueText(property.value).slice(0, 30), icon: null }));
    return options.length ? { from: context.pos - typingKey[3].length, filter: false, options } : null;
  }

  const wiki = TYPING_WIKI.exec(before);
  const typing = wiki ?? TYPING_MENTION.exec(before);
  if (!typing) return null;
  const at = context.pos - typing[0].length;
  const query = nameOf(typing[1].replace(/^\[/, ""));
  if (!wiki && !query && before.slice(0, at - line.from).trim() && !context.explicit) return null;
  const rank = (name: string) => (!query ? 1 : name.startsWith(query) ? 3 : name.split(" ").some((word) => word.startsWith(query)) ? 2 : name.includes(query) ? 1 : 0);
  const found = [...notes.objects]
    .map(([name, entry]) => ({ entry, rank: rank(name) }))
    .filter(({ rank }) => rank > 0)
    .sort((a, b) => b.rank - a.rank || Number(!!b.entry.meta.type) - Number(!!a.entry.meta.type) || b.entry.note.updatedAt - a.entry.note.updatedAt)
    .slice(0, MAX_OPTIONS);
  if (!found.length) return null;
  return {
    from: at + (wiki ? 2 : 1),
    filter: false,
    options: found.map(({ entry }): IconCompletion => ({
      label: entry.meta.title,
      detail: entry.meta.type ? typeLabel(entry.meta.type) : "",
      icon: iconOf(entry),
      apply: (view: EditorView, _completion: Completion, _from: number, to: number) => {
        const text = wiki ? wikiLinkOf(entry.meta.title) : mentionOf(entry.meta.title);
        // A wiki link's closing brackets, if they're typed already.
        const end = wiki && view.state.sliceDoc(to, to + 2) === "]]" ? to + 2 : to;
        view.dispatch({ changes: { from: at, to: end, insert: text }, selection: { anchor: at + text.length }, userEvent: "input.complete" });
      },
    })),
  };
}

/** `/properties`: adds front matter with a `type`, or moves to the end of the note's properties. */
export function editProperties(view: EditorView, from: number, to: number) {
  const front = view.state.field(frontMatterField, false);
  if (!front) {
    view.dispatch({
      changes: [{ from, to }, { from: 0, insert: "---\ntype: \n---\n" }],
      selection: { anchor: "---\ntype: ".length },
      userEvent: "input",
    });
    return;
  }
  // A new line for another property, above the closing `---`.
  const end = view.state.doc.line(front.lines - 1).to;
  view.dispatch({ changes: [{ from, to }, { from: end, insert: "\n" }], selection: { anchor: end + 1 }, userEvent: "input" });
}

/** A mention and a "." with nothing after it yet, before the cursor. */
const JUST_DOT = /(?<![\p{L}\p{M}\p{N}_./\\@`])@(?:\[[^\]\n]+\]|[\p{L}\p{N}_][\p{L}\p{M}\p{N}_-]*)\.$/u;

/**
 * The properties menu opens on the "." after a mention, but that "." often ends a sentence: Enter
 * there, before a letter is typed or another property is chosen with ↓, closes the menu and starts
 * a new line. Tab, a click or ↓ and Enter still pick one.
 */
export const mentionKeys = Prec.highest(
  keymap.of([
    {
      key: "Enter",
      run(view) {
        const { state } = view;
        if (completionStatus(state) !== "active" || selectedCompletionIndex(state) !== 0) return false;
        const { head } = state.selection.main;
        const line = state.doc.lineAt(head);
        const before = line.text.slice(0, head - line.from);
        // After `@type.` the menu is of types (for a type table), and the "." can't end a sentence.
        if (!JUST_DOT.test(before) || /@type\.$/i.test(before)) return false;
        closeCompletion(view);
        return false;
      },
    },
  ]),
);

/** The title a note made from a mention gets: as written, with `_` for spaces in a bare `@` one. */
const titleFrom = (written: string, name: string) =>
  written.startsWith("@") && !written.startsWith("@[") ? name.replace(/_/g, " ") : name.trim();

/**
 * Makes the note the mention written as `written` is of, which isn't there yet: titled with its
 * name, with the property it mentions as an empty one. Stays in the note being written.
 */
function createMentioned(written: string) {
  const mention = readMention(written);
  if (!mention) return;
  const title = titleFrom(written, mention.name);
  const properties = mention.key ? `---\n${mention.key}: \n---\n` : "";
  notes.add(`${properties}# ${title}\n`);
  speak(t("editor.mention.created", { title }));
}

/**
 * Opens what the mention written as `written` is of, as ⌘-click on it does: the note (a property's
 * too), or a type's notes in the list. A note that isn't there yet is made (`createMentioned`).
 */
export function openMention(written: string) {
  const ref = readTypeRef(written);
  if (ref) return openType(ref.type);
  const mention = readMention(written);
  if (!mention) return;
  const entry = notes.find(mention.name);
  if (entry) openNote(entry.note.id);
  else createMentioned(written);
}

/**
 * Hovering a mention of a note there isn't shows a card that offers to make it: a note with the
 * mention's name as its title (and the property mentioned, empty), added without leaving this one.
 */
export const missingNotes = hoverTooltip(
  (view, pos, side) => {
    let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(pos, side);
    while (node && node.name !== "Mention") node = node.parent;
    if (!node) return null;
    const { from, to } = node;
    const written = view.state.sliceDoc(from, to);
    const mention = readMention(written);
    if (!mention || readTypeRef(written) || notes.find(mention.name)) return null;
    const title = titleFrom(written, mention.name);
    return {
      pos: from,
      end: to,
      above: true,
      create() {
        const dom = document.createElement("div");
        dom.className = "cm-mention-card";
        const label = document.createElement("span");
        label.textContent = t("editor.mention.missing", { title });
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = t("editor.mention.create");
        // Keep the editor's cursor and focus where they are.
        button.addEventListener("mousedown", (event) => event.preventDefault());
        button.addEventListener("click", () => {
          createMentioned(written);
          view.dispatch({ effects: closeHoverTooltips });
        });
        dom.append(label, button);
        return { dom };
      },
    };
  },
  { hoverTime: 250 },
);
