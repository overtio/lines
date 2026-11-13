import { dayOf } from "../notes/calendar";
import { cleanTagInput, normalizeTag } from "../notes/parse";
import type { LibraryItem } from "../plugins/types";
import { known } from "./text";

/*
 * A browser's bookmarks, as the Library's resources (docs/library.md): read from the page of links
 * every browser exports (Netscape's bookmark file: Chrome, Edge, Firefox, Safari… and Pinboard,
 * Raindrop and Pocket), or from Firefox's own backup in JSON, and what each is as a note
 * (bookmarkImport.ts makes them). Nothing is looked up as they come in: a resource is looked up
 * later, one at a time, when asked.
 */

/** A bookmark as a file has it. */
export interface Bookmark {
  title: string;
  url: string;
  /** The folders it's in, outermost first. */
  folders: string[];
  /** When it was bookmarked, if the file says. */
  added?: number;
  tags: string[];
  description?: string;
}

/** As early as a bookmark's date can be; anything before (or after now) is no date. */
const EARLIEST = Date.UTC(1990, 0, 1);

/**
 * A moment as a bookmarks file writes it, in seconds (Netscape's ADD_DATE, Pocket's time_added),
 * milliseconds or microseconds (Firefox's backup), in milliseconds.
 */
export function bookmarkTime(value: unknown): number | undefined {
  const number = typeof value === "string" && value.trim() ? Number(value) : typeof value === "number" ? value : NaN;
  const ms = number > 1e14 ? number / 1000 : number > 1e11 ? number : number * 1000;
  return ms >= EARLIEST && ms <= Date.now() + 86_400_000 ? Math.round(ms) : undefined;
}

