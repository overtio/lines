import type { IconName } from "../icons/icons";
import { isSite } from "../platform";
import { DEFAULT_LANGUAGE, plugins } from "../plugins/registry.svelte";
import type { NoteLanguage } from "../plugins/types";
import { untrack } from "svelte";
import { announce } from "../windows/channel";
import { noteKeys } from "./noteKeys.svelte";
import type { SampleSet } from "./samples";
import { SvelteSet } from "svelte/reactivity";
import { normalizeTag, renameTagIn, renameTypeIn } from "./parse";
import { nameOf } from "./properties";
import { IndexedDBStorage, type NoteStorage } from "./storage";
import type { Filter, Note, NoteLock, NoteMeta, WrappedKey } from "./types";
import { WELCOME_NOTE } from "./welcome";

export interface Entry {
  note: Note;
  meta: NoteMeta;
}

export interface TagNode {
  name: string;
  path: string;
  count: number;
  children: TagNode[];
}

const SAVE_DELAY = 400;
const SEEDED_KEY = "lines.seeded";

export function isBlank(body: string) {
  return /^\s*#?\s*$/.test(body);
}

/** Whether the welcome note was already added once; marks it as added either way. */
function seeded() {
  try {
    if (localStorage.getItem(SEEDED_KEY)) return true;
    localStorage.setItem(SEEDED_KEY, "1");
  } catch {
    // Storage that can't be written: at worst the welcome note comes back.
  }
  return false;
}

/** What a new device starts with: the welcome note, or on the demo website, the feature tour. */
async function firstNotes(): Promise<Note[]> {
  if (isSite) return (await import("./samples")).sampleNotes("tour");
  const now = Date.now();
  return [{ id: crypto.randomUUID(), body: WELCOME_NOTE, createdAt: now, updatedAt: now, pinned: false, trashed: false }];
}

/** A locked note that isn't open: all there is of it is its title. */
export const isClosed = (note: Note) => !!note.locked && !note.locked.open;

/**
 * What the list knows of a note. A locked note shows its title only, open or not: its tags,
 * to-dos and words stay out of the sidebar and search, so they don't come and go as it opens.
 */
function metaOf(note: Note): NoteMeta {
  const language = plugins.language(note.format);
  if (!note.locked) return language.meta(note.body);
  const title = note.locked.open ? language.meta(note.body).title : note.locked.title;
  return { title, excerpt: "", tags: [], hasOpenTodos: false, searchText: title.toLowerCase(), properties: [], type: "" };
}

const entryOf = (note: Note): Entry => ({ note, meta: metaOf(note) });

/** A note as it's stored and synced: a locked one without its Markdown. */
export function stored(note: Note): Note {
  if (!note.locked) return note;
  const { open: _, ...locked } = note.locked;
  return { ...note, body: "", locked };
}

function matchesTag(tags: string[], tag: string) {
  return tags.some((t) => t === tag || t.startsWith(tag + "/"));
}

class NotesStore {
  #storage: NoteStorage;
  #pending = new Map<string, ReturnType<typeof setTimeout>>();
  #changeListeners = new Set<() => void>();
  #flushers = new Set<() => void>();
  /**
   * What new notes started as, so one left untouched can be discarded like a blank one, and the
   * tag or type they were made in, to start them again in another language.
   */
  #templates = new Map<string, { body: string; made: { tag?: string; type?: string } }>();
  /** Notes moved to the trash since the last edit, most recent last, for undo; those trashed together share a batch. */
  #trashed: { id: string; pinned: boolean; selected: boolean; batch: number }[] = [];
  #batch = 0;
  /** Where a ⇧-click range starts from: the note last ⌘-clicked, or the open one. */
  #anchor: string | null = null;

  /** Immutable entries: an edit replaces one entry, so unrelated list rows never re-render. */
  entries = $state.raw<Entry[]>([]);
  ready = $state(false);
  /** Why notes couldn't be loaded, if they couldn't. */
  loadError = $state<string | null>(null);
  selectedId = $state<string | null>(null);
  /**
   * Notes picked in the list to act on together (⌘-click, ⇧-click, ⌘A), the open one among them.
   * Empty when it's just the open note.
   */
  picked = new SvelteSet<string>();
  filter = $state<Filter>({ kind: "all" });
  query = $state("");
  /** A freshly created note that the editor should focus once it opens. */
  pendingFocus = $state<string | null>(null);
  /** Bumped when a note changes from outside the editor (e.g. sync), so an open editor can refresh. */
  remoteRevision = $state({ id: "", n: 0 });
  /** Bumped when locked notes open or close, so editors take up (or let go of) their text. */
  lockRevision = $state(0);

