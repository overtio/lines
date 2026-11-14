/*
 * Finding words in a book's text, for the readers (src/plugins/pdf-reader, epub-reader): where a
 * search matches, the words around it, a match marked where it's drawn, and the ISBN a book prints.
 */

/** Where `query` is in `text`, ignoring case and how words are spaced. */
export function findAll(text: string, query: string): { index: number; length: number }[] {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const pattern = new RegExp(words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "giu");
  return Array.from(text.matchAll(pattern), (match) => ({ index: match.index, length: match[0].length }));
}

/** The words around a match, on one line: a few before it, more after. */
export function excerptAround(text: string, index: number, length: number) {
  const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, index - 40)));
  const end = text.indexOf(" ", Math.min(text.length, index + length + 60));
  const shown = text.slice(start, end < 0 ? text.length : end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${shown}${end >= 0 ? "…" : ""}`;
}

/** Whether `digits` is an ISBN-10 or ISBN-13, its check digit right. */
function isIsbn(digits: string) {
  if (/^97[89]\d{10}$/.test(digits)) {
    const sum = [...digits].reduce((total, digit, at) => total + Number(digit) * (at % 2 ? 3 : 1), 0);
    return sum % 10 === 0;
  }
  if (/^\d{9}[\dX]$/.test(digits)) {
    const sum = [...digits].reduce((total, digit, at) => total + (digit === "X" ? 10 : Number(digit)) * (10 - at), 0);
    return sum % 11 === 0;
  }
  return false;
}

/** The first ISBN a book's text gives (`ISBN 978-0-14-143951-8`), without its hyphens. */
export function isbnIn(text: string): string | undefined {
  for (const match of text.matchAll(/ISBN(?:-1[03])?\s*:?\s*((?:\d[\s-]?){12}\d|(?:\d[\s-]?){9}[\dX])/gi)) {
    const digits = match[1].replace(/[\s-]/g, "").toUpperCase();
    if (isIsbn(digits)) return digits;
  }
  return undefined;
}

/** The highlight a search's match is drawn with, in the readers' stylesheets: `::highlight(lines-mark)`. */
export const MARK = "lines-mark";

/**
 * Marks the first place `query` is in `root`'s text, across its elements (a PDF's text runs), at or
 * after `from` if it's given (a search's match, where its text starts); the range marked, or null.
 * Drawn with the CSS Custom Highlight API, so the page's own elements are left as they are.
 */
export function markText(root: Element, query: string, from?: { node: Node; offset: number }): Range | null {
  const view = root.ownerDocument.defaultView;
  const highlights = view && "highlights" in view.CSS ? view.CSS.highlights : null;
  highlights?.delete(MARK);
  const nodes: Text[] = [];
  let text = "";
  // Where `from` is in the text: in a text node, or the text after an element.
  let start = from ? -1 : 0;
  const after = Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY;
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (start < 0 && from && (node === from.node || from.node.compareDocumentPosition(node) & after)) start = text.length + (node === from.node ? from.offset : 0);
    nodes.push(node);
    text += node.data;
  }
  const found = start < 0 ? undefined : findAll(text, query).find((match) => match.index >= start);
  if (!found) return null;
  const at = (offset: number): [Text, number] => {
    for (const node of nodes) {
      if (offset <= node.length) return [node, offset];
      offset -= node.length;
    }
    return [nodes.at(-1)!, nodes.at(-1)!.length];
  };
  const range = root.ownerDocument.createRange();
  range.setStart(...at(found.index));
  range.setEnd(...at(found.index + found.length));
  if (highlights && view) highlights.set(MARK, new view.Highlight(range));
  return range;
}
