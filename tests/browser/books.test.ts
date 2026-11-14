import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { BookPlace, Reading } from "../../src/lib/plugins/types";
import { zip } from "../../src/lib/zip";
import { type App, clickMod, mod, noErrors, openApp } from "./app";
import { cjkPdf } from "./books/makePdf";
import { png } from "./files";

/*
 * Books kept with library notes, read in the note's place: a PDF (made by books/makePdf.ts from
 * Project Gutenberg's Pride and Prejudice, its first two chapters) and an EPUB (Project
 * Gutenberg's The Yellow Wallpaper, its cover made smaller), both in the public domain; and EPUBs
 * made here to try what a book can do (run scripts, lead the frame away, load from the web, fill
 * memory, be written right to left). The app keeps books in IndexedDB, which Playwright's WebKit does
 * only on disk, so tests through the app ask for that (`onDisk`).
 */

const fixture = (name: string) => readFileSync(new URL(`./books/${name}`, import.meta.url));
const PDF = { name: "Pride and Prejudice.pdf", type: "application/pdf", bytes: fixture("pride-and-prejudice.pdf") };
const EPUB = { name: "The Yellow Wallpaper.epub", type: "application/epub+zip", bytes: fixture("the-yellow-wallpaper.epub") };
type BookFile = typeof PDF;

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

const base64 = (file: BookFile) => [file.name, file.type, file.bytes.toString("base64")] as const;

/** Keeps a file with the notes, as dropping it into one does; its attachment's name. */
const attach = (app: App, file: BookFile) =>
  app.page.evaluate(([name, type, data]) => window.testing.saveAttachment(new File([Uint8Array.from(atob(data), (char) => char.charCodeAt(0))], name, { type })), base64(file));

/** Opens a book note keeping `file`, with more properties if given; the attachment's name. */
async function openBook(app: App, file: BookFile, title: string, properties = "status: to read") {
  const name = await attach(app, file);
  await app.open(`---\ntype: book\n${properties}\n---\n# ${title}\n\n[${file.name}](../attachments/${name})\n`);
  return name;
}

const reader = (app: App) => app.page.getByRole("button", { name: "Read the Book" });
const back = (app: App) => app.page.getByRole("button", { name: "Back to the Note" });
/** Waits for the reader to say it's at `place`, under the book. */
const at = (app: App, place: string) => app.page.locator("[aria-live=polite]", { hasText: new RegExp(`^${place}$`) }).waitFor();

/** A book opened by its reader alone (`openReader`): what it gave, the places it said it was at, and the keys it handed over. */
interface Opened {
  reading: Reading;
  places: { place: BookPlace; read: boolean }[];
  keys: string[];
}
const opened = (app: App) => app.page.evaluateHandle(() => (window as unknown as { book: Opened }).book);

/** Opens `file` with its reader plugin alone, in a box over the app, paginated, as the app would; at `at`, if given. */
const openReader = (app: App, file: BookFile, at?: string) =>
  app.page.evaluate(
    async ([[name, type, data], at]) => {
      const host = document.createElement("div");
      host.style.cssText = "position: fixed; inset: 40px; z-index: 100; background: var(--surface); color: var(--text)";
      document.body.append(host);
      const places: Opened["places"] = [];
      const keys: string[] = [];
      const reading = await window.testing.plugins.bookReader(name)!.open(host, {
        data: new File([Uint8Array.from(atob(data), (char) => char.charCodeAt(0))], name, { type }),
        title: name,
        at,
        flow: "paginated",
        themeColors: false,
        moved: (place, read) => places.push({ place, read }),
        selected() {},
        keydown(event) {
          keys.push(event.key);
          return false;
        },
        active() {},
      });
      (window as unknown as { book: Opened }).book = { reading, places, keys };
    },
    [base64(file), at] as const,
  );

/** Where the reader opened alone last said it was. */
const lastPlace = (app: App) => app.page.evaluate(() => (window as unknown as { book: Opened }).book.places.at(-1)?.place);

/** The EPUB frame's document, in the page. */
const FRAME = "iframe.epub-reader";

const CONTAINER = `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;

/** A chapter's XHTML, `body` in its body. */
const chapter = (body: string, attributes = "") =>
  `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink" ${attributes}><head><title>Chapter</title></head><body>${body}</body></html>`;

