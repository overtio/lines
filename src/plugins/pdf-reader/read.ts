import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy, type PDFPageProxy, type RenderTask } from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { excerptAround, findAll, isbnIn, markText } from "../../lib/books/text";
import { t } from "../../lib/i18n/index.svelte";
import type { BookDetails, BookFlow, OpenBook, Reading } from "../../lib/plugins/types";
import "./reader.css";

/*
 * A PDF, with pdf.js: its pages one under another, each drawn on a canvas once it's near the view
 * and let go once it's far from it, so a 400-page book holds a few pages in memory, not 400. Over
 * each canvas, pdf.js's text layer: the page's text in transparent spans where it's drawn, to
 * choose, search and read aloud. Paginated, a page fits the view and the keys turn it; scrolled, the
 * pages fit its width. Pages are as printed, or in the theme's colors, their pictures as they are.
 * A place is `page=12`, as a link to a PDF says it.
 */

GlobalWorkerOptions.workerSrc = worker;

/**
 * pdf.js's own files, served with lines (vite.config.ts) and fetched only by a PDF that needs them:
 * character maps for Chinese, Japanese and Korean text, the standard fonts a PDF doesn't carry, and
 * the decoders of JPEG 2000 and JBIG2 pictures and of color profiles.
 */
const DATA = new URL(`${import.meta.env.BASE_URL}pdfjs/`, location.href).href;

/** The widest a page is drawn while scrolling: past it, lines of text get too long to read. */
const MAX_WIDTH = 900;
/** Space around each page, scrolling. */
const GAP = 16;

/** A PDF read from its file's bytes, which pdf.js takes over. */
const load = (data: Uint8Array<ArrayBuffer>) =>
  getDocument({
    data,
    useSystemFonts: true,
    enableXfa: false,
    cMapUrl: `${DATA}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${DATA}standard_fonts/`,
    wasmUrl: `${DATA}wasm/`,
    iccUrl: `${DATA}iccs/`,
  }).promise;

/** A page's text as pdf.js reads it, its runs joined, a line's end a space. */
async function pageText(page: PDFPageProxy) {
  const content = await page.getTextContent();
  return content.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? " " : "") : "")).join("");
}

export async function pdfDetails(bytes: Uint8Array<ArrayBuffer>): Promise<BookDetails> {
  const doc = await load(bytes);
  try {
    const { info, metadata } = await doc.getMetadata();
    const dict = info as Record<string, unknown>;
    const xmp = (name: string) => {
      const value = metadata?.get(name);
      return (Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value : "").trim();
    };
    const said = (name: string) => (typeof dict[name] === "string" ? (dict[name] as string).trim() : "");
    // The ISBN, where the book prints it: on its first pages, the copyright page.
    let isbn: string | undefined;
    for (let n = 1; n <= Math.min(doc.numPages, 8) && !isbn; n++) isbn = isbnIn(await pageText(await doc.getPage(n)));
    const properties: [string, string][] = [
      ["author", xmp("dc:creator") || said("Author")],
      ["pages", String(doc.numPages)],
      ["publisher", xmp("dc:publisher")],
      ["isbn", isbn ?? ""],
      ["language", xmp("dc:language")],
    ];
    return {
      title: xmp("dc:title") || said("Title") || undefined,
      properties: properties.filter(([, value]) => value),
      description: xmp("dc:description") || said("Subject") || undefined,
      cover: await firstPage(doc).catch(() => undefined),
    };
  } finally {
    void doc.loadingTask.destroy();
  }
}

/** A picture of the first page, as a cover. */
async function firstPage(doc: PDFDocumentProxy): Promise<Blob | undefined> {
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 600 / page.getViewport({ scale: 1 }).width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvas, viewport, background: "#fff" }).promise;
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? undefined), "image/jpeg", 0.85));
}

/** A color as red, green and blue, however CSS writes it (`oklch(…)` too). */
function rgb(color: string): [number, number, number] {
  const context = new OffscreenCanvas(1, 1).getContext("2d")!;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  return [red, green, blue];
}

/**
 * A printed page in the theme's colors: its black the text's, its white the background's and the
 * greys between their mix, its pictures, where pdf.js says it drew them (three corners each, 0 to 1
 * across the page), left as they are.
 */
function recolor(canvas: HTMLCanvasElement, pictures: ArrayLike<number> | null, ink: [number, number, number], paper: [number, number, number]) {
  const context = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const kept: { x: number; y: number; pixels: ImageData }[] = [];
  const corners = pictures ?? [];
  for (let i = 0; i + 5 < corners.length; i += 6) {
    const xs = [corners[i], corners[i + 2], corners[i + 4], corners[i + 2] + corners[i + 4] - corners[i]].map((x) => x * width);
    const ys = [corners[i + 1], corners[i + 3], corners[i + 5], corners[i + 3] + corners[i + 5] - corners[i + 1]].map((y) => y * height);
    const x = Math.max(0, Math.floor(Math.min(...xs)));
    const y = Math.max(0, Math.floor(Math.min(...ys)));
    const w = Math.min(width, Math.ceil(Math.max(...xs))) - x;
    const h = Math.min(height, Math.ceil(Math.max(...ys))) - y;
    if (w > 0 && h > 0) kept.push({ x, y, pixels: context.getImageData(x, y, w, h) });
  }
  const page = context.getImageData(0, 0, width, height);
  const pixels = page.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const light = (pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722) / 255;
    pixels[i] = ink[0] + (paper[0] - ink[0]) * light;
    pixels[i + 1] = ink[1] + (paper[1] - ink[1]) * light;
    pixels[i + 2] = ink[2] + (paper[2] - ink[2]) * light;
  }
  context.putImageData(page, 0, 0);
  for (const { x, y, pixels } of kept) context.putImageData(pixels, x, y);
}

