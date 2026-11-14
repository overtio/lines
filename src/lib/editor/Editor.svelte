<script lang="ts">
  import { EditorSelection, EditorState, type StateEffect, Transaction } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import { untrack } from "svelte";
  import { frontMatter } from "../notes/properties";
  import { notes } from "../notes/store.svelte";
  import type { Note } from "../notes/types";
  import { looks } from "../notes/looks.svelte";
  import { tagColorCss, tagColorSheet } from "./tagColors";
  import { plugins } from "../plugins/registry.svelte";
  import { prefs } from "../prefs.svelte";
  import { objectsChanged } from "./objects";
  import { outline, outlineCompartment } from "./outline.svelte";
  import { reopened } from "./markers";
  import { copyOnSelectCompartment, createExtensions, formatCompartment, formatEditing, readOnly, readOnlyCompartment, spelling, spellingCompartment, steadyScroller } from "./setup";
  import { copyOnSelect } from "./copyOnSelect";
  import { symbolsChanged } from "./symbols";
  import { changesBetween, editedNote } from "./util";
  import { paneEditor } from "./writeIn";

  // `pane`: which pane it's in (panes.ts), for what's written into its note from outside it (writeIn.ts).
  let { noteId, trashed, pane }: { noteId: string; trashed: boolean; pane: string } = $props();
  // Read through these, the effects below run again only when the note or whether it's read-only
  // changes, not each time the note's entry does (a save, or sync).
  const id = $derived(noteId);
  const viewOnly = $derived(trashed);

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

  function changed() {
    dirty = true;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, SYNC_DELAY);
  }

  /** A note's editor state, in its language from the start rather than read as Markdown first. */
  const stateOf = (note: Note | undefined) =>
    EditorState.create({ doc: note?.body ?? "", extensions: [createExtensions(changed, note?.format), steadyScroller, note ? editedNote.of(note.id) : []] });

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

  /**
   * Sets the editor up for the open note's language (its plugin's editing), unless it is already
   * (or `again`): from nothing, so what was drawn for another language, or with Markdown shown
   * another way, goes.
   */
  function applyFormat(again = false) {
    if (!view || !currentId) return;
    const editing = formatEditing(notes.get(currentId)?.note.format);
    if (!again && formatCompartment.get(view.state) === editing) return;
    view.dispatch({ effects: formatCompartment.reconfigure([]) });
    view.dispatch({ effects: formatCompartment.reconfigure(editing) });
  }

  function cachedFor(id: string) {
    const note = notes.get(id)?.note;
    const cached = cache.get(id);
    if (cached && cached.state.doc.toString() === (note?.body ?? "")) return cached;
    return { state: stateOf(note), scroll: null };
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
    // What's changed since it was opened starts again (the Changes plugin).
    view.dispatch({ effects: reopened.of(null) });
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

  /** Apply a change that arrived from elsewhere (sync), touching only the parts that differ. */
  function replaceDoc(body: string) {
    if (!view) return;
    const changes = changesBetween(view.state.doc.toString(), body);
    if (!changes.length) return;
    view.dispatch({ changes, userEvent: "sync", annotations: Transaction.addToHistory.of(false) });
    // The store already has this text; don't echo it back.
    dirty = false;
    clearTimeout(syncTimer);
  }

  $effect(() => {
    view = new EditorView({ parent: host });
    const unregister = notes.registerFlusher(sync);
    const unwritable = paneEditor(untrack(() => pane), () => view);
    const leave = () => notes.leave();
    const onVisibility = () => document.visibilityState === "hidden" && leave();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", leave);
    // WebKit closes a tab without telling it (no pagehide) unless it listens for beforeunload.
    window.addEventListener("beforeunload", leave);
    return () => {
      unregister();
      unwritable();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("beforeunload", leave);
      sync();
      view?.destroy();
      view = undefined;
      currentId = null;
    };
  });

  $effect(() => {
    const note = id;
    untrack(() => open(note));
  });

  $effect(() => {
    const { ids } = notes.remoteRevision;
    untrack(() => {
      if (!currentId || !ids.includes(currentId)) return;
      const body = notes.get(currentId)?.note.body;
      if (body !== undefined) replaceDoc(body);
    });
  });

  // Locked notes opened or closed. Once closed, nothing of them stays here, undo history
  // included; once opened, the one showing takes up its text.
  $effect(() => {
    void notes.lockRevision;
    untrack(() => {
      for (const cached of cache.keys()) if (notes.get(cached)?.note.locked) cache.delete(cached);
      const note = currentId !== null ? notes.get(currentId)?.note : undefined;
      if (!view || !note?.locked || view.state.doc.toString() === note.body) return;
      dirty = false;
      clearTimeout(syncTimer);
      view.setState(stateOf(note));
      view.dispatch({ effects: setUp() });
      applyFormat();
    });
  });

  $effect(() => {
    void notes.get(id)?.note.format;
    untrack(applyFormat);
  });

  // A plugin turned on or off: the note's language is set up again from scratch, so all it draws
  // (math, diagrams, its own syntax) follows. Its text, selection and undo history stay.
  let pluginsSeen = plugins.active;
  $effect(() => {
    const active = plugins.active;
    if (active === pluginsSeen) return;
    pluginsSeen = active;
    untrack(() => applyFormat(true));
  });

  // Markdown shown another way, dragging or underlined headings turned on or off (Settings → Editor).
  $effect(() => {
    void prefs.markdownMode;
    void prefs.dragBlocks;
    void prefs.underlinedHeadings;
    untrack(() => applyFormat());
  });

  /** Whether the note can be edited, the outline beside it (Settings → Layout), and its spelling and copying what's selected (Settings → Editor). */
  const setUp = () => [
    readOnlyCompartment.reconfigure(readOnly(viewOnly)),
    outlineCompartment.reconfigure(prefs.outline ? outline : []),
    spellingCompartment.reconfigure(spelling(prefs.spellcheck)),
    copyOnSelectCompartment.reconfigure(copyOnSelect(prefs.copyOnSelect)),
  ];

  $effect(() => {
    void id;
    const effects = setUp();
    untrack(() => view?.dispatch({ effects }));
  });

  // Tags in the colors chosen for them in the sidebar, in every note in this window.
  $effect(() => {
    tagColorSheet().textContent = tagColorCss(looks.looks);
  });

  // Mentions show other notes' titles, icons and properties, and tags their icons and colors; values
  // their scores and copy buttons (Settings → Little Touches). Draw them again when those change.
  $effect(() => {
    void notes.objectsSignature;
    void looks.looks;
    void prefs.scores;
    void prefs.copyValues;
    untrack(() => view?.dispatch({ effects: objectsChanged.of(null) }));
  });

  // Settings → Editor: `->` shown as →, or as typed.
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

<div class="h-full min-h-0" bind:this={host}></div>
