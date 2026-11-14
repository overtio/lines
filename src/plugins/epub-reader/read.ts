import { excerptAround, findAll, MARK, markText } from "../../lib/books/text";
import { t } from "../../lib/i18n/index.svelte";
import { smaller } from "../../lib/pictures";
import { openExternal } from "../../lib/platform";
import type { BookDetails, BookFlow, BookPlace, OpenBook, Reading } from "../../lib/plugins/types";
import { cfi, parseCfi, resolveCfi, type Point } from "./cfi";
import { cleanChapter, isOutside, type BookFiles } from "./clean";
import { chapterDocument, decoded, pathFrom, readEpub, readText, type Epub } from "./epub";

/*
 * An EPUB, a chapter at a time, in a frame of its own: made safe first (clean.ts), then shown in a
 * sandboxed <iframe> under a policy that runs no script and loads nothing but the book's own files
 * and lines' fonts. The frame shows only what lines puts in it: its links are lines' to follow, and
 * anything else it's led to is put back. The theme's colors and the notes' font and size are put
 * over the book's own style, which keeps the rest (italics, headings, indents, pictures).
 * Paginated, the chapter is laid out in columns as wide as the view, one turned at a time (from the
 * right in a right-to-left book), as most e-book readers do; scrolled, it's one long page. A place
 * is an EPUB CFI (cfi.ts).
 */

/** The longest a line of text runs, in characters, as a note's do at their widest. */
const MEASURE = "34em";
/** The space between pages, and around the text. */
const GAP = 48;

/** Nothing runs in a chapter (no script, no `on…` attribute, no `javascript:` link), and nothing loads but its own files and lines' fonts. */
const POLICY = "default-src 'none'; script-src 'none'; img-src blob: data:; media-src blob:; style-src 'unsafe-inline'; font-src 'self' blob: data:";

export async function epubDetails(bytes: Uint8Array<ArrayBuffer>): Promise<BookDetails> {
  const { metadata, cover, files, types } = await readEpub(bytes);
  const picture = cover && isRaster(types.get(cover) ?? "") ? files.get(cover) : undefined;
  const properties: [string, string][] = [
    ["author", metadata.authors.join(", ")],
    ["publisher", metadata.publisher ?? ""],
    ["isbn", metadata.isbn ?? ""],
    ["language", metadata.language ?? ""],
  ];
  return {
    title: metadata.title,
    properties: properties.filter(([, value]) => value),
    description: metadata.description,
    // A cover that can't be read leaves the book without one, rather than unread.
    cover: picture ? await smaller(new Blob([await picture.read()]), 1200).catch(() => undefined) : undefined,
  };
}

const isRaster = (type: string) => /^image\/(?:png|jpeg|gif|webp|avif|bmp)$/.test(type);

/**
 * The type a book's file is given as a blob: URL: a picture, sound, film or font that can't run
 * anything, as it says it is; an SVG picture once it's made safe; anything else plain bytes, which
 * no browser opens as a page (an HTML "picture" in a tab of its own would run as lines).
 */
const blobType = (type: string) => (isRaster(type) || /^(?:audio|video|font)\//.test(type) ? type : "application/octet-stream");

/** The book's files as blob: URLs, each made once, and let go of together. */
function bookFiles(epub: Epub): BookFiles & { revoke(): void } {
  const urls = new Map<string, Promise<string | null>>();
  const files: BookFiles & { revoke(): void } = {
    url(path) {
      let url = urls.get(path);
      if (!url) {
        url = blobOf(path).then((blob) => blob && URL.createObjectURL(blob));
        urls.set(path, url);
      }
      return url;
    },
    text: (path) => readText(epub.files, path),
    revoke() {
      for (const url of urls.values()) void url.then((each) => each && URL.revokeObjectURL(each));
    },
  };
  async function blobOf(path: string): Promise<Blob | null> {
    const file = epub.files.get(path);
    if (!file) return null;
    const type = epub.types.get(path) ?? "";
    if (type !== "image/svg+xml") return new Blob([await file.read()], { type: blobType(type) });
    const svg = new DOMParser().parseFromString(new TextDecoder().decode(await file.read()), "image/svg+xml");
    if (svg.getElementsByTagName("parsererror").length) return null;
    await cleanChapter(svg, path, files);
    return new Blob([new XMLSerializer().serializeToString(svg)], { type });
  }
  return files;
}

/**
 * The page's own fonts in `family` (lines' bundled ones, a style's), which a frame doesn't share
 * with it: their @font-face rules, which load them from lines itself.
 */
function fontFaces(family: string) {
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSFontFaceRule && family.includes(rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim())) rules.push(rule.cssText);
      }
    } catch {
      // A stylesheet from elsewhere, which can't be read: none of lines' is.
    }
  }
  return rules.join("\n");
}

