import { syntaxTree } from "@codemirror/language";
import { EditorSelection, type EditorState, type Extension, Prec, type Range, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { mount, unmount } from "svelte";
import Icon from "../icons/Icon.svelte";
import type { IconName } from "../icons/icons";
import {
  ATTACHMENT_PATH,
  attachmentName,
  attachmentURL,
  getAttachment,
  isImage,
  openAttachment,
  saveAttachment,
  whenArrived,
} from "../notes/attachments";
import { coarsePointer } from "../platform";
import { cardInset, type CardInset, sameInset, setInset } from "./cards";
import { ancestors, focusChanged, focused, isEditing } from "./util";

/*
 * Images and files in notes. One on a line of its own is drawn as a block in its place (the image,
 * or a card naming the file); with the cursor on that line its Markdown shows, with the block
 * below it. Images within text are drawn inline by livePreview.ts, and files within text are links.
 * Pasting or dropping files, or the /image and /file commands, saves them on the device (see
 * notes/attachments.ts) and puts each on its own line.
 */

/** Heights images were drawn at, so a block that scrolls back into view takes its place at once. */
const heights = new Map<string, number>();

/**
 * An `<img>` for a note's image, or a quiet placeholder while it can't be shown: an attachment
 * that sync hasn't brought to this device yet (it appears when it arrives), or a web image that
 * didn't load. Calls `onChange` whenever its size may have changed.
 */
export function imageElement(src: string, alt: string, onChange: () => void): { dom: HTMLElement; destroy: () => void } {
  const dom = document.createElement("span");
  dom.className = "cm-lp-image-slot";
  const img = document.createElement("img");
  img.className = "cm-lp-image";
  img.alt = alt;
  img.draggable = false;
  img.onload = () => {
    heights.set(src, img.offsetHeight);
    onChange();
  };
  img.onerror = () => {
    dom.replaceChildren(placeholder("This image couldn't be shown"));
    onChange();
  };
  let cancel = () => {};
  const name = attachmentName(src);
  if (!name) {
    img.src = src;
    dom.append(img);
  } else {
    const show = () =>
      void attachmentURL(name).then((url) => {
        if (url) {
          img.src = url;
          dom.replaceChildren(img);
        } else {
          dom.replaceChildren(placeholder("This image isn't on this device yet"));
          cancel = whenArrived(name, show);
        }
        onChange();
      });
    show();
  }
  return { dom, destroy: () => cancel() };
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
];

function formatSize(bytes: number) {
  if (bytes < 1000) return `${bytes} bytes`;
  const [value, unit] =
    bytes < 1e6 ? [bytes / 1e3, "KB"] : bytes < 1e9 ? [bytes / 1e6, "MB"] : [bytes / 1e9, "GB"];
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${unit}`;
}

/** A card for an attached file: its kind, name and size, or a note that it hasn't arrived yet. */
function fileElement(name: string, label: string, onChange: () => void): { dom: HTMLElement; destroy: () => void } {
  const ext = name.slice(name.lastIndexOf(".") + 1);
  const dom = document.createElement("span");
  dom.className = "cm-lp-file";
  dom.title = coarsePointer.matches ? "" : "Double-click to open";
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
  const show = () =>
    void getAttachment(name).then((data) => {
      dom.classList.toggle("is-missing", !data);
      meta.textContent = data ? `${ext.toUpperCase()} · ${formatSize(data.size)}` : "Not on this device yet";
      if (!data) cancel = whenArrived(name, show);
      onChange();
    });
  show();
  return {
    dom,
    destroy: () => {
      cancel();
      void unmount(component);
    },
  };
}

const cleanups = new WeakMap<HTMLElement, () => void>();

class BlockWidget extends WidgetType {
  constructor(
    readonly block: Block,
    /** How far in it sits, in cards. */
    readonly inset: CardInset,
    /** Drawn below its Markdown while the cursor is on it, rather than in its place. */
    readonly preview: boolean,
    /** Its Markdown is selected, so typing or Delete would replace it. */
    readonly selected = false,
  ) {
    super();
  }
  eq(other: BlockWidget) {
    return (
      other.block.kind === this.block.kind &&
      other.block.src === this.block.src &&
      other.block.label === this.block.label &&
      sameInset(other.inset, this.inset) &&
      other.preview === this.preview &&
      other.selected === this.selected
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
    this.#classes(dom);
    const onChange = () => view.requestMeasure();
    const content = kind === "image" ? imageElement(src, label, onChange) : fileElement(attachmentName(src)!, label, onChange);
    dom.append(content.dom);
    cleanups.set(dom, content.destroy);
    return dom;
  }
  /** Moving the cursor onto or off the block keeps it as it is. */
  updateDOM(dom: HTMLElement) {
    if (dom.dataset.src !== this.block.src || dom.dataset.label !== this.block.label) return false;
    this.#classes(dom);
    return true;
  }
  destroy(dom: HTMLElement) {
    cleanups.get(dom)?.();
  }
  get estimatedHeight() {
    return this.block.kind === "file" ? 60 : (heights.get(this.block.src) ?? 200);
  }
  ignoreEvent() {
    return false;
  }
}

/** An image or file drawn as a block, and where its Markdown is. */
interface Block {
  kind: "image" | "file";
  from: number;
  to: number;
  src: string;
  /** The image's alt text, or the file's name. */
  label: string;
}

/** The image an `Image` node shows, or the attachment a `Link` node links to. */
function blockOf(state: EditorState, node: SyntaxNode): Block | null {
  const url = node.getChild("URL");
  const marks = node.getChildren("LinkMark");
  if (!url || marks.length < 2) return null;
  const src = state.sliceDoc(url.from, url.to);
  const label = state.sliceDoc(marks[0].to, marks[1].from);
  if (node.name === "Image") return { kind: "image", from: node.from, to: node.to, src, label };
  if (node.name === "Link" && attachmentName(src)) {
    return { kind: "file", from: node.from, to: node.to, src, label: label.replace(/\\(.)/g, "$1") };
  }
  return null;
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

function buildBlocks(state: EditorState): DecorationSet {
  const decos: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      // Blocks are in top-level paragraphs or cards; nothing else needs a look inside.
      if (node.name === "Document" || node.name === "Card" || node.name === "Paragraph") return true;
      if (node.name !== "Image" && node.name !== "Link") return false;
      const block = drawnAsBlock(state, node.node);
      if (!block) return false;
      const line = state.doc.lineAt(node.from);
      const inset = cardInset(state, node.node);
      if (isEditing(state, line.from, line.to)) {
        const selected = state.selection.ranges.some((r) => r.from <= node.from && r.to >= node.to && !r.empty);
        const widget = new BlockWidget(block, inset, true, selected);
        decos.push(Decoration.widget({ widget, block: true, side: 1 }).range(line.to));
      } else {
        const widget = new BlockWidget(block, inset, false);
        decos.push(Decoration.replace({ widget, block: true }).range(line.from, line.to));
      }
      return false;
    },
  });
  return Decoration.set(decos, true);
}

const blocks = StateField.define<DecorationSet>({
  create: buildBlocks,
  update(decos, tr) {
    if (tr.docChanged || tr.selection || focusChanged(tr) || syntaxTree(tr.startState) !== syntaxTree(tr.state)) {
      return buildBlocks(tr.state);
    }
    return decos;
  },
  provide: (field) => EditorView.decorations.from(field),
});

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

const blockKeymap = Prec.high(
  keymap.of([
    { key: "ArrowUp", run: arrow(false) },
    { key: "ArrowDown", run: arrow(true) },
    { key: "Backspace", run: backspace },
  ]),
);

/**
 * Clicking a block selects its Markdown, so it can be deleted, cut or typed over. Double-clicking
 * (or ⌘-clicking, or tapping while not editing) opens an attachment.
 */
const clickToSelect = EditorView.domEventHandlers({
  mousedown(event, view) {
    const dom = (event.target as HTMLElement).closest<HTMLElement>(".cm-lp-block");
    if (!dom) return false;
    event.preventDefault();
    const name = attachmentName(dom.dataset.src ?? "");
    const opens = event.detail === 2 || event.metaKey || event.ctrlKey || (coarsePointer.matches && !view.hasFocus);
    if (name && event.button === 0 && opens) {
      void openAttachment(name, dom.dataset.label || name).catch((error) => console.error("lines: couldn't open", error));
      return true;
    }
    if (event.button !== 0 || view.state.readOnly) return true;
    const pos = view.posAtDOM(dom);
    // A preview sits after its line's end; the block it shows is on that line.
    const line = view.state.doc.lineAt(dom.classList.contains("is-preview") ? Math.max(0, pos - 1) : pos);
    const from = line.from + (/^\s*/.exec(line.text)?.[0].length ?? 0);
    view.dispatch({ selection: { anchor: from, head: line.to } });
    view.focus();
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

/** Saves a file and returns the Markdown for it: an image, or a link named after the file. */
async function attach(file: File): Promise<string | null> {
  try {
    const image = await normalize(file);
    if (image) return `![](${ATTACHMENT_PATH}${await saveAttachment(image)})`;
    const label = (file.name || "File").replace(/[\\[\]]/g, "\\$&");
    return `[${label}](${ATTACHMENT_PATH}${await saveAttachment(file)})`;
  } catch (error) {
    // A folder dropped from Finder, say, which can't be read as a file.
    console.error("lines: couldn't attach", file.name, error);
    return null;
  }
}

/** Code and tables, where an attachment can't go. */
const NO_ATTACHMENTS = new Set(["FencedCode", "CodeBlock", "InlineCode", "Table", "HTMLBlock"]);

function canAttach(state: EditorState, pos: number) {
  if (state.readOnly) return false;
  for (const node of ancestors(state, pos, -1)) if (NO_ATTACHMENTS.has(node.name)) return false;
  return true;
}

/**
 * Saves `files` and puts them at `from`–`to` (replacing any selection there), each on a line of
 * its own, with the cursor on the line after them so they show at once. `snap` puts them above
 * or below the line instead of splitting its text, as a drop does.
 */
async function insertFiles(view: EditorView, files: File[], from: number, to = from, snap = false) {
  const saved = (await Promise.all(files.map(attach))).filter((markdown): markdown is string => !!markdown);
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
  const line = doc.lineAt(from);
  const before = doc.sliceString(line.from, from).trim() ? "\n" : "";
  const insert = before + markdown + "\n";
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
    scrollIntoView: true,
    userEvent: "input.paste",
  });
  view.focus();
}

/** Text copied along with a file that's only its name or address, as Finder and browsers add. */
const FILE_LABEL = /^(?:\S+\.[a-z0-9]{1,10}|https?:\/\/\S+)$/i;

const dropAndPaste = EditorView.domEventHandlers({
  paste(event, view) {
    const data = event.clipboardData;
    const files = [...(data?.files ?? [])];
    if (!data || !files.length) return false;
    // Text copied with a picture (a paragraph from a document, cells from a spreadsheet) wins.
    const text = data.getData("text/plain").trim();
    if (text && !FILE_LABEL.test(text) && !files.some((file) => file.name === text)) return false;
    const { main } = view.state.selection;
    if (!canAttach(view.state, main.from)) return false;
    event.preventDefault();
    void insertFiles(view, files, main.from, main.to);
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
    if (!canAttach(view.state, pos)) return true;
    void insertFiles(view, files, pos, pos, true);
    return true;
  },
});

let picker: HTMLInputElement | undefined;

/** The /image and /file commands: choose files from the device, put in place of the typed command. */
function choose(accept: string) {
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
      if (files.length && canAttach(view.state, pos)) void insertFiles(view, files, pos);
    };
    picker.click();
  };
}

export const chooseImages = choose("image/*");
export const chooseFiles = choose("");

export const attachmentBlocks: Extension = [focused, blocks, blockKeymap, clickToSelect, dropAndPaste];
