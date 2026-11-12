import { canDrop, dropNote } from "./notes/noteDrops";
import { notes } from "./notes/store.svelte";
import { along, type Direction, MAIN, type PaneTree, panesOf, replacedPane, resized, sharesOf, swappedPanes, topPanes, withoutPane, withPane } from "./panes";
import { NOTE_MIN, ui } from "./ui.svelte";

/** The narrowest and shortest a pane is made by splitting. */
export const PANE_MIN = { width: 300, height: 180 };

/** Where in a pane something dragged would go: beside it, on one side, or in its place. */
export type Zone = Direction | "center";

/** How near a pane's edge, as a share of its size, something dragged goes beside it rather than in its place. */
const EDGE = 0.25;

/** The zone of a pane's box a point is in: the nearest edge, if near enough, or its middle. */
function zoneAt(box: DOMRect, x: number, y: number): Zone {
  const [left, top] = [(x - box.left) / box.width, (y - box.top) / box.height];
  const edges: [number, Direction][] = [
    [left, "left"],
    [1 - left, "right"],
    [top, "up"],
    [1 - top, "down"],
  ];
  const [distance, nearest] = edges.reduce((a, b) => (b[0] < a[0] ? b : a));
  return distance < EDGE ? nearest : "center";
}

/**
 * The note's place in this window, split into panes (panes.ts): the layout, and the pane last used,
 * where a note opened beside goes. Kept while lines is open.
 */
class Panes {
  tree = $state.raw<PaneTree>({ pane: MAIN });
  /** The pane last clicked or typed in. */
  active = $state(MAIN);
  /** A note dragged from the list, or a pane by its grip, over the panes, and where it would go if let go. */
  drag = $state.raw<{ kind: "note" | "pane"; id: string } | null>(null);
  dropAt = $state.raw<{ pane: string; zone: Zone } | null>(null);
  /** The sidebar row what's dragged would be dropped on instead (noteDrops.ts), as its `data-note-drop` says. */
  rowAt = $state<string | null>(null);
  /** Where the pointer is, while lines follows the drag itself (`follow`), to show the note's title there. */
  pointer = $state.raw<{ x: number; y: number } | null>(null);

  constructor() {
    // A note dragged from the list as the browser drags it (NoteRow.svelte), or back into the window
    // once handed to macOS: over the panes and the sidebar it shows where it would go, and it's never
    // dropped into a note's text or taken in as a file. Before it's handled anywhere else.
    window.addEventListener(
      "dragover",
      (event) => {
        if (!this.drag) return;
        event.preventDefault();
        event.stopPropagation();
        this.#over(event.clientX, event.clientY);
        if (event.dataTransfer) event.dataTransfer.dropEffect = this.dropAt || this.rowAt ? "copy" : "none";
      },
      true,
    );
    window.addEventListener(
      "drop",
      (event) => {
        if (!this.drag) return;
        event.preventDefault();
        event.stopPropagation();
        this.drop();
      },
      true,
    );
    window.addEventListener("dragleave", (event) => {
      if (this.drag && !event.relatedTarget) this.handedOut();
    });
    window.addEventListener("dragend", () => this.endDrag());
  }

  /** The notes open in panes of their own. */
  get ids(): string[] {
    return panesOf(this.tree).filter((pane) => pane !== MAIN);
  }

  /** The layout drawn: the panes while there's room for them, or else the open note's alone. */
  get shownTree(): PaneTree {
    return this.shown ? this.tree : { pane: MAIN };
  }

  /** The panes along the window's top, whose headers are its title bar. */
  get top(): Set<string> {
    return topPanes(this.tree);
  }

  /** Whether there's room to show more than the open note: not on a phone, and its pane's not too narrow. */
  get shown() {
    return ui.layout !== "narrow" && ui.editorWidth >= NOTE_MIN + PANE_MIN.width;
  }