/** An EPUB made here: its chapters in order, its other files with the media types its manifest gives them, and what its spine says. */
function makeEpub(name: string, chapters: string[], { files = {}, spine = "", language = "en" }: { files?: Record<string, { type: string; data: string | Uint8Array }>; spine?: string; language?: string } = {}): BookFile {
  const modified = new Date(2026, 10, 13);
  const items = [
    ...chapters.map((_, i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`),
    ...Object.entries(files).map(([path, file], i) => `<item id="f${i}" href="${path}" media-type="${file.type}"/>`),
  ];
  const opf = `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${name}</dc:title><dc:language>${language}</dc:language></metadata><manifest>${items.join("")}</manifest><spine ${spine}>${chapters.map((_, i) => `<itemref idref="c${i}"/>`).join("")}</spine></package>`;
  const bytes = zip([
    { name: "mimetype", data: "application/epub+zip", modified },
    { name: "META-INF/container.xml", data: CONTAINER, modified },
    { name: "OPS/book.opf", data: opf, modified },
    ...chapters.map((data, i) => ({ name: `OPS/c${i}.xhtml`, data, modified })),
    ...Object.entries(files).map(([path, file]) => ({ name: `OPS/${decodeURIComponent(path)}`, data: file.data, modified })),
  ]);
  return { name: `${name}.epub`, type: "application/epub+zip", bytes: Buffer.from(bytes) };
}

/** Answers anything asked of evil.example, and says what was. */
async function watchEvil(app: App) {
  const asked: string[] = [];
  await app.page.route("https://evil.example/**", (route) => {
    asked.push(route.request().url());
    return route.fulfill({ body: "" });
  });
  return asked;
}

test("a book note's PDF opens in its place, turns with the keys, and keeps where it was left and how far it's been read", async () => {
  app = await openApp({ onDisk: true });
  const { page } = app;
  await openBook(app, PDF, "Pride and Prejudice");
  await reader(app).click();
  await page.locator(".pdf-page canvas").first().waitFor();
  await at(app, "Page 1 of 6");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("PageDown");
  await at(app, "Page 3 of 6");
  // The contents are the PDF's outline; going to a chapter isn't reading it.
  await page.getByRole("button", { name: "Contents" }).click();
  await page.getByRole("menuitem", { name: "Chapter II." }).click();
  await at(app, "Page 4 of 6");
  // Back in the note, how far it's been read (to page 3) and that it's being read, written by lines.
  await back(app).click();
  await page.waitForFunction(() => window.testing.text()?.includes("progress: 40%"));
  expect(await app.text()).toContain("status: reading\n");
  // It opens where it was left again.
  await reader(app).click();
  await at(app, "Page 4 of 6");
});

test("how far a book's been read never goes back, nor forward by going to a place", async () => {
  app = await openApp({ onDisk: true });
  const { page } = app;
  const name = await openBook(app, PDF, "Pride and Prejudice", "status: reading\nprogress: 50%");
  // A link to its last page, as a quote's would be.
  await page.evaluate((name) => {
    const view = window.testing.editor()!;
    view.dispatch({ changes: { from: view.state.doc.length, insert: `\n[The end](../attachments/${name}#page=6)\n` } });
  }, name);
  await reader(app).click();
  await at(app, "Page 1 of 6");
  // Read a page here (another device was further on): nothing's written.
  await page.keyboard.press("ArrowRight");
  await at(app, "Page 2 of 6");
  await back(app).click();
  // Gone to the end and read on there: still nothing.
  await page.locator(".cm-lp-link", { hasText: "The end" }).click({ modifiers: [await clickMod(page)] });
  await at(app, "Page 6 of 6");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await back(app).click();
  await page.waitForTimeout(200);
  const text = (await app.text())!;
  expect(text).toContain("progress: 50%\n");
  expect(text).toContain("status: reading\n");
});

test("text chosen in a PDF is kept as a quote in the note, whose link opens the book there", async () => {
  app = await openApp({ onDisk: true });
  const { page } = app;
  const name = await openBook(app, PDF, "Pride and Prejudice");
  await reader(app).click();
  const span = page.locator(".pdf-page[data-page='1'] .textLayer span", { hasText: "It is a truth universally acknowledged" });
  await span.waitFor();
  await span.evaluate((element) => getSelection()!.selectAllChildren(element));
  await page.getByRole("button", { name: "Keep Quote" }).click();
  await page.waitForFunction(() => window.testing.text()?.includes("> It is a truth"));
  expect(await app.text()).toContain(`\n\n> It is a truth universally acknowledged, that a single man in\n> — [Page 1](../attachments/${name}#page=1)\n`);
  // ⌘Z takes it back out, and ⌘⇧H keeps it again.
  await page.keyboard.press(`${mod()}+z`);
  await page.waitForFunction(() => !window.testing.text()?.includes("> It is a truth"));
  await span.evaluate((element) => getSelection()!.selectAllChildren(element));
  // ⌘ as the page reads it: Playwright's WebKit says it's a Mac on Linux too.
  await page.keyboard.press(`${await clickMod(page)}+Shift+h`);
  await page.waitForFunction(() => window.testing.text()?.includes("> It is a truth"));
  // Its link opens the book at its page, rather than where it was left.
  await page.locator(".pdf-reader").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await at(app, "Page 3 of 6");
  await back(app).click();
  await page.locator(".cm-lp-link", { hasText: "Page 1" }).click({ modifiers: [await clickMod(page)] });
  await page.locator(".pdf-page canvas").first().waitFor();
  await at(app, "Page 1 of 6");
});

test("a quote's link opens the book's file in its app when there's no reader for it", async () => {
  app = await openApp({ onDisk: true });
  const { page } = app;
  const name = await attach(app, PDF);
  await page.evaluate(() => window.testing.plugins.setOn(window.testing.plugins.get("pdf-reader")!, false));
  await page.evaluate(() => Object.assign(window, { open: (url: string) => ((window as unknown as { opened: string }).opened = url) }));
  await app.open(`# Quotes\n\n> Words.\n> — [Page 2](../attachments/${name}#page=2)\n`);
  await page.locator(".cm-lp-link", { hasText: "Page 2" }).click({ modifiers: [await clickMod(page)] });
  await page.waitForFunction(() => (window as unknown as { opened?: string }).opened?.startsWith("blob:"));
});

test("an EPUB is read in the notes' font, by its contents, searched, quoted from at its CFI, and ⌘Z in it is lines'", async () => {
  app = await openApp({ onDisk: true });
  const { page } = app;
  const name = await openBook(app, EPUB, "The Yellow Wallpaper");
  await reader(app).click();
  const frame = page.frameLocator(FRAME);
  // The first chapter is its cover, a picture from the book itself.
  await frame.locator("svg image").waitFor({ state: "attached" });
  expect(await frame.locator("svg image").getAttribute("xlink:href")).toStartWith("blob:");
  await page.getByRole("button", { name: "Contents" }).click();
  await page.getByRole("menuitem", { name: "The Yellow Wallpaper" }).click();
  await frame.getByRole("heading", { name: "The Yellow Wallpaper", level: 1 }).waitFor();
  const body = frame.locator("body");
  expect(await body.evaluate((element) => getComputedStyle(element).fontFamily)).toBe(await app.style(".cm-content", "font-family"));
  // Matches, under the chapter they're in.
  await page.getByRole("searchbox", { name: "Search the book" }).fill("ancestral halls");
  await page.getByRole("searchbox", { name: "Search the book" }).press("Enter");
  const results = page.getByRole("menu", { name: "1 found" });
  await results.getByRole("group", { name: "The Yellow Wallpaper" }).waitFor();
  await results.getByRole("menuitem", { name: /ancestral halls/ }).click();
  await page.waitForFunction((selector) => {
    const frame = document.querySelector<HTMLIFrameElement>(selector)!;
    return (frame.contentWindow as Window & typeof globalThis).CSS.highlights.get("lines-mark")?.size === 1;
  }, FRAME);
  await page.evaluate((selector) => {
    const doc = document.querySelector<HTMLIFrameElement>(selector)!.contentDocument!;
    doc.getSelection()!.selectAllChildren([...doc.querySelectorAll("p")].find((p) => p.textContent?.includes("ancestral halls"))!);
  }, FRAME);
  await page.getByRole("button", { name: "Keep Quote" }).click();
  await page.waitForFunction(() => window.testing.text()?.includes("ancestral halls"));
  expect(await app.text()).toMatch(
    new RegExp(`> It is very seldom that mere ordinary people like John and myself secure ancestral halls for the summer\\.\\n> — \\[The Yellow Wallpaper\\]\\(\\.\\./attachments/${name}#epubcfi\\(/6/4!/4/\\d+/1:0\\)\\)\\n$`),
  );
  // The book has the keys again, and ⌘Z there is lines': the quote goes.
  await page.keyboard.press(`${mod()}+z`);
  await page.waitForFunction(() => !window.testing.text()?.includes("ancestral halls"));
});

test("a book added from its file is a note filled in from what the file says, and one note however often it's added", async () => {
  app = await openApp({ onDisk: true });
  const { page } = app;
  const add = async () => {
    await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Add to Library" }).click();
    await page.getByRole("menuitem", { name: "Add to Library" }).click();
    await page.getByRole("dialog", { name: "Add to Library" }).locator("input[type=file]").setInputFiles({ name: EPUB.name, mimeType: EPUB.type, buffer: EPUB.bytes });
  };
  await add();
  await page.waitForFunction(() => window.testing.text()?.includes("# The Yellow Wallpaper"));
  const text = (await app.text())!;
  expect(text).toStartWith("---\ntype: book\nauthor: Charlotte Perkins Gilman\nlanguage: en\nstatus: to read\n---\n# The Yellow Wallpaper\n\n![The Yellow Wallpaper|240](../attachments/");
  expect(text).toMatch(/\n\[The Yellow Wallpaper\.epub\]\(\.\.\/attachments\/[0-9a-f]{32}\.epub\)\n$/);
  // Added again, it's the same note; dropped twice at once, still one.
  const id = await page.evaluate(() => window.testing.notes.selectedId);
  await page.evaluate(() => window.testing.notes.select(null));
  await add();
  await page.waitForFunction((id) => window.testing.notes.selectedId === id, id);
  await page.evaluate(([name, type, data]) => {
    const transfer = new DataTransfer();
    for (let i = 0; i < 2; i++) transfer.items.add(new File([Uint8Array.from(atob(data), (char) => char.charCodeAt(0))], name, { type }));
    document.querySelector(".note-list")!.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }));
  }, base64(PDF));
  await page.waitForFunction(() => window.testing.text()?.includes("# Pride and Prejudice"));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.testing.notes.entries.filter((entry) => entry.meta.type === "book").length)).toBe(2);
});

