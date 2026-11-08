import { isolateHistory } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import { EditorSelection, type EditorState, type Extension, Prec } from "@codemirror/state";
import { EditorView, keymap, WidgetType } from "@codemirror/view";
import type { SyntaxNode, SyntaxNodeRef } from "@lezer/common";
import { mount, unmount } from "svelte";
import Icon from "../icons/Icon.svelte";
import type { IconName } from "../icons/icons";
import {
  ATTACHMENT_PATH,
  attachmentFileName,
  attachmentName,
  attachmentURL,
  extensionOf,
  getAttachment,
  imageSize,
  isImage,
  openAttachment,
  withWidth,
  saveAttachment,
  whenArrived,
} from "../notes/attachments";
import { coarsePointer } from "../platform";
import { locale, type MessageKey, t } from "../i18n/index.svelte";
import { plugins } from "../plugins/registry.svelte";
import type { Embed, EmbedLink, FileView, Renderer, Shown } from "../plugins/types";
import { actionBar, dropBar, resizeHandle } from "./actions";
import { cardInset, type CardInset, sameInset, setInset } from "./cards";
import { editDrawing, isDrawing, knownDrawing } from "./drawings";
import { giphyStill } from "./giphy";
import { addActions, fencedBlock, removeActions } from "./rendered";
import { isUnsplashPhoto, unsplashImage, unsplashPhoto } from "./unsplash";
import { ancestors, blockPos, drawnBlock, drawnBlocks, focused, INTERACTIVE, isEditing, OWN_INPUT, whenClicked } from "./util";

/*
 * Images and files in notes. One on a line of its own is drawn as a block in its place (the image,
 * or a card naming the file, below what a plugin shows of it: a 3D model to turn); with the cursor
 * on that line its Markdown shows, with the block below it. Such an image has a handle on its
 * corner that resizes it, written into its label as Obsidian does (`![Lake|400](…)`), and a
 * drawing (drawings.ts) a button to edit it. A file that a renderer plugin makes blocks from
 * (`Renderer.fromFiles`) has a button that puts its block in its place: a CSV file's spreadsheet.
 * A link a plugin draws (an embed: asciinema's embed code as the recording's player) is a block too.
 * Images within text are drawn inline by livePreview.ts, and files within text are links.
 * Pasting or dropping files, or the /image and /file commands, saves them on the device (see
 * notes/attachments.ts) and puts each on its own line.
 */

/**
 * Heights images were drawn at (by address and label, which holds the width), so a block that
 * scrolls back into view takes its place at once.
 */
const heights = new Map<string, number>();

/**
 * An `<img>` for a note's image, at the width its label gives (`|400`), or a quiet placeholder
 * while it can't be shown: an attachment that sync hasn't brought to this device yet (it appears
 * when it arrives), or a web image that didn't load. Calls `onChange` whenever its size may have
 * changed.
 */
export function imageElement(src: string, label: string, onChange: () => void): { dom: HTMLElement; destroy: () => void } {
  const dom = document.createElement("span");
  dom.className = "cm-lp-image-slot";
  const img = document.createElement("img");
  img.className = "cm-lp-image";
  const { alt, width } = imageSize(label);
  // An image with no alt text of its own is still named, so screen readers don't skip it or read its address.
  img.alt = alt || t("editor.image");
  img.draggable = false;
  if (width) setWidth(img, width);
  img.onload = () => {
    heights.set(`${src}\n${label}`, img.offsetHeight);
    onChange();
  };
  img.onerror = () => {
    dom.replaceChildren(placeholder(t("editor.imageFailed")));
    onChange();
  };
  let cancel = () => {};
  let gone = false;
  const name = attachmentName(src);
  if (!name) {
    img.src = unsplashImage(src) ?? giphyStill(src) ?? src;
    dom.append(img);
  } else {
    const show = () =>
      void attachmentURL(name).then((url) => {
        if (gone) return;
        if (url) {
          img.src = url;
          dom.replaceChildren(img);
        } else {
          dom.replaceChildren(placeholder(t("editor.imageNotHere")));
          cancel = whenArrived(name, show);
        }
        onChange();
      });
    show();
  }
  return {
    dom,
    destroy: () => {
      gone = true;
      cancel();
    },
  };
}

function placeholder(text: string) {
  const el = document.createElement("span");
  el.className = "cm-lp-image-missing";
  el.textContent = text;
  return el;
}

