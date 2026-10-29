import { syntaxTree } from "@codemirror/language";
import type { Range, Text } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import type { IconName } from "../icons/icons";
import { plainLine } from "../notes/stats";
import { attachmentName, openAttachment } from "../notes/attachments";
import { coarsePointer, openExternal } from "../platform";
import { CalloutIcon, calloutOf, type CardInset, cardInset, endsBlock, isCardFence } from "./cards";
import { FormatWidget, formatterFor } from "./formatCode";
import { drawnAsBlock, imageElement } from "./attachments";
import { CopyWidget, keyValue } from "./keyValue";

/*
 * Live preview: the document is always plain Markdown, and this plugin only
 * decorates it. Markup is hidden unless the cursor is on (or touching) the
 * construct, so what you type is exactly what is stored — no conversions,
 * no block model, nothing to get out of sync.
 */

/** A list bullet; its shape cycles with how deep the list is nested (dot, ring, square). */
class BulletWidget extends WidgetType {
  constructor(readonly shape: number) {
    super();
  }
  eq(other: BulletWidget) {
    return other.shape === this.shape;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = `cm-lp-bullet cm-lp-bullet-${this.shape}`;
    el.setAttribute("aria-hidden", "true");
    return el;
  }
}

/**
 * An ordered list's number, drawn in a marker-wide slot like a bullet, so the cursor on an empty
 * item goes where its text will start rather than just after the number.
 */
class NumberWidget extends WidgetType {
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
  constructor(readonly checked: boolean) {
    super();
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked;
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
    el.innerHTML = this.checked ? CHECK_SVG : "";
    slot.append(el);
    return slot;
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
    return el;
  }
  // A click puts the cursor here, which shows the Markdown.
  ignoreEvent() {
    return false;
  }
}

const imageCleanups = new WeakMap<HTMLElement, () => void>();

/** An image within text; one on a line of its own is drawn as a block by attachments.ts. */
class ImageWidget extends WidgetType {
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

const INLINE_STYLES: Record<string, [cls: string, mark: string]> = {
  Emphasis: ["cm-lp-em", "EmphasisMark"],
  StrongEmphasis: ["cm-lp-strong", "EmphasisMark"],
  Strikethrough: ["cm-lp-strike", "StrikethroughMark"],
  Highlight: ["cm-lp-highlight", "HighlightMark"],
  InlineCode: ["cm-lp-code", "CodeMark"],
};

function build(view: EditorView): DecorationSet {
  const { state } = view;
  const { doc } = state;
  // When the editor isn't focused, render everything.
  const selection = view.hasFocus ? state.selection.ranges : [];
  const touches = (from: number, to: number) => selection.some((r) => r.from <= to && r.to >= from);
  const lineActive = (pos: number) => {
    const line = doc.lineAt(pos);
    return touches(line.from, line.to);
  };

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
  const spaceAfter = (pos: number) => (doc.sliceString(pos, pos + 1) === " " ? pos + 1 : pos);
  const hideChildren = (node: SyntaxNode, name: string) => {
    for (let c = node.firstChild; c; c = c.nextSibling) if (c.name === name) hide(c.from, c.to);
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
      if (value) {
        const valueFrom = start + lead + value.from;
        const valueTo = start + lead + value.to;
        mark(valueFrom, valueTo, "cm-lp-kv-value");
        // What it copies is the value as it reads, without its Markdown.
        const plain = plainLine(doc.sliceString(valueFrom, valueTo)).trim();
        const widget = new CopyWidget(plain, `Copy ${plain}`);
        decos.push(Decoration.widget({ widget, side: 1 }).range(valueTo));
      }
      pos = line.to + 1;
    }
  };