/** A bookmark's tags as a file lists them: `design, css`. */
const tagsIn = (text: string | null | undefined) =>
  (text ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

/** The start of Netscape's bookmark file, which every browser writes. */
const NETSCAPE = /^<!DOCTYPE\s+NETSCAPE-Bookmark-file-1>/i;

/** Whether `text` is a file of bookmarks lines reads: a browser's export, Pocket's, or Firefox's backup. */
export function isBookmarks(text: string): boolean {
  const start = text.trimStart().slice(0, 100_000);
  if (start.startsWith("{")) return /"type"\s*:\s*"text\/x-moz-place-container"/.test(start);
  return NETSCAPE.test(start) || /<a\s[^>]*\b(?:add_date|time_added)\s*=/i.test(start);
}

/** The bookmarks in a file, in its order; null if it isn't a file of bookmarks lines reads. */
export function readBookmarks(text: string): Bookmark[] | null {
  if (!isBookmarks(text)) return null;
  const start = text.trimStart();
  return start.startsWith("{") ? readBackup(start) : readPage(start);
}

/* Netscape's bookmark file, and pages like it. */

/**
 * The bookmarks on a page of them, read with the browser's parser into a document of its own, where
 * nothing on it runs or loads. Each browser writes it a little differently (Safari's folders at the
 * top aren't in a list; Firefox describes a bookmark, or a folder, in a `<DD>` after it), and the
 * parser makes the same tree of all of them.
 */
function readPage(html: string): Bookmark[] {
  const page = new DOMParser().parseFromString(html, "text/html");
  // A bookmark file's folders are its H3s, its H1 its title; Pocket heads its lists Unread and Read Archive.
  const heading = NETSCAPE.test(html) ? "h3" : "h1, h2, h3, h4, h5, h6";
  return [...page.querySelectorAll("a[href]")].map((link) => ({
    title: link.textContent?.trim() ?? "",
    url: link.getAttribute("href")!.trim(),
    folders: foldersOf(link, heading),
    added: bookmarkTime(link.getAttribute("add_date") ?? link.getAttribute("time_added")),
    tags: tagsIn(link.getAttribute("tags")),
    description: descriptionOf(link),
  }));
}

const LISTS = "dl, ul, ol";

/** The folders a link is in: each list it's in, named by the heading before it. */
function foldersOf(link: Element, heading: string): string[] {
  const folders: string[] = [];
  for (let list = link.closest(LISTS); list; list = list.parentElement?.closest(LISTS) ?? null) {
    const name = nameOf(list, heading);
    if (name) folders.unshift(name);
  }
  return folders;
}

/**
 * A list's name: the heading just before it, or in the `<DT>` before it, looking past what can come
 * between (a folder's description, a `<p>`), up to the list it's in.
 */
function nameOf(list: Element, heading: string): string | undefined {
  for (let at: Element | null = list; at && !(at !== list && at.matches(LISTS)); at = at.parentElement) {
    for (let before = at.previousElementSibling; before; before = before.previousElementSibling) {
      if (before.matches(LISTS)) return undefined;
      const found = before.matches(heading) ? before : before.querySelector(`:scope > :is(${heading})`);
      if (found) return found.textContent?.trim() || undefined;
      if (before.localName === "dt") return undefined;
    }
  }
  return undefined;
}

/** What a bookmark's `<DD>` says of it, after its `<DT>`: its own text, not a list in it. */
function descriptionOf(link: Element): string | undefined {
  const next = link.closest("dt")?.nextElementSibling;
  if (next?.localName !== "dd") return undefined;
  const text = [...next.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join("");
  return text.trim() || undefined;
}

/* Firefox's backup (Bookmarks → Manage Bookmarks → Import and Backup → Backup…). */

interface Place {
  type?: string;
  title?: string;
  uri?: string;
  root?: string;
  dateAdded?: number;
  tags?: string;
  children?: Place[];
  annos?: { name?: string; value?: unknown }[];
}

/**
 * Firefox's own folders, by their `root`, named as its bookmark file names them; the menu's
 * bookmarks are at the top of that file, in no folder.
 */
const ROOTS: Record<string, string | null> = {
  placesRoot: null,
  bookmarksMenuFolder: null,
  toolbarFolder: "Bookmarks Toolbar",
  unfiledBookmarksFolder: "Other Bookmarks",
  mobileFolder: "Mobile Bookmarks",
};

function readBackup(json: string): Bookmark[] | null {
  let root: Place;
  try {
    root = JSON.parse(json);
  } catch {
    return null;
  }
  const found: Bookmark[] = [];
  const walk = (folder: Place, folders: string[]) => {
    for (const place of folder.children ?? []) {
      if (place.type === "text/x-moz-place-container") {
        const name = place.root && place.root in ROOTS ? ROOTS[place.root] : place.title?.trim();
        walk(place, name ? [...folders, name] : folders);
      } else if (place.type === "text/x-moz-place" && place.uri) {
        const description = place.annos?.find((anno) => anno.name === "bookmarkProperties/description")?.value;
        found.push({
          title: place.title?.trim() ?? "",
          url: place.uri,
          folders,
          added: bookmarkTime(place.dateAdded),
          tags: tagsIn(place.tags),
          description: typeof description === "string" && description.trim() ? description.trim() : undefined,
        });
      }
    }
  };
  walk(root, []);
  return found;
}

/* Making notes of them. */

/** A link as it's compared, so the same page written two ways (`HTTPS://Example.com`) is one. */
export function linkKey(link: string): string {
  try {
    return new URL(link).href;
  } catch {
    return link;
  }
}

const isWebPage = (url: string) => /^https?:\/\/[^/\s]/i.test(url);

/** What importing bookmarks would do: those to add, and how many are left out, and why. */
export interface BookmarkPlan {
  add: Bookmark[];
  /** In the library already: a note there has the same link. */
  there: number;
  /** In the file more than once: added once, the first time. */
  repeated: number;
  /** Not a page on the web (a bookmarklet, a browser's own page, a saved search). */
  other: number;
}

/** What importing `bookmarks` would do, with the library's notes' links `kept`. */
export function planImport(bookmarks: Bookmark[], kept: Iterable<string>): BookmarkPlan {
  const there = new Set([...kept].map(linkKey));
  const seen = new Set<string>();
  const plan: BookmarkPlan = { add: [], there: 0, repeated: 0, other: 0 };
  for (const bookmark of bookmarks) {
    const key = linkKey(bookmark.url);
    if (!isWebPage(bookmark.url)) plan.other++;
    else if (there.has(key)) plan.there++;
    else if (seen.has(key)) plan.repeated++;
    else {
      seen.add(key);
      plan.add.push(bookmark);
    }
  }
  return plan;
}

/** A tag of a bookmark's, or of its folders (`Dev / Rust` as `dev/rust`), as lines writes it; null where nothing of it can be one. */
function tagOf(names: string[]): string | null {
  const parts = names.map((name) => cleanTagInput(name.replace(/[/#]/g, " ")).replace(/-{2,}/g, "-").replace(/^-|-$/g, "")).filter(Boolean);
  return parts.length ? normalizeTag(parts.join("/")) : null;
}

/** A bookmark as a resource: its title, its folder and the day it was bookmarked, what it says of itself, and its tags, and its folders' if asked. */
export function bookmarkItem(bookmark: Bookmark, { folderTags = false } = {}): LibraryItem {
  const tags = [...bookmark.tags.map((tag) => tagOf([tag])), folderTags ? tagOf(bookmark.folders) : null].filter((tag) => tag !== null);
  return {
    type: "resource",
    title: bookmark.title || bookmark.url.replace(/^https?:\/\/(?:www\.)?/i, "").replace(/\/$/, ""),
    link: bookmark.url,
    properties: known([
      ["folder", bookmark.folders.join(" / ")],
      ["added", bookmark.added ? dayOf(bookmark.added) : undefined],
    ]),
    description: bookmark.description,
    tags: [...new Set(tags)],
  };
}