const ICONS: [RegExp, IconName][] = [
  [/^(pdf|txt|md|rtf|docx?|pages|odt|csv|xlsx?|numbers|pptx?|key)$/, "file-text"],
  [/^(mp4|mov|m4v|webm|avi|mkv)$/, "film"],
  [/^(mp3|m4a|wav|aac|flac|ogg|aiff?)$/, "music"],
  [/^(zip|gz|tgz|tar|7z|rar|dmg)$/, "archive"],
  [/^(png|jpg|gif|webp|avif|heic|svg)$/, "image"],
  [/^cast$/, "terminal"],
];

const oneDecimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

/** A size in bytes as people read it: 820 bytes, 1.2 KB, 14 MB. */
export function formatSize(bytes: number) {
  if (bytes < 1000) return t("editor.size.bytes", { count: bytes });
  const [value, unit]: [number, MessageKey] =
    bytes < 1e6 ? [bytes / 1e3, "editor.size.kb"] : bytes < 1e9 ? [bytes / 1e6, "editor.size.mb"] : [bytes / 1e9, "editor.size.gb"];
  return t(unit, { size: (value < 10 ? oneDecimal : whole).format(value) });
}

/** A card for an attached file: its kind, name and size, or a note that it hasn't arrived yet. */
function fileElement(name: string, label: string, onChange: () => void): { dom: HTMLElement; destroy: () => void } {
  const ext = extensionOf(name);
  const dom = document.createElement("span");
  dom.className = "cm-lp-file";
  dom.title = coarsePointer.matches ? "" : t("editor.file.open");
  const icon = document.createElement("span");
  icon.className = "cm-lp-file-icon";
  const iconName = ICONS.find(([pattern]) => pattern.test(ext))?.[1] ?? "paperclip";
  const component = mount(Icon, { target: icon, props: { name: iconName, size: 18, strokeWidth: 1.75 } });
  const text = document.createElement("span");
  text.className = "cm-lp-file-text";
  const title = document.createElement("span");
  title.className = "cm-lp-file-name";
  title.textContent = label || name;
  const meta = document.createElement("span");
  meta.className = "cm-lp-file-meta";
  text.append(title, meta);
  dom.append(icon, text);
  let cancel = () => {};
  let gone = false;
  const show = () =>
    void getAttachment(name).then((data) => {
      if (gone) return;
      dom.classList.toggle("is-missing", !data);
      meta.textContent = data ? t("editor.file.meta", { kind: ext.toUpperCase(), size: formatSize(data.size) }) : t("editor.file.notHere");
      if (!data) cancel = whenArrived(name, show);
      onChange();
    });
  show();
  return {
    dom,
    destroy: () => {
      gone = true;
      cancel();
      void unmount(component);
    },
  };
}

/** A file a plugin shows (`FileView`: a 3D model, a recording), above the card naming it, once it's on this device. */
function viewedFile(viewer: FileView, name: string, label: string, onChange: () => void): { dom: HTMLElement; destroy: () => void; shown: () => Shown | null } {
  const card = fileElement(name, label, onChange);
  const view = document.createElement("span");
  view.className = "cm-lp-file-view";
  const dom = document.createElement("span");
  dom.className = "cm-lp-viewed-file";
  dom.append(view, card.dom);
  let shown: Shown | null = null;
  let cancel = () => {};
  let gone = false;
  const show = () =>
    void getAttachment(name).then((data) => {
      if (gone) return;
      if (!data) return void (cancel = whenArrived(name, show));
      shown = viewer.show(view, { name, label: label || name, data });
      onChange();
    });
  show();
  return {
    dom,
    shown: () => shown,
    destroy: () => {
      gone = true;
      cancel();
      shown?.destroy();
      card.destroy();
    },
  };
}

const cleanups = new WeakMap<HTMLElement, () => void>();
/** What plugins show in blocks (a recording's player), by the block's element, to give it the keyboard. */
const shownBy = new WeakMap<HTMLElement, () => Shown | null>();

/** What a block draws: two blocks with the same draw the same thing. */
const blockKey = (block: Block) => [block.kind, block.src, block.label, block.embed?.link.image ?? ""].join("\n");