/** The theme over the book's style: its colors, the notes' font and size, and a page laid out for the flow. */
function themeCss(host: HTMLElement, flow: BookFlow, width: number, height: number) {
  const style = getComputedStyle(host);
  const value = (name: string) => style.getPropertyValue(name).trim();
  const font = value("--font-text");
  const page =
    flow === "paginated"
      ? `html { height: ${height}px; overflow: hidden; }
         body { height: ${height}px; box-sizing: border-box; margin: 0; padding: ${GAP / 2}px ${GAP / 2}px;
                column-width: ${width - GAP}px; column-gap: ${GAP}px; column-fill: auto; }
         img, svg, video { max-height: ${height - GAP * 1.5}px; max-width: 100%; object-fit: contain; break-inside: avoid; }`
      : `html { overflow-y: auto; }
         body { max-width: ${MEASURE}; margin: 0 auto; padding: ${GAP / 2}px ${GAP / 2}px ${GAP * 2}px; }
         img, svg, video { max-width: 100%; height: auto; }`;
  return `${fontFaces(font)}
    :root { color-scheme: ${value("color-scheme") || "light dark"}; }
    html { background: ${style.backgroundColor} !important; }
    body { background: transparent !important; color: ${style.color} !important; }
    body { font-family: ${font} !important; font-size: ${value("--editor-size") || "16px"} !important;
           line-height: ${value("--editor-line-height") || 1.6} !important; }
    body * { color: inherit !important; background-color: transparent !important; border-color: ${value("--border")} !important; }
    body :is(pre, code, kbd, samp, tt) { font-family: ${value("--font-mono") || "ui-monospace, monospace"} !important; }
    [data-href], [data-href] * { color: ${value("--accent")} !important; cursor: pointer; text-decoration: underline; }
    ::selection { background: ${value("--selection")}; }
    ::highlight(${MARK}) { background-color: ${value("--highlight")}; }
    ${page}`;
}

/** Where a chapter is shown from: its start, its end, or a point in it, found once it's shown. */
type Where = "start" | "end" | ((d: Document) => Point);