test("the PDF reader draws pages over their text, turns them, searches, says where what's chosen is, and keeps to its pages", async () => {
  app = await openApp();
  const { page } = app;
  await openReader(app, PDF);
  await page.locator(".pdf-page[data-page='1'] canvas").waitFor();
  const first = page.locator(".pdf-page[data-page='1'] .textLayer span", { hasText: "It is a truth universally acknowledged" });
  await first.waitFor();
  expect(await lastPlace(app)).toEqual({ at: "page=1", progress: 0, label: "Page 1 of 6" });
  // One document for screen readers, not one per page.
  expect(await page.locator(".pdf-reader[role=document]").count()).toBe(1);
  expect(await page.locator(".pdf-reader :is([role=region], [role=document], [aria-label])").count()).toBe(0);
  const book = await opened(app);
  expect(await book.evaluate(({ reading }) => reading.contents)).toEqual([
    { label: "Chapter I.", at: "page=1", depth: 0 },
    { label: "Chapter II.", at: "page=4", depth: 0 },
  ]);
  await book.evaluate(({ reading }) => reading.turn(true));
  expect(await book.evaluate(({ places }) => places.at(-1))).toEqual({ place: { at: "page=2", progress: 0.2, label: "Page 2 of 6" }, read: true });
  const found = await book.evaluate(({ reading }) => reading.search("Netherfield Park", 10, new AbortController().signal));
  expect(found[0]).toMatchObject({ at: "page=1", label: "Page 1" });
  expect(found[0].excerpt).toContain("Netherfield Park is let at last");
  await first.evaluate((element) => getSelection()!.selectAllChildren(element));
  expect(await book.evaluate(({ reading }) => reading.selection())).toMatchObject({ at: "page=1", text: "It is a truth universally acknowledged, that a single man in" });
  // A page past its end is its last, gone to, not read.
  await book.evaluate(({ reading }) => reading.go("page=999"));
  expect(await book.evaluate(({ places }) => places.at(-1))).toEqual({ place: { at: "page=6", progress: 1, label: "Page 6 of 6" }, read: false });
});

