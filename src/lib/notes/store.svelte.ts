import type { IconName } from "../icons/icons";
import type { PaletteColor } from "../palette";
import { vault } from "../lock/vault";
import { isSite } from "../platform";
import { DEFAULT_LANGUAGE, plugins } from "../plugins/registry.svelte";
import type { Made, NoteLanguage } from "../plugins/types";
import { prefs } from "../prefs.svelte";
import { untrack } from "svelte";
import { announce } from "../windows/channel";
import { isOn } from "./calendar";
import { noteKeys } from "./noteKeys.svelte";
import type { SampleSet } from "./samples";
import { normalizeTag, renameTagIn, renameTypeIn } from "./parse";
import { nameOf } from "./properties";
import { IndexedDBStorage, syncRecords, type NoteStorage } from "./storage";
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
/** After a write fails, how long the next waits: twice as long after each failure since, up to RETRY_MAX. */
const RETRY_DELAY = 1000;
const RETRY_MAX = 60_000;
const SEEDED_KEY = "lines.seeded";
/** Before each note's id: a note `leave` kept in localStorage, not stored yet. */
const KEPT_KEY = "lines.unsaved.";

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
  if (!note.locked) return plugins.meta(note.format, note.body);
  const title = note.locked.open ? plugins.meta(note.format, note.body).title : note.locked.title;
  return { title, excerpt: "", tags: [], hasOpenTodos: false, searchText: title.toLowerCase(), properties: [], type: "" };
}

const entryOf = (note: Note): Entry => ({ note, meta: metaOf(note) });

/** A locked note, opened if its key is. */
export async function opened(note: Note): Promise<Note> {
  if (!note.locked) return note;
  try {
    const body = await noteKeys.open(note.locked);
    if (body !== null) return { ...note, body, locked: { ...note.locked, open: true } };
  } catch (error) {
    console.error(`lines: couldn't open locked note ${note.id}`, error);
  }
  return note;
}

/** A note as it's stored and synced: a locked one without its Markdown. */
export function stored(note: Note): Note {
  if (!note.locked) return note;
  const { open: _, ...locked } = note.locked;
  return { ...note, body: "", locked };
}

function matchesTag(tags: string[], tag: string) {
  return tags.some((t) => t === tag || t.startsWith(tag + "/"));
}

/** The list's order: pinned notes first, then the latest edited. */
const listOrder = (a: Entry, b: Entry) => Number(b.note.pinned) - Number(a.note.pinned) || b.note.updatedAt - a.note.updatedAt;

/**
 * Work done once for each version of a note (its entry, or its meta, which is new only when its
 * text is), rather than again for every note whenever one changes.
 */
function cached<K extends object, V>(compute: (key: K) => V) {
  const cache = new WeakMap<K, V>();
  return (key: K) => {
    let value = cache.get(key);
    if (value === undefined) cache.set(key, (value = compute(key)));
    return value;
  };
}

/** A note's tags, and the tags they're nested under (`travel` for `#travel/italy`). */
const tagPathsOf = cached((meta: NoteMeta) => {
  const paths = new Set<string>();
  for (const tag of meta.tags) {
    const parts = tag.split("/");
    for (let i = 1; i <= parts.length; i++) paths.add(parts.slice(0, i).join("/"));
  }
  return [...paths];
});

/** A note's title as a mention finds it. */
const mentionNameOf = cached((meta: NoteMeta) => nameOf(meta.title));

/** What mentions and type tables show of a note (`objectsSignature`). */
const objectLineOf = cached(({ note, meta }: Entry) =>
  [note.id, meta.title, note.icon, meta.type, ...meta.properties.map((p) => `${p.key}:${p.value}`)].join("\u0001"),
);