class BlockWidget extends WidgetType {
  constructor(
    readonly block: Block,
    /** How far in it sits, in cards. */
    readonly inset: CardInset,
    /** Drawn below its Markdown while the cursor is on it, rather than in its place. */
    readonly preview: boolean,
    /** Its Markdown is selected, so typing or Delete would replace it. */
    readonly selected = false,
    /** What makes a block from the file, for its button, so turning that plugin on or off draws it again. */
    readonly converter = block.kind === "file" ? plugins.blockFromFile(block.src) : undefined,
  ) {
    super();
  }
  eq(other: BlockWidget) {
    return (
      blockKey(other.block) === blockKey(this.block) &&
      sameInset(other.inset, this.inset) &&
      other.preview === this.preview &&
      other.selected === this.selected &&
      other.converter === this.converter
    );
  }
  #classes(dom: HTMLElement) {
    dom.className =
      `cm-lp-block cm-lp-${this.block.kind}-block` +
      (this.preview ? " is-preview" : "") +
      (this.selected ? " is-selected" : "");
    setInset(dom, this.inset);
  }
  toDOM(view: EditorView) {
    const { kind, src, label } = this.block;
    const dom = document.createElement("div");
    dom.dataset.src = src;
    dom.dataset.label = label;
    dom.dataset.key = blockKey(this.block);
    this.#classes(dom);
    dom.addEventListener("keydown", (event) => backToNote(view, dom, event), true);
    if (kind === "embed") {
      drawEmbed(view, dom, this.block);
      return dom;
    }
    const onChange = () => view.requestMeasure();
    const viewer = kind === "file" ? plugins.fileView(src) : undefined;
    const viewed = viewer && viewedFile(viewer, attachmentName(src)!, label, onChange);
    if (viewed) shownBy.set(dom, viewed.shown);
    const content = kind === "image" ? imageElement(src, label, onChange) : (viewed ?? fileElement(attachmentName(src)!, label, onChange));
    let destroy = content.destroy;
    // An image sits in a frame with its resize handle on its corner (and a drawing's edit button beside it).
    const frame = document.createElement("span");
    frame.className = "cm-lp-image-frame";
    frame.append(content.dom);
    dom.append(kind === "image" ? frame : content.dom);
    const { converter } = this;
    if (converter?.fromFiles) {
      const { label, icon } = converter.fromFiles;
      dom.dataset.converter = converter.id;
      const run = (view: EditorView, pos: number) => void convertFile(view, pos, converter).catch((error) => console.error("lines: couldn't convert", error));
      // Beside the card, not the whole line.
      const bar = addActions(view, dom, [{ label, icon, run }], content.dom);
      if (bar) content.dom.append(bar);
    }
    if (kind === "image") {
      const handle = resizeHandle(view, dom, "cm-lp-image-resize", {
        target: () => dom.querySelector<HTMLImageElement>(".cm-lp-image"),
        min: 48,
        max: () => {
          const style = getComputedStyle(dom);
          return dom.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        },
        show: setWidth,
        write: (width) => writeWidth(view, dom, width),
      });
      frame.append(handle);
    }
    const name = attachmentName(src);
    if (kind === "image" && name) {
      void isDrawing(name).then((drawing) => {
        // Not if it's gone meanwhile (scrolled away, say).
        if (!drawing || !cleanups.has(dom)) return;
        dom.dataset.drawing = "";
        const edit = document.createElement("button");
        edit.className = "cm-lp-action cm-lp-drawing-edit";
        edit.type = "button";
        // Not a Tab stop in the text: Enter on the selected drawing does the same.
        edit.tabIndex = -1;
        edit.title = t("editor.drawing.editHint");
        edit.setAttribute("aria-label", t("editor.drawing.edit"));
        const icon = mount(Icon, { target: edit, props: { name: "pencil", size: 15 } });
        const bar = actionBar(dom, frame);
        bar.append(edit);
        frame.append(bar);
        onChange();
        destroy = () => {
          content.destroy();
          dropBar(bar);
          void unmount(icon);
        };
        cleanups.set(dom, destroy);
      });
    }
    cleanups.set(dom, destroy);
    return dom;
  }
  /** Moving the cursor onto or off the block keeps it as it is. */
  updateDOM(dom: HTMLElement) {
    if (dom.dataset.key !== blockKey(this.block) || dom.dataset.converter !== this.converter?.id) return false;
    this.#classes(dom);
    return true;
  }
  destroy(dom: HTMLElement) {
    cleanups.get(dom)?.();
    cleanups.delete(dom);
    removeActions(dom);
  }
  get estimatedHeight() {
    if (this.block.kind !== "file") return heights.get(`${this.block.src}\n${this.block.label}`) ?? (this.block.kind === "image" ? 200 : 420);
    return plugins.fileView(this.block.src) ? 420 : 60;
  }
  /** What takes its own clicks and keys (a recording's player) has them; the rest selects the block. */
  ignoreEvent(event: Event) {
    return event.target instanceof Element && !!event.target.closest(OWN_INPUT);
  }
}

