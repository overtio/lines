<script lang="ts">
  import { EditorSelection, EditorState, type StateEffect, Transaction } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import { untrack } from "svelte";
  import { frontMatter } from "../notes/properties";
  import { notes } from "../notes/store.svelte";
  import { typeIcons } from "../notes/tagIcons.svelte";
  import { prefs } from "../prefs.svelte";
  import { objectsChanged } from "./objects";
  import { createExtensions, formatCompartment, formatEditing, readOnly, readOnlyCompartment } from "./setup";
  import { symbolsChanged } from "./symbols";

  let { noteId, trashed }: { noteId: string; trashed: boolean } = $props();

  const SYNC_DELAY = 120;
  const MAX_CACHED = 30;

  let host: HTMLDivElement;
  let view: EditorView | undefined;
  let currentId: string | null = null;
  let syncTimer: ReturnType<typeof setTimeout> | undefined;
  /** True when the user has typed something the store hasn't seen yet. */
  let dirty = false;
  /** Editor states and scroll positions per note, so undo history and place survive switching notes. */
  const cache = new Map<string, { state: EditorState; scroll: StateEffect<unknown> | null }>();

  const extensions = createExtensions(() => {
    dirty = true;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, SYNC_DELAY);
  });

  /**
   * The editor owns the text while you type; the store gets a copy shortly
   * after. Nothing ever pushes content back into a live editor, which keeps
   * typing free of cursor jumps and re-render glitches.
   */
  function sync() {
    clearTimeout(syncTimer);
    syncTimer = undefined;
    if (!dirty || !view || !currentId) return;
    dirty = false;
    const body = view.state.doc.toString();
    if (notes.get(currentId)?.note.body !== body) notes.update(currentId, body);
  }

  /** Sets the editor up for the open note's format, Markdown or LaTeX, unless it is already. */
  function applyFormat() {
    if (!view || !currentId) return;
    const editing = formatEditing(notes.get(currentId)?.note.format);
    if (formatCompartment.get(view.state) !== editing) view.dispatch({ effects: formatCompartment.reconfigure(editing) });
  }

  function cachedFor(id: string) {
    const body = notes.get(id)?.note.body ?? "";
    const cached = cache.get(id);
    if (cached && cached.state.doc.toString() === body) return cached;
    return { state: EditorState.create({ doc: body, extensions }), scroll: null };
  }

  function open(id: string) {
    if (!view || id === currentId) return;
    if (currentId) {
      sync();
      cache.delete(currentId);
      cache.set(currentId, { state: view.state, scroll: view.scrollSnapshot() });
      if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
    }
    currentId = id;
    const { state, scroll } = cachedFor(id);
    view.setState(state);
    applyFormat();
    if (scroll) view.dispatch({ effects: scroll });
    else view.scrollDOM.scrollTop = 0;

    if (notes.pendingFocus === id) {
      notes.pendingFocus = null;
      // The title's line, after the properties of a note made under a type.
      const { doc } = view.state;
      const titleLine = doc.line(Math.min(doc.lines, (frontMatter(doc.toString())?.lines ?? 0) + 1));
      view.dispatch({ selection: EditorSelection.cursor(titleLine.to) });
      view.focus();
    }
  }

  /** Apply a change that arrived from elsewhere (sync), touching only the part that differs. */
  function replaceDoc(body: string) {
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === body) return;
    let start = 0;
    while (start < current.length && start < body.length && current[start] === body[start]) start++;
    let end = 0;
    while (
      end < current.length - start &&
      end < body.length - start &&
      current[current.length - 1 - end] === body[body.length - 1 - end]
    )
      end++;
    view.dispatch({
      changes: { from: start, to: current.length - end, insert: body.slice(start, body.length - end) },
      userEvent: "sync",
      annotations: Transaction.addToHistory.of(false),
    });
    // The store already has this text; don't echo it back.
    dirty = false;
    clearTimeout(syncTimer);
  }

  $effect(() => {
    view = new EditorView({ parent: host });
    const unregister = notes.registerFlusher(sync);
    const flush = () => notes.flush();
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      unregister();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      sync();
      view?.destroy();
      view = undefined;
      currentId = null;
    };
  });

  $effect(() => {
    const id = noteId;
    untrack(() => open(id));
  });

  $effect(() => {
    const { id } = notes.remoteRevision;
    untrack(() => {
      if (id !== currentId) return;
      const body = notes.get(id)?.note.body;
      if (body !== undefined) replaceDoc(body);
    });
  });

  // Locked notes opened or closed. Once closed, nothing of them stays here, undo history
  // included; once opened, the one showing takes up its text.
  $effect(() => {
    void notes.lockRevision;
    untrack(() => {
      for (const id of cache.keys()) if (notes.get(id)?.note.locked) cache.delete(id);
      const note = currentId !== null ? notes.get(currentId)?.note : undefined;
      if (!view || !note?.locked || view.state.doc.toString() === note.body) return;
      dirty = false;
      clearTimeout(syncTimer);
      view.setState(EditorState.create({ doc: note.body, extensions }));
      view.dispatch({ effects: readOnlyCompartment.reconfigure(readOnly(trashed)) });
      applyFormat();
    });
  });

  $effect(() => {
    void notes.get(noteId)?.note.format;
    untrack(applyFormat);
  });

  $effect(() => {
    const value = trashed;
    noteId;
    view?.dispatch({ effects: readOnlyCompartment.reconfigure(readOnly(value)) });
  });

  // Mentions show other notes' titles, icons and properties; draw them again when those change.
  $effect(() => {
    void notes.objectsSignature;
    void typeIcons.signature();
    untrack(() => view?.dispatch({ effects: objectsChanged.of(null) }));
  });

  // Settings → Text: `->` shown as →, or as typed.
  $effect(() => {
    void prefs.symbolsInText;
    void prefs.symbolsInCode;
    untrack(() => view?.dispatch({ effects: symbolsChanged.of(null) }));
  });

  $effect(() => {
    prefs.watchLayout();
    view?.requestMeasure();
  });
</script>

<div class="editor" bind:this={host}></div>

<style>
  .editor {
    height: 100%;
    min-height: 0;
  }
</style>