class NotesStore {
  #storage: NoteStorage;
  /**
   * Notes changed and not stored yet, each with when it's due to be (SAVE_DELAY after its last
   * change), the soonest first. One timer saves those due together.
   */
  #pending = new Map<string, number>();
  #saveTimer: ReturnType<typeof setTimeout> | undefined;
  /** Writes that failed in a row, and when the next may be tried (`performance.now()`). */
  #failures = 0;
  #retryAt = 0;
  /** Each note's write under way, so its writes land in order and `flush` can wait for them. */
  #saving = new Map<string, Promise<void>>();
  /** The notes `leave` kept in localStorage, until they're stored. */
  #kept = new Set<string>();
  /** Notes sync changed in another window while they had unsaved edits here (`#typingWins`). */
  #typedOverSync = new Set<string>();
  #changeListeners = new Set<() => void>();
  #flushers = new Set<() => void>();
  /**
   * What new notes started as, so one left untouched can be discarded like a blank one, and the
   * tag or type they were made in, to start them again in another language.
   */
  #templates = new Map<string, { body: string; made: Made }>();
  /** Notes moved to the trash since the last edit, most recent last, for undo; those trashed together share a batch. */
  #trashed: { id: string; pinned: boolean; selected: boolean; batch: number }[] = [];
  /** A note's text before it was last changed from outside its editor (moved on the Calendar), for undo. */
  #edited: { id: string; body: string } | null = null;
  #batch = 0;
  /** Where a ⇧-click range starts from: the note last ⌘-clicked, or the open one. */
  #anchor: string | null = null;

  /** Immutable entries: an edit replaces one entry, so unrelated list rows never re-render. */
  entries = $state.raw<Entry[]>([]);
  ready = $state(false);
  /** Why notes couldn't be loaded, if they couldn't. */
  loadError = $state<string | null>(null);
  /** Why the last write failed, until one works again. Its notes are tried again meanwhile. */
  saveError = $state<string | null>(null);
  selectedId = $state<string | null>(null);
  /**
   * Notes picked in the list to act on together (⌘-click, ⇧-click, ⌘A), the open one among them.
   * Empty when it's just the open note. A new set for each change, so picking thousands of notes
   * wakes the list once rather than once for each.
   */
  picked = $state.raw<ReadonlySet<string>>(new Set());
  filter = $state<Filter>({ kind: "all" });
  query = $state("");
  /** A freshly created note that the editor should focus once it opens. */
  pendingFocus = $state<string | null>(null);
  /** Bumped when notes change from outside the editor (e.g. sync), so editors with them open can refresh. */
  remoteRevision = $state<{ ids: string[]; n: number }>({ ids: [], n: 0 });
  /** Bumped when locked notes open or close, so editors take up (or let go of) their text. */
  lockRevision = $state(0);

  /** Each entry by its note's id. */
  #byId = $derived(new Map(this.entries.map((entry) => [entry.note.id, entry])));

  selected = $derived(this.selectedId === null ? null : (this.#byId.get(this.selectedId) ?? null));

  /** The list's order as last worked out, and its entries by id then (`#ordered`). */
  #lastOrder = { entries: [] as Entry[], byId: new Map<string, Entry>() };

  /**
   * Every entry in the list's order. Sorted from the last order, with each entry as it is now and
   * new ones first: after an edit that's in order but for a note or two, which sorts in about one
   * pass. Choosing a list or searching only filters it.
   */
  #ordered = $derived.by(() => {
    const byId = this.#byId;
    const last = this.#lastOrder;
    const ordered = this.entries.filter(({ note }) => !last.byId.has(note.id));
    for (const { note } of last.entries) {
      const entry = byId.get(note.id);
      if (entry) ordered.push(entry);
    }
    ordered.sort(listOrder);
    this.#lastOrder = { entries: ordered, byId };
    return ordered;
  });

