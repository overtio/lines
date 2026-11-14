import { propertyOf } from "../notes/properties";
import type { NoteMeta } from "../notes/types";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryItem } from "../plugins/types";

/*
 * What says which thing something in the Library is, so the same thing is one note however it's
 * added (same.ts asks): its link, as the same page however it's written
 * (`HTTPS://www.imdb.com/title/tt8962124/?ref_=nv` is `imdb.com/title/tt8962124`) and as the ids the
 * sources know it by (`imdb:tt8962124`, from an IMDb link, or from what Wikidata says of a Wikipedia
 * one); and the properties its kind is known by (a book's ISBN, a feed's address).
 */

/** Parts of a link's query that only say where it was shared from, not what it's to. */
const TRACKING = /^(?:utm_\w+|fbclid|gclid|dclid|msclkid|yclid|igshid|mc_cid|mc_eid|si|ref|ref_|ref_src|ref_url|feature)$/i;

/**
 * A link as it's compared: without its scheme, `www.`, a closing `/`, or what the query says only of
 * where it was shared from, and the rest of the query in order. What's after `#` stays: it can be
 * what the page shows (`#json=…`, `#!/…`), not just where on it to go; a source knows its own pages'.
 * But not a text fragment (`#:~:text=…`, a browser's link to words on the page) or what follows one.
 */
export function linkKey(link: string): string {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return link.trim();
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return url.href;
  const query = [...url.searchParams].filter(([key]) => !TRACKING.test(key)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const hash = url.hash.replace(/:~:.*$/, "").replace(/^#$/, "");
  return `${url.host.replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}${query.length ? `?${new URLSearchParams(query)}` : ""}${hash}`;
}

/** An ISBN-13's check digit, for its first twelve. */
const check13 = (twelve: string) => (10 - ([...twelve].reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1), 0) % 10)) % 10;

/**
 * An ISBN as it's compared: its digits, an ISBN-10 as the ISBN-13 it's the same book as; null for
 * one whose check digit doesn't add up (a placeholder, `0000000000`, a typo), which is no book's.
 */
export function isbnKey(isbn: string): string | null {
  const digits = isbn.replace(/[^\dX]/gi, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(digits)) {
    const sum = [...digits].reduce((total, digit, i) => total + (digit === "X" ? 10 : Number(digit)) * (10 - i), 0);
    if (sum % 11 || /^0+X?$/.test(digits)) return null;
    const twelve = `978${digits.slice(0, 9)}`;
    return `${twelve}${check13(twelve)}`;
  }
  return /^97[89]\d{10}$/.test(digits) && check13(digits.slice(0, 12)) === Number(digits[12]) ? digits : null;
}

/** A link as one of what tells a thing (`LibraryItem.ids`): another address of its page. */
export const linkId = (link: string) => `link:${linkKey(link)}`;

/** What a link is to: the page, written loosely, and the ids the sources know it by. */
function linkKeys(link: string): string[] {
  const keys = [linkId(link)];
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return keys;
  }
  for (const source of plugins.librarySources) {
    const key = source.key?.(url);
    if (key) keys.push(key);
  }
  return keys;
}

/**
 * A property its kind is known by, as it's compared, under its own key: an address loosely (a feed's
 * isn't the same thing as a page of it, a bookmark), an ISBN as one, if it is one.
 */
function propertyKeys(key: string, value: string): string[] {
  if (/^https?:\/\//i.test(value)) return [`${key}:${linkKey(value)}`];
  if (key !== "isbn") return [`${key}:${value.toLowerCase()}`];
  const isbn = isbnKey(value);
  return isbn ? [`isbn:${isbn}`] : [];
}

/** Something to tell from the rest: what a source found, or as much of it as is known (a link). */
export type Thing = Partial<Pick<LibraryItem, "type" | "link" | "properties" | "ids">>;

/**
 * What says which thing something is: its link (but for a kind whose links can be another's: an
 * episode's is often its show's page), the ids its source found, and the properties its kind is known by.
 */
export function keysOf({ type, link, properties = [], ids = [] }: Thing): string[] {
  const kind = type ? plugins.libraryKind(type) : undefined;
  const known = (kind?.ids ?? []).flatMap((key) => {
    const value = properties.find(([each]) => each === key)?.[1]?.trim();
    return value ? propertyKeys(key, value) : [];
  });
  return [...new Set([...(link && !kind?.sharedLinks ? linkKeys(link) : []), ...ids, ...known])];
}

/** A note's keys, as its properties say what it is. */
export function keysOfNote(meta: NoteMeta): string[] {
  const value = (key: string) => propertyOf(meta.properties, key)?.value.trim();
  const ids = plugins.libraryKind(meta.type)?.ids ?? [];
  return keysOf({ type: meta.type, link: value("link"), properties: ids.flatMap((key): [string, string][] => (value(key) ? [[key, value(key)!]] : [])) });
}