test("a PDF opened at a page past its end opens at its last", async () => {
  app = await openApp();
  await openReader(app, PDF, "page=40");
  expect(await lastPlace(app)).toEqual({ at: "page=6", progress: 1, label: "Page 6 of 6" });
});

test("a PDF's pages are as printed, or in the theme's colors", async () => {
  app = await openApp({ scheme: "dark" });
  const { page } = app;
  await openReader(app, PDF);
  await page.locator(".pdf-page[data-page='1'] canvas").waitFor();
  /** The paper's color, in the page's top left corner. */
  const paper = () => page.locator(".pdf-page[data-page='1'] canvas").evaluate((canvas: HTMLCanvasElement) => Array.from(canvas.getContext("2d")!.getImageData(4, 4, 1, 1).data.slice(0, 3)));
  expect(await paper()).toEqual([255, 255, 255]);
  const book = await opened(app);
  await book.evaluate(({ reading }) => reading.setThemeColors!(true));
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".pdf-page[data-page='1'] canvas");
    return canvas && canvas.getContext("2d")!.getImageData(4, 4, 1, 1).data[0] < 128;
  });
  const [red, green, blue] = await paper();
  expect(Math.max(red, green, blue)).toBeLessThan(80);
});

test("a PDF's Chinese text in a font it doesn't carry is read with pdf.js's character maps, shipped with lines", async () => {
  app = await openApp();
  const { page } = app;
  const asked: string[] = [];
  page.on("request", (request) => asked.push(new URL(request.url()).pathname));
  await openReader(app, { name: "Chinese.pdf", type: "application/pdf", bytes: Buffer.from(cjkPdf("中文")) });
  await page.locator(".pdf-page[data-page='1'] .textLayer span", { hasText: "中文" }).waitFor();
  expect(asked.some((path) => path.endsWith("/pdfjs/cmaps/UniGB-UCS2-H.bcmap"))).toBe(true);
});