/** Esc in what takes its own keys (a recording's player) goes back to the note, with its block selected. */
function backToNote(view: EditorView, dom: HTMLElement, event: KeyboardEvent) {
  if (event.key !== "Escape" || !(event.target instanceof Element) || !event.target.closest(OWN_INPUT)) return;
  event.preventDefault();
  event.stopPropagation();
  const own = blockOnLine(view.state, view.state.doc.lineAt(blockPos(view, dom)).number);
  view.focus();
  if (own) selectBlock(view, own, true);
}

/** What a plugin draws for a link (embeds). */
function drawEmbed(view: EditorView, dom: HTMLElement, block: Block) {
  const { link, by } = block.embed!;
  const frame = document.createElement("div");
  frame.className = "cm-lp-embed";
  dom.append(frame);
  const drawn = by.draw(frame, link, () => {
    heights.set(`${block.src}\n${block.label}`, frame.offsetHeight);
    view.requestMeasure();
  });
  shownBy.set(dom, () => drawn);
  cleanups.set(dom, () => drawn.destroy());
}

/* Resizing images. */

function setWidth(img: HTMLImageElement, width: number) {
  img.style.width = `${width}px`;
  // A width chosen is kept, whatever its height.
  img.style.maxHeight = "none";
}

/** Writes an image's width into its label (`![Lake|400](…)`), or takes it out (null). */
function writeWidth(view: EditorView, dom: HTMLElement, width: number | null) {
  const block = blockOnLine(view.state, view.state.doc.lineAt(blockPos(view, dom)).number);
  if (!block || block.kind !== "image") return;
  const label = withWidth(block.label, width);
  if (label === block.label) return;
  // After "![".
  const from = block.from + 2;
  view.dispatch({ changes: { from, to: from + block.label.length, insert: label }, userEvent: "input.resize" });
}

/**
 * Puts the block `renderer` makes from the file on the line at `pos` in the file's place (a CSV
 * file's spreadsheet), with the cursor on the line after it, so it shows. Undo brings the file back.
 */
async function convertFile(view: EditorView, pos: number, renderer: Renderer) {
  const file = blockOnLine(view.state, view.state.doc.lineAt(pos).number);
  const name = file && attachmentName(file.src);
  const data = name && (await getAttachment(name));
  if (!file || !name || !data || !renderer.fromFiles) return;
  const { code, name: blockName } = await renderer.fromFiles.read({ name: attachmentFileName(name, file.label), data: new Uint8Array(await data.arrayBuffer()) });
  // The note may have changed while the file was read.
  const { state } = view;
  const line = state.doc.lineAt(Math.min(pos, state.doc.length));
  if (state.readOnly || !view.dom.isConnected || blockOnLine(state, line.number)?.src !== file.src) return;
  const insert = fencedBlock(renderer.languages[0], code, blockName);
  view.dispatch({
    // A line after it, for the cursor, if it ends the note.
    changes: { from: line.from, to: line.to, insert: line.to === state.doc.length ? `${insert}\n` : insert },
    selection: { anchor: line.from + insert.length + 1 },
    userEvent: "input",
    annotations: isolateHistory.of("full"),
  });
  view.focus();
}

/** An image or file drawn as a block, or a link a plugin draws (an embed), and where its Markdown is. */
interface Block {
  kind: "image" | "file" | "embed";
  from: number;
  to: number;
  /** The image's address, the file's, or the embed's link's (its image's, if it doesn't link). */
  src: string;
  /** The image's alt text, the file's name, or the embed's text. */
  label: string;
  embed?: { link: EmbedLink; by: Embed };
}

/** An `Image` or `Link` node's address and text (the alt text, for an image), and where its text is. */
function linkParts(state: EditorState, node: SyntaxNode) {
  const url = node.getChild("URL");
  const marks = node.getChildren("LinkMark");
  if (!url || marks.length < 2) return null;
  return { src: state.sliceDoc(url.from, url.to), label: state.sliceDoc(marks[0].to, marks[1].from), from: marks[0].to, to: marks[1].from };
}

