import { zipEntries, type ZippedFile } from "../../lib/zip";

/*
 * An EPUB's package, read as the EPUB 3 spec has it (and EPUB 2's, which most books still are): a
 * ZIP whose META-INF/container.xml names the package document (the OPF), which lists the book's
 * files (its manifest), its chapters in reading order (its spine) and what it says of itself (its
 * Dublin Core metadata); and its table of contents, EPUB 3's nav document or EPUB 2's NCX.
 */

const DC = "http://purl.org/dc/elements/1.1/";
const OPS = "http://www.idpf.org/2007/ops";

export interface Epub {
  files: Map<string, ZippedFile>;
  /** Media types by path, as the manifest gives them. */
  types: Map<string, string>;
  /** The chapters in reading order: each one's path in the ZIP, and how big it is unpacked. */
  spine: { path: string; size: number }[];
  contents: { label: string; path: string; fragment: string; depth: number }[];
  metadata: {
    title?: string;
    authors: string[];
    publisher?: string;
    language?: string;
    isbn?: string;
    description?: string;
  };
  /** Its cover picture's path. */
  cover?: string;
  /** Its pages turn from right to left (Arabic, Hebrew, Japanese manga): its spine says so, or its language is written that way. */
  rtl: boolean;
}

/** Languages written from right to left, by their code's first part. */
const RIGHT_TO_LEFT = new Set(["ar", "arc", "dv", "fa", "he", "ku", "ps", "sd", "syr", "ug", "ur", "yi"]);

/** A file's path in the ZIP, from a link to it in the file at `from`: `../images/a%20b.jpg`. */
export function pathFrom(from: string, href: string): string {
  const url = new URL(href, `https://book.invalid/${from}`);
  return decoded(url.pathname.slice(1));
}

/** A path or fragment with its `%20`s as the characters they are; as written, where it isn't encoded that way (`100%.png`). */
export function decoded(text: string) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** An XML document, or null where it isn't well formed. */
function xml(text: string, type: DOMParserSupportedType = "application/xml") {
  const doc = new DOMParser().parseFromString(text, type);
  return doc.getElementsByTagName("parsererror").length ? null : doc;
}

const decoder = new TextDecoder();

export async function readText(files: Map<string, ZippedFile>, path: string): Promise<string | null> {
  const file = files.get(path);
  return file ? decoder.decode(await file.read()) : null;
}

const byLocalName = (root: Document | Element, name: string) => Array.from(root.getElementsByTagNameNS("*", name));
const textOf = (element: Element | undefined) => element?.textContent?.replace(/\s+/g, " ").trim() || undefined;

/** The ISBN among a book's identifiers: `urn:isbn:…`, one its scheme says is one, or a number that looks like one. */
function isbnAmong(identifiers: Element[]) {
  for (const identifier of identifiers) {
    const value = textOf(identifier) ?? "";
    const scheme = identifier.getAttributeNS("http://www.idpf.org/2007/opf", "scheme") ?? identifier.getAttribute("opf:scheme");
    const digits = value.replace(/^urn:isbn:/i, "").replace(/[\s-]/g, "");
    if ((/^urn:isbn:/i.test(value) || scheme?.toLowerCase() === "isbn" || /^97[89]\d{10}$/.test(digits)) && /^(?:\d{9}[\dX]|\d{13})$/i.test(digits)) return digits;
  }
  return undefined;
}