test("the EPUB reader shows a chapter in a frame of its own, turns its pages, hands keys to lines, searches, and says where what's chosen is", async () => {
  app = await openApp();
  const { page } = app;
  await openReader(app, EPUB);
  const frame = page.frameLocator(FRAME);
  // Scripts too, only so that lines' own listeners on it run in WebKit; the policy runs none of the book's (below).
  expect(await page.locator(FRAME).getAttribute("sandbox")).toBe("allow-same-origin allow-scripts");
  const book = await opened(app);
  const contents = await book.evaluate(({ reading }) => reading.contents);
  expect(contents.map(({ label }) => label)).toEqual(["The Yellow Wallpaper", "THE FULL PROJECT GUTENBERG™ LICENSE"]);
  // Opened, its cover is shown, not read.
  expect(await book.evaluate(({ places }) => places.at(-1)?.read)).toBe(false);
  await book.evaluate(({ reading }, at) => reading.go(at), contents[0].at);
  await frame.getByRole("heading", { name: "The Yellow Wallpaper", level: 1 }).waitFor();
  await page.waitForFunction(() => (window as unknown as { book: Opened }).book.places.at(-1)?.place.label === "The Yellow Wallpaper");
  // Pages are columns as wide as the frame, turned one at a time.
  const left = () => page.evaluate((selector) => document.querySelector<HTMLIFrameElement>(selector)!.contentDocument!.scrollingElement!.scrollLeft, FRAME);
  const width = await page.locator(FRAME).evaluate((element) => element.clientWidth);
  const before = await left();
  await book.evaluate(({ reading }) => reading.turn(true));
  expect((await left()) - before).toBe(width);
  expect(await book.evaluate(({ places }) => places.at(-1)?.read)).toBe(true);
  // Keys pressed in the frame come to lines, to turn its pages with or for its shortcuts.
  await book.evaluate(({ reading }) => reading.focus());
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press(`${mod()}+z`);
  expect(await book.evaluate(({ keys }) => keys.filter((key) => key !== "Meta" && key !== "Control"))).toEqual(["ArrowRight", "z"]);
  // A match is a CFI, gone to and marked on the page turned to.
  const found = await book.evaluate(({ reading }) => reading.search("ancestral halls", 10, new AbortController().signal));
  expect(found).toHaveLength(1);
  expect(found[0].at).toMatch(/^epubcfi\(\/6\/4!\/4\/\d+\/1:\d+\)$/);
  await book.evaluate(({ reading }, at) => reading.go(at, "ancestral halls"), found[0].at);
  await page.waitForFunction((selector) => {
    const view = document.querySelector<HTMLIFrameElement>(selector)!.contentWindow as Window & typeof globalThis;
    return view.CSS.highlights.get("lines-mark")?.size === 1;
  }, FRAME);
  const shown = await page.evaluate((selector) => {
    const frame = document.querySelector<HTMLIFrameElement>(selector)!;
    const [range] = (frame.contentWindow as Window & typeof globalThis).CSS.highlights.get("lines-mark")!;
    const { left, right } = (range as Range).getBoundingClientRect();
    return left >= 0 && right <= frame.clientWidth;
  }, FRAME);
  expect(shown).toBe(true);
  await page.evaluate((selector) => {
    const doc = document.querySelector<HTMLIFrameElement>(selector)!.contentDocument!;
    doc.getSelection()!.selectAllChildren([...doc.querySelectorAll("p")].find((p) => p.textContent?.includes("ancestral halls"))!);
  }, FRAME);
  const chosen = await book.evaluate(({ reading }) => reading.selection());
  expect(chosen?.text).toBe("It is very seldom that mere ordinary people like John and myself secure ancestral halls for the summer.");
  expect(chosen?.at).toMatch(/^epubcfi\(\/6\/4!\/4\/\d+\/1:0\)$/);
});

