import { EditorView } from "@codemirror/view";
import { notes } from "../lib/notes/store.svelte";
import { plugins } from "../lib/plugins/registry.svelte";
import { prefs } from "../lib/prefs.svelte";

/*
 * What the browser tests (tests/browser/) use inside the page, in builds made with `--mode test`
 * only: the open note's editor, Settings as the app keeps them, and a way to open a note of any
 * format with any text.
 */

const editor = () => {
  const dom = document.querySelector<HTMLElement>(".editor-pane .cm-editor");
  return dom ? EditorView.findFromDOM(dom) : null;
};

/** Resolves once `ready()` is true, checked each frame; rejects after `timeout` ms. */
async function until(ready: () => unknown, timeout = 10_000) {
  const start = performance.now();
  while (!ready()) {
    if (performance.now() - start > timeout) throw new Error("timed out");
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

const testing = {
  notes,
  plugins,
  prefs,
  editor,
  until,
  /** The open note's text. */
  text: () => editor()?.state.doc.toString() ?? null,
  /** Adds a note with this text, in `format` (Markdown if left out), and opens it, once its editor shows it. */
  async open(body: string, format?: string) {
    const now = Date.now();
    const id = crypto.randomUUID();
    await notes.insert({ id, body, format, createdAt: now, updatedAt: now, pinned: false, trashed: false });
    notes.select(id);
    await until(() => editor()?.state.doc.toString() === body);
    return id;
  },
  /** Puts the cursor at `pos` in the open note (its end, if left out), with the keyboard in the note. */
  place(pos?: number) {
    const view = editor()!;
    view.focus();
    view.dispatch({ selection: { anchor: pos ?? view.state.doc.length }, scrollIntoView: true });
  },
};

declare global {
  interface Window {
    testing: typeof testing;
  }
}

window.testing = testing;