/** An embed's block, if a plugin draws `link`. */
function embedBlock(node: SyntaxNode, link: EmbedLink): Block | null {
  const by = plugins.embed(link);
  return by ? { kind: "embed", from: node.from, to: node.to, src: link.href ?? link.image!, label: link.label, embed: { link, by } } : null;
}

/**
 * The image an `Image` node shows, or the attachment a `Link` node links to, or what a plugin draws
 * either as: an image that links somewhere too, as embed codes write a recording's (`[![…](picture)](address)`).
 */
function blockOf(state: EditorState, node: SyntaxNode): Block | null {
  const parts = linkParts(state, node);
  if (!parts) return null;
  const { src, label } = parts;
  if (node.name === "Image") {
    return embedBlock(node, { href: null, image: src, label }) ?? { kind: "image", from: node.from, to: node.to, src, label };
  }
  if (node.name !== "Link") return null;
  const image = node.getChild("Image");
  const shown = image?.from === parts.from && image.to === parts.to ? linkParts(state, image) : null;
  const text = label.replace(/\\(.)/g, "$1");
  const embed = embedBlock(node, { href: src, image: shown?.src ?? null, label: shown?.label ?? text });
  if (embed) return embed;
  return attachmentName(src) ? { kind: "file", from: node.from, to: node.to, src, label: text } : null;
}

/**
 * The block an image or attachment link is drawn as, if it's all there is on its line (apart
 * from spaces), in a paragraph that isn't in a list or quote. livePreview.ts leaves these alone.
 */
export function drawnAsBlock(state: EditorState, node: SyntaxNode): Block | null {
  const container = node.parent?.parent?.name;
  if (node.parent?.name !== "Paragraph" || (container !== "Document" && container !== "Card")) return null;
  const line = state.doc.lineAt(node.from);
  if (node.to > line.to || state.sliceDoc(line.from, line.to).trim() !== state.sliceDoc(node.from, node.to)) return null;
  return blockOf(state, node);
}

function drawBlock(state: EditorState, node: SyntaxNodeRef) {
  if (node.name !== "Image" && node.name !== "Link") return null;
  const block = drawnAsBlock(state, node.node);
  if (!block) return null;
  const line = state.doc.lineAt(node.from);
  const editing = isEditing(state, line.from, line.to);
  const selected = editing && state.selection.ranges.some((r) => r.from <= node.from && r.to >= node.to && !r.empty);
  return drawnBlock(new BlockWidget(block, cardInset(state, node.node), editing, selected), line.from, line.to, editing);
}

/** The block on line `n`, if there is one. */
function blockOnLine(state: EditorState, n: number) {
  if (n < 1 || n > state.doc.lines) return null;
  const line = state.doc.line(n);
  const start = line.from + (line.text.length - line.text.trimStart().length);
  if (!/^!?\[/.test(line.text.trimStart())) return null;
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(start, 1); node; node = node.parent) {
    if (node.name === "Image" || node.name === "Link") return drawnAsBlock(state, node);
  }
  return null;
}

const selectBlock = (view: EditorView, block: Block, forward: boolean) => {
  view.dispatch({
    selection: forward ? { anchor: block.from, head: block.to } : { anchor: block.to, head: block.from },
    scrollIntoView: true,
    userEvent: "select",
  });
  return true;
};

/** Whether the selection is exactly one block's Markdown, as clicking or arrowing to it leaves it. */
export function selectedBlock(state: EditorState) {
  const range = state.selection.main;
  if (state.selection.ranges.length > 1 || range.empty) return null;
  const block = blockOnLine(state, state.doc.lineAt(range.from).number);
  return block && block.from === range.from && block.to === range.to ? block : null;
}

/**
 * Up and down would skip over a block, as it has no lines of text to stop on. Instead they stop
 * on it, selecting it as a click does, and the next press moves on past it.
 */
function arrow(forward: boolean) {
  return (view: EditorView) => {
    const { state } = view;
    const range = state.selection.main;
    if (state.selection.ranges.length > 1) return false;
    const line = state.doc.lineAt(range.head);
    let from = range;
    if (!range.empty) {
      if (!selectedBlock(state)) return false;
      from = EditorSelection.cursor(forward ? line.to : line.from);
    } else if (state.doc.lineAt(view.moveVertically(range, forward).head).number === line.number) {
      // Within a line that wraps.
      return false;
    }
    const next = blockOnLine(state, line.number + (forward ? 1 : -1));
    if (next) return selectBlock(view, next, forward);
    if (range.empty) return false;
    // Off a selected block, to the line beyond it.
    const moved = view.moveVertically(from, forward);
    view.dispatch({ selection: moved.head === from.head ? from : moved, scrollIntoView: true, userEvent: "select" });
    return true;
  };
}