test("a right-to-left EPUB turns its pages leftward", async () => {
  app = await openApp();
  const { page } = app;
  const paragraph = "<p>هذا كتاب يقرأ من اليمين إلى اليسار، صفحة بعد صفحة، حتى نهايته البعيدة جدا.</p>";
  const book = makeEpub("Arabic", [chapter(`<h1>الفصل الأول</h1>${paragraph.repeat(120)}<p id="last">النهاية</p>`, 'lang="ar" dir="rtl"')], { spine: 'page-progression-direction="rtl"', language: "ar" });
  await openReader(app, book);
  const arabic = await opened(app);
  expect(await arabic.evaluate(({ reading }) => reading.rtl)).toBe(true);
  const left = () => page.evaluate((selector) => document.querySelector<HTMLIFrameElement>(selector)!.contentDocument!.scrollingElement!.scrollLeft, FRAME);
  const width = await page.locator(FRAME).evaluate((element) => element.clientWidth);
  expect(await left()).toBe(0);
  await arabic.evaluate(({ reading }) => reading.turn(true));
  expect(await left()).toBe(-width);
  const progress = await arabic.evaluate(({ places }) => places.at(-1)!.place.progress);
  expect(progress).toBeGreaterThan(0);
  // A place on a later page is turned to, leftward.
  const end = await arabic.evaluate(({ reading }) => reading.search("النهاية", 1, new AbortController().signal));
  await arabic.evaluate(({ reading }, at) => reading.go(at), end[0].at);
  await page.waitForFunction(([selector, width]) => document.querySelector<HTMLIFrameElement>(selector)!.contentDocument!.scrollingElement!.scrollLeft < -width, [FRAME, width] as const);
  const shown = await page.frameLocator(FRAME).locator("#last").evaluate((element, width) => {
    const { left, right } = element.getBoundingClientRect();
    return left >= 0 && right <= width;
  }, width);
  expect(shown).toBe(true);
});

