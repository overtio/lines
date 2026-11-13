import { t } from "../../lib/i18n/index.svelte";
import { known, names, yearOf } from "../../lib/library/text";
import { getJson } from "../../lib/library/web";
import type { LibraryItem, LibrarySource, Plugin } from "../../lib/plugins/types";

/*
 * Open Library (openlibrary.org), the Internet Archive's open catalog of books: a book by a link to
 * it there, or by its ISBN in a link (a bookshop's, or Amazon's, whose number for a book is its
 * ISBN-10). Only the book's id or ISBN is sent. It answers web pages too.
 */

const API = "https://openlibrary.org";

/** Whether `digits` is an ISBN, by its check digit: ten (the last can be X) or thirteen, starting 978 or 979. */
export function isIsbn(digits: string): boolean {
  if (/^\d{9}[\dX]$/i.test(digits)) {
    const sum = [...digits].reduce((total, digit, i) => total + (10 - i) * (/x/i.test(digit) ? 10 : Number(digit)), 0);
    return sum % 11 === 0;
  }
  if (/^97[89]\d{10}$/.test(digits)) {
    const sum = [...digits].reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1), 0);
    return sum % 10 === 0;
  }
  return false;
}

/** The book a link is to: an Open Library work or edition, or an ISBN. */
export function bookIn(url: URL): { work: string } | { edition: string } | { isbn: string } | null {
  if (/^(?:www\.)?openlibrary\.org$/i.test(url.hostname)) {
    const [, section, id] = url.pathname.split("/");
    if (section === "works" && /^OL\d+W$/.test(id)) return { work: id };
    if (section === "books" && /^OL\d+M$/.test(id)) return { edition: id };
    if (section === "isbn" && isIsbn(id?.replace(/-/g, "") ?? "")) return { isbn: id.replace(/-/g, "") };
    return null;
  }
  // Amazon's number for a book, its ASIN, is its ISBN-10.
  const asin = /^(?:www\.)?amazon\.[a-z.]+$/i.test(url.hostname) ? /\/(?:dp|gp\/product)\/(\d{9}[\dX])(?:[/?]|$)/i.exec(url.pathname)?.[1] : undefined;
  const written = asin ?? /(?:^|[/?&])isbn(?:[=/:]|%3A)([\d-]{10,17}X?)(?![\d])/i.exec(url.pathname + url.search)?.[1];
  const isbn = written?.replace(/-/g, "").toUpperCase();
  return isbn && isIsbn(isbn) ? { isbn } : null;
}

interface Edition {
  title?: string;
  authors?: { key: string }[];
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  isbn_13?: string[];
  isbn_10?: string[];
  covers?: number[];
  works?: { key: string }[];
}

interface Work {
  title?: string;
  description?: string | { value: string };
  authors?: { author?: { key: string } }[];
  covers?: number[];
  first_publish_date?: string;
}

/** Authors' names, by their keys (`/authors/OL79034A`): the first few, asked together. */
async function authorNames(keys: string[], signal: AbortSignal) {
  const authors = await Promise.all(keys.slice(0, 3).map((key) => getJson<{ name?: string }>(`${API}${key}.json`, signal)));
  return names(authors.map((author) => author?.name));
}

const coverOf = (covers: number[] | undefined) => {
  const id = covers?.find((cover) => cover > 0);
  return id ? `https://covers.openlibrary.org/b/id/${id}-L.jpg` : undefined;
};

async function lookup(url: URL, signal: AbortSignal): Promise<LibraryItem | null> {
  const book = bookIn(url);
  if (!book) return null;
  const edition = "work" in book ? null : await getJson<Edition>("edition" in book ? `${API}/books/${book.edition}.json` : `${API}/isbn/${book.isbn}.json`, signal);
  const workKey = "work" in book ? `/works/${book.work}` : edition?.works?.[0]?.key;
  const work = workKey ? await getJson<Work>(`${API}${workKey}.json`, signal) : null;
  const title = edition?.title ?? work?.title;
  if (!title) return null;
  const authorKeys = edition?.authors?.map((author) => author.key) ?? work?.authors?.flatMap((each) => (each.author ? [each.author.key] : [])) ?? [];
  const description = typeof work?.description === "string" ? work.description : work?.description?.value;
  return {
    type: "book",
    title,
    link: url.href,
    properties: known([
      ["author", await authorNames(authorKeys, signal)],
      ["year", yearOf(edition?.publish_date ?? work?.first_publish_date)],
      ["pages", edition?.number_of_pages],
      ["publisher", edition?.publishers?.[0]],
      ["isbn", edition?.isbn_13?.[0] ?? edition?.isbn_10?.[0] ?? ("isbn" in book ? book.isbn : undefined)],
    ]),
    cover: coverOf(edition?.covers) ?? coverOf(work?.covers),
    description,
  };
}

/** A book as Open Library's search finds it. */
interface Found {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
}

/** Books whose title or author is `text`, each its work's, with a small cover. */
async function search(_type: string, text: string, signal: AbortSignal): Promise<LibraryItem[]> {
  const params = new URLSearchParams({ q: text, fields: "key,title,author_name,first_publish_year,cover_i", limit: "20" });
  const found = await getJson<{ docs?: Found[] }>(`${API}/search.json?${params}`, signal);
  return (found?.docs ?? []).map((book) => ({
    type: "book",
    title: book.title,
    link: `${API}${book.key}`,
    properties: known([
      ["author", names(book.author_name?.slice(0, 3) ?? [])],
      ["year", book.first_publish_year],
    ]),
    cover: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : undefined,
  }));
}

const source: LibrarySource = {
  id: "open-library",
  name: "Open Library",
  recognizes: (url) => bookIn(url) !== null,
  lookup,
  searches: ["book"],
  search,
};

export const openLibrary = (): Plugin => ({
  id: "open-library",
  name: "Open Library",
  description: t("plugins.openLibrary.description"),
  icon: "book-open",
  enabledByDefault: true,
  requires: ["library"],
  contributes: { librarySources: [source] },
});
