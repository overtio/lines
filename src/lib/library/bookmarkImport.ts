import { type Bookmark, bookmarkItem, planImport } from "./bookmarks";
import type { ImportWork } from "./imports.svelte";
import { inLibrary } from "./same";

/*
 * Bookmarks made into the Library's resources (Settings → Library → Bookmarks): what an import of
 * them writes (imports.svelte.ts writes it), worked out as it starts.
 */

/** What a bookmarks file's panel gives an import: the bookmarks read, and whether they're tagged with their folders. */
export interface BookmarksInput {
  bookmarks: Bookmark[];
  folderTags: boolean;
}

/**
 * A resource of each bookmark the library hasn't got, dated when it was bookmarked (or, undated, in
 * the file's order, the first the latest). Nothing is looked up.
 */
export function bookmarkWork(input: unknown): ImportWork {
  const { bookmarks, folderTags } = input as BookmarksInput;
  const { add } = planImport(bookmarks, (link) => inLibrary({ link }));
  return { add: add.map((bookmark) => ({ item: bookmarkItem(bookmark, { folderTags }), created: bookmark.added, status: null })), append: [] };
}