  /** The pane a note opened beside goes beside: the last used, if it's still there. */
  get #at() {
    return panesOf(this.tree).includes(this.active) ? this.active : MAIN;
  }

  /** Whether the pane last used has room to be split that way, each half as big as a pane can be. */
  fits(direction: Direction) {
    if (!this.shown) return false;
    const share = sharesOf(this.tree).get(this.#at)!;
    return along(direction) === "row" ? share.width * ui.editorWidth >= 2 * PANE_MIN.width : share.height * ui.editorHeight >= 2 * PANE_MIN.height;
  }

  /** Opens a note in a pane to the right of, or below, the one last used; one already in a pane is just used. */
  open(id: string, direction: Direction) {
    if (id === notes.selectedId) return;
    if (!this.ids.includes(id)) this.tree = withPane(this.tree, this.#at, id, direction);
    this.active = id;
  }

  close(id: string) {
    this.tree = withoutPane(this.tree, id);
    if (this.active === id) this.active = MAIN;
  }

  /** The note in pane `id` to the open note's place, and the open one to its pane; with none open (the Calendar's week), just to its place. */
  toMain(id: string) {
    const main = notes.selectedId;
    this.tree = main ? replacedPane(this.tree, id, main) : withoutPane(this.tree, id);
    notes.select(id);
    this.active = MAIN;
  }

  /** Starts dragging a note (from the list) or a pane (by its grip): one already in a pane moves that pane. */
  startDrag(kind: "note" | "pane", id: string) {
    this.drag = { kind: kind === "note" && this.ids.includes(id) ? "pane" : kind, id };
  }

  /** The pointer at this point, in a drag lines follows itself: where what's dragged would go, and its title beside the pointer. */
  follow(x: number, y: number) {
    this.pointer = { x, y };
    this.#over(x, y);
  }

  /** The drag's gone out of the window, to macOS (dragOut.ts, which ends it): nothing here is under it. */
  handedOut() {
    [this.pointer, this.dropAt, this.rowAt] = [null, null, null];
  }

  /** Where what's dragged would go at this point: a sidebar row that takes it, or else the pane under it and its zone, where that makes sense and there's room. */
  #over(x: number, y: number) {
    const drag = this.drag;
    [this.dropAt, this.rowAt] = [null, null];
    if (!drag) return;
    // Under the cover lines puts over the window while it follows a drag (DragLabel.svelte).
    const under = document.elementsFromPoint(x, y).find((element) => !element.closest("[data-drag-cover]"));
    const target = under?.closest<HTMLElement>("[data-note-drop]")?.dataset.noteDrop;
    if (target && canDrop(target, drag.id)) {
      this.rowAt = target;
      return;
    }
    // Into the panes only while there's room for them; a note can still be dropped on the sidebar's rows.
    if (!this.shown) return;
    for (const place of document.querySelectorAll<HTMLElement>("[data-pane-place]")) {
      const box = place.getBoundingClientRect();
      if (x < box.left || x > box.right || y < box.top || y > box.bottom) continue;
      const pane = place.dataset.panePlace!;
      const zone = zoneAt(box, x, y);
      // Onto itself, or the open note onto its own pane, is nowhere; beside a pane, only with room for both.
      if (pane === drag.id || (drag.kind === "note" && drag.id === notes.selectedId)) return;
      if (zone !== "center" && (along(zone) === "row" ? box.width < 2 * PANE_MIN.width : box.height < 2 * PANE_MIN.height)) return;
      this.dropAt = { pane, zone };
      return;
    }
  }

  /** Lets go of what's dragged where it would go: onto a sidebar row; beside a pane, or in its place (in the open note's, opened; in another's, swapped). */
  drop() {
    const { drag, dropAt, rowAt } = this;
    this.endDrag();
    if (!drag) return;
    if (rowAt) return dropNote(rowAt, drag.id);
    if (!dropAt) return;
    const { pane, zone } = dropAt;
    if (zone === "center") {
      if (pane === MAIN) return drag.kind === "pane" ? this.toMain(drag.id) : notes.select(drag.id);
      this.tree = drag.kind === "pane" ? swappedPanes(this.tree, drag.id, pane) : replacedPane(this.tree, pane, drag.id);
    } else {
      const without = drag.kind === "pane" ? withoutPane(this.tree, drag.id) : this.tree;
      this.tree = withPane(without, pane, drag.id, zone);
    }
    this.active = drag.id;
  }

  endDrag() {
    this.drag = null;
    this.handedOut();
  }

  resize(path: readonly number[], sizes: number[]) {
    this.tree = resized(this.tree, path, sizes);
  }
}

export const panes = new Panes();
