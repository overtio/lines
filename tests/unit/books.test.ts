import { describe, expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";
import { excerptAround, findAll, isbnIn } from "../../src/lib/books/text";
import { cfi, cfiPath, parseCfi, resolveCfi } from "../../src/plugins/epub-reader/cfi";
import { zip, zipEntries } from "../../src/lib/zip";
import { stubApp } from "./stubs";

stubApp();
const { bookIn, placeLink, progressOf, progressValue, quoteMarkdown, statusFor, withQuote } = await import("../../src/lib/books/books");
const { referencedAttachments } = await import("../../src/lib/notes/attachments");

/*
 * Books kept with library notes (lib/books/): which file is a note's book, quotes kept from it, how
 * far through it is, places in an EPUB (its CFIs), and reading its ZIP without being made to fill memory.
 */

const PDF = "3f9c0000000000000000000000000001.pdf";
const EPUB = "3f9c0000000000000000000000000002.epub";
const readable = (name: string) => /\.(pdf|epub)$/.test(name);

describe("a note's book", () => {
  test("is the first file on a line of its own that a reader reads", () => {
    const body = `---\ntype: book\n---\n# Emma\n\n![Emma|240](../attachments/3f9c0000000000000000000000000003.jpg)\n\nSee [the notes](../attachments/${PDF}) too.\n\n[Emma.epub](../attachments/${EPUB})\n[Emma.pdf](../attachments/${PDF})\n`;
    expect(bookIn(body, readable)).toEqual({ name: EPUB, label: "Emma.epub" });
    expect(bookIn(body, (name) => name.endsWith(".mobi"))).toBeNull();
  });

  test("a link to a place in it is its file and the place", () => {
    expect(placeLink(`../attachments/${PDF}#page=12`)).toEqual({ name: PDF, at: "page=12" });
    expect(placeLink(`../attachments/${EPUB}#epubcfi(/6/4!/4/10/1:3)`)).toEqual({ name: EPUB, at: "epubcfi(/6/4!/4/10/1:3)" });
    expect(placeLink(`../attachments/${PDF}`)).toBeNull();
    expect(placeLink("https://example.com/book.pdf#page=2")).toBeNull();
  });
});

describe("a quote kept from a book", () => {
  const place = { at: "page=3", label: "Page 3" };

  test("is a quote of what was chosen, as just that text, with a link back to its place", () => {
    expect(quoteMarkdown("It is a truth #universally\nacknowledged, *that*…", place, PDF)).toBe(
      `> It is a truth \\#universally acknowledged, \\*that\\*…\n> — [Page 3](../attachments/${PDF}#page=3)`,
    );
  });

  test("keeps the chosen text's paragraphs, and a chapter's name as its link's text", () => {
    expect(quoteMarkdown("One.\n\nTwo.", { at: "epubcfi(/6/4!/4/2/1:0)", label: "Chapter [1]" }, EPUB)).toBe(
      `> One.\n>\n> Two.\n> — [Chapter 1](../attachments/${EPUB}#epubcfi(/6/4!/4/2/1:0))`,
    );
  });

  test("goes at the note's end, and keeps the book from being taken as unused", () => {
    const note = withQuote(`# Emma\n\n[Emma.pdf](../attachments/${PDF})\n\n`, quoteMarkdown("Words.", place, PDF));
    expect(note).toBe(`# Emma\n\n[Emma.pdf](../attachments/${PDF})\n\n> Words.\n> — [Page 3](../attachments/${PDF}#page=3)\n`);
    expect([...referencedAttachments([note])]).toEqual([PDF]);
  });
});

describe("how far through", () => {
  test("is read from the note and written whole percents", () => {
    expect(progressOf("37%")).toBe(0.37);
    expect(progressOf(" 100 % ")).toBe(1);
    expect(progressOf("about half")).toBeNull();
    expect(progressOf(undefined)).toBeNull();
    expect(progressValue(0.379)).toBe("37%");
    expect(progressValue(1.2)).toBe("100%");
  });

  test("moves a status on along its kind's own, never back, and leaves a status of your own", () => {
    const read = ["to read", "reading", "read"];
    expect(statusFor("to read", 0, read)).toBe("to read");
    expect(statusFor(undefined, 0.1, read)).toBe("reading");
    expect(statusFor("To Read", 0.4, read)).toBe("reading");
    expect(statusFor("reading", 0.995, read)).toBe("read");
    expect(statusFor("read", 0.2, read)).toBe("read");
    expect(statusFor("abandoned", 0.5, read)).toBe("abandoned");
    expect(statusFor("to watch", 1, ["to watch", "watching", "watched"])).toBe("watched");
    // A kind without statuses has none written.
    expect(statusFor(undefined, 0.5, [])).toBeUndefined();
  });
});

describe("an EPUB CFI", () => {
  /** A node of a pretend document, as much of one as cfi.ts reads. */
  interface Fake {
    nodeType: number;
    localName?: string;
    data?: string;
    length?: number;
    childNodes: Fake[];
    parentNode: Fake | null;
    firstChild: Fake | null;
    nextSibling: Fake | null;
    previousSibling: Fake | null;
    ownerDocument: { documentElement: Fake };
  }
  const document = { documentElement: null as unknown as Fake };
  const node = (fields: Partial<Fake>, children: Fake[] = []): Fake => {
    const made: Fake = { nodeType: 1, childNodes: children, parentNode: null, firstChild: children[0] ?? null, nextSibling: null, previousSibling: null, ownerDocument: document, ...fields };
    children.forEach((child, i) => Object.assign(child, { parentNode: made, previousSibling: children[i - 1] ?? null, nextSibling: children[i + 1] ?? null }));
    return made;
  };
  const el = (localName: string, children: (Fake | string)[] = []) => node({ localName }, children.map((child) => (typeof child === "string" ? node({ nodeType: 3, data: child, length: child.length }) : child)));
  // <html><head/><body><p>Hello <em>you</em> there</p><p>Next</p></body></html>
  const em = el("em", ["you"]);
  const first = el("p", ["Hello ", em, " there"]);
  const second = el("p", ["Next"]);
  const html = el("html", [el("head"), el("body", [first, second])]);
  document.documentElement = html;
  const at = (target: Fake, offset: number) => ({ node: target as unknown as Node, offset });

  test("is the steps to a point: elements even, the text between them odd, and a character offset", () => {
    expect(cfi(1, at(first.childNodes[0], 2))).toBe("epubcfi(/6/4!/4/2/1:2)");
    expect(cfi(1, at(first.childNodes[2], 3))).toBe("epubcfi(/6/4!/4/2/3:3)");
    expect(cfi(0, at(second.childNodes[0], 0))).toBe("epubcfi(/6/2!/4/4/1:0)");
    // Between an element's children, at the child after it.
    expect(cfiPath(at(first, 1))).toBe("/4/2/2");
    expect(cfiPath(at(em, 0))).toBe("/4/2/2/1:0");
  });

  test("is read back to its chapter and point, past assertions and a range's end", () => {
    expect(parseCfi("epubcfi(/6/4[chap01]!/4[body]/2/3:3)")).toEqual({ index: 1, steps: [4, 2, 3], offset: 3 });
    expect(parseCfi("epubcfi(/6/4!/4/2,/1:2,/3:1)")).toEqual({ index: 1, steps: [4, 2, 1], offset: 2 });
    expect(parseCfi("epubcfi(/6/4!/4/2)")).toEqual({ index: 1, steps: [4, 2], offset: null });
    for (const bad of ["epubcfi(/6/3!/4)", "epubcfi(/4/2!/4)", "epubcfi(/6/4!/4/x)", "page=3", ""]) expect(parseCfi(bad)).toBeNull();
    const point = resolveCfi(document as unknown as Document, [4, 2, 3], 3);
    expect(point.node).toBe(first.childNodes[2] as unknown as Node);
    expect(point.offset).toBe(3);
  });

  test("leads as far as it can where the chapter has changed", () => {
    const point = resolveCfi(document as unknown as Document, [4, 8, 1], 0);
    expect(point.node).toBe(html.childNodes[1] as unknown as Node);
  });
});

describe("a book's text", () => {
  test("is searched ignoring case and how words are spaced, with the words around a match", () => {
    const text = "My dear Mr. Bennet, said his lady to him one day, have you heard that Netherfield\nPark is let at last?";
    expect(findAll(text, "netherfield park")).toEqual([{ index: 70, length: 16 }]);
    expect(findAll(text, "  ")).toEqual([]);
    expect(findAll("a (b) a (b)", "(b)")).toHaveLength(2);
    expect(excerptAround(text, 70, 16)).toBe("…lady to him one day, have you heard that Netherfield Park is let at last?");
  });

  test("gives the ISBN it prints, if its check digit is right", () => {
    expect(isbnIn("Penguin Classics\nISBN 978-0-14-143951-8\nPrinted in")).toBe("9780141439518");
    expect(isbnIn("ISBN-10: 0-14-143951-3")).toBe("0141439513");
    expect(isbnIn("ISBN 978-0-14-143951-9")).toBeUndefined();
    expect(isbnIn("no number here")).toBeUndefined();
  });
});

describe("a ZIP's files", () => {
  test("are read one at a time, as they're asked for", async () => {
    const modified = new Date(2026, 10, 13);
    const files = zipEntries(zip([{ name: "mimetype", data: "application/epub+zip", modified }, { name: "OPS/a.xhtml", data: "<p>Hello</p>".repeat(100), modified }]));
    expect([...files.keys()]).toEqual(["mimetype", "OPS/a.xhtml"]);
    expect(files.get("OPS/a.xhtml")!.size).toBe(1200);
    expect(new TextDecoder().decode(await files.get("OPS/a.xhtml")!.read())).toBe("<p>Hello</p>".repeat(100));
  });

  /** A ZIP of one deflated file, `bytes` of zeros, that says it unpacks to `stated`. */
  function deflated(bytes: number, stated: number) {
    const packed = deflateRawSync(new Uint8Array(bytes));
    const name = new TextEncoder().encode("big.bin");
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(8, 8, true);
    local.setUint32(18, packed.length, true);
    local.setUint32(22, stated, true);
    local.setUint16(26, name.length, true);
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(10, 8, true);
    central.setUint32(20, packed.length, true);
    central.setUint32(24, stated, true);
    central.setUint16(28, name.length, true);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, 1, true);
    end.setUint16(10, 1, true);
    end.setUint32(16, 30 + name.length + packed.length, true);
    return new Uint8Array(Buffer.concat([new Uint8Array(local.buffer), name, packed, new Uint8Array(central.buffer), name, new Uint8Array(end.buffer)]));
  }

  test("unpack to no more than they say, nor past the limit, so a small ZIP can't fill memory", async () => {
    expect((await zipEntries(deflated(4096, 4096)).get("big.bin")!.read()).length).toBe(4096);
    // 450 MB of zeros packs into under half a megabyte: it says 1 KB, and stops there.
    const bomb = deflated(450 * 1024 * 1024, 1024);
    expect(bomb.length).toBeLessThan(500_000);
    const started = performance.now();
    await expect(zipEntries(bomb).get("big.bin")!.read()).rejects.toThrow("bigger than it says");
    expect(performance.now() - started).toBeLessThan(1000);
    // Saying so isn't enough past the limit.
    await expect(zipEntries(deflated(4096, 4096), 1024).get("big.bin")!.read()).rejects.toThrow("bigger than it says");
  });
});