  selected = $derived(this.entries.find((e) => e.note.id === this.selectedId) ?? null);

  visible = $derived.by(() => {
    const f = this.filter;
    const terms = this.query.toLowerCase().split(/\s+/).filter(Boolean);
    return this.entries
      .filter(({ note, meta }) => {
        if (f.kind === "trash") {
          if (!note.trashed) return false;
        } else {
          if (note.trashed) return false;
          if (f.kind === "todo" && !meta.hasOpenTodos) return false;
          if (f.kind === "untagged" && meta.tags.length) return false;
          if (f.kind === "tag" && !matchesTag(meta.tags, f.tag)) return false;
          if (f.kind === "type" && meta.type !== f.type) return false;
        }
        return terms.every((t) => meta.searchText.includes(t));
      })
      .sort(
        (a, b) =>
          Number(b.note.pinned) - Number(a.note.pinned) || b.note.updatedAt - a.note.updatedAt,
      );
  });

  counts = $derived.by(() => {
    let all = 0, todo = 0, untagged = 0, trash = 0;
    for (const { note, meta } of this.entries) {
      if (note.trashed) { trash++; continue; }
      all++;
      if (meta.hasOpenTodos) todo++;
      if (!meta.tags.length) untagged++;
    }
    return { all, todo, untagged, trash };
  });

