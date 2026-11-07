import { syntaxTreeAvailable } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { notes } from "../lib/notes/store.svelte";
import { library } from "./library";

/*
 * What the benchmarks (scripts/bench.mjs) use inside the page, in builds made with `--mode bench`
 * only. Timings are from an input (a key or a press, as the browser stamped it) to the end of the
 * frame that shows its result: the time someone waits.
 */

/** When the last key or press came in. */
let lastInput = 0;
/** How long each key took to show, since `keys()` last took them. */
let keyTimes: number[] = [];
let pending = 0;

/** When the next frame has been drawn: a frame callback, then a task after its paint. */
const painted = () =>
  new Promise<number>((resolve) =>
    requestAnimationFrame(() => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve(performance.now());
      channel.port2.postMessage(null);
    }),
  );

addEventListener("pointerdown", (event) => (lastInput = event.timeStamp), { capture: true });
addEventListener(
  "keydown",
  (event) => {
    const input = (lastInput = event.timeStamp);
    pending++;
    void painted().then((end) => {
      keyTimes.push(end - input);
      pending--;
    });
  },
  { capture: true },
);

/** When the first row of the note list appeared, since the page started loading. */
let firstRow = 0;
new MutationObserver((_, observer) => {
  if (!document.querySelector("[data-id]")) return;
  firstRow = performance.now();
  observer.disconnect();
}).observe(document, { childList: true, subtree: true });

/** Frame lengths while recording. */
let frames: number[] | null = null;
function recordFrames(last: number) {
  requestAnimationFrame((now) => {
    if (!frames) return;
    frames.push(now - last);
    recordFrames(now);
  });
}

const bench = {
  /** Adds the benchmark library: `count` everyday notes and the big ones, stored before it resolves. */
  async seed(count: number) {
    await notes.insert(...library(count));
    await notes.flush();
    return notes.entries.length;
  },

  /** How long loading took: notes read and listed, and the list's first row shown. */
  startup() {
    const loaded = performance.getEntriesByName("lines:notes-loaded")[0]?.startTime ?? NaN;
    return { loaded, firstRow };
  },

  /** Waits for `ready()` (checked every frame), then for that frame to be drawn; ms since the last input. */
  async until(ready: () => unknown = () => true, timeout = 20_000) {
    const start = performance.now();
    while (!ready()) {
      if (performance.now() - start > timeout) throw new Error("timed out");
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return (await painted()) - lastInput;
  },

  /** The keys' times since last asked, once every key's frame is drawn. */
  async keys() {
    // `pending` falls as each key's frame is drawn.
    // oxlint-disable-next-line no-unmodified-loop-condition
    while (pending) await painted();
    const taken = keyTimes;
    keyTimes = [];
    return taken;
  },

  startFrames() {
    frames = [];
    requestAnimationFrame(recordFrames);
  },
  stopFrames() {
    const taken = frames ?? [];
    frames = null;
    return taken;
  },

  /** The open note's editor has read all of its text (parsed it to the end). */
  parsed() {
    const editor = document.querySelector<HTMLElement>(".editor-pane .cm-editor");
    const state = editor && EditorView.findFromDOM(editor)?.state;
    return !!state && syntaxTreeAvailable(state, state.doc.length);
  },

  /** The note `id` is open, its text in the editor (a spreadsheet's grid draws from it). */
  shows(id: string) {
    const body = notes.get(id)?.note.body;
    const editor = document.querySelector<HTMLElement>(".editor-pane .cm-editor");
    const doc = notes.selectedId === id && editor ? EditorView.findFromDOM(editor)?.state.doc : undefined;
    return !!doc && body !== undefined && doc.length === body.length && doc.sliceString(0, 200) === body.slice(0, 200);
  },

  /** The id of the note titled `title`. */
  idOf: (title: string) => notes.entries.find((entry) => entry.meta.title === title)?.note.id ?? null,

  titleOf: (id: string) => notes.get(id)?.meta.title ?? "",

  isOpen: (id: string) => notes.selectedId === id,

  /** How many notes the list holds (not only the rows it draws). */
  listed: () => notes.visible.length,

  /** The id of the note in the list's row `n`. */
  row: (n: number) => document.querySelectorAll<HTMLElement>(".items [data-id]")[n]?.dataset.id ?? null,

  /** How much memory scripts use, where the browser says (Chromium). */
  heap: () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
};

declare global {
  interface Window {
    bench: typeof bench;
  }
}
window.bench = bench;
