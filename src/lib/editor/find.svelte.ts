import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  replaceAll,
  replaceNext,
  search,
  SearchQuery,
  setSearchQuery,
} from "@codemirror/search";
import type { EditorState } from "@codemirror/state";
import { EditorView, type Panel, runScopeHandlers, type ViewUpdate } from "@codemirror/view";
import { flushSync, mount, unmount } from "svelte";
import FindBar from "./FindBar.svelte";

/*
 * The find bar over a note (⌘F): CodeMirror's search, drawn with lines' own controls. It finds as
 * you type and counts the matches; in a note that can be edited, it replaces too.
 */

/** The most matches counted; past it the count says "1,000+". */
export const MOST_MATCHES = 1000;

export type QuerySpec = Pick<SearchQuery, "search" | "caseSensitive" | "literal" | "regexp" | "replace" | "wholeWord">;

/** What the find bar shows (FindBar.svelte). */
export class FindState {
  query = $state.raw(new SearchQuery({ search: "" }));
  /** How many matches there are, up to MOST_MATCHES, and which of them is selected (1 for the first), or 0. */
  count = $state(0);
  current = $state(0);
  readOnly = $state(false);
}

function countMatches(state: EditorState, query: SearchQuery) {
  if (!query.search || !query.valid) return { count: 0, current: 0 };
  const { from, to } = state.selection.main;
  let count = 0;
  let current = 0;
  const cursor = query.getCursor(state);
  for (let match = cursor.next(); !match.done && count < MOST_MATCHES; match = cursor.next()) {
    count++;
    if (match.value.from === from && match.value.to === to) current = count;
  }
  return { count, current };
}

const spec = ({ search, caseSensitive, literal, regexp, replace, wholeWord }: SearchQuery): QuerySpec => ({
  search,
  caseSensitive,
  literal,
  regexp,
  replace,
  wholeWord,
});

class FindPanel implements Panel {
  readonly dom = document.createElement("div");
  readonly top = true;
  readonly find = new FindState();
  readonly #component: Record<string, unknown>;

  constructor(readonly view: EditorView) {
    this.#read(view.state);
    this.#component = mount(FindBar, {
      target: this.dom,
      props: {
        find: this.find,
        actions: {
          change: (change: Partial<QuerySpec>) =>
            view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ ...spec(this.find.query), ...change })) }),
          next: () => findNext(view),
          previous: () => findPrevious(view),
          replace: () => replaceNext(view),
          replaceAll: () => replaceAll(view),
          close: () => closeSearchPanel(view),
        },
      },
    });
    // Drawn now, with its field marked, for CodeMirror to focus as it opens.
    flushSync();
    // The search keys (Esc, ⌘G, F3) work in the bar too, as they do in the note.
    this.dom.addEventListener("keydown", (event) => {
      if (runScopeHandlers(view, event, "search-panel")) event.preventDefault();
    });
  }

  /** Opened: into the field, with what's in it selected to type over. */
  mount() {
    const field = this.dom.querySelector<HTMLInputElement>("[main-field]");
    field?.focus();
    field?.select();
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || getSearchQuery(update.state) !== getSearchQuery(update.startState)) this.#read(update.state);
  }

  #read(state: EditorState) {
    const query = getSearchQuery(state);
    this.find.query = query;
    this.find.readOnly = state.readOnly;
    Object.assign(this.find, countMatches(state, query));
  }

  destroy() {
    void unmount(this.#component);
  }
}

/** Search in the note, with the find bar at its top. */
export const find = search({ top: true, createPanel: (view) => new FindPanel(view) });

/** Opens the find bar of the note in `pane`, wherever focus is (⌘F outside the note); returns whether there was one. */
export function findInPane(pane: Element) {
  const editor = pane.querySelector<HTMLElement>(".cm-editor");
  const view = editor && EditorView.findFromDOM(editor);
  return !!view && openSearchPanel(view);
}