  /**
   * Tag counts serialized to a string. Typing that doesn't change tags yields an
   * identical string, so the tag tree below doesn't rebuild on every keystroke.
   */
  #tagSignature = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const { note, meta } of this.entries) {
      if (note.trashed) continue;
      const paths = new Set<string>();
      for (const tag of meta.tags) {
        const parts = tag.split("/");
        for (let i = 1; i <= parts.length; i++) paths.add(parts.slice(0, i).join("/"));
      }
      for (const p of paths) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([t, n]) => `${t}\t${n}`).join("\n");
  });

  tagTree = $derived.by(() => {
    const root: TagNode[] = [];
    const nodes = new Map<string, TagNode>();
    for (const line of this.#tagSignature.split("\n").filter(Boolean)) {
      const [path, count] = line.split("\t");
      const slash = path.lastIndexOf("/");
      const node: TagNode = { name: path.slice(slash + 1), path, count: Number(count), children: [] };
      nodes.set(path, node);
      (slash === -1 ? root : nodes.get(path.slice(0, slash))!.children).push(node);
    }
    return root;
  });

  /** Each type (`type: person`, see properties.ts) and how many notes have it, by name. */
  types = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const { note, meta } of this.entries) {
      if (!note.trashed && meta.type) counts.set(meta.type, (counts.get(meta.type) ?? 0) + 1);
    }
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => ({ type, count }));
  });

  /**
   * The note each mention (`@Oleks`) finds, by its title (see properties.ts `nameOf`). Two notes
   * with one title: the one with a type, then the one edited last. Trashed notes aren't found.
   */
  objects = $derived.by(() => {
    const found = new Map<string, Entry>();
    for (const entry of this.entries) {
      const name = nameOf(entry.meta.title);
      if (!name || entry.note.trashed) continue;
      const other = found.get(name);
      const typed = !!entry.meta.type;
      if (!other || (typed !== !!other.meta.type ? typed : entry.note.updatedAt > other.note.updatedAt)) found.set(name, entry);
    }
    return found;
  });

  /**
   * What mentions and type tables show of other notes, as a string: their titles, icons, types and
   * properties. Typing that changes none of these leaves it the same, so editors don't redraw for it.
   */
  objectsSignature = $derived.by(() =>
    this.entries
      .filter(({ note }) => !note.trashed)
      .map(({ note, meta }) => [note.id, meta.title, note.icon, meta.type, ...meta.properties.map((p) => `${p.key}:${p.value}`)].join("\u0001"))
      .join("\n"),
  );

  constructor(storage: NoteStorage) {
    this.#storage = storage;
    // A language's plugin turned on or off: its notes are read again, as their language or as plain
    // text. Only the effect asks for plugins, as it runs once every module has loaded.
    $effect.root(() => {
      let languages: readonly NoteLanguage[] | undefined;
      $effect(() => {
        const now = plugins.languages;
        const changed = languages && (now.length !== languages.length || now.some((language, i) => language !== languages![i]));
        languages = now;
        if (changed) untrack(() => (this.entries = this.entries.map((entry) => entryOf(entry.note))));
      });
    });
  }

  async load() {
    try {
      let all = await this.#storage.all();
      if (!all.length && !seeded()) {
        all = await firstNotes();
        for (const note of all) await this.#storage.put(note);
        // The demo website opens its first note, so a visitor isn't met by an empty page.
        if (isSite) this.selectedId = all[0]?.id ?? null;
      }
      for (const note of all) noteKeys.notice(note);
      this.entries = await Promise.all(all.map(async (note) => entryOf(await this.#opened(note))));
      this.ready = true;
    } catch (error) {
      console.error("lines: couldn't load notes", error);
      this.loadError = error instanceof Error ? error.message : String(error);
    }
  }

  get(id: string) {
    return this.entries.find((e) => e.note.id === id);
  }

  /** The note a mention of `name` finds (see `objects`). */
  find(name: string): Entry | undefined {
    return this.objects.get(nameOf(name));
  }

  /** The notes of a type (`@type.recipe` finds `recipe`; `_`, `-` and spaces alike), not trashed. */
  ofType(type: string): Entry[] {
    const wanted = nameOf(type);
    return this.entries.filter(({ note, meta }) => !note.trashed && meta.type && nameOf(meta.type) === wanted);
  }

  /** Opens a note, showing all notes if the list hides it. */
  show(id: string) {
    if (!this.visible.some((e) => e.note.id === id)) this.setFilter({ kind: "all" });
    this.select(id);
  }

  select(id: string | null) {
    const previous = this.selectedId;
    this.selectedId = id;
    if (previous && previous !== id) this.#discardIfBlank(previous);
  }

  setFilter(filter: Filter) {
    this.filter = filter;
    this.clearPicks();
    if (this.selected && !this.visible.some((e) => e.note.id === this.selectedId)) {
      this.select(null);
    }
  }

  /** Makes a new note and opens it, ready to type its title; `body` is what it starts as, if not the usual. */
  create(body?: string): string {
    const now = Date.now();
    const f = this.filter;
    // Made under a tag it has the tag; made under a type, it's one of that type.
    const made = f.kind === "tag" ? { tag: f.tag } : f.kind === "type" ? { type: f.type } : {};
    const note: Note = {
      id: crypto.randomUUID(),
      body: body ?? plugins.language().newNote(made),
      createdAt: now,
      updatedAt: now,
      pinned: false,
      trashed: false,
    };
    this.#templates.set(note.id, { body: note.body, made });
    if (this.filter.kind === "trash") this.filter = { kind: "all" };
    this.query = "";
    this.entries = [entryOf(note), ...this.entries];
    this.pendingFocus = note.id;
    this.select(note.id);
    this.#notify();
    return note.id;
  }

  update(id: string, body: string) {
    // Typing makes the editor's own undo the one ⌘Z should reach.
    this.#trashed = [];
    this.#patch(id, { body, updatedAt: Date.now() });
  }

  /** The picked notes still in the list, in its order. */
  get pickedEntries(): Entry[] {
    return this.picked.size ? this.visible.filter((e) => this.picked.has(e.note.id)) : [];
  }

  /** ⌘-click: adds the note to the picked ones (with the open one, the first time) and opens it, or takes it out. */
  togglePick(id: string) {
    if (!this.picked.size && this.selectedId && this.selectedId !== id && this.visible.some((e) => e.note.id === this.selectedId)) {
      this.picked.add(this.selectedId);
    }
    this.#anchor = id;
    if (this.picked.has(id)) {
      this.picked.delete(id);
      if (this.selectedId === id) this.select(this.pickedEntries.at(-1)?.note.id ?? null);
    } else {
      this.picked.add(id);
      this.select(id);
    }
    this.#settlePicks();
  }

  /** ⇧-click (or ⇧↑, ⇧↓): picks every note from the last one clicked to this one, and opens it. */
  pickRange(id: string) {
    const ids = this.visible.map((e) => e.note.id);
    this.#anchor ??= this.selectedId;
    const from = ids.indexOf(this.#anchor ?? id);
    const to = ids.indexOf(id);
    if (to === -1) return;
    const start = from === -1 ? to : Math.min(from, to);
    const end = from === -1 ? to : Math.max(from, to);
    this.picked.clear();
    for (const pick of ids.slice(start, end + 1)) this.picked.add(pick);
    this.select(id);
    this.#settlePicks();
  }

  /** ⌘A in the list: every note in it. */
  pickAll() {
    for (const { note } of this.visible) this.picked.add(note.id);
    this.#settlePicks();
  }

  clearPicks() {
    this.picked.clear();
    this.#anchor = null;
  }

  /** One note picked is just the open note. */
  #settlePicks() {
    if (this.picked.size > 1) return;
    const [only] = this.picked;
    this.picked.clear();
    if (only) this.select(only);
  }

  /** Pins these notes, or unpins them. Like pinning one, it doesn't count as an edit. */
  setPinned(ids: string[], pinned: boolean) {
    for (const id of ids) if (this.get(id)) this.#patch(id, { pinned });
  }

  /** Adds `#tag` to these notes (not locked ones, whose text can't be read here), keeping their dates. */
  addTag(ids: string[], tag: string) {
    const target = normalizeTag(tag.replace(/^#/, ""));
    if (!target) return 0;
    const only = new Set(ids);
    return this.#rewrite((body, note) => (only.has(note.id) ? plugins.language(note.format).addTag(body, target) : body));
  }

  /** Moves these notes to the trash together; ⌘Z brings them all back. */
  trashMany(ids: string[]) {
    const batch = ++this.#batch;
    for (const id of ids) this.trash(id, batch);
  }

  restoreMany(ids: string[]) {
    for (const id of ids) this.restore(id);
  }

  deleteForeverMany(ids: string[]) {
    return this.#deleteForever(ids);
  }

  togglePin(id: string) {
    const entry = this.get(id);
    if (entry) this.#patch(id, { pinned: !entry.note.pinned });
  }

  /** Locks a note with this device's key, which has to be open. Like pinning, it doesn't count as an edit. */
  lock(id: string) {
    const entry = this.get(id);
    const key = noteKeys.settings?.key;
    if (!entry || entry.note.locked || !key || !noteKeys.isOpen(key.id)) return;
    this.#patch(id, { locked: { key, title: entry.meta.title, files: [], sealed: "", open: true } });
    // Stored encrypted right away, rather than after the usual pause.
    return this.flush();
  }

  /** Takes the lock off an open note. */
  removeLock(id: string) {
    const entry = this.get(id);
    if (!entry?.note.locked?.open) return;
    this.#patch(id, { locked: undefined });
    return this.flush();
  }

  /** Puts the key into every locked note it opens (after the person gave the password, say). */
  async openLocked() {
    const opened = new Map<string, { body: string; lock: NoteLock }>();
    for (const { note } of this.entries) {
      if (!isClosed(note)) continue;
      try {
        const body = await noteKeys.open(note.locked!);
        if (body !== null) opened.set(note.id, { body, lock: note.locked! });
      } catch (error) {
        console.error(`lines: couldn't open locked note ${note.id}`, error);
      }
    }
    if (!opened.size) return;
    this.entries = this.entries.map((entry) => {
      const open = opened.get(entry.note.id);
      // Unless it changed meanwhile (it synced, say), in which case it stays closed.
      if (!open || entry.note.locked !== open.lock) return entry;
      return entryOf({ ...entry.note, body: open.body, locked: { ...open.lock, open: true } });
    });
    this.lockRevision++;
  }

  /** Gives the notes locked with this key its new wrapping, after the password changed. */
  rekey(key: WrappedKey) {
    for (const { note } of this.entries) {
      if (note.locked?.key.id === key.id && note.locked.key.changed < key.changed) this.#patch(note.id, { locked: { ...note.locked, key } });
    }
    return this.flush();
  }

  /** Closes every open locked note, once what's typed in them is stored, encrypted. */
  async closeLocked() {
    for (let i = 0; i < 3 && this.entries.some(({ note }) => note.locked?.open && !note.locked.sealed); i++) await this.flush();
    this.entries = this.entries.map((entry) => (entry.note.locked?.open ? entryOf(stored(entry.note)) : entry));
    this.lockRevision++;
  }

  /** Sets the note's icon, or takes it away. Like pinning, it doesn't count as an edit. */
  setIcon(id: string, icon: IconName | null) {
    this.#patch(id, { icon: icon ?? undefined });
  }

  /**
   * Writes the note in another language, by its id. Its text stays as it is, except a new note's,
   * which starts again the way that language starts one (in LaTeX, without Markdown's "# ", and a
   * tag it was made under in a comment, where LaTeX ignores it).
   */
  setFormat(id: string, format: string) {
    const entry = this.get(id);
    if (!entry || (entry.note.format ?? DEFAULT_LANGUAGE) === format) return;
    this.flush();
    const stored = format === DEFAULT_LANGUAGE ? undefined : format;
    const template = this.#templates.get(id);
    if (template && entry.note.body === template.body) {
      const body = plugins.language(format).newNote(template.made);
      this.#templates.set(id, { ...template, body });
      this.#patch(id, { body, format: stored });
      if (this.selectedId === id) this.remoteRevision = { id, n: this.remoteRevision.n + 1 };
      return;
    }
    this.#patch(id, { format: stored });
  }

  trash(id: string, batch = ++this.#batch) {
    const entry = this.get(id);
    if (!entry || entry.note.trashed) return;
    this.#trashed.push({ id, pinned: entry.note.pinned, selected: this.selectedId === id, batch });
    this.picked.delete(id);
    this.#patch(id, { trashed: true, pinned: false });
    if (this.selectedId === id) this.selectedId = null;
  }

  /** Brings back the notes most recently moved to the trash (together), if nothing was edited since. */
  undoTrash() {
    for (let last = this.#trashed.pop(); last; last = this.#trashed.pop()) {
      const batch = [last];
      while (this.#trashed.at(-1)?.batch === last.batch) batch.push(this.#trashed.pop()!);
      const back = batch.filter((trashed) => this.get(trashed.id)?.note.trashed);
      if (!back.length) continue;
      for (const trashed of back) this.#patch(trashed.id, { trashed: false, pinned: trashed.pinned });
      const open = back.find((trashed) => trashed.selected);
      if (open && this.filter.kind !== "trash") this.select(open.id);
      return true;
    }
    return false;
  }

  restore(id: string) {
    this.#patch(id, { trashed: false });
  }

  deleteForever(id: string) {
    return this.#deleteForever([id]);
  }

  emptyTrash() {
    return this.#deleteForever(this.entries.filter((e) => e.note.trashed).map((e) => e.note.id));
  }

  async #deleteForever(ids: string[]) {
    if (!ids.length) return;
    const gone = new Set(ids);
    for (const id of ids) {
      this.picked.delete(id);
      clearTimeout(this.#pending.get(id));
      this.#pending.delete(id);
      this.#templates.delete(id);
    }
    this.entries = this.entries.filter((e) => !gone.has(e.note.id));
    if (this.selectedId && gone.has(this.selectedId)) this.selectedId = null;
    this.#notify();
    await this.#storage.delete(...ids);
    for (const id of ids) void announce({ type: "note", id, local: true });
  }

  /**
   * Renames a tag, and the tags nested under it, in every note that uses it (trashed ones too).
   * Notes keep their dates, so the list doesn't reshuffle; sync still picks up the new text.
   */
  renameTag(from: string, to: string) {
    const target = normalizeTag(to);
    if (!target || target === from) return;
    this.#rewrite((body) => renameTagIn(body, from, to));
    // Keep showing the same notes under their new name.
    const f = this.filter;
    if (f.kind === "tag" && (f.tag === from || f.tag.startsWith(from + "/"))) {
      this.filter = { kind: "tag", tag: target + f.tag.slice(from.length) };
    }
  }

  /**
   * Renames a type: the `type` of every note of it (trashed ones too), and every `@type.…` of it.
   * As with tags, notes keep their dates. Renamed onto a type there is already, the two become one.
   */
  renameType(from: string, to: string) {
    const target = to.trim().toLowerCase();
    if (!target || nameOf(target) === nameOf(from)) return;
    this.#rewrite((body) => renameTypeIn(body, from, to.trim()));
    // Keep showing the same notes under their new name.
    if (this.filter.kind === "type" && this.filter.type === from) this.filter = { kind: "type", type: target };
  }

  /**
   * Rewrites every note's text with `rewrite` (but locked notes', which aren't listed), saving the
   * ones it changes. Returns how many it changed.
   */
  #rewrite(rewrite: (body: string, note: Note) => string) {
    this.flush();
    const changed: string[] = [];
    this.entries = this.entries.map((entry) => {
      if (entry.note.locked) return entry;
      const body = rewrite(entry.note.body, entry.note);
      if (body === entry.note.body) return entry;
      changed.push(entry.note.id);
      return entryOf({ ...entry.note, body });
    });
    for (const id of changed) void this.#save(id);
    if (this.selectedId && changed.includes(this.selectedId)) {
      this.remoteRevision = { id: this.selectedId, n: this.remoteRevision.n + 1 };
    }
    if (changed.length) this.#notify();
    return changed.length;
  }

  /** Called after every local change, e.g. to schedule a sync. */
  onLocalChange(listener: () => void) {
    this.#changeListeners.add(listener);
    return () => this.#changeListeners.delete(listener);
  }

  /** Lets the editor hand over typing it hasn't reported yet whenever we flush. */
  registerFlusher(flusher: () => void) {
    this.#flushers.add(flusher);
    return () => this.#flushers.delete(flusher);
  }

  /** Adds notes made from files (import.ts); returns how many, and the files that weren't of a kind lines reads. */
  async importFiles(files: File[]) {
    const { notesFromFiles } = await import("./import");
    const { notes, skipped } = await notesFromFiles(files);
    for (const note of notes) await this.insert(note);
    return { count: notes.length, skipped };
  }

  /** Adds a set of sample notes (see samples.ts); returns how many. */
  async addSamples(set: SampleSet) {
    const { sampleNotes } = await import("./samples");
    const added = await sampleNotes(set);
    for (const note of added) await this.insert(note);
    return added.length;
  }

  /**
   * Deletes every note on this device, locked and trashed ones too, and starts again with the
   * welcome note, the feature tour and the examples, as they are in this build. For trying out
   * new sample notes while developing; with sync on it would delete the synced notes too.
   */
  async reset() {
    await this.flush();
    await this.#deleteForever(this.entries.map((e) => e.note.id));
    const { sampleNotes } = await import("./samples");
    // The demo website starts with the tour, whose first note welcomes; elsewhere the welcome note comes first.
    const welcome: Note[] = isSite ? [] : [{ id: crypto.randomUUID(), body: WELCOME_NOTE, createdAt: 0, updatedAt: 0, pinned: false, trashed: false }];
    const now = Date.now();
    // A second apart, so the list shows them in this order: welcome, tour, examples.
    const all = [...welcome, ...(await sampleNotes("tour")), ...(await sampleNotes("examples"))].map((note, i) => ({
      ...note,
      createdAt: now - i * 1000,
      updatedAt: now - i * 1000,
    }));
    for (const note of [...all].reverse()) await this.insert(note);
    this.filter = { kind: "all" };
    this.query = "";
    this.select(all[0].id);
    return all.length;
  }

  /** Adds a note with this text without opening it (one made from a mention, say); returns its id. */
  add(body: string): string {
    const now = Date.now();
    const note: Note = { id: crypto.randomUUID(), body, createdAt: now, updatedAt: now, pinned: false, trashed: false };
    void this.insert(note);
    return note.id;
  }

  async insert(note: Note) {
    this.entries = [entryOf(note), ...this.entries];
    await this.#save(note.id);
    this.#notify();
  }

  /** Store a note that came from a sync backend, without treating it as a local edit. */
  async applyRemote(incoming: Note) {
    noteKeys.notice(incoming);
    const note = await this.#opened(incoming);
    const entry = entryOf(note);
    const exists = this.entries.some((e) => e.note.id === note.id);
    this.entries = exists
      ? this.entries.map((e) => (e.note.id === note.id ? entry : e))
      : [entry, ...this.entries];
    clearTimeout(this.#pending.get(note.id));
    this.#pending.delete(note.id);
    this.remoteRevision = { id: note.id, n: this.remoteRevision.n + 1 };
    await this.#storage.put(stored(note));
    void announce({ type: "note", id: note.id, local: false });
  }

  /** Remove a note that was deleted on another device. */
  async removeRemote(id: string) {
    clearTimeout(this.#pending.get(id));
    this.#pending.delete(id);
    this.entries = this.entries.filter((e) => e.note.id !== id);
    if (this.selectedId === id) this.selectedId = null;
    await this.#storage.delete(id);
    void announce({ type: "note", id, local: false });
  }

  /**
   * Picks up a note another window (a floating note, or the main window) saved or deleted.
   * Unsaved typing here wins. `local` edits are the person's own, so they count as local changes
   * here too: only the main window syncs, and this is how it hears about them.
   */
  async reload(id: string, local: boolean) {
    if (this.#hasUnsaved(id)) return;
    const found = await this.#storage.get(id);
    if (found) noteKeys.notice(found);
    const note = found && (await this.#opened(found));
    if (this.#hasUnsaved(id)) return;
    const current = this.get(id);
    if (!note) {
      if (!current) return;
      this.entries = this.entries.filter((e) => e.note.id !== id);
      if (this.selectedId === id) this.selectedId = null;
    } else {
      if (current && JSON.stringify(stored(current.note)) === JSON.stringify(found)) return;
      const entry = entryOf(note);
      this.entries = current ? this.entries.map((e) => (e.note.id === id ? entry : e)) : [entry, ...this.entries];
      if (current?.note.body !== note.body) this.remoteRevision = { id, n: this.remoteRevision.n + 1 };
    }
    if (local) this.#notify();
  }

  /** Whether this window has edits to the note it hasn't saved, including typing in the editor. */
  #hasUnsaved(id: string) {
    for (const flusher of this.#flushers) flusher();
    return this.#pending.has(id);
  }

  /** Write any pending saves immediately (e.g. when the app is backgrounded or a window closes). */
  flush(): Promise<void> {
    for (const flusher of this.#flushers) flusher();
    const writes = [];
    for (const [id, timer] of this.#pending) {
      clearTimeout(timer);
      writes.push(this.#save(id));
    }
    return Promise.all(writes).then(() => {});
  }

  #patch(id: string, changes: Partial<Note>) {
    this.entries = this.entries.map((e) => {
      if (e.note.id !== id) return e;
      const note = { ...e.note, ...changes };
      // An edit to a locked note waits to be encrypted again, which saving does.
      if (note.locked && changes.body !== undefined) note.locked = { ...note.locked, sealed: "" };
      return changes.body === undefined && !("locked" in changes) && !("format" in changes) ? { note, meta: e.meta } : entryOf(note);
    });
    clearTimeout(this.#pending.get(id));
    this.#pending.set(id, setTimeout(() => this.#save(id), SAVE_DELAY));
    this.#notify();
  }

  #notify() {
    for (const listener of this.#changeListeners) listener();
  }

  async #save(id: string) {
    this.#pending.delete(id);
    let note = this.get(id)?.note;
    if (!note) return;
    if (note.locked && !note.locked.sealed) note = await this.#seal(note);
    await this.#storage.put(stored(note));
    void announce({ type: "note", id, local: true });
  }

  /** Encrypts an open locked note's Markdown, ready to store and sync. */
  async #seal(note: Note): Promise<Note> {
    const sealed = { ...note, locked: await noteKeys.seal(note) };
    // Unless it was edited meanwhile; that edit has a save of its own coming.
    if (this.get(note.id)?.note === note) {
      this.entries = this.entries.map((e) => (e.note === note ? { note: sealed, meta: e.meta } : e));
    }
    return sealed;
  }

  /** A locked note, opened if its key is. */
  async #opened(note: Note): Promise<Note> {
    if (!note.locked) return note;
    try {
      const body = await noteKeys.open(note.locked);
      if (body !== null) return { ...note, body, locked: { ...note.locked, open: true } };
    } catch (error) {
      console.error(`lines: couldn't open locked note ${note.id}`, error);
    }
    return note;
  }

  #discardIfBlank(id: string) {
    const entry = this.get(id);
    if (entry?.note.locked) return void this.#templates.delete(id);
    const untouched = entry && (isBlank(entry.note.body) || entry.note.body === this.#templates.get(id)?.body);
    this.#templates.delete(id);
    if (entry && !entry.note.trashed && untouched) void this.deleteForever(id);
  }
}

export const noteStorage = new IndexedDBStorage();
export const notes = new NotesStore(noteStorage);
