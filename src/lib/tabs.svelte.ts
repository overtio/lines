import { notes } from "./notes/store.svelte";
import { prefs } from "./prefs.svelte";
import { ui } from "./ui.svelte";

/*
 * Tabs (Settings → General → Layout, off by default): the notes opened, side by side above the note,
 * as in a code editor. A note opened from the list shows in a preview tab, in italics, which the
 * next note opened takes over; editing the note, or double-clicking its tab, keeps it open. The
 * open note is the selected one: picking a note anywhere opens it here. Tabs are kept until the
 * next launch, and not shown at phone width, where one pane shows at a time.
 */

export interface Tab {
  id: string;
  /** Only shown until another note opens in its place. */
  preview: boolean;
}

const KEY = "lines.tabs";

function read(): { list: Tab[]; active: string | null } {
  try {
    const { list, active } = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (Array.isArray(list)) {
      return {
        list: list.filter((tab) => typeof tab?.id === "string").map((tab) => ({ id: tab.id, preview: tab.preview === true })),
        active: typeof active === "string" ? active : null,
      };
    }
  } catch {
    // Unreadable: no tabs.
  }
  return { list: [], active: null };
}

class Tabs {
  #stored = read();
  list = $state<Tab[]>(this.#stored.list);
  /** The tab last opened: what's shown again when the selection goes. */
  #active = this.#stored.active;
  /** Each tab's note as last seen: an edit since keeps a preview, and trashing it closes the tab. */
  #seen = new Map<string, { updatedAt: number; trashed: boolean }>();

  readonly shown = $derived(prefs.tabs && ui.layout !== "narrow");

  /**
   * Keeps the tabs in step with the notes and the selection (called by the tab bar's effect): a
   * note picked opens in the preview tab, or a new one after the open tab; a tab whose note was
   * deleted or trashed closes; and when the selection goes (the list now shows other notes, or the
   * note was trashed), the open tab, or the one beside the closed one, is shown again.
   */
  follow() {
    if (!notes.ready) return;
    const selected = notes.selectedId;
    const before = this.list;
    const list: Tab[] = [];
    for (const tab of before) {
      const note = notes.get(tab.id)?.note;
      const seen = this.#seen.get(tab.id);
      if (!note || (note.trashed && seen && !seen.trashed)) continue;
      const edited = !!seen && note.updatedAt !== seen.updatedAt;
      this.#seen.set(tab.id, { updatedAt: note.updatedAt, trashed: note.trashed });
      list.push(edited && tab.preview ? { id: tab.id, preview: false } : tab);
    }
    if (selected && !list.some((tab) => tab.id === selected)) {
      const note = notes.get(selected)?.note;
      if (note) this.#seen.set(selected, { updatedAt: note.updatedAt, trashed: note.trashed });
      const tab = { id: selected, preview: true };
      const preview = list.findIndex((each) => each.preview);
      if (preview >= 0) list[preview] = tab;
      else {
        const at = list.findIndex((each) => each.id === this.#active);
        list.splice(at < 0 ? list.length : at + 1, 0, tab);
      }
    }
    let next = this.#active;
    if (selected) next = selected;
    else if (this.#active) {
      const at = before.findIndex((tab) => tab.id === this.#active);
      next = (list.find((tab) => tab.id === this.#active) ?? list[Math.min(at, list.length - 1)])?.id ?? null;
    }
    this.#set(list, next);
    if (!selected && next) notes.select(next);
  }

  /** Closes a tab; closing the open one opens the one beside it. */
  close(id: string) {
    const at = this.list.findIndex((tab) => tab.id === id);
    if (at < 0) return;
    const list = this.list.filter((tab) => tab.id !== id);
    if (notes.selectedId !== id) return this.#set(list, this.#active);
    const next = list[Math.min(at, list.length - 1)]?.id ?? null;
    this.#set(list, next);
    notes.select(next);
  }

  /** Closes every tab but this one, which it opens. */
  closeOthers(id: string) {
    this.#set(
      this.list.filter((tab) => tab.id === id),
      id,
    );
    if (notes.selectedId !== id) notes.select(id);
  }

  /** Opens a note in a tab of its own (not a preview) after the open one; `show` switches to it, else it waits there. */
  open(id: string, show: boolean) {
    let list: Tab[];
    if (this.list.some((tab) => tab.id === id)) list = this.list.map((tab) => (tab.id === id ? { id, preview: false } : tab));
    else {
      list = [...this.list];
      const at = list.findIndex((tab) => tab.id === this.#active);
      list.splice(at < 0 ? list.length : at + 1, 0, { id, preview: false });
    }
    this.#set(list, this.#active);
    if (show) notes.show(id);
  }

  /** Keeps a preview tab open, as an edit does. */
  keep(id: string) {
    this.#set(
      this.list.map((tab) => (tab.id === id && tab.preview ? { id, preview: false } : tab)),
      this.#active,
    );
  }

  /** Tabs off: they go, rather than coming back long after. */
  clear() {
    this.#set([], null);
  }

  #set(list: Tab[], active: string | null) {
    const same = list.length === this.list.length && list.every((tab, i) => tab.id === this.list[i].id && tab.preview === this.list[i].preview);
    if (same && active === this.#active) return;
    if (!same) this.list = list;
    this.#active = active;
    for (const id of this.#seen.keys()) if (!list.some((tab) => tab.id === id)) this.#seen.delete(id);
    try {
      localStorage.setItem(KEY, JSON.stringify({ list, active }));
    } catch {
      // Storage that can't be written: the tabs last until lines restarts.
    }
  }
}

export const tabs = new Tabs();
