import { syntaxTree } from "@codemirror/language";
import { type Range, RangeSet, type Text } from "@codemirror/state";
import {
  type Command,
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { mount, unmount } from "svelte";
import Icon from "../icons/Icon.svelte";
import type { IconName } from "../icons/icons";
import {
  CALLOUTS,
  CalloutIcon,
  type CalloutIconPlace,
  type CalloutKind,
  calloutOf,
  type CardInset,
  cardInset,
  endsBlock,
  isCardFence,
} from "./cards";
import { FormatWidget, formatterFor } from "./formatCode";
import { drawnAsBlock, imageElement } from "./attachments";
import { linkAttributes, localIcon } from "./localLinks";
import { shortLink, ShortLinkWidget, type ShortLink } from "./shortLinks";
import { CopyWidget, keyValue } from "./keyValue";
import { ScoreWidget, scoreIn } from "./scores";
import { prefs } from "../prefs.svelte";
import { InlineMathWidget } from "./math";
import { fenceCode } from "./rendered";
import { followClick, openHref } from "./links";
import { drawMention, frontMatterField, objectsChanged, openMention, openTag, valueText } from "./objects";
import { normalizeTag } from "../notes/parse";
import { cheer, viewSelectionInUse } from "./util";
import { keyOf } from "../notes/properties";
import { markupMode } from "./markupMode";
import { plainLine } from "../notes/stats";
import { t } from "../i18n/index.svelte";
import { tagLooks, typeLooks } from "../notes/looks.svelte";

/*
 * Live preview: the document is always plain Markdown, and this plugin only
 * decorates it. Markup is hidden unless the cursor is on (or touching) the
 * construct, so what you type is exactly what is stored — no conversions,
 * no block model, nothing to get out of sync. How much shows is a setting
 * (markupMode.ts): all of it, or none of what only styles text.
 */

/** A list bullet; its shape cycles with how deep the list is nested (dot, ring, square). */
export class BulletWidget extends WidgetType {
  constructor(readonly shape: number) {
    super();
  }
  eq(other: BulletWidget) {
    return other.shape === this.shape;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = `cm-lp-bullet cm-lp-bullet-${this.shape}`;
    // Said before the item's text, so a list reads as one (numbers are text already).
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", t("editor.a11y.bullet"));
    return el;
  }
}

/**
 * Words only screen readers get, in place of Markdown that's hidden from sight but still there:
 * a card's `:::` lines ("Warning callout" … "End of warning callout"), the properties' `---`, the
 * start and end of a code block. Without them those read as their characters, or not at all.
 */
class SpokenWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: SpokenWidget) {
    return other.text === this.text;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "sr-only";
    el.textContent = this.text;
    return el;
  }
  ignoreEvent() {
    return false;
  }
}

/**
 * An ordered list's number, drawn in a marker-wide slot like a bullet, so the cursor on an empty
 * item goes where its text will start rather than just after the number.
 */
export class NumberWidget extends WidgetType {
  constructor(readonly number: string) {
    super();
  }
  eq(other: NumberWidget) {
    return other.number === this.number;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-lp-list-marker cm-lp-list-number";
    el.textContent = this.number + " ";
    return el;
  }
}

const CHECK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    /** The todo's text, which names the checkbox for screen readers. */
    readonly label: string,
  ) {
    super();
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.label === this.label;
  }
  toDOM() {
    // The box sits in a marker-wide slot, so the space after it is part of the widget and the
    // cursor on an empty todo goes where its text will start.
    const slot = document.createElement("span");
    slot.className = "cm-lp-task-marker";
    const el = document.createElement("span");
    el.className = "cm-lp-checkbox" + (this.checked ? " is-checked" : "");
    el.setAttribute("role", "checkbox");
    el.setAttribute("aria-checked", String(this.checked));
    el.setAttribute("aria-label", this.label || t("editor.checkbox"));
    el.innerHTML = this.checked ? CHECK_SVG : "";
    slot.append(el);
    return slot;
  }
  // Ticked, or its text edited: the same box, so the caret beside it stays put.
  updateDOM(slot: HTMLElement) {
    const el = slot.firstElementChild as HTMLElement | null;
    if (!el) return false;
    el.className = "cm-lp-checkbox" + (this.checked ? " is-checked" : "");
    el.setAttribute("aria-checked", String(this.checked));
    el.setAttribute("aria-label", this.label || t("editor.checkbox"));
    el.innerHTML = this.checked ? CHECK_SVG : "";
    return true;
  }
  ignoreEvent() {
    return false;
  }
}

class RuleWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-lp-hr";
    // In place of the `---`, which screen readers would otherwise say.
    el.setAttribute("role", "separator");
    return el;
  }
  // A click puts the cursor here, which shows the Markdown.
  ignoreEvent() {
    return false;
  }
}

/** The icons mounted in widgets, to unmount when they go. */
const icons = new WeakMap<HTMLElement, Record<string, unknown>>();

function unmountIcon(dom: HTMLElement) {
  const icon = icons.get(dom);
  if (icon) void unmount(icon);
}

/** The icon before a `type` property's value. */
class TypeIconWidget extends WidgetType {
  constructor(readonly icon: IconName) {
    super();
  }
  eq(other: TypeIconWidget) {
    return other.icon === this.icon;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-lp-prop-type-icon";
    icons.set(el, mount(Icon, { target: el, props: { name: this.icon, size: 14, strokeWidth: 2 } }));
    return el;
  }
  destroy(dom: HTMLElement) {
    unmountIcon(dom);
  }
}

/** A tag's `#`, drawn as the tag's icon in the sidebar (a hash unless one was chosen); screen readers still hear "#". */
class TagIconWidget extends WidgetType {
  constructor(readonly icon: IconName) {
    super();
  }
  eq(other: TagIconWidget) {
    return other.icon === this.icon;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-lp-tag-icon";
    icons.set(el, mount(Icon, { target: el, props: { name: this.icon, size: 13, strokeWidth: 2.25 } }));
    const spoken = document.createElement("span");
    spoken.className = "sr-only";
    spoken.textContent = "#";
    el.append(spoken);
    return el;
  }
  destroy(dom: HTMLElement) {
    unmountIcon(dom);
  }
  // A click puts the cursor here, which shows the `#`.
  ignoreEvent() {
    return false;
  }
}

const imageCleanups = new WeakMap<HTMLElement, () => void>();

/** An image within text; one on a line of its own is drawn as a block by attachments.ts. */
export class ImageWidget extends WidgetType {
  constructor(readonly src: string, readonly alt: string) {
    super();
  }
  eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt;
  }
  toDOM(view: EditorView) {
    const image = imageElement(this.src, this.alt, () => view.requestMeasure());
    imageCleanups.set(image.dom, image.destroy);
    return image.dom;
  }
  destroy(dom: HTMLElement) {
    imageCleanups.get(dom)?.();
  }
  ignoreEvent() {
    return false;
  }
}

const bullets = [0, 1, 2].map((shape) => new BulletWidget(shape));
const rule = new RuleWidget();
const formatWidget = new FormatWidget();
const hidden = Decoration.replace({});

/** What's drawn in a note's properties (its front matter): only what's within a line. */
const IN_PROPERTIES = new Set(["Emphasis", "StrongEmphasis", "Strikethrough", "Highlight", "Underline", "InlineCode", "Link", "Autolink", "URL", "Tag", "Mention", "InlineMath", "Escape"]);

/** Text styled by marks around it: its class, and its marks' name. */
export const INLINE_STYLES: Record<string, [cls: string, mark: string]> = {
  Emphasis: ["cm-lp-em", "EmphasisMark"],
  StrongEmphasis: ["cm-lp-strong", "EmphasisMark"],
  Strikethrough: ["cm-lp-strike", "StrikethroughMark"],
  Highlight: ["cm-lp-highlight", "HighlightMark"],
  Underline: ["cm-lp-underline", "UnderlineMark"],
  InlineCode: ["cm-lp-code", "CodeMark"],
};