test("an EPUB chapter that can't be read leaves the reader reading the rest, with places in the chapter shown", async () => {
  app = await openApp();
  const { page } = app;
  const made = makeEpub("Patchy", [chapter("<h1>One</h1><p>First.</p>"), chapter("<h1>Two</h1><p>Second.</p>"), chapter('<h1>Three</h1><p>Third <img src="100%.png" alt="a picture"/>.</p>')], {
    files: { "100%25.png": { type: "image/png", data: png(4, 4, () => [200, 100, 50]) } },
  });
  // The second chapter's file says it's smaller than it is: it won't unpack.
  const bytes = new Uint8Array(made.bytes);
  const view = new DataView(bytes.buffer);
  for (let at = bytes.length - 22; at > 0; at--) {
    if (view.getUint32(at, true) !== 0x02014b50) continue;
    const length = view.getUint16(at + 28, true);
    if (new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + length)) === "OPS/c1.xhtml") view.setUint32(at + 24, view.getUint32(at + 24, true) + 1, true);
  }
  await openReader(app, { ...made, bytes: Buffer.from(bytes) });
  const frame = page.frameLocator(FRAME);
  await frame.getByRole("heading", { name: "One" }).waitFor();
  const book = await opened(app);
  await book.evaluate(({ reading }) => reading.turn(true));
  await page.waitForTimeout(300);
  await frame.getByRole("heading", { name: "One" }).waitFor();
  expect(app.errors.every((error) => error.includes("couldn't show the chapter"))).toBe(true);
  app.errors.length = 0;
  // The reader goes on: the third chapter, its picture whose name isn't encoded as a link's (100%).
  await book.evaluate(({ reading }) => reading.go("epubcfi(/6/6!/4/2)"));
  await frame.getByRole("heading", { name: "Three" }).waitFor();
  expect(await frame.getByRole("img", { name: "a picture" }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(4);
  await page.evaluate((selector) => {
    const doc = document.querySelector<HTMLIFrameElement>(selector)!.contentDocument!;
    doc.getSelection()!.selectAllChildren(doc.querySelector("p")!);
  }, FRAME);
  expect((await book.evaluate(({ reading }) => reading.selection()))?.at).toStartWith("epubcfi(/6/6!");
});

test("an EPUB's scripts never run, and it loads nothing from elsewhere", async () => {
  app = await openApp();
  const { page } = app;
  const asked = await watchEvil(app);
  await openReader(
    app,
    makeEpub("Trap", [
      `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Trap</title>
<link rel="stylesheet" href="https://evil.example/style.css"/>
<script>parent.pwned = "script";</script></head>
<body onload="parent.pwned = 'onload'"><h1>Chapter</h1>
<p>Read me.<img src="https://evil.example/pixel.png" onerror="parent.pwned = 'onerror'"/></p>
<p><a href="javascript:parent.pwned='link'">A link</a></p>
<iframe src="https://evil.example/frame.html"></iframe>
<object data="https://evil.example/plugin"></object>
<form action="https://evil.example/form"><input name="q"/></form>
<p style="background: url(https://evil.example/bg.png)">Styled.</p>
<svg xmlns="http://www.w3.org/2000/svg"><script>parent.pwned = "svg"</script></svg>
</body></html>`,
    ]),
  );
  const frame = page.frameLocator(FRAME);
  await frame.getByRole("heading", { name: "Chapter" }).waitFor();
  await frame.getByText("A link").click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as { pwned?: string }).pwned)).toBeUndefined();
  expect(await frame.locator("script, iframe, object, form, input").count()).toBe(0);
  expect(asked).toEqual([]);
  // Were one to get past that, the frame's policy wouldn't run it.
  await page.evaluate((selector) => {
    const doc = document.querySelector<HTMLIFrameElement>(selector)!.contentDocument!;
    const script = doc.createElement("script");
    script.textContent = "parent.pwned = 'missed'";
    doc.body.append(script);
    doc.body.insertAdjacentHTML("beforeend", `<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" onload="parent.pwned = 'missed'">`);
  }, FRAME);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as { pwned?: string }).pwned)).toBeUndefined();
  // Which says so.
  expect(app.errors.every((error) => /Content Security Policy|Blocked script execution/.test(error))).toBe(true);
  app.errors.length = 0;
});