/** Who wrote it: its creators, but those another role says aren't authors (an editor, a translator, an illustrator). */
function authorsIn(opf: Document) {
  const roles = new Map<string, string>();
  for (const meta of byLocalName(opf, "meta")) {
    const refines = meta.getAttribute("refines");
    if (meta.getAttribute("property") === "role" && refines) roles.set(refines.replace(/^#/, ""), textOf(meta) ?? "");
  }
  return Array.from(opf.getElementsByTagNameNS(DC, "creator")).flatMap((creator) => {
    const role = roles.get(creator.id) ?? creator.getAttributeNS("http://www.idpf.org/2007/opf", "role") ?? creator.getAttribute("opf:role");
    const name = textOf(creator);
    return name && (!role || role === "aut") ? [name] : [];
  });
}

/** EPUB 3's table of contents: the nav document's `toc` nav, its lists of links nested as the book's parts are. */
function navContents(nav: Document, path: string): Epub["contents"] {
  const toc = byLocalName(nav, "nav").find((element) => (element.getAttributeNS(OPS, "type") ?? element.getAttribute("epub:type") ?? "").split(/\s+/).includes("toc"));
  const entries: Epub["contents"] = [];
  const walk = (list: Element, depth: number) => {
    for (const item of Array.from(list.children).filter((child) => child.localName === "li")) {
      const link = Array.from(item.children).find((child) => child.localName === "a" || child.localName === "span");
      const href = link?.getAttribute("href");
      const label = textOf(link);
      if (href && label) entries.push({ label, ...target(path, href), depth });
      const sublist = Array.from(item.children).find((child) => child.localName === "ol");
      if (sublist) walk(sublist, depth + 1);
    }
  };
  const list = toc && Array.from(toc.children).find((child) => child.localName === "ol");
  if (list) walk(list, 0);
  return entries;
}

/** EPUB 2's table of contents: the NCX's navPoints, nested. */
function ncxContents(ncx: Document, path: string): Epub["contents"] {
  const entries: Epub["contents"] = [];
  const walk = (parent: Element, depth: number) => {
    for (const point of Array.from(parent.children).filter((child) => child.localName === "navPoint")) {
      const label = textOf(byLocalName(point, "text")[0]);
      const href = byLocalName(point, "content")[0]?.getAttribute("src");
      if (label && href) entries.push({ label, ...target(path, href), depth });
      walk(point, depth + 1);
    }
  };
  const map = byLocalName(ncx, "navMap")[0];
  if (map) walk(map, 0);
  return entries;
}

const target = (from: string, href: string) => ({ path: pathFrom(from, href), fragment: decoded(href.split("#")[1] ?? "") });

export async function readEpub(bytes: Uint8Array<ArrayBuffer>): Promise<Epub> {
  const files = zipEntries(bytes);
  const container = xml((await readText(files, "META-INF/container.xml")) ?? "");
  const opfPath = container && byLocalName(container, "rootfile")[0]?.getAttribute("full-path");
  const opf = opfPath ? xml((await readText(files, opfPath)) ?? "") : null;
  if (!opfPath || !opf) throw new Error("Not an EPUB");

  const items = new Map<string, { path: string; type: string; properties: string[] }>();
  const types = new Map<string, string>();
  for (const item of byLocalName(opf, "item")) {
    const href = item.getAttribute("href");
    if (!href || !item.id) continue;
    const path = pathFrom(opfPath, href);
    const type = item.getAttribute("media-type") ?? "";
    items.set(item.id, { path, type, properties: (item.getAttribute("properties") ?? "").split(/\s+/) });
    types.set(path, type);
  }
  const spine = byLocalName(opf, "itemref").flatMap((ref) => {
    const item = items.get(ref.getAttribute("idref") ?? "");
    return item && files.has(item.path) ? [{ path: item.path, size: files.get(item.path)!.size }] : [];
  });

  let contents: Epub["contents"] = [];
  const nav = [...items.values()].find((item) => item.properties.includes("nav"));
  const navDoc = nav && xml((await readText(files, nav.path)) ?? "", "application/xhtml+xml");
  if (nav && navDoc) contents = navContents(navDoc, nav.path);
  if (!contents.length) {
    const ncx = items.get(byLocalName(opf, "spine")[0]?.getAttribute("toc") ?? "") ?? [...items.values()].find((item) => item.type === "application/x-dtbncx+xml");
    const ncxDoc = ncx && xml((await readText(files, ncx.path)) ?? "");
    if (ncx && ncxDoc) contents = ncxContents(ncxDoc, ncx.path);
  }

  const coverId = byLocalName(opf, "meta").find((meta) => meta.getAttribute("name") === "cover")?.getAttribute("content");
  const cover = [...items.values()].find((item) => item.properties.includes("cover-image")) ?? (coverId ? items.get(coverId) : undefined);

  const dc = (name: string) => textOf(opf.getElementsByTagNameNS(DC, name)[0]);
  const progression = byLocalName(opf, "spine")[0]?.getAttribute("page-progression-direction");
  return {
    files,
    types,
    spine,
    contents,
    metadata: {
      title: dc("title"),
      authors: authorsIn(opf),
      publisher: dc("publisher"),
      language: dc("language"),
      isbn: isbnAmong(Array.from(opf.getElementsByTagNameNS(DC, "identifier"))),
      description: dc("description"),
    },
    cover: cover?.type.startsWith("image/") ? cover.path : undefined,
    rtl: progression ? progression === "rtl" : RIGHT_TO_LEFT.has((dc("language") ?? "").split("-")[0].toLowerCase()),
  };
}

/** A chapter's document as its file has it: XHTML, or HTML where it isn't well formed (as some books' aren't). */
export async function chapterDocument(epub: Epub, index: number): Promise<Document> {
  const text = (await readText(epub.files, epub.spine[index].path)) ?? "";
  return xml(text, "application/xhtml+xml") ?? new DOMParser().parseFromString(text, "text/html");
}