export async function openEpub(dom: HTMLElement, book: OpenBook): Promise<Reading> {
  const epub = await readEpub(new Uint8Array(await book.data.arrayBuffer()));
  const files = bookFiles(epub);
  const sizes = epub.spine.map((chapter) => chapter.size);
  const total = sizes.reduce((sum, size) => sum + size, 0) || 1;
  const before = (at: number) => sizes.slice(0, at).reduce((sum, size) => sum + size, 0);
  let flow = book.flow;
  /** The chapter shown, and the one asked for last. */
  let index = -1;
  let wanted = -1;
  /** The page turned to in the chapter, paginated, and whether the chapter's written right to left. */
  let page = 0;
  let rtl = false;
  let loading: Promise<void> = Promise.resolve();

  const frame = document.createElement("iframe");
  frame.className = "epub-reader";
  // The same origin, so lines can lay the chapter out and read what's chosen. Scripts too, as
  // WebKit (Safari, and the Mac, iPhone and Linux apps) runs none of lines' own listeners on a frame
  // sandboxed without them (webkit.org/b/218086), and it can't be told without its saying so in the
  // console: the frame's policy runs none of the book's, which has none left, and the frame can't be
  // led to a page that would (lines' own policy lets frames show only its own pages, and `load`
  // below puts the chapter back).
  frame.setAttribute("sandbox", "allow-same-origin allow-scripts");
  frame.title = book.title;
  dom.append(frame);

  const doc = () => frame.contentDocument!;
  const width = () => frame.clientWidth;
  const pages = () => Math.max(1, Math.round(doc().documentElement.scrollWidth / width()));
  const scroller = () => doc().scrollingElement ?? doc().documentElement;

  /** What the chapter's called in the contents, or its number. */
  const chapterLabel = (at: number) => epub.contents.find((entry) => entry.path === epub.spine[at].path)?.label ?? t("books.chapter", { chapter: at + 1 });

  /** How far through the book what's shown goes: what's before this chapter, and this chapter as far as the page or view shown. */
  function progress() {
    const element = scroller();
    const within = flow === "paginated" ? (page + 1) / pages() : Math.min(1, (element.scrollTop + element.clientHeight) / Math.max(1, element.scrollHeight));
    return Math.min(1, (before(index) + within * sizes[index]) / total);
  }

  /** The first character shown: at the top of the column turned to (its right in a right-to-left chapter), or of the view. */
  function firstShown(): Point {
    const d = doc();
    const x = rtl ? width() - GAP / 2 - 2 : GAP / 2 + 2;
    const y = GAP / 2 + 2;
    const caret = "caretPositionFromPoint" in d ? d.caretPositionFromPoint(x, y) : null;
    if (caret) return { node: caret.offsetNode, offset: caret.offset };
    const range = d.caretRangeFromPoint?.(x, y);
    return range ? { node: range.startContainer, offset: range.startOffset } : { node: d.body ?? d.documentElement, offset: 0 };
  }

  const place = (): BookPlace => ({ at: cfi(index, firstShown()), progress: progress(), label: chapterLabel(index) });
  const tell = (read: boolean) => book.moved(place(), read);

  /** Turns to a page of the chapter: right to left, the pages go on leftward. */
  function showPage(next: number) {
    page = Math.min(pages() - 1, Math.max(0, next));
    scroller().scrollLeft = (rtl ? -1 : 1) * page * width();
  }

  /** Turns to where a point is drawn. */
  function reveal(point: Point) {
    const range = doc().createRange();
    range.setStart(point.node, Math.min(point.offset, point.node.nodeType === Node.TEXT_NODE ? (point.node as Text).length : point.node.childNodes.length));
    const rect = range.getBoundingClientRect();
    const box = rect.width || rect.height ? rect : (point.node.nodeType === Node.ELEMENT_NODE ? (point.node as Element) : point.node.parentElement)?.getBoundingClientRect();
    if (!box) return;
    const left = scroller().scrollLeft;
    if (flow === "scrolled") scroller().scrollTop += box.top - GAP / 2;
    else showPage(Math.floor(rtl ? (width() - box.right - left) / width() : (box.left + left) / width()));
  }

  function style() {
    const element = doc().getElementById("lines-theme");
    if (element) element.textContent = themeCss(dom, flow, width(), frame.clientHeight);
    rtl = getComputedStyle(doc().body).direction === "rtl";
  }

  /** Shows chapter `at`, from `where`; `read` when it's come to by reading on. */
  async function load(at: number, where: Where, read: boolean) {
    wanted = at;
    // A place in the chapter shown is turned to, not loaded again.
    if (at === index && typeof where === "function") {
      reveal(where(doc()));
      return tell(read);
    }
    const chapter = await chapterDocument(epub, at);
    await cleanChapter(chapter, epub.spine[at].path, files);
    if (wanted !== at) return;
    frame.srcdoc = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${POLICY}"></head><body></body></html>`;
    await new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
    if (wanted !== at) return;
    const d = doc();
    // The chapter in the page with the policy in its head: its root's attributes (its language and
    // direction), what its head has after the policy, and its body as the body, the root's second
    // element as CFIs count it.
    for (const attribute of Array.from(chapter.documentElement.attributes)) d.documentElement.setAttributeNS(attribute.namespaceURI, attribute.name, attribute.value);
    for (const child of Array.from(chapter.head?.childNodes ?? [])) d.head.append(d.importNode(child, true));
    d.body.replaceWith(d.importNode(chapter.body ?? chapter.documentElement, true));
    const theme = d.createElement("style");
    theme.id = "lines-theme";
    d.head.append(theme);
    index = at;
    style();
    listen(d);
    page = 0;
    if (where === "end" && flow === "paginated") showPage(pages() - 1);
    else if (where === "end") scroller().scrollTop = scroller().scrollHeight;
    else if (where !== "start") reveal(where(d));
    tell(read);
  }

  /** Shows a chapter after the one asked for before; one that can't be shown leaves the reader as it was. */
  const go = (at: number, where: Where, read = false) =>
    (loading = loading.then(() => load(at, where, read)).catch((error) => console.error("lines: couldn't show the chapter", error)));

  /** Where a place lines gave leads: a chapter's file and an id in it (as the contents link), or a CFI. */
  function target(at: string, mark?: string): { at: number; where: Where } | null {
    const [path, id] = at.split("#");
    const chapter = epub.spine.findIndex((each) => each.path === path);
    if (chapter >= 0) return { at: chapter, where: (d) => ({ node: (id && d.getElementById(id)) || d.body, offset: 0 }) };
    const parsed = parseCfi(at);
    if (!parsed || !epub.spine[parsed.index]) return null;
    return {
      at: parsed.index,
      where: (d) => {
        const point = resolveCfi(d, parsed.steps, parsed.offset);
        if (mark) markText(d.body, mark, point);
        return point;
      },
    };
  }

  /** Follows a link in the book: the web's in the browser, the book's own to its place; anything else nowhere. */
  function follow(href: string) {
    if (/^(?:https?|mailto):/i.test(href)) return void openExternal(href);
    if (isOutside(href)) return;
    const path = pathFrom(epub.spine[index].path, href);
    const at = epub.spine.findIndex((chapter) => chapter.path === path);
    const id = decoded(href.split("#")[1] ?? "");
    if (at >= 0) void go(at, (d) => ({ node: (id && d.getElementById(id)) || d.body, offset: 0 }));
  }

  function listen(d: Document) {
    d.addEventListener("keydown", (event) => {
      const link = (event.target as Element).closest?.("[data-href]");
      if (link && event.key === "Enter") {
        event.preventDefault();
        return follow(link.getAttribute("data-href")!);
      }
      if (book.keydown(event)) event.preventDefault();
    });
    for (const type of ["pointermove", "pointerdown", "wheel", "touchstart"]) d.addEventListener(type, () => book.active(), { passive: true });
    d.addEventListener("selectionchange", () => book.selected(!d.getSelection()?.isCollapsed));
    d.addEventListener("scroll", () => flow === "scrolled" && tell(true), { passive: true });
    d.addEventListener(
      "click",
      (event) => {
        const link = (event.target as Element).closest?.("[data-href]");
        if (!link) return;
        event.preventDefault();
        follow(link.getAttribute("data-href")!);
      },
      true,
    );
  }

  // The frame shows only what lines puts in it: led anywhere else, it has the chapter put back.
  frame.addEventListener("load", () => {
    let url: string | undefined;
    try {
      url = frame.contentWindow?.location.href;
    } catch {
      url = undefined;
    }
    if (url !== "about:srcdoc" && index >= 0) {
      const at = index;
      index = -1;
      void go(at, "start");
    }
  });

  const reading: Reading = {
    contents: epub.contents.flatMap((entry) => {
      const at = epub.spine.findIndex((chapter) => chapter.path === entry.path);
      return at < 0 ? [] : [{ label: entry.label, depth: entry.depth, at: entry.fragment ? `${entry.path}#${entry.fragment}` : entry.path }];
    }),
    rtl: epub.rtl,
    go(at, mark) {
      const found = target(at, mark);
      if (found) void go(found.at, found.where);
    },
    turn(forward) {
      if (index < 0) return;
      if (flow === "scrolled") {
        const element = scroller();
        const atEdge = forward ? element.scrollTop + element.clientHeight >= element.scrollHeight - 2 : element.scrollTop <= 0;
        if (!atEdge) return element.scrollBy({ top: (forward ? 1 : -1) * element.clientHeight * 0.9 });
      } else if (forward ? page < pages() - 1 : page > 0) {
        showPage(page + (forward ? 1 : -1));
        return tell(true);
      }
      const next = index + (forward ? 1 : -1);
      if (next >= 0 && next < epub.spine.length) void go(next, forward ? "start" : "end", forward);
    },
    setFlow(next) {
      const at = firstShown();
      flow = next;
      style();
      reveal(at);
      tell(false);
    },
    selection() {
      const selection = frame.contentWindow?.getSelection();
      if (index < 0 || !selection || selection.isCollapsed) return null;
      const range = selection.getRangeAt(0);
      return { text: selection.toString(), at: cfi(index, { node: range.startContainer, offset: range.startOffset }), progress: progress(), label: chapterLabel(index) };
    },
    async search(query, limit, signal) {
      const found: Awaited<ReturnType<Reading["search"]>> = [];
      for (let at = 0; at < epub.spine.length && found.length < limit; at++) {
        signal.throwIfAborted();
        const chapter = await chapterDocument(epub, at).catch(() => null);
        if (!chapter) continue;
        const walker = chapter.createTreeWalker(chapter.body ?? chapter.documentElement, NodeFilter.SHOW_TEXT);
        // Text node by text node, as a match keeps to one: enough for words and short phrases.
        for (let node = walker.nextNode() as Text | null; node && found.length < limit; node = walker.nextNode() as Text | null) {
          for (const match of findAll(node.data, query)) {
            found.push({ at: cfi(at, { node, offset: match.index }), progress: before(at) / total, label: chapterLabel(at), excerpt: excerptAround(node.data, match.index, match.length) });
            if (found.length >= limit) break;
          }
        }
      }
      return found;
    },
    focus() {
      frame.focus();
      frame.contentWindow?.focus();
    },
    layout() {
      if (index < 0) return;
      const at = firstShown();
      style();
      reveal(at);
    },
    destroy() {
      frame.remove();
      files.revoke();
    },
  };

  // Where it was left, or its start; where that can't be shown (a chapter that won't read), its start.
  const first = (book.at && target(book.at)) || { at: 0, where: "start" as const };
  await load(first.at, first.where, false).catch(() => load(0, "start", false));
  return reading;
}
