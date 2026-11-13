import { EditorView } from "@codemirror/view";
import { feeds } from "../lib/feeds/feeds.svelte";
import { NoFeed } from "../lib/feeds/find";
import { htmlToMarkdown } from "../lib/feeds/markdown";
import { readOpml } from "../lib/feeds/opml";
import { NotAFeed, readFeed } from "../lib/feeds/parse";
import { attachmentNames, saveAttachment } from "../lib/notes/attachments";
import { noteKeys } from "../lib/notes/noteKeys.svelte";
import { notes } from "../lib/notes/store.svelte";
import { panes } from "../lib/panes.svelte";
import { plugins } from "../lib/plugins/registry.svelte";
import { prefs } from "../lib/prefs.svelte";
import { customThemes } from "../lib/themes/custom.svelte";
import { themeDrafts } from "../lib/themes/drafts.svelte";
import { presets, writePresetFile } from "../lib/themes/presets.svelte";

/*
 * What the browser tests (tests/browser/) use inside the page, in builds made with `--mode test`
 * only: the open note's editor, Settings as the app keeps them, and a way to open a note of any
 * format with any text.
 */

/** The open note's editor, in its pane wherever the others are (Panes.svelte). */
const editor = () => {
  const dom = document.querySelector<HTMLElement>('.editor-pane [data-pane-content="main"] .cm-editor');
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
  noteKeys,
  feeds,
  /** Reading feeds, their HTML and OPML, as lines does (lib/feeds/). */
  reading: { readFeed, NotAFeed, NoFeed, htmlToMarkdown, readOpml },
  panes,
  plugins,
  prefs,
  customThemes,
  themeDrafts,
  presets,
  writePresetFile,
  saveAttachment,
  attachmentNames,
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