/**
 * Backspace just after a block (at the end of its line, or the start of the text below it)
 * selects it, and a second press deletes it, rather than unpicking its Markdown or merging text in.
 */
function backspace(view: EditorView) {
  const { state } = view;
  const range = state.selection.main;
  if (state.selection.ranges.length > 1 || !range.empty || state.readOnly) return false;
  const line = state.doc.lineAt(range.head);
  const own = blockOnLine(state, line.number);
  if (own && range.head === own.to) return selectBlock(view, own, false);
  const above = range.head === line.from && line.text.trim() ? blockOnLine(state, line.number - 1) : null;
  return above ? selectBlock(view, above, false) : false;
}

/**
 * Enter on a selected drawing opens it, and on what a plugin shows that takes the keyboard (a
 * recording) gives it the keyboard, rather than replacing it with a new line.
 */
function openBlock(view: EditorView) {
  const block = selectedBlock(view.state);
  if (!block) return false;
  const line = view.state.doc.lineAt(block.from).number;
  const dom = [...view.contentDOM.querySelectorAll<HTMLElement>(".cm-lp-block")].find((each) => view.state.doc.lineAt(blockPos(view, each)).number === line);
  const shown = dom && shownBy.get(dom)?.();
  if (shown?.focus) {
    shown.focus();
    return true;
  }
  if (block.kind !== "image" || !knownDrawing(block.src) || view.state.readOnly) return false;
  void editDrawing(view, block.src, block.from);
  return true;
}

const blockKeymap = Prec.high(
  keymap.of([
    { key: "ArrowUp", run: arrow(false) },
    { key: "ArrowDown", run: arrow(true) },
    { key: "Backspace", run: backspace },
    { key: "Enter", run: openBlock },
  ]),
);

/**
 * Clicking a block selects its Markdown, so it can be deleted, cut or typed over; one drawn to work
 * with (a 3D model) is dragged instead, and only a click that isn't a drag selects it.
 * Double-clicking (or ⌘-clicking, or tapping while not editing) opens an attachment, or edits a
 * drawing, as its button does.
 */
const clickToSelect = EditorView.domEventHandlers({
  mousedown(event, view) {
    const dom = (event.target as HTMLElement).closest<HTMLElement>(".cm-lp-block");
    if (!dom) return false;
    event.preventDefault();
    // The resize handle's own (resizeHandle).
    if ((event.target as HTMLElement).closest(".cm-lp-image-resize")) return true;
    const src = dom.dataset.src ?? "";
    const name = attachmentName(src);
    // A tap opens a file when not editing, but not on what's drawn of it to work with (a 3D model).
    const interactive = !!(event.target as HTMLElement).closest(INTERACTIVE);
    const opens = event.detail === 2 || event.metaKey || event.ctrlKey || (coarsePointer.matches && !view.hasFocus && !interactive);
    const button = !!(event.target as HTMLElement).closest(".cm-lp-drawing-edit");
    if ("drawing" in dom.dataset && event.button === 0 && (opens || button) && !view.state.readOnly) {
      void editDrawing(view, src, view.state.doc.lineAt(blockPos(view, dom)).from);
      return true;
    }
    // Its other buttons (addActions') act on click.
    if ((event.target as HTMLElement).closest(".cm-lp-actions")) return true;
    if (name && event.button === 0 && opens) {
      void openAttachment(name, dom.dataset.label || name).catch((error) => console.error("lines: couldn't open", error));
      return true;
    }
    if (event.button !== 0 || view.state.readOnly) return true;
    const select = () => {
      if (!dom.isConnected) return;
      const line = view.state.doc.lineAt(blockPos(view, dom));
      const from = line.from + (/^\s*/.exec(line.text)?.[0].length ?? 0);
      view.dispatch({ selection: { anchor: from, head: line.to } });
      view.focus();
    };
    if (interactive) whenClicked(event, select);
    else select();
    return true;
  },
});

/* Adding images and files. */

/**
 * The image to save for a file: as it is if it's a kind every browser shows, else converted to
 * PNG (TIFF and BMP, say, which come from some Mac apps). Null if it isn't an image, or one this
 * browser can't read, which is then attached as a file.
 */
