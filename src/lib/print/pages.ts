import { el } from "./parts";

/*
 * Pages from a printed note. The document is laid out once, as one long column the width of a
 * page's text; pages are then cut from it between lines of text, never through a line, an image,
 * math or a table row, and a heading stays with what follows it. Each page shows its part of the
 * column (copies of the blocks it holds, in place), so what prints is exactly what the preview
 * shows: the page breaks are lines' own, not the browser's.
 */

export type PaperId = "a4" | "letter";

/** Paper sizes and their margins, in millimetres. */
export const PAPERS: Record<PaperId, { width: number; height: number; side: number; top: number }> = {
  a4: { width: 210, height: 297, side: 22, top: 24 },
  letter: { width: 215.9, height: 279.4, side: 22, top: 22 },
};

/** Parts of a document that a page can't cut through. Text is cut between its lines (see `solids`). */
const WHOLE = "img, svg, .katex, .doc-math, tr, hr, .doc-box, .doc-mark, .doc-li-mark, .doc-image-missing, .doc-icon, .doc-title, .doc-theorem-label";

/** Where everything that can't be cut is, top to bottom, merged where they overlap: [top, bottom] from the column's top. */
function solids(doc: HTMLElement): [number, number][] {
  const origin = doc.getBoundingClientRect().top;
  const found: [number, number][] = [];
  const add = (rect: DOMRect) => {
    if (rect.height > 0 && rect.width > 0) found.push([rect.top - origin, rect.bottom - origin]);
  };
  // Each line of text, as the browser broke it.
  const walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent!.trim() || node.parentElement!.closest(WHOLE)) continue;
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) add(rect);
  }
  for (const element of doc.querySelectorAll(WHOLE)) add(element.getBoundingClientRect());
  found.sort((a, b) => a[0] - b[0]);
  // A heading holds on to the first line after it.
  for (const heading of doc.querySelectorAll("h1, h2, h3, h4, h5, h6, .doc-abstract-title, .doc-caption")) {
    const rect = heading.getBoundingClientRect();
    const bottom = rect.bottom - origin;
    const next = found.find(([top]) => top >= bottom - 1);
    if (next) found.push([rect.top - origin, next[1]]);
  }
  found.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [top, bottom] of found) {
    const last = merged[merged.length - 1];
    if (last && top < last[1] - 1) last[1] = Math.max(last[1], bottom);
    else merged.push([top, bottom]);
  }
  return merged;
}

/** Where each page starts and ends in the column, for pages `height` tall. */
function breaks(parts: [number, number][], height: number): [number, number][] {
  const pages: [number, number][] = [];
  // A little of the space around a cut goes with each side, for boxes' padding (a code block's).
  const slack = 8;
  let start = 0;
  let i = 0;
  while (i < parts.length) {
    const limit = start + height;
    let j = i;
    while (j < parts.length && parts[j][1] <= limit) j++;
    if (j === i) {
      // Taller than a whole page (it starts this one): it's cut where the page ends.
      pages.push([start, limit]);
      parts[i] = [limit, parts[i][1]];
      start = limit;
      continue;
    }
    const next = parts[j]?.[0] ?? Infinity;
    const end = Math.min(parts[j - 1][1] + slack, next, limit);
    pages.push([start, end]);
    i = j;
    if (i < parts.length) start = Math.max(end, parts[i][0] - slack);
  }
  return pages.length ? pages : [[0, 0]];
}

/**
 * Lays `doc` out in `measure` (a hidden column `paper`'s text width, already in the page) and
 * returns its pages. `whole` makes one page as tall as the document, with no page number (for a
 * single image of it).
 */
export function paginate(doc: HTMLElement, measure: HTMLElement, paper: PaperId, whole = false): HTMLElement[] {
  const size = PAPERS[paper];
  measure.style.width = `${size.width - 2 * size.side}mm`;
  if (doc.parentElement !== measure) measure.replaceChildren(doc);
  const probe = el("div");
  probe.style.height = `${size.height - 2 * size.top}mm`;
  measure.append(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();

  const origin = doc.getBoundingClientRect();
  const blocks = [...doc.children].map((block) => {
    const rect = block.getBoundingClientRect();
    return { block, top: rect.top - origin.top, bottom: rect.bottom - origin.top, left: rect.left - origin.left, width: rect.width };
  });
  const cuts = whole ? [[0, Math.ceil(origin.height)] as [number, number]] : breaks(solids(doc), height);
  return cuts.map(([start, end], index) => {
    const page = el("div", "print-page");
    page.style.width = `${size.width}mm`;
    page.style.height = whole ? `calc(${2 * size.top}mm + ${end}px)` : `${size.height}mm`;
    const area = el("div", "print-area");
    area.style.inset = `${size.top}mm ${size.side}mm auto`;
    area.style.height = `${end - start}px`;
    const copy = doc.cloneNode(false) as HTMLElement;
    copy.style.top = `${-start}px`;
    for (const { block, top, bottom, left, width } of blocks) {
      if (bottom <= start || top >= end) continue;
      const clone = block.cloneNode(true) as HTMLElement;
      Object.assign(clone.style, { position: "absolute", top: `${top}px`, left: `${left}px`, width: `${width}px`, margin: "0" });
      // A block carried over from the page before is read there, whole, not again here.
      if (top < start) clone.setAttribute("aria-hidden", "true");
      copy.append(clone);
    }
    area.append(copy);
    page.append(area);
    if (!whole) {
      const footer = el("div", "print-footer", String(index + 1));
      footer.style.bottom = `${size.top / 2}mm`;
      page.append(footer);
    }
    return page;
  });
}