  const codeLines = new Set<number>();
  /**
   * Lines inside cards: how far in, whether it's a `:::` fence, and on a callout's opening fence,
   * which callout and whether the cursor is in it. Inner cards overwrite outer ones.
   */
  const cardLines = new Map<
    number,
    { inset: CardInset; fence: boolean; top: boolean; callout?: { kind: string; icon: IconName | null; editing: boolean } }
  >();
  const { from, to } = view.viewport;
  syntaxTree(state).iterate({
    from,
    to,
    enter(ref) {
      const node = ref.node;
      const name = ref.name;

      if (name in INLINE_STYLES) {
        const [cls, markName] = INLINE_STYLES[name];
        mark(node.from, node.to, cls);
        if (!touches(node.from, node.to)) hideChildren(node, markName);
        return;
      }

      if (name.startsWith("ATXHeading")) {
        const level = name.slice(-1);
        lineClass(node.from, node.from, () => `cm-lp-h cm-lp-h${level}`);
        if (lineActive(node.from)) return;
        for (let c = node.firstChild; c; c = c.nextSibling) {
          if (c.name !== "HeaderMark") continue;
          if (c.from === node.from) hide(c.from, spaceAfter(c.to));
          else hide(doc.sliceString(c.from - 1, c.from) === " " ? c.from - 1 : c.from, c.to);
        }
        return;
      }

      switch (name) {
        case "SetextHeading1":
        case "SetextHeading2":
          lineClass(node.from, node.from, () => `cm-lp-h cm-lp-h${name.slice(-1)}`);
          return;

        case "Link": {
          const url = node.getChild("URL");
          const marks = node.getChildren("LinkMark");
          if (!url || marks.length < 2 || drawnAsBlock(state, node.node)) return;
          const textFrom = marks[0].to;
          const textTo = marks[1].from;
          mark(textFrom, textTo, "cm-lp-link", { "data-href": doc.sliceString(url.from, url.to) });
          if (!touches(node.from, node.to)) {
            hide(node.from, textFrom);
            hide(textTo, node.to);
          }
          return;
        }

        case "Autolink": {
          const url = node.getChild("URL");
          if (!url) return false;
          mark(url.from, url.to, "cm-lp-link", { "data-href": doc.sliceString(url.from, url.to) });
          if (!touches(node.from, node.to)) hideChildren(node, "LinkMark");
          return false;
        }

        case "URL": {
          // Bare URLs (GFM autolinks); URLs inside links are handled above.
          const parent = node.parent?.name;
          if (parent === "Link" || parent === "Image" || parent === "LinkReference") return;
          mark(node.from, node.to, "cm-lp-link", { "data-href": doc.sliceString(node.from, node.to) });
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

        case "Tag":
          mark(node.from, node.to, "cm-lp-tag");
          return false;

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
            if (!touches(listMark.from, marker.to)) {
              decos.push(Decoration.replace({ widget: new CheckboxWidget(checked) }).range(listMark.from, end));
            } else {
              mark(listMark.from, end, "cm-lp-list-marker");
            }
            if (checked) mark(end, task.to, "cm-lp-done");
            return;
          }
          decos.push(Decoration.line({ class: "cm-lp-li", attributes: { style } }).range(line.from));
          const end = spaceAfter(listMark.to);
          const number = node.parent?.name === "OrderedList";
          if (touches(listMark.from, listMark.to)) {
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
          lineClass(node.from, node.to, () => "cm-lp-quote");
          return;

        case "QuoteMark":
          if (!lineActive(node.from)) hide(node.from, spaceAfter(node.to));
          return;

        case "HorizontalRule":
          if (!lineActive(node.from)) {
            decos.push(Decoration.replace({ widget: rule }).range(node.from, node.to));
          }
          return false;

        case "FencedCode": {
          // Right after another code block or a card (no line between): a gap, so the two don't run together.
          const afterBlock = endsBlock(state, doc.lineAt(node.from).number - 1);
          lineClass(node.from, node.to, (n, first, last) => {
            codeLines.add(n);
            let cls = "cm-lp-codeblock";
            if (n === first) cls += " cm-lp-codeblock-first cm-lp-fence" + (afterBlock ? " cm-lp-codeblock-after" : "");
            if (n === last) {
              cls += " cm-lp-codeblock-last";
              if (n !== first && /^\s*(```|~~~)/.test(doc.line(n).text)) cls += " cm-lp-fence";
            }
            return cls;
          });
          // The ``` themselves show only while the cursor is on their line; the language stays as a label.
          for (const mark of node.node.getChildren("CodeMark")) if (!lineActive(mark.from)) hide(mark.from, mark.to);
          // A copy button in the block's top right corner, for the code without its fences.
          const code = node.node.getChild("CodeText");
          const text = code ? doc.sliceString(code.from, code.to) : "";
          const widget = new CopyWidget(text, "Copy code", "cm-lp-copy cm-lp-code-copy");
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
          const callout = found && { kind: found.kind, icon: found.icon, editing: touches(node.from, node.to) };
          for (let n = start; n <= end; n++) {
            const fence = isCardFence(doc.line(n).text, n, first, last);
            cardLines.set(n, { inset, fence, top: n === first + 1, callout: n === first && callout ? callout : undefined });
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

  for (const [n, { inset, fence, top, callout }] of cardLines) {
    const line = doc.line(n);
    let cls = "cm-lp-card";
    if (fence) cls += touches(line.from, line.to) ? " cm-lp-card-fence is-active" : " cm-lp-card-fence";
    else if (top) cls += " cm-lp-card-top";
    if (callout) {
      // The icon sits on the opening fence, so it's there whatever the first line inside is.
      cls += ` cm-lp-callout-head cm-lp-callout-${callout.kind}`;
      decos.push(Decoration.widget({ widget: new CalloutIcon(callout.icon, callout.editing), side: -1 }).range(line.from));
    }
    const style = `--card-depth: ${inset.depth}; --card-icons: ${inset.icons}`;
    decos.push(Decoration.line({ class: cls, attributes: { style } }).range(line.from));
  }

  // The title and the blank lines between paragraphs get their own, adjustable spacing.
  const title = titleLine(doc);
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
const blankDeco = Decoration.line({ class: "cm-lp-blank" });

/** The first non-empty line (other than a card's `:::`), which the note list also uses as the title. */
function titleLine(doc: Text) {
  for (let n = 1; n <= Math.min(doc.lines, 20); n++) {
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
}

/** Whether this click opens the link under it: with ⌘ (Ctrl), or a tap while not editing. */
export function opensLink(event: MouseEvent, view: EditorView) {
  const link = (event.target as HTMLElement).closest<HTMLElement>(".cm-lp-link");
  return !!link?.dataset.href && (event.metaKey || event.ctrlKey || (coarsePointer.matches && !view.hasFocus));
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = build(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        update.focusChanged ||
        update.startState.readOnly !== update.state.readOnly ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = build(update.view);
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
        if (opensLink(event, view)) {
          const link = target.closest<HTMLElement>(".cm-lp-link")!;
          const name = attachmentName(link.dataset.href!);
          void (name ? openAttachment(name, link.textContent ?? name) : openExternal(link.dataset.href!));
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
  },
);
