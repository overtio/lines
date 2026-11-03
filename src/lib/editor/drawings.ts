import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { mount, unmount } from "svelte";
import { t } from "../i18n/index.svelte";
import { ATTACHMENT_PATH, attachmentName, getAttachment, saveAttachment } from "../notes/attachments";
import { fenceLanguage } from "./rendered";

/*
 * Drawings: Excalidraw sketches kept as SVG attachments with their scene inside, as excalidraw.com
 * saves them with "Embed scene". A note shows one as the image it is, here and in any Markdown app;
 * lines also opens it in Excalidraw (DrawingEditor.svelte) to change, and Save puts the result in as
 * a new attachment in its place. /drawing starts one, and a Mermaid diagram's button
 * (plugins/mermaid) starts one from a copy of the diagram.
 */

/** What an SVG that holds its Excalidraw scene says. */
const SCENE = "payload-type:application/vnd.excalidraw+json";

const known = new Map<string, Promise<boolean>>();
/** The attachments found to be drawings so far, for answers that can't wait (a key press). */
const found = new Set<string>();

/** Whether an attachment is a drawing lines can open in Excalidraw. */
export function isDrawing(name: string): Promise<boolean> {
  if (!name.endsWith(".svg")) return Promise.resolve(false);
  let drawing = known.get(name);
  if (!drawing) {
    drawing = getAttachment(name).then(async (data) => {
      // Not on this device yet: asked again when it's shown.
      if (!data) known.delete(name);
      const yes = !!data && (await data.text()).includes(SCENE);
      if (yes) found.add(name);
      return yes;
    });
    known.set(name, drawing);
  }
  return drawing;
}

/** Whether `src` is known to be a drawing already. */
export const knownDrawing = (src: string) => found.has(attachmentName(src) ?? "");

let open = false;

/**
 * Opens Excalidraw full-window on a drawing, on a Mermaid diagram's code turned into shapes, or on
 * a blank one; `onsave` gets the SVG on Save. Closed, it leaves the cursor back in the note.
 */
async function openEditor(
  view: EditorView,
  scene: Blob | null,
  onsave: (svg: Blob) => Promise<void>,
  mermaid: string | null = null,
) {
  if (open) return;
  open = true;
  try {
    const { default: DrawingEditor } = await import("../components/DrawingEditor.svelte");
    const editor = mount(DrawingEditor, {
      target: document.body,
      props: {
        scene,
        mermaid,
        onsave,
        onclose: () => {
          void unmount(editor);
          open = false;
          if (view.dom.isConnected) view.focus();
        },
      },
    });
  } catch (error) {
    open = false;
    throw error;
  }
}

/** Opens the drawing at `src` (its Markdown at `from`), and puts what's saved in its place. */
export async function editDrawing(view: EditorView, src: string, from: number) {
  const name = attachmentName(src);
  const data = name && (await getAttachment(name));
  if (!data || view.state.readOnly) return;
  await openEditor(view, data, async (svg) => {
    const next = ATTACHMENT_PATH + (await saveAttachment(svg));
    if (next === src || !view.dom.isConnected) return;
    // Where the note links to it, nearest where it was (sync may have changed the note meanwhile).
    const text = view.state.doc.toString();
    const link = `](${src})`;
    let at = -1;
    for (let i = text.indexOf(link); i >= 0; i = text.indexOf(link, i + 1)) {
      if (at < 0 || Math.abs(i - from) < Math.abs(at - from)) at = i;
    }
    if (at < 0) return;
    view.dispatch({ changes: { from: at + 2, to: at + 2 + src.length, insert: next }, userEvent: "input.drawing" });
  });
}

/** The /drawing command: a blank drawing, put on a line of its own where the command was typed. */
export function newDrawing(view: EditorView, from: number, to: number) {
  view.dispatch({ changes: { from, to }, userEvent: "delete" });
  void openEditor(view, null, async (svg) => {
    const src = ATTACHMENT_PATH + (await saveAttachment(svg));
    if (!view.dom.isConnected) return;
    const { doc } = view.state;
    const pos = Math.min(from, doc.length);
    const line = doc.lineAt(pos);
    const insert = (doc.sliceString(line.from, pos).trim() ? "\n" : "") + `![${t("editor.drawing")}](${src})\n`;
    view.dispatch({
      changes: { from: pos, insert },
      selection: { anchor: pos + insert.length },
      scrollIntoView: true,
      userEvent: "input.drawing",
    });
  });
}

/** The Mermaid code block at or around `pos`: where it starts and ends, and its code. */
function diagramAt(state: EditorState, pos: number) {
  for (const side of [1, -1] as const) {
    for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side); node; node = node.parent) {
      if (node.name !== "FencedCode") continue;
      const info = node.getChild("CodeInfo");
      if (!info || fenceLanguage(state.sliceDoc(info.from, info.to)) !== "mermaid") return null;
      const code = node.getChild("CodeText");
      return { from: node.from, to: node.to, source: code ? state.sliceDoc(code.from, code.to) : "" };
    }
  }
  return null;
}

/**
 * A Mermaid diagram's "Copy and Edit as Drawing": opens its code in Excalidraw as shapes, and Save
 * puts the drawing on a line of its own below the code block, which stays as it is.
 */
export function drawingFromDiagram(view: EditorView, pos: number) {
  const diagram = diagramAt(view.state, pos);
  if (!diagram || !diagram.source.trim() || view.state.readOnly) return;
  void openEditor(
    view,
    null,
    async (svg) => {
      const src = ATTACHMENT_PATH + (await saveAttachment(svg));
      if (!view.dom.isConnected) return;
      const { state } = view;
      // Below the block, found again by its code nearest where it was (sync may have changed the note).
      const blocks: { from: number; to: number }[] = [];
      syntaxTree(state).iterate({
        enter(node) {
          if (node.name !== "FencedCode") return;
          const found = diagramAt(state, node.from);
          if (found?.source === diagram.source) blocks.push(found);
          return false;
        },
      });
      const distance = (block: { from: number }) => Math.abs(block.from - diagram.from);
      const block = blocks.sort((a, b) => distance(a) - distance(b))[0];
      const end = state.doc.lineAt(block ? block.to : Math.min(diagram.to, state.doc.length));
      const next = end.number < state.doc.lines ? state.doc.line(end.number + 1) : null;
      const insert = `\n\n![${t("editor.drawing")}](${src})` + (next && next.text.trim() ? "\n" : "");
      // The cursor stays where it was, so the new drawing shows as one rather than as its Markdown.
      view.dispatch({
        changes: { from: end.to, insert },
        effects: EditorView.scrollIntoView(end.to + insert.trimEnd().length, { y: "nearest" }),
        userEvent: "input.drawing",
      });
    },
    diagram.source,
  );
}