interface Page {
  n: number;
  dom: HTMLElement;
  /** Drawn at this scale and in these colors, or not drawn. */
  drawn: string | null;
  task?: RenderTask;
  layer?: TextLayer;
}

export async function openPdf(dom: HTMLElement, book: OpenBook): Promise<Reading> {
  const doc = await load(new Uint8Array(await book.data.arrayBuffer()));
  const count = doc.numPages;
  const base = (await doc.getPage(1)).getViewport({ scale: 1 });
  let flow: BookFlow = book.flow;
  let themeColors = book.themeColors;
  let scale = 1;
  let current = 1;
  let mark: { page: number; text: string } | null = null;

  /** A page asked for, as one of this PDF's: `page=0` or `page=999` of a shorter one is its first or last. */
  const pageAt = (at: string) => Math.min(count, Math.max(1, Number(/(?:^|&)page=(\d+)/.exec(at)?.[1]) || 1));
  const progressAt = (n: number) => (count > 1 ? (n - 1) / (count - 1) : 1);

  // One document for screen readers, its pages' text in order.
  const scroller = document.createElement("div");
  scroller.className = "pdf-reader";
  scroller.tabIndex = 0;
  scroller.setAttribute("role", "document");
  scroller.setAttribute("aria-label", book.title);
  const pages: Page[] = Array.from({ length: count }, (_, index) => {
    const page = document.createElement("div");
    page.className = "pdf-page";
    page.dataset.page = String(index + 1);
    scroller.append(page);
    return { n: index + 1, dom: page, drawn: null };
  });
  dom.append(scroller);

  /** How a page is drawn now: its scale, and its colors. */
  const look = () => {
    if (!themeColors) return `${scale}`;
    const style = getComputedStyle(dom);
    return `${scale} ${style.color} ${style.backgroundColor}`;
  };

  async function draw(page: Page) {
    const drawing = look();
    if (page.drawn === drawing) return;
    page.task?.cancel();
    page.layer?.cancel();
    page.drawn = drawing;
    const proxy = await doc.getPage(page.n);
    const viewport = proxy.getViewport({ scale });
    const ratio = devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.setAttribute("aria-hidden", "true");
    const text = document.createElement("div");
    text.className = "textLayer";
    page.task = proxy.render({ canvas, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0], recordImages: themeColors });
    page.layer = new TextLayer({ textContentSource: proxy.streamTextContent(), container: text, viewport });
    try {
      await Promise.all([page.task.promise, page.layer.render()]);
    } catch {
      // Cancelled: let go of, or drawn again another way.
      return;
    }
    if (page.drawn !== drawing) return;
    if (themeColors) {
      const style = getComputedStyle(dom);
      recolor(canvas, proxy.imageCoordinates, rgb(style.color), rgb(style.backgroundColor));
    }
    page.dom.replaceChildren(canvas, text);
    if (mark?.page === page.n) showMark(text, mark.text);
  }

  /** Marks a search's match on its page, scrolling to it if the pages scroll. */
  function showMark(layer: HTMLElement, text: string) {
    const range = markText(layer, text);
    if (range && flow === "scrolled") range.startContainer.parentElement?.scrollIntoView({ block: "center" });
  }

  function release(page: Page) {
    page.task?.cancel();
    page.layer?.cancel();
    page.drawn = null;
    page.dom.replaceChildren();
  }

  // Pages are drawn as they come within a screen of the view, and let go of beyond three.
  const near = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) void draw(pages[Number((entry.target as HTMLElement).dataset.page) - 1]);
    },
    { root: scroller, rootMargin: "100% 0px" },
  );
  const far = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (!entry.isIntersecting) release(pages[Number((entry.target as HTMLElement).dataset.page) - 1]);
    },
    { root: scroller, rootMargin: "300% 0px" },
  );

  /**
   * Fits the pages: paginated, each in the whole view, centered, so the next is out of sight;
   * scrolled, to the view's width, no wider than reads well.
   */
  function size() {
    const width = scroller.clientWidth - GAP * 2;
    const height = scroller.clientHeight;
    scale = Math.max(0.25, flow === "paginated" ? Math.min(width / base.width, (height - GAP * 2) / base.height) : Math.min(width, MAX_WIDTH) / base.width);
    scroller.dataset.flow = flow;
    scroller.style.setProperty("--total-scale-factor", String(scale));
    const pageHeight = Math.floor(base.height * scale);
    for (const page of pages) {
      page.dom.style.width = `${Math.floor(base.width * scale)}px`;
      page.dom.style.height = `${pageHeight}px`;
      page.dom.style.marginBlock = flow === "paginated" ? `${(height - pageHeight) / 2}px` : "";
      if (page.drawn !== null) void draw(page);
    }
  }

  function show(n: number, read: boolean) {
    current = Math.min(count, Math.max(1, n));
    scroller.scrollTop = flow === "paginated" ? (current - 1) * scroller.clientHeight : pages[current - 1].dom.offsetTop - GAP;
    tell(read);
  }

  function tell(read: boolean) {
    book.moved({ at: `page=${current}`, progress: progressAt(current), label: t("books.pageOf", { page: current, count }) }, read);
  }

  // The page at the top of the view, as it scrolls: scrolled, that's reading on.
  let frame = 0;
  scroller.addEventListener(
    "scroll",
    () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = scroller.scrollTop + scroller.clientHeight / 3;
        let n = 1;
        for (let low = 0, high = count - 1; low <= high; ) {
          const middle = (low + high) >> 1;
          if (pages[middle].dom.offsetTop <= top) {
            n = middle + 1;
            low = middle + 1;
          } else high = middle - 1;
        }
        if (n === current) return;
        current = n;
        tell(true);
      });
    },
    { passive: true },
  );

  // Paginated, a swipe or the wheel turns the page, once for each push.
  let wheeled = 0;
  scroller.addEventListener(
    "wheel",
    (event) => {
      if (flow !== "paginated" || Math.abs(event.deltaY) < 20 || event.timeStamp - wheeled < 400) return;
      wheeled = event.timeStamp;
      reading.turn(event.deltaY > 0);
    },
    { passive: true },
  );

  const chosen = () => {
    const selection = document.getSelection();
    return selection && !selection.isCollapsed && scroller.contains(selection.anchorNode) ? selection : null;
  };
  const onSelection = () => book.selected(!!chosen());
  document.addEventListener("selectionchange", onSelection);

  const texts = new Map<number, Promise<string>>();
  const textOf = (n: number) => {
    let text = texts.get(n);
    if (!text) texts.set(n, (text = doc.getPage(n).then(pageText)));
    return text;
  };

  async function contents(): Promise<Reading["contents"]> {
    const outline = (await doc.getOutline()) ?? [];
    const entries: Reading["contents"] = [];
    const walk = async (items: typeof outline, depth: number) => {
      for (const item of items) {
        const dest = typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
        const ref = dest?.[0];
        const page = ref && typeof ref === "object" ? (await doc.getPageIndex(ref).catch(() => -1)) + 1 : typeof ref === "number" ? ref + 1 : 0;
        if (page > 0) entries.push({ label: item.title, at: `page=${page}`, depth });
        await walk(item.items, depth + 1);
      }
    };
    await walk(outline, 0);
    return entries;
  }

  const reading: Reading = {
    contents: await contents(),
    go(at, text) {
      const n = pageAt(at);
      mark = text ? { page: n, text } : null;
      show(n, false);
      const layer = pages[n - 1].dom.querySelector<HTMLElement>(".textLayer");
      if (layer && text) showMark(layer, text);
    },
    turn(forward) {
      if (flow === "paginated") show(current + (forward ? 1 : -1), true);
      else scroller.scrollBy({ top: (forward ? 1 : -1) * scroller.clientHeight * 0.9 });
    },
    setFlow(next) {
      flow = next;
      size();
      show(current, false);
    },
    setThemeColors(on) {
      themeColors = on;
      for (const page of pages) if (page.drawn !== null) void draw(page);
    },
    selection() {
      const selection = chosen();
      if (!selection) return null;
      const n = Number((selection.anchorNode as Element).parentElement?.closest<HTMLElement>(".pdf-page")?.dataset.page) || current;
      // A word broken over two lines is one again.
      const text = selection.toString().replace(/(\p{L})-\s*\n\s*(\p{Ll})/gu, "$1$2");
      return { text, at: `page=${n}`, progress: progressAt(n), label: t("books.page", { page: n }) };
    },
    async search(query, limit, signal) {
      const found: Awaited<ReturnType<Reading["search"]>> = [];
      for (let n = 1; n <= count && found.length < limit; n++) {
        signal.throwIfAborted();
        const text = await textOf(n);
        for (const match of findAll(text, query)) {
          found.push({ at: `page=${n}`, progress: progressAt(n), label: t("books.page", { page: n }), excerpt: excerptAround(text, match.index, match.length) });
          if (found.length >= limit) break;
        }
      }
      return found;
    },
    focus: () => scroller.focus({ preventScroll: true }),
    layout() {
      size();
      show(current, false);
    },
    destroy() {
      document.removeEventListener("selectionchange", onSelection);
      near.disconnect();
      far.disconnect();
      for (const page of pages) release(page);
      scroller.remove();
      void doc.loadingTask.destroy();
    },
  };

  size();
  for (const page of pages) {
    near.observe(page.dom);
    far.observe(page.dom);
  }
  if (book.at) reading.go(book.at);
  else show(1, false);
  return reading;
}