async function normalize(file: File): Promise<Blob | null> {
  if (isImage(file)) return file;
  if (!file.type.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    bitmap.close();
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  } catch {
    return null;
  }
}

/**
 * How a note's format writes what's pasted or dropped into it: Markdown (`![](…)`, `[Name](…)`), or
 * LaTeX (latex.ts), and where in the note an attachment can't go (code, tables…).
 */
export interface AttachmentWriter {
  image(src: string, alt: string): string;
  file(href: string, name: string): string;
  allowed(state: EditorState, pos: number): boolean;
}

/** Saves a file and returns how `writer` writes it: an image, or a link named after the file. */
async function attach(file: File, writer: AttachmentWriter): Promise<string | null> {
  try {
    const image = await normalize(file);
    if (image) return writer.image(ATTACHMENT_PATH + (await saveAttachment(image)), "");
    return writer.file(ATTACHMENT_PATH + (await saveAttachment(file)), file.name || t("editor.file.name"));
  } catch (error) {
    // A folder dropped from Finder, say, which can't be read as a file.
    console.error("lines: couldn't attach", file.name, error);
    return null;
  }
}

/** Code and tables, where an attachment can't go. */
const NO_ATTACHMENTS = new Set(["FencedCode", "CodeBlock", "InlineCode", "Table", "HTMLBlock"]);

function canAttach(state: EditorState, pos: number) {
  for (const node of ancestors(state, pos, -1)) if (NO_ATTACHMENTS.has(node.name)) return false;
  return true;
}

const escapeLabel = (text: string) => text.replace(/[\\[\]]/g, "\\$&");

const markdownWriter: AttachmentWriter = {
  image: (src, alt) => `![${escapeLabel(alt)}](${src})`,
  file: (href, name) => `[${escapeLabel(name)}](${href})`,
  allowed: canAttach,
};

const allowed = (writer: AttachmentWriter, state: EditorState, pos: number) => !state.readOnly && writer.allowed(state, pos);

/**
 * Saves `files` and puts them at `from`–`to` (replacing any selection there), each on a line of
 * its own, with the cursor on the line after them so they show at once. `snap` puts them above
 * or below the line instead of splitting its text, as a drop does.
 */
async function insertFiles(view: EditorView, writer: AttachmentWriter, files: File[], from: number, to = from, snap = false) {
  const saved = (await Promise.all(files.map((file) => attach(file, writer)))).filter((text): text is string => !!text);
  if (!saved.length || !view.dom.isConnected) return;
  const { doc } = view.state;
  // The note may have changed while the files were saved.
  from = Math.min(from, doc.length);
  to = Math.min(Math.max(to, from), doc.length);
  const markdown = saved.join("\n");
  if (snap) {
    // Above or below the line, whichever edge is nearer; the cursor stays where it was.
    const line = doc.lineAt(from);
    const above = !line.text.trim() || from - line.from < line.to - from;
    const changes = view.state.changes(
      above ? { from: line.from, insert: markdown + "\n" } : { from: line.to, insert: "\n" + markdown },
    );
    // A cursor at the edge the files go in at stays on its own line, not on theirs.
    view.dispatch({ changes, selection: view.state.selection.map(changes, above ? 1 : -1), userEvent: "input.drop" });
    view.focus();
    return;
  }
  insertLines(view, markdown, from, to, "input.paste");
}

/** Puts `markdown` at `from`–`to` on a line of its own, with the cursor on the line after it so it shows at once. */
function insertLines(view: EditorView, markdown: string, from: number, to: number, userEvent: string) {
  const line = view.state.doc.lineAt(from);
  const before = view.state.doc.sliceString(line.from, from).trim() ? "\n" : "";
  const insert = before + markdown + "\n";
  view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length }, scrollIntoView: true, userEvent });
  view.focus();
}

/** Puts an image from the web (/unsplash, /giphy) where the cursor is in a Markdown note, unless it can't go there. */
export function insertWebImage(view: EditorView, src: string, alt: string) {
  const { from, to } = view.state.selection.main;
  if (!view.dom.isConnected || !allowed(markdownWriter, view.state, from)) return;
  insertLines(view, markdownWriter.image(src, alt), from, to, "input");
}

/** Text copied along with a file that's only its name or address, as Finder and browsers add. */
const FILE_LABEL = /^(?:\S+\.[a-z0-9]{1,10}|https?:\/\/\S+)$/i;