function build(view: EditorView): DecorationSet {
  const { state } = view;
  const { doc } = state;
  const mode = state.facet(markupMode);
  if (mode === "source") return Decoration.none;
  // Out of the editor (and its find bar), render everything; while Markdown is all in sight, nothing hides it.
  const selection = viewSelectionInUse(view) ? state.selection.ranges : [];
  const all = mode === "visible";
  const touches = (from: number, to: number) => all || selection.some((r) => r.from <= to && r.to >= from);
  const lineActive = (pos: number) => {
    const line = doc.lineAt(pos);
    return touches(line.from, line.to);
  };
  // Hidden, what only styles text (`**`, a heading's `#`, a list's marker) doesn't show under the cursor either.
  const styleShows = mode === "hidden" ? () => false : touches;
  const styleLineShows = mode === "hidden" ? () => false : lineActive;

  const decos: Range<Decoration>[] = [];
  const hide = (from: number, to: number) => {
    if (from < to && !doc.sliceString(from, to).includes("\n")) decos.push(hidden.range(from, to));
  };
  const mark = (from: number, to: number, cls: string, attributes?: Record<string, string>) => {
    if (from < to) decos.push(Decoration.mark({ class: cls, attributes }).range(from, to));
  };
  const lineClass = (from: number, to: number, cls: (n: number, first: number, last: number) => string) => {
    const first = doc.lineAt(from).number;
    const last = doc.lineAt(to).number;
    for (let n = first; n <= last; n++) {
      decos.push(Decoration.line({ class: cls(n, first, last) }).range(doc.line(n).from));
    }
  };
  /** A heading's line, which screen readers also hear as a heading of its level (and can jump between). */
  const heading = (pos: number, level: string) => decos.push(headingLines[Number(level) - 1].range(doc.lineAt(pos).from));
  const spaceAfter = (pos: number) => (doc.sliceString(pos, pos + 1) === " " ? pos + 1 : pos);
  /** Draws a link short, in place of `from`–`to` (shortLinks.ts). */
  const shortChip = (from: number, to: number, href: string, short: ShortLink) => {
    decos.push(Decoration.replace({ widget: new ShortLinkWidget(href, short.mark, short.text) }).range(from, to));
    return false;
  };
  const hideChildren = (node: SyntaxNode, name: string) => {
    for (let c = node.firstChild; c; c = c.nextSibling) if (c.name === name) hide(c.from, c.to);
  };
  /**
   * A value (of a "Key: Value" line, or a property): a score drawn as marks, but on the line being
   * edited (scores.ts), and a button that copies it as it reads, without its Markdown, mentions as
   * they show (Settings → Little Touches, both).
   */
  const drawValue = (from: number, to: number, written: string) => {
    const score = prefs.scores !== "off" && !lineActive(from) ? scoreIn(written) : null;
    if (score) decos.push(Decoration.replace({ widget: new ScoreWidget(score.score, score.of, prefs.scores as Exclude<typeof prefs.scores, "off">) }).range(from, to));
    else mark(from, to, "cm-lp-kv-value");
    const plain = valueText(written);
    if (prefs.copyValues && plain) decos.push(Decoration.widget({ widget: new CopyWidget(plain, t("editor.copyValue", { value: plain })), side: 1 }).range(to));
  };
  /** Marks the value of each "Key: Value" line from `from` to `to`, with a copy button after it. */
  const keyValues = (from: number, to: number) => {
    for (let pos = from; pos <= to; ) {
      const line = doc.lineAt(pos);
      const start = Math.max(line.from, from);
      const text = doc.sliceString(start, Math.min(line.to, to));
      // Later lines of a paragraph can start with a quote's ">" or indentation.
      const lead = /^[\s>]*/.exec(text)![0].length;
      const value = keyValue(text.slice(lead));
      if (value) drawValue(start + lead + value.from, start + lead + value.to, doc.sliceString(start + lead + value.from, start + lead + value.to));
      pos = line.to + 1;
    }
  };

  const codeLines = new Set<number>();
  /** Draws a block's lines as code. Its fences (`fence`, marked `markName`) show only while the cursor is on their line. */
  const codeBlock = (node: SyntaxNode, fence: RegExp, markName: string) => {
    // Right after another code block or a card (no line between): a gap, so the two don't run together.
    const afterBlock = endsBlock(state, doc.lineAt(node.from).number - 1);
    lineClass(node.from, node.to, (n, first, last) => {
      codeLines.add(n);
      let cls = "cm-lp-codeblock";
      if (n === first) cls += " cm-lp-codeblock-first cm-lp-fence" + (afterBlock ? " cm-lp-codeblock-after" : "");
      if (n === last) {
        cls += " cm-lp-codeblock-last";
        if (n !== first && fence.test(doc.line(n).text)) cls += " cm-lp-fence";
      }
      return cls;
    });
    // A code block's language stays, as a label.
    for (const mark of node.getChildren(markName)) if (!lineActive(mark.from)) hide(mark.from, mark.to);
  };
  /**
   * Lines inside cards: how far in, whether it's a `:::` fence, and on a callout's opening fence,
   * which callout and whether the cursor is in it. Inner cards overwrite outer ones.
   */
  const cardLines = new Map<
    number,
    {
      inset: CardInset;
      fence: boolean;
      top: boolean;
      callout?: { kind: string; icon: IconName | null; editing: boolean; place: CalloutIconPlace };
      /** On a fence, what a screen reader says for it: where the card or callout starts or ends. */
      spoken?: string;
    }
  >();
  const { from, to } = view.viewport;
  const front = state.field(frontMatterField, false);
  // Where the note's properties end; Markdown reads them as a divider and a heading, which they aren't.
  const frontEnd = front ? doc.line(front.lines).to : -1;
  syntaxTree(state).iterate({
    from,
    to,
    enter(ref) {
      const node = ref.node;
      const name = ref.name;
      if (node.from <= frontEnd && !IN_PROPERTIES.has(name)) return;

      if (name in INLINE_STYLES) {
        const [cls, markName] = INLINE_STYLES[name];
        mark(node.from, node.to, cls);
        if (!styleShows(node.from, node.to)) hideChildren(node, markName);
        return;
      }

      if (name.startsWith("ATXHeading")) {
        const level = name.slice(-1);
        heading(node.from, level);
        if (styleLineShows(node.from)) return;
        // Its `#`s at the start; `#`s at the end (CommonMark's closing ones) show, as the note list shows
        // them, rather than hiding a `#` just typed there to start a tag.
        const marks = node.getChild("HeaderMark");
        if (marks?.from === node.from) hide(marks.from, spaceAfter(marks.to));
        return;
      }

      switch (name) {
        case "SetextHeading1":
        case "SetextHeading2": {
          // Text underlined with `===` or `---` (Settings → Editor → Underlined headings), every line of it.
          // Not while its underline is being typed, which a dash or two already is: the text above isn't
          // a heading until it's done.
          const underline = doc.lineAt(node.to);
          if (selection.some((range) => range.empty && range.head >= underline.from && range.head <= underline.to)) return;
          for (let pos = node.from; pos < underline.from; pos = doc.lineAt(pos).to + 1) heading(pos, name.slice(-1));
          return;
        }

        case "Link": {
          const url = node.getChild("URL");
          const marks = node.getChildren("LinkMark");
          if (!url || marks.length < 2) return;
          // Drawn as a block (attachments.ts), it shows its Markdown as written, an image in it too.
          if (drawnAsBlock(state, node.node)) return false;
          const textFrom = marks[0].to;
          const textTo = marks[1].from;
          const href = doc.sliceString(url.from, url.to);
          const short = !touches(node.from, node.to) && shortLink(href);
          if (short) {
            // A link whose text is its URL reads short; one with text of its own gets the mark.
            if (doc.sliceString(textFrom, textTo) === href) return shortChip(node.from, node.to, href, short);
            decos.push(Decoration.widget({ widget: new ShortLinkWidget(href, short.mark, ""), side: -1 }).range(textFrom));
          }
          // A folder or file on this computer: its icon in front.
          const local = !touches(node.from, node.to) && localIcon(href);
          if (local) decos.push(local.range(textFrom));
          mark(textFrom, textTo, "cm-lp-link", linkAttributes(href));
          if (!touches(node.from, node.to)) {
            hide(node.from, textFrom);
            hide(textTo, node.to);
          }
          return;
        }

        case "Autolink": {
          const url = node.getChild("URL");
          if (!url) return false;
          const href = doc.sliceString(url.from, url.to);
          const short = !touches(node.from, node.to) && shortLink(href);
          if (short) return shortChip(node.from, node.to, href, short);
          const local = !touches(node.from, node.to) && localIcon(href);
          if (local) decos.push(local.range(url.from));
          mark(url.from, url.to, "cm-lp-link", linkAttributes(href));
          if (!touches(node.from, node.to)) hideChildren(node, "LinkMark");
          return false;
        }

        case "URL": {
          // Bare URLs (GFM autolinks); URLs inside links are handled above.
          const parent = node.parent?.name;
          if (parent === "Link" || parent === "Image" || parent === "LinkReference") return;
          const href = doc.sliceString(node.from, node.to);
          const short = !touches(node.from, node.to) && shortLink(href);
          if (short) return shortChip(node.from, node.to, href, short);
          mark(node.from, node.to, "cm-lp-link", { "data-href": href });
          return;
        }

        case "Image": {
          const url = node.getChild("URL");
          const marks = node.getChildren("LinkMark");
          if (!url || marks.length < 2 || touches(node.from, node.to) || drawnAsBlock(state, node.node)) return false;
          if (doc.lineAt(node.from).number !== doc.lineAt(node.to).number) return false;
          const widget = new ImageWidget(
            doc.sliceString(url.from, url.to),
            doc.sliceString(marks[0].to, marks[1].from),
          );
          decos.push(Decoration.replace({ widget }).range(node.from, node.to));
          return false;
        }

        case "Escape": {
          // `\#` reads as `#`, as other Markdown apps show it: its backslash shows only under the cursor.
          if (!styleShows(node.from, node.to)) hide(node.from, node.from + 1);
          return false;
        }

        case "Tag": {
          const hash = node.getChild("TagMark");
          const tag = hash ? normalizeTag(doc.sliceString(hash.to, node.to)) : null;
          // Opened before the icon at its start, so the icon is inside the tag's pill. ⌘-click lists its notes.
          const attributes: Record<string, string> = tag ? { "data-tag": tag } : {};
          decos.push(Decoration.mark({ class: "cm-lp-tag", attributes, inclusiveStart: true }).range(node.from, node.to));
          // Its `#` as an icon, unless the cursor is on it.
          if (hash && !styleShows(node.from, node.to)) {
            decos.push(Decoration.replace({ widget: new TagIconWidget(tag ? tagLooks.icon(tag) : "hash") }).range(hash.from, hash.to));
          }
          return false;
        }

        case "Mention": {
          // Its source shows with the cursor in it, Hidden too: a chip can't be edited, only taken away.
          if (touches(node.from, node.to)) {
            mark(node.from, node.to, "cm-lp-mention-source");
            return false;
          }
          const drawn = drawMention(doc.sliceString(node.from, node.to));
          if ("widget" in drawn) decos.push(Decoration.replace({ widget: drawn.widget }).range(node.from, node.to));
          else mark(node.from, node.to, "cm-lp-mention-missing", drawn.missing ? { title: drawn.missing } : undefined);
          return false;
        }

        case "Paragraph":
          keyValues(node.from, node.to);
          return;

        case "Task": {
          const marker = node.getChild("TaskMarker");
          if (marker) keyValues(spaceAfter(marker.to), node.to);
          return;
        }

        case "ListItem": {
          const listMark = node.getChild("ListMark");
          if (!listMark) return;
          // How deep the item is nested. Its indentation is drawn from this, so the spaces typed
          // before the marker are hidden and each level steps in by the marker's width.
          let depth = 0;
          for (let p = node.parent; p; p = p.parent) if (p.name === "BulletList" || p.name === "OrderedList") depth++;
          const line = doc.lineAt(listMark.from);
          let indentFrom = listMark.from;
          while (indentFrom > line.from && /[ \t]/.test(doc.sliceString(indentFrom - 1, indentFrom))) indentFrom--;
          hide(indentFrom, listMark.from);
          const task = node.getChild("Task");
          const marker = task?.getChild("TaskMarker");
          const style = `--li-depth: ${depth}`;
          if (task && marker) {
            const checked = /x/i.test(doc.sliceString(marker.from, marker.to));
            const end = spaceAfter(marker.to);
            const cls = checked ? "cm-lp-li cm-lp-task cm-lp-task-done" : "cm-lp-li cm-lp-task";
            decos.push(Decoration.line({ class: cls, attributes: { style } }).range(line.from));
            if (!styleShows(listMark.from, marker.to)) {
              const label = plainLine(doc.sliceString(end, Math.min(task.to, line.to))).trim();
              decos.push(Decoration.replace({ widget: new CheckboxWidget(checked, label) }).range(listMark.from, end));
            } else {
              mark(listMark.from, end, "cm-lp-list-marker");
            }
            if (checked) mark(end, task.to, "cm-lp-done");
            return;
          }
          decos.push(Decoration.line({ class: "cm-lp-li", attributes: { style } }).range(line.from));
          const end = spaceAfter(listMark.to);
          const number = node.parent?.name === "OrderedList";
          if (styleShows(listMark.from, listMark.to)) {
            mark(listMark.from, end, number ? "cm-lp-list-marker cm-lp-list-number" : "cm-lp-list-marker");
          } else if (number) {
            const widget = new NumberWidget(doc.sliceString(listMark.from, listMark.to));
            decos.push(Decoration.replace({ widget }).range(listMark.from, end));
          } else {
            decos.push(Decoration.replace({ widget: bullets[(depth - 1) % 3] }).range(listMark.from, end));
          }
          return;
        }

        case "Blockquote":
          for (let n = doc.lineAt(node.from).number; n <= doc.lineAt(node.to).number; n++) {
            decos.push(quoteLine.range(doc.line(n).from));
          }
          return;

        case "QuoteMark":
          if (!styleLineShows(node.from)) hide(node.from, spaceAfter(node.to));
          return;

        case "HorizontalRule":
          if (!styleLineShows(node.from)) {
            decos.push(Decoration.replace({ widget: rule }).range(node.from, node.to));
          }
          return false;

        case "InlineMath": {
          const marks = node.getChildren("MathMark");
          if (marks.length < 2) return false;
          const single = doc.lineAt(node.from).number === doc.lineAt(node.to).number;
          if (touches(node.from, node.to) || !single) {
            mark(node.from, node.to, "cm-lp-math-source", { spellcheck: "false" });
            return false;
          }
          const widget = new InlineMathWidget(doc.sliceString(marks[0].to, marks[1].from), marks[0].to - marks[0].from === 2);
          decos.push(Decoration.replace({ widget }).range(node.from, node.to));
          return false;
        }

        case "MathBlock":
          // Its LaTeX looks like code; math.ts draws the math.
          codeBlock(node, /^\s*\$\$/, "MathMark");
          mark(node.from, node.to, "cm-lp-math-source", { spellcheck: "false" });
          return false;

        case "FencedCode": {
          codeBlock(node, /^\s*(```|~~~)/, "CodeMark");
          decos.push(Decoration.widget({ widget: new SpokenWidget(t("editor.a11y.codeStart")), side: -1 }).range(node.from));
          decos.push(Decoration.widget({ widget: new SpokenWidget(t("editor.a11y.codeEnd")), side: 1 }).range(node.to));
          // A copy button in the block's top right corner, for the code without its fences.
          const text = fenceCode(node.node, doc);
          const widget = new CopyWidget(text, t("editor.copyCode"), "cm-lp-copy cm-lp-code-copy");
          decos.push(Decoration.widget({ widget, side: 1 }).range(doc.lineAt(node.from).to));
          // A code block in a language that can be tidied gets a Format button beside Copy.
          const info = node.node.getChild("CodeInfo");
          if (!state.readOnly && text.trim() && formatterFor(info ? doc.sliceString(info.from, info.to) : "", text)) {
            decos.push(Decoration.widget({ widget: formatWidget, side: 2 }).range(doc.lineAt(node.from).to));
          }
          return false;
        }

        case "Card": {
          const inset = cardInset(state, node);
          const first = doc.lineAt(node.from).number;
          const last = doc.lineAt(node.to).number;
          const start = Math.max(first, doc.lineAt(from).number);
          const end = Math.min(last, doc.lineAt(to).number);
          const found = calloutOf(doc.line(first).text);
          // With nothing inside, the icon goes in the middle of the card rather than where a first line would be.
          const closed = last > first && isCardFence(doc.line(last).text, last, first, last);
          const place = last === first ? "fence" : last === first + 1 && closed ? "middle" : "line";
          const callout = found && { kind: found.kind, icon: found.icon, editing: touches(node.from, node.to), place } as const;
          const kind = found ? CALLOUTS[found.kind as CalloutKind].label : null;
          for (let n = start; n <= end; n++) {
            const fence = isCardFence(doc.line(n).text, n, first, last);
            const spoken = !fence
              ? undefined
              : n === first
                ? kind ? t("editor.a11y.calloutStart", { kind }) : t("editor.a11y.cardStart")
                : kind ? t("editor.a11y.calloutEnd", { kind }) : t("editor.a11y.cardEnd");
            cardLines.set(n, { inset, fence, top: n === first + 1, callout: n === first && callout ? callout : undefined, spoken });
          }
          return;
        }

        case "CardMark":
          return false;

        case "Table":
          lineClass(node.from, node.to, (n, first) => (n === first + 1 ? "cm-lp-table cm-lp-table-delim" : "cm-lp-table"));
          return false;
      }
    },
  });

  for (const [n, { inset, fence, top, callout, spoken }] of cardLines) {
    const line = doc.line(n);
    let cls = "cm-lp-card";
    if (fence) cls += touches(line.from, line.to) ? " cm-lp-card-fence is-active" : " cm-lp-card-fence";
    // The fence (from its colons, after a quote's `>`), unseen until the cursor's on it, is said in words.
    const colons = line.text.indexOf(":");
    if (fence && spoken && colons >= 0 && !touches(line.from, line.to)) {
      decos.push(Decoration.replace({ widget: new SpokenWidget(spoken) }).range(line.from + colons, line.to));
    }
    else if (top) cls += " cm-lp-card-top";
    if (callout) {
      // The icon sits on the opening fence, so it's there whatever the first line inside is.
      cls += ` cm-lp-callout-head cm-lp-callout-${callout.kind}`;
      decos.push(Decoration.widget({ widget: new CalloutIcon(callout.icon, callout.editing, callout.place), side: -1 }).range(line.from));
    }
    const style = `--card-depth: ${inset.depth}; --card-icons: ${inset.icons}`;
    decos.push(Decoration.line({ class: cls, attributes: { style } }).range(line.from));
  }

  if (front) {
    // The properties: a key column and values, with the `---` lines shrunk away until the cursor is in them.
    const active = touches(0, frontEnd);
    const keyLines = new Set(front.properties.map((property) => property.line));
    for (let n = 1; n <= front.lines; n++) {
      const line = doc.line(n);
      const fence = n === 1 ? "cm-lp-props-fence cm-lp-props-open" : n === front.lines ? "cm-lp-props-fence cm-lp-props-close" : "";
      let cls = fence ? fence + (active || !front.properties.length ? " is-active" : "") : "cm-lp-prop";
      if (!fence && !keyLines.has(n) && line.text.trim()) {
        // A YAML comment, or a list item or more of the value above, which lines up with the values.
        const comment = /^\s*#/.test(line.text);
        cls += comment ? " cm-lp-prop-comment" : " cm-lp-prop-more";
        if (!comment && !lineActive(line.from)) hide(line.from, line.from + /^\s*/.exec(line.text)![0].length);
      }
      decos.push(Decoration.line({ class: cls }).range(line.from));
      // The `---` lines, unseen, are said in words.
      if (fence && !active && front.properties.length && line.text) {
        const spoken = n === 1 ? t("editor.a11y.propertiesStart") : t("editor.a11y.propertiesEnd");
        decos.push(Decoration.replace({ widget: new SpokenWidget(spoken) }).range(line.from, line.to));
      }
    }
    for (const property of front.properties) {
      const line = doc.line(property.line);
      const valueFrom = line.from + /^[^:]*:[ \t]*/.exec(line.text)![0].length;
      const keyEnd = line.from + property.key.length;
      mark(line.from, valueFrom, "cm-lp-prop-key");
      if (!lineActive(line.from)) hide(keyEnd, valueFrom);
      const valueTo = line.from + line.text.trimEnd().length;
      if (valueTo <= valueFrom) continue;
      if (keyOf(property.key) === "type") {
        decos.push(Decoration.widget({ widget: new TypeIconWidget(typeLooks.icon(property.value.trim().toLowerCase())), side: -1 }).range(valueFrom));
        mark(valueFrom, valueTo, "cm-lp-prop-type");
        continue;
      }
      // As a "Key: Value" line's: a score's marks, and a button that copies it on hovering.
      drawValue(valueFrom, valueTo, property.value);
    }
  }

  // The title and the blank lines between paragraphs get their own, adjustable spacing.
  const title = titleLine(doc, front ? front.lines + 1 : 1);
  for (let pos = from; pos <= to; ) {
    const line = doc.lineAt(pos);
    if (line.number === title) decos.push(titleDeco.range(line.from));
    else if (doc.length && !line.text.trim() && !codeLines.has(line.number) && !cardLines.get(line.number)?.fence) {
      decos.push(blankDeco.range(line.from));
    }
    pos = line.to + 1;
  }

  return Decoration.set(decos, true);
}

const titleDeco = Decoration.line({ class: "cm-lp-title" });
const headingLines = [1, 2, 3, 4, 5, 6].map((level) =>
  Decoration.line({ class: `cm-lp-h cm-lp-h${level}`, attributes: { role: "heading", "aria-level": String(level) } }),
);
const quoteLine = Decoration.line({ class: "cm-lp-quote", attributes: { role: "blockquote" } });
const blankDeco = Decoration.line({ class: "cm-lp-blank" });

/** The first non-empty line from `start` (other than a card's `:::`), which the note list also uses as the title. */
function titleLine(doc: Text, start: number) {
  for (let n = start; n <= Math.min(doc.lines, start + 19); n++) {
    const text = doc.line(n).text.trim();
    if (text && !text.startsWith(":::")) return n;
  }
  return 0;
}

function toggleCheckbox(view: EditorView, el: Element) {
  const pos = view.posAtDOM(el);
  const line = view.state.doc.lineAt(pos);
  const match = /\[( |x|X)\]/.exec(line.text.slice(pos - line.from));
  if (!match) return;
  const at = pos + match.index + 1;
  view.dispatch({
    changes: { from: at, to: at + 1, insert: match[1] === " " ? "x" : " " },
    userEvent: "input.toggle",
  });
  if (match[1] === " ") cheer();
}

/**
 * ⌥↵ opens what the cursor is on: a mention's note (made, if it isn't there yet), a type's or a
 * tag's notes, a link, or an attached file. The keyboard's way to everything a click opens (links.ts).
 */
export const openAtCursor: Command = (view) => {
  const { state } = view;
  const { head } = state.selection.main;
  for (const side of [-1, 1] as const) {
    for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(head, side); node; node = node.parent) {
      if (node.name === "Mention") {
        openMention(state.sliceDoc(node.from, node.to));
        return true;
      }
      if (node.name === "Tag") {
        const tag = normalizeTag(state.sliceDoc(node.from + 1, node.to));
        if (tag) openTag(tag);
        return !!tag;
      }
      const url = node.name === "URL" ? node : node.name === "Link" || node.name === "Autolink" || node.name === "Image" ? node.getChild("URL") : null;
      if (url) {
        const marks = node.getChildren("LinkMark");
        const text = node.name === "Link" && marks.length > 1 ? state.sliceDoc(marks[0].to, marks[1].from) : "";
        openHref(state.sliceDoc(url.from, url.to), text);
        return true;
      }
    }
  }
  return false;
};

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    #atoms: RangeSet<Decoration> | undefined;

    constructor(view: EditorView) {
      this.decorations = build(view);
    }

    /** What's drawn in place of Markdown, which the cursor goes over in one step while Markdown is hidden (hiddenMarkdown.ts). */
    get atoms() {
      return (this.#atoms ??= this.decorations.update({ filter: (from, to, deco) => from < to && (deco === hidden || deco.spec.widget !== undefined) }));
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        update.focusChanged ||
        update.transactions.some((tr) => tr.effects.some((effect) => effect.is(objectsChanged))) ||
        update.startState.readOnly !== update.state.readOnly ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = build(update.view);
        this.#atoms = undefined;
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      mousedown(event, view) {
        const target = event.target as HTMLElement;
        const checkbox = target.closest(".cm-lp-checkbox");
        if (checkbox) {
          if (!view.state.readOnly) toggleCheckbox(view, checkbox.parentElement ?? checkbox);
          event.preventDefault();
          return true;
        }
        return followClick(event, view);
      },
    },
  },
);