  visible = $derived.by(() => {
    const f = this.filter;
    const terms = this.query.toLowerCase().split(/\s+/).filter(Boolean);
    return this.#ordered.filter(({ note, meta }) => {
      if (f.kind === "trash") {
        if (!note.trashed) return false;
      } else {
        if (note.trashed) return false;
        if (f.kind === "inbox" && !note.inbox) return false;
        if (f.kind === "todo" && !meta.hasOpenTodos) return false;
        if (f.kind === "untagged" && meta.tags.length) return false;
        if (f.kind === "tag" && !matchesTag(meta.tags, f.tag)) return false;
        if (f.kind === "type" && meta.type !== f.type) return false;
        if (f.kind === "calendar" && !isOn(note, meta, f.day, prefs.calendarEdited)) return false;
      }
      return terms.every((t) => meta.searchText.includes(t));
    });
  });

  counts = $derived.by(() => {
    let inbox = 0, all = 0, todo = 0, untagged = 0, trash = 0;
    for (const { note, meta } of this.entries) {
      if (note.trashed) { trash++; continue; }
      all++;
      if (note.inbox) inbox++;
      if (meta.hasOpenTodos) todo++;
      if (!meta.tags.length) untagged++;
    }
    return { inbox, all, todo, untagged, trash };
  });

  /**
   * Tag counts serialized to a string. Typing that doesn't change tags yields an
   * identical string, so the tag tree below doesn't rebuild on every keystroke.
   */
  #tagSignature = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const { note, meta } of this.entries) {
      if (note.trashed) continue;
      for (const path of tagPathsOf(meta)) counts.set(path, (counts.get(path) ?? 0) + 1);
    }
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([t, n]) => `${t}\t${n}`).join("\n");
  });

  /** Every tag and how many notes have it, nested ones by their whole path (`work/meetings`), in order. */
  tags = $derived(
    this.#tagSignature
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [path, count] = line.split("\t");
        return { path, count: Number(count) };
      }),
  );

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
      if (entry.note.trashed) continue;
      const name = mentionNameOf(entry.meta);
      if (!name) continue;
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
      .map(objectLineOf)
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
      let all = await this.#storeKept(await this.#storage.all());
      if (!all.length && !seeded()) {
        all = await firstNotes();
        for (const note of all) await this.#storage.put(note);
        // The demo website opens its first note, so a visitor isn't met by an empty page.
        if (isSite) this.selectedId = all[0]?.id ?? null;
      }
      for (const note of all) noteKeys.notice(note);
      this.entries = await Promise.all(all.map(async (note) => entryOf(await opened(note))));
      this.ready = true;
    } catch (error) {
      console.error("lines: couldn't load notes", error);
      this.loadError = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Stores the notes `leave` kept that the page went before storing, and returns `all` with them.
   * Not over a note stored since with a later edit, nor over one locked since.
   */
  async #storeKept(all: Note[]): Promise<Note[]> {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(KEPT_KEY));
    if (!keys.length) return all;
    const byId = new Map(all.map((note) => [note.id, note]));
    const newer: Note[] = [];
    for (const key of keys) {
      try {
        const note: Note = JSON.parse(localStorage.getItem(key)!);
        const was = byId.get(note.id);
        if (note.id === key.slice(KEPT_KEY.length) && (!was || (!was.locked && was.updatedAt < note.updatedAt))) newer.push(note);
      } catch {
        // Not a note: nothing to store.
      }
    }
    try {
      if (newer.length) await this.#storage.put(...newer);
    } catch (error) {
      console.error("lines: couldn't store what was typed as lines closed", error);
      return all;
    }
    for (const key of keys) localStorage.removeItem(key);
    for (const note of newer) {
      byId.set(note.id, note);
      void announce({ type: "note", id: note.id, local: true });
    }
    return [...byId.values()];
  }

  get(id: string) {
    return this.#byId.get(id);
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

  /**
   * Makes a new note and opens it, ready to type its title; `body` is what it starts as, if not the
   * usual, and `made` what it's made as, if not what the list shown gives it. Not `open`, it's made
   * where it is, for its title to be typed there (an event on the Calendar).
   */
  create(body?: string, made?: Made, { open = true } = {}): string {
    const now = Date.now();
    const f = this.filter;
    // Made under a tag it has the tag; made under a type, it's one of that type; made on a day, it's dated that day.
    made ??= f.kind === "tag" ? { tag: f.tag } : f.kind === "type" ? { type: f.type } : f.kind === "calendar" ? { properties: { date: f.day } } : {};
    const note: Note = {
      id: crypto.randomUUID(),
      body: body ?? plugins.language().newNote(made),
      createdAt: now,
      updatedAt: now,
      pinned: false,
      trashed: false,
      ...(prefs.newNotes === "inbox" && { inbox: true }),
    };
    this.#templates.set(note.id, { body: note.body, made });
    if (this.filter.kind === "trash") this.filter = { kind: "all" };
    this.query = "";
    this.entries = [entryOf(note), ...this.entries];
    if (open) {
      this.pendingFocus = note.id;
      this.select(note.id);
    }
    this.#notify();
    return note.id;
  }

  update(id: string, body: string) {
    // Typing makes the editor's own undo the one ⌘Z should reach.
    this.#trashed = [];
    this.#edited = null;
    this.#patch(id, { body, updatedAt: Date.now() });
  }

  /** Changes a note's text from outside its editor, as moving it on the Calendar does; ⌘Z puts it back. */
  edit(id: string, body: string) {
    const entry = this.get(id);
    if (!entry || entry.note.body === body) return;
    this.#trashed = [];
    this.#edited = { id, body: entry.note.body };
    this.#patch(id, { body, updatedAt: Date.now() });
    this.#changedOutside([id]);
  }

  /** Puts back the note `edit` last changed, if nothing was done since. */
  undoEdit() {
    const edited = this.#edited;
    this.#edited = null;
    if (!edited || !this.get(edited.id)) return false;
    this.#patch(edited.id, { body: edited.body, updatedAt: Date.now() });
    this.#changedOutside([edited.id]);
    return true;
  }

  /** The picked notes still in the list, in its order. */
  get pickedEntries(): Entry[] {
    return this.picked.size ? this.visible.filter((e) => this.picked.has(e.note.id)) : [];
  }

  /** ⌘-click: adds the note to the picked ones (with the open one, the first time) and opens it, or takes it out. */
  togglePick(id: string) {
    const picked = new Set(this.picked);
    if (!picked.size && this.selectedId && this.selectedId !== id && this.visible.some((e) => e.note.id === this.selectedId)) {
      picked.add(this.selectedId);
    }
    this.#anchor = id;
    const unpicked = picked.delete(id);
    if (!unpicked) picked.add(id);
    this.picked = picked;
    if (!unpicked) this.select(id);
    else if (this.selectedId === id) this.select(this.pickedEntries.at(-1)?.note.id ?? null);
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
    this.picked = new Set(ids.slice(start, end + 1));
    this.select(id);
    this.#settlePicks();
  }

  /** ⌘A in the list: every note in it. */
  pickAll() {
    this.picked = new Set([...this.picked, ...this.visible.map((e) => e.note.id)]);
    this.#settlePicks();
  }

  clearPicks() {
    if (this.picked.size) this.picked = new Set();
    this.#anchor = null;
  }

  /** One note picked is just the open note. */
  #settlePicks() {
    if (this.picked.size > 1) return;
    const [only] = this.picked;
    if (only) {
      this.picked = new Set();
      this.select(only);
    }
  }

  /** Lets go of these notes, if they're picked. */
  #unpick(ids: Iterable<string>) {
    const picked = new Set(this.picked);
    for (const id of ids) picked.delete(id);
    if (picked.size !== this.picked.size) this.picked = picked;
  }

  /** Pins these notes, or unpins them. Like pinning one, it doesn't count as an edit. */
  setPinned(ids: string[], pinned: boolean) {
    this.#patch(ids, { pinned });
  }

  /** Adds `#tag` to these notes (not locked ones, whose text can't be read here), keeping their dates. */
  addTag(ids: string[], tag: string) {
    const target = normalizeTag(tag.replace(/^#/, ""));
    if (!target) return 0;
    const only = new Set(ids);
    return this.rewrite((body, note) => (only.has(note.id) ? plugins.language(note.format).addTag(body, target) : body));
  }

  /** Moves these notes to the trash together; ⌘Z brings them all back. */
  trashMany(ids: string[]) {
    const batch = ++this.#batch;
    this.#edited = null;
    const trashing = ids.map((id) => this.get(id)?.note).filter((note): note is Note => !!note && !note.trashed);
    for (const { id, pinned } of trashing) this.#trashed.push({ id, pinned, selected: this.selectedId === id, batch });
    this.#unpick(trashing.map((note) => note.id));
    this.#patch(trashing.map((note) => note.id), { trashed: true, pinned: false });
    if (trashing.some((note) => note.id === this.selectedId)) this.selectedId = null;
  }

  restoreMany(ids: string[]) {
    this.#patch(ids, { trashed: false });
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
    this.saveNow();
  }

  /** Takes the lock off an open note. */
  removeLock(id: string) {
    const entry = this.get(id);
    if (!entry?.note.locked?.open) return;
    this.#patch(id, { locked: undefined });
    this.saveNow();
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
    // Typing that comes in while they're saved is saved too, before their text goes.
    do await this.flush();
    while (this.entries.some(({ note }) => note.locked?.open && this.#hasUnsaved(note.id)));
    this.entries = this.entries.map((entry) => (entry.note.locked?.open ? entryOf(stored(entry.note)) : entry));
    this.lockRevision++;
  }

  /** Sets the note's icon, or takes it away. Like pinning, it doesn't count as an edit. */
  setIcon(id: string, icon: IconName | null) {
    this.#patch(id, { icon: icon ?? undefined });
  }

  setColor(id: string, color: PaletteColor | null) {
    this.#patch(id, { color: color ?? undefined });
  }

  /**
   * Writes the note in another language, by its id. Its text stays as it is, except a new note's,
   * which starts again the way that language starts one (in LaTeX, without Markdown's "# ", and a
   * tag it was made under in a comment, where LaTeX ignores it).
   */
  setFormat(id: string, format: string) {
    const entry = this.get(id);
    if (!entry || (entry.note.format ?? DEFAULT_LANGUAGE) === format) return;
    this.saveNow();
    const stored = format === DEFAULT_LANGUAGE ? undefined : format;
    const template = this.#templates.get(id);
    if (template && entry.note.body === template.body) {
      const body = plugins.language(format).newNote(template.made);
      this.#templates.set(id, { ...template, body });
      this.#patch(id, { body, format: stored });
      this.#changedOutside([id]);
      return;
    }
    this.#patch(id, { format: stored });
  }

  trash(id: string) {
    this.trashMany([id]);
  }

  /** Puts these notes in the Inbox, or takes them out of it (filed). */
  setInbox(ids: string[], inbox: boolean) {
    this.#patch(ids.filter((id) => !!this.get(id)?.note.inbox !== inbox), { inbox });
  }

  /** Brings back the notes most recently moved to the trash (together), if nothing was edited since. */
  undoTrash() {
    for (let last = this.#trashed.pop(); last; last = this.#trashed.pop()) {
      const batch = [last];
      while (this.#trashed.at(-1)?.batch === last.batch) batch.push(this.#trashed.pop()!);
      const back = batch.filter((trashed) => this.get(trashed.id)?.note.trashed);
      if (!back.length) continue;
      for (const pinned of [true, false]) {
        this.#patch(back.filter((trashed) => trashed.pinned === pinned).map((trashed) => trashed.id), { trashed: false, pinned });
      }
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
    this.#unpick(ids);
    for (const id of ids) {
      this.#pending.delete(id);
      this.#templates.delete(id);
      if (this.#kept.delete(id)) localStorage.removeItem(KEPT_KEY + id);
    }
    this.entries = this.entries.filter((e) => !gone.has(e.note.id));
    if (this.selectedId && gone.has(this.selectedId)) this.selectedId = null;
    this.#notify();
    // A write still under way would bring them back.
    await Promise.allSettled(ids.map((id) => this.#saving.get(id)));
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
    this.rewrite((body) => renameTagIn(body, from, to));
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
    this.rewrite((body) => renameTypeIn(body, from, to.trim()));
    // Keep showing the same notes under their new name.
    if (this.filter.kind === "type" && this.filter.type === from) this.filter = { kind: "type", type: target };
  }

  /**
   * Rewrites every note's text with `rewrite` (but locked notes', which aren't listed), saving the
   * ones it changes, open ones included. Returns how many it changed.
   */
  rewrite(rewrite: (body: string, note: Note) => string) {
    this.saveNow();
    const changed: string[] = [];
    this.entries = this.entries.map((entry) => {
      if (entry.note.locked) return entry;
      const body = rewrite(entry.note.body, entry.note);
      if (body === entry.note.body) return entry;
      changed.push(entry.note.id);
      return entryOf({ ...entry.note, body });
    });
    void this.#save(changed);
    if (changed.length) {
      this.#changedOutside(changed);
      this.#notify();
    }
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
    // A synced note's file keeps its id, unless a note here has it: an import never takes another's place.
    const ids = new Set(this.entries.map((entry) => entry.note.id));
    for (const note of notes) {
      if (ids.has(note.id)) note.id = crypto.randomUUID();
      ids.add(note.id);
      // New here, so to be sorted, as a note made here is.
      if (prefs.newNotes === "inbox") note.inbox = true;
      noteKeys.notice(note);
    }
    await this.insert(...notes);
    return { count: notes.length, skipped };
  }

  /** Adds a set of sample notes (see samples.ts); returns how many. */
  async addSamples(set: SampleSet) {
    const { sampleNotes } = await import("./samples");
    const added = await sampleNotes(set);
    await this.insert(...added);
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
    await this.insert(...all);
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

  /** Adds these notes as they are, without opening them. */
  async insert(...added: Note[]) {
    if (!added.length) return;
    this.entries = [...added.map(entryOf), ...this.entries];
    await this.#save(added.map((note) => note.id));
    this.#notify();
  }

  /**
   * Stores a note that came from a sync backend, without treating it as a local edit. Not if it
   * was edited here meanwhile (false): that edit wins, and syncs.
   */
  async applyRemote(incoming: Note) {
    noteKeys.notice(incoming);
    const note = await opened(incoming);
    if (this.#hasUnsaved(note.id)) return false;
    this.#put(entryOf(note));
    this.#changedOutside([note.id]);
    await this.#storage.put(stored(note));
    void announce({ type: "note", id: note.id, local: false });
    return true;
  }

  /** Removes a note that was deleted on another device, unless it was edited here meanwhile. */
  async removeRemote(id: string) {
    if (this.#hasUnsaved(id)) return;
    this.#drop(id);
    await this.#storage.delete(id);
    void announce({ type: "note", id, local: false });
  }

  /**
   * Picks up a note another window (a floating note, or the main window) saved or deleted.
   * Unsaved typing here wins. `local` edits are the person's own, so they count as local changes
   * here too: only the main window syncs, and this is how it hears about them.
   */
  async reload(id: string, local: boolean) {
    if (this.#typingWins(id, local)) return;
    const found = await this.#storage.get(id);
    if (found) noteKeys.notice(found);
    const note = found && (await opened(found));
    if (this.#typingWins(id, local)) return;
    const current = this.get(id);
    if (!note) {
      if (!current) return;
      this.#drop(id);
    } else {
      if (current && JSON.stringify(stored(current.note)) === JSON.stringify(found)) return;
      this.#put(entryOf(note));
      if (current?.note.body !== note.body) this.#changedOutside([id]);
    }
    if (local) this.#notify();
  }

  /**
   * Whether the note has unsaved edits here, which win over what another window stored. What sync
   * stored (not `local`) isn't lost though: once the edits are stored, the note's sync record goes
   * (`#save`), so the next pass takes it as changed on both sides and keeps the synced edit too.
   */
  #typingWins(id: string, local: boolean) {
    if (!this.#hasUnsaved(id)) return false;
    if (!local) this.#typedOverSync.add(id);
    return true;
  }

  /** Puts the entry in place of its note's, or first if the note is new here. */
  #put(entry: Entry) {
    const { id } = entry.note;
    this.entries = this.get(id) ? this.entries.map((e) => (e.note.id === id ? entry : e)) : [entry, ...this.entries];
  }

  /** Takes a note out of the list, deleted elsewhere. */
  #drop(id: string) {
    this.entries = this.entries.filter((e) => e.note.id !== id);
    if (this.selectedId === id) this.selectedId = null;
  }

  /** Whether this window has edits to the note it hasn't stored, including typing in the editor. */
  #hasUnsaved(id: string) {
    this.#handOver();
    return this.#pending.has(id) || this.#saving.has(id);
  }

  /** Takes what's been typed in the editors and not reported yet. */
  #handOver() {
    for (const flusher of this.#flushers) flusher();
  }

  /**
   * Writes any pending saves now, and waits for those under way (e.g. when the app is backgrounded
   * or a window closes). Fails if they couldn't be written.
   */
  async flush(): Promise<void> {
    this.#handOver();
    void this.#save([...this.#pending.keys()]);
    await Promise.all(this.#saving.values());
    if (this.saveError !== null) throw new Error(this.saveError);
  }

  /** `flush`, without waiting for it: should the writes fail, `saveError` says so, and they're tried again. */
  saveNow() {
    this.flush().catch(() => {});
  }

  /**
   * As the page may be going (closed, reloaded, hidden, or lines quitting): writes what isn't stored
   * yet, which may not finish in time, so keeps it in localStorage too, written at once, for the next
   * `load`. Not locked notes, nor anything while the app lock is on: their text is only ever stored
   * encrypted. Resolves once written, or once the write failed, which `saveError` shows.
   */
  leave(): Promise<void> {
    this.#handOver();
    if (!vault.sealing) {
      for (const id of new Set([...this.#pending.keys(), ...this.#saving.keys()])) {
        const note = this.get(id)?.note;
        if (!note || note.locked) continue;
        try {
          localStorage.setItem(KEPT_KEY + id, JSON.stringify(note));
          this.#kept.add(id);
        } catch {
          // Too big for localStorage: it has the write alone.
        }
      }
    }
    return this.flush().catch(() => {});
  }

  /** Takes what `leave` kept of a note out of localStorage, once the note is stored as it was then, or later. */
  #forgetKept({ id, updatedAt }: Note) {
    if (!this.#kept.has(id)) return;
    try {
      const kept: Note | null = JSON.parse(localStorage.getItem(KEPT_KEY + id) ?? "null");
      if (kept && kept.updatedAt > updatedAt) return;
      localStorage.removeItem(KEPT_KEY + id);
    } catch {
      // Unreadable: the next load drops it, as it's no newer than what's stored.
    }
    this.#kept.delete(id);
  }

  /** Changes a note, or several the same way, and saves them after a pause. */
  #patch(which: string | string[], changes: Partial<Note>) {
    const ids = new Set((typeof which === "string" ? [which] : which).filter((id) => this.get(id)));
    if (!ids.size) return;
    this.entries = this.entries.map((e) => {
      if (!ids.has(e.note.id)) return e;
      const note = { ...e.note, ...changes };
      // An edit to a locked note waits to be encrypted again, which saving does.
      if (note.locked && changes.body !== undefined) note.locked = { ...note.locked, sealed: "" };
      return changes.body === undefined && !("locked" in changes) && !("format" in changes) ? { note, meta: e.meta } : entryOf(note);
    });
    const due = performance.now() + SAVE_DELAY;
    for (const id of ids) {
      // Taken out and put back, so the soonest due stay first.
      this.#pending.delete(id);
      this.#pending.set(id, due);
    }
    this.#saveIn(SAVE_DELAY);
    this.#notify();
  }

  /** Saves the notes due in `delay` ms, unless a save is set already. */
  #saveIn(delay: number) {
    if (!this.#saveTimer) this.#saveTimer = setTimeout(() => this.#saveDue(), delay);
  }

  /** Saves the notes that are due, and waits for the next. */
  #saveDue() {
    this.#saveTimer = undefined;
    const now = performance.now();
    if (now < this.#retryAt) return this.#saveIn(this.#retryAt - now);
    const due: string[] = [];
    for (const [id, at] of this.#pending) {
      if (at > now) {
        this.#saveIn(at - now);
        break;
      }
      due.push(id);
    }
    void this.#save(due);
  }

  /** Tells the editors with these notes open that their text changed. */
  #changedOutside(ids: string[]) {
    this.remoteRevision = { ids, n: this.remoteRevision.n + 1 };
  }

  #notify() {
    for (const listener of this.#changeListeners) listener();
  }

  /** Writes these notes as they are now, in one go, after any writes of them already under way. */
  #save(ids: string[]): Promise<void> {
    if (!ids.length) return Promise.resolve();
    for (const id of ids) this.#pending.delete(id);
    const before = ids.map((id) => this.#saving.get(id));
    const saving = (async () => {
      await Promise.allSettled(before);
      const notes = ids.map((id) => this.get(id)?.note).filter((note) => note !== undefined);
      const sealed = await Promise.all(notes.map((note) => (note.locked && !note.locked.sealed ? this.#seal(note) : note)));
      if (!sealed.length) return;
      await this.#storage.put(...sealed.map(stored));
      const typedOver = sealed.map(({ id }) => id).filter((id) => this.#typedOverSync.has(id));
      if (typedOver.length) {
        await syncRecords.delete(...typedOver);
        for (const id of typedOver) this.#typedOverSync.delete(id);
      }
      for (const note of sealed) {
        this.#forgetKept(note);
        void announce({ type: "note", id: note.id, local: true });
      }
    })()
      .then(() => this.#saved(), (error) => this.#failed(ids, error))
      .finally(() => {
        for (const id of ids) if (this.#saving.get(id) === saving) this.#saving.delete(id);
      });
    for (const id of ids) this.#saving.set(id, saving);
    return saving;
  }

  /** A write worked: saving goes on as usual. */
  #saved() {
    this.#failures = 0;
    this.#retryAt = 0;
    this.saveError = null;
  }

  /** A write failed (the disk is full, say): its notes are tried again, after longer each time it fails. */
  #failed(ids: string[], error: unknown) {
    console.error("lines: couldn't save notes", error);
    this.saveError = error instanceof Error ? error.message : String(error);
    const now = performance.now();
    this.#retryAt = now + Math.min(RETRY_DELAY * 2 ** this.#failures++, RETRY_MAX);
    for (const id of ids) if (this.get(id) && !this.#pending.has(id)) this.#pending.set(id, now + SAVE_DELAY);
    this.#saveIn(this.#retryAt - now);
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

  #discardIfBlank(id: string) {
    // Typing the editor hasn't reported yet counts.
    this.#handOver();
    const entry = this.get(id);
    if (entry?.note.locked) return void this.#templates.delete(id);
    const untouched = entry && (isBlank(entry.note.body) || entry.note.body === this.#templates.get(id)?.body);
    this.#templates.delete(id);
    if (entry && !entry.note.trashed && untouched) void this.deleteForever(id);
  }
}

export const noteStorage = new IndexedDBStorage();
export const notes = new NotesStore(noteStorage);