test("nothing in an EPUB leads its frame away: links are lines' to follow, and the frame is put back if it's led anywhere", async () => {
  app = await openApp();
  const { page } = app;
  const asked = await watchEvil(app);
  // Links to the web open in the browser: here, they're only noted.
  await page.evaluate(() => Object.assign(window, { opened: [] as string[], open: (url: string) => (window as unknown as { opened: string[] }).opened.push(url) }));
  await openReader(
    app,
    makeEpub("Doors", [
      chapter(`<h1>Doors</h1>
<p><a href="https://evil.example/plain">A plain link</a></p>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40"><a xlink:href="https://evil.example/svg"><text x="0" y="20">An SVG link</text></a></svg>
<p><img src="map.png" usemap="#m" alt="A map"/></p><map name="m"><area shape="rect" coords="0,0,40,40" href="https://evil.example/area" alt="An area"/></map>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40"><a href="#here"><set attributeName="href" to="https://evil.example/smil"/><text x="0" y="20">An animated link</text></a></svg>
<p id="here">Here.</p>`),
    ], { files: { "map.png": { type: "image/png", data: png(40, 40, () => [10, 120, 200]) } } }),
  );
  const frame = page.frameLocator(FRAME);
  await frame.getByRole("heading", { name: "Doors" }).waitFor();
  for (const text of ["A plain link", "An SVG link", "An animated link"]) await frame.getByText(text).click();
  await frame.getByRole("img", { name: "A map" }).click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(300);
  const location = () => page.evaluate((selector) => document.querySelector<HTMLIFrameElement>(selector)!.contentWindow!.location.href, FRAME);
  expect(await location()).toBe("about:srcdoc");
  expect(await page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual(["https://evil.example/plain", "https://evil.example/svg"]);
  expect(await frame.locator("area, set, [usemap], a[href]").count()).toBe(0);
  expect(asked).toEqual([]);
  // Led somewhere all the same, the chapter's put back.
  await page.evaluate((selector) => (document.querySelector<HTMLIFrameElement>(selector)!.contentWindow!.location.href = "about:blank"), FRAME);
  await frame.getByRole("heading", { name: "Doors" }).waitFor();
  expect(await location()).toBe("about:srcdoc");
});

test("an EPUB's files are shown only as what can't run, and its styles' addresses however they're written lead nowhere", async () => {
  app = await openApp();
  const { page } = app;
  const asked = await watchEvil(app);
  await openReader(
    app,
    makeEpub("Disguises", [
      chapter(`<style>h1 { background-image: image-set("https://evil.example/set.png" 1x); } h2 { background: u\\72 l(https://evil.example/escaped.png); }</style>
<h1>Disguises</h1><h2>Escaped</h2>
<p style="background: u\\000072l(https://evil.example/attribute.png)"><a href="java&#9;script:parent.pwned='tab'">A tabbed link</a></p>
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><image xlink:href="https://evil.example/svg.png" width="20" height="20"/></svg>
<p><img src="page.html" alt="A page"/><img src="picture.svg" alt="A drawing"/><img src="photo.png" alt="A photo"/></p>`),
    ], {
      files: {
        "page.html": { type: "text/html", data: "<script>parent.pwned = 'page'</script>" },
        "picture.svg": { type: "image/svg+xml", data: `<svg xmlns="http://www.w3.org/2000/svg" onload="parent.pwned = 'svg'" width="4" height="4"><script>parent.pwned = 'svg'</script><rect width="4" height="4"/></svg>` },
        "photo.png": { type: "image/png", data: png(4, 4, () => [0, 0, 0]) },
      },
    }),
  );
  const frame = page.frameLocator(FRAME);
  await frame.getByRole("heading", { name: "Disguises" }).waitFor();
  await frame.getByText("A tabbed link").click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as { pwned?: string }).pwned)).toBeUndefined();
  // As what each blob: URL is given out as, and holds: read by lines' page, as the frame may fetch nothing.
  const blob = async (alt: string) =>
    page.evaluate(async (src) => {
      const data = await (await fetch(src)).blob();
      return { type: data.type, text: await data.text() };
    }, (await frame.getByRole("img", { name: alt }).getAttribute("src"))!);
  expect((await blob("A page")).type).toBe("application/octet-stream");
  const drawing = await blob("A drawing");
  expect(drawing.type).toBe("image/svg+xml");
  expect(drawing.text).not.toMatch(/<script|onload/);
  expect((await blob("A photo")).type).toBe("image/png");
  // Nothing was asked of the web, nor had to be stopped by the frame's policy (noErrors, after).
  expect(asked).toEqual([]);
});