/** What a plugin writes a link pasted on an empty line as, if it draws it (an asciinema recording's embed code). */
function pastedEmbed(link: string) {
  for (const embed of plugins.embeds) {
    const markdown = embed.paste?.(link);
    if (markdown) return markdown;
  }
  return null;
}

/**
 * Pasting a link on an empty line can put what it links to there: an Unsplash photo (its page, or
 * the picture), or with `embeds` what a plugin draws (an asciinema recording). The link goes in as
 * text first, so undo turns it back into the link.
 */
const pasteLink = (writer: AttachmentWriter, embeds: boolean) => EditorView.domEventHandlers({
  paste(event, view) {
    const { state } = view;
    const link = event.clipboardData?.getData("text/plain").trim() ?? "";
    const range = state.selection.main;
    if (!/^https?:\/\/\S+$/i.test(link) || state.selection.ranges.length > 1 || !range.empty) return false;
    if (state.doc.lineAt(range.from).text.trim() || !allowed(writer, state, range.from)) return false;
    const markdown = isUnsplashPhoto(link) ? writer.image(link, unsplashPhoto(link)?.alt ?? "") : embeds ? pastedEmbed(link) : null;
    if (!markdown) return false;
    event.preventDefault();
    const { from } = range;
    view.dispatch({
      changes: { from, insert: link },
      selection: { anchor: from + link.length },
      userEvent: "input.paste",
      scrollIntoView: true,
    });
    const insert = `${markdown}\n`;
    view.dispatch({
      changes: { from, to: from + link.length, insert },
      // On the line below, so what it links to shows.
      selection: { anchor: from + insert.length },
      annotations: isolateHistory.of("before"),
      userEvent: "input.paste",
      scrollIntoView: true,
    });
    return true;
  },
});

const dropAndPaste = (writer: AttachmentWriter) => EditorView.domEventHandlers({
  paste(event, view) {
    const data = event.clipboardData;
    const files = [...(data?.files ?? [])];
    if (!data || !files.length) return false;
    // Text copied with a picture (a paragraph from a document, cells from a spreadsheet) wins.
    const text = data.getData("text/plain").trim();
    if (text && !FILE_LABEL.test(text) && !files.some((file) => file.name === text)) return false;
    const { main } = view.state.selection;
    if (!allowed(writer, view.state, main.from)) return false;
    event.preventDefault();
    void insertFiles(view, writer, files, main.from, main.to);
    return true;
  },
  dragover(event, view) {
    if (!event.dataTransfer?.types.includes("Files") || view.state.readOnly) return false;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    return true;
  },
  drop(event, view) {
    const files = [...(event.dataTransfer?.files ?? [])];
    if (!files.length) return false;
    event.preventDefault();
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }, false);
    if (!allowed(writer, view.state, pos)) return true;
    void insertFiles(view, writer, files, pos, pos, true);
    return true;
  },
});

let picker: HTMLInputElement | undefined;

/** The /image and /file commands: choose files from the device, put in place of the typed command as `writer` writes them. */
export function choose(accept: string, writer = markdownWriter) {
  return (view: EditorView, from: number, to: number) => {
    view.dispatch({ changes: { from, to }, userEvent: "delete" });
    if (!picker) {
      picker = Object.assign(document.createElement("input"), { type: "file", multiple: true, hidden: true });
      // iOS only opens the picker for an input that's in the page.
      document.body.append(picker);
    }
    picker.accept = accept;
    picker.value = "";
    picker.onchange = () => {
      const files = [...(picker!.files ?? [])];
      const pos = view.state.selection.main.head;
      if (files.length && allowed(writer, view.state, pos)) void insertFiles(view, writer, files, pos);
    };
    picker.click();
  };
}

export const chooseImages = choose("image/*");
export const chooseFiles = choose("");

/** Pasting and dropping files, and pasting links to Unsplash photos (and with `embeds` what plugins draw), written by `writer`. */
export const attachmentPasting = (writer: AttachmentWriter, { embeds = false } = {}): Extension => [dropAndPaste(writer), pasteLink(writer, embeds)];

export const attachmentBlocks: Extension = [
  focused,
  drawnBlocks(drawBlock, { inside: ["Document", "Card", "Paragraph"] }),
  blockKeymap,
  clickToSelect,
  attachmentPasting(markdownWriter, { embeds: true }),
];
