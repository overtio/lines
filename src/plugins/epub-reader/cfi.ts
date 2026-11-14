/*
 * Places in an EPUB as EPUB CFIs (https://w3c.github.io/epub-specs/epub33/epubcfi/), the way EPUB
 * readers write them, so a quote's link means the same place to them: `epubcfi(/6/4!/4/10/3:12)` is
 * the spine's second chapter (/6 the package's spine, /4 its second itemref), then in that chapter's
 * document its body (/4), the body's fifth element (/10), the text after that element's first
 * element (/3), and 12 characters into it. Elements are even steps, the text between them odd ones.
 * Written without the assertions in brackets some readers add (`/4[chap01]`), which are read past.
 */

/** A place in a chapter's document: a text node and a character in it, or an element. */
export interface Point {
  node: Node;
  offset: number;
}

/** Node types, as numbers, so the steps can be worked out wherever there's a tree of nodes (and tested without a page). */
const ELEMENT = 1;
const TEXT = 3;
const CDATA = 4;

const isText = (node: Node) => node.nodeType === TEXT || node.nodeType === CDATA;

/** The step to `node` among its parent's children: an element's even, the text before or after elements odd. */
function step(node: Node): number {
  let elements = 0;
  for (let sibling = node.parentNode!.firstChild; sibling && sibling !== node; sibling = sibling.nextSibling) {
    if (sibling.nodeType === ELEMENT) elements++;
  }
  return node.nodeType === ELEMENT ? (elements + 1) * 2 : elements * 2 + 1;
}

/** How many characters of text come before `node` in its run of text between elements. */
function before(node: Node) {
  let count = 0;
  for (let sibling = node.previousSibling; sibling && sibling.nodeType !== ELEMENT; sibling = sibling.previousSibling) {
    if (isText(sibling)) count += (sibling as CharacterData).length;
  }
  return count;
}

/** The steps from the document's root element to a point, and the character offset into text: `/4/10/3:12`. */
export function cfiPath({ node, offset }: Point): string {
  let target = node;
  let characters = offset;
  // A point between an element's children is at the child after it: its text's start, or the element.
  if (node.nodeType === ELEMENT && node.childNodes.length) {
    target = node.childNodes[Math.min(offset, node.childNodes.length - 1)];
    characters = offset < node.childNodes.length ? 0 : ((target as CharacterData).length ?? 0);
  }
  const steps: number[] = [];
  const root = target.ownerDocument!.documentElement;
  for (let at: Node = target; at !== root && at.parentNode; at = at.parentNode) steps.unshift(step(at));
  return steps.map((each) => `/${each}`).join("") + (isText(target) ? `:${before(target) + characters}` : "");
}

/** A point in the spine's chapter `index`, as a CFI. */
export const cfi = (index: number, point: Point) => `epubcfi(/6/${(index + 1) * 2}!${cfiPath(point)})`;

/** A CFI's chapter (its index in the spine), the steps in it, and the offset at its end; null if it isn't one. */
export function parseCfi(text: string): { index: number; steps: number[]; offset: number | null } | null {
  const match = /^epubcfi\((.*)\)$/.exec(text.trim());
  // Assertions are read past; a range (`/4/2,/1:2,/3:1`) is where it starts, its path and its start's.
  const [parent = "", start = ""] = match?.[1].replace(/\[[^\]]*\]/g, "").split(",") ?? [];
  const [spine, inside = ""] = (parent + start).split("!");
  const chapter = /^\/6\/(\d+)$/.exec(spine);
  if (!chapter || Number(chapter[1]) % 2 || !/^(?:\/\d+)*(?::\d+)?$/.test(inside)) return null;
  const [steps, offset] = inside.split(":");
  return {
    index: Number(chapter[1]) / 2 - 1,
    steps: steps.split("/").filter(Boolean).map(Number),
    offset: offset === undefined ? null : Number.parseInt(offset, 10),
  };
}

/** Where a CFI's steps lead in a chapter's document; as far as they go, where the document has changed. */
export function resolveCfi(doc: Document, steps: number[], offset: number | null): Point {
  let node: Node = doc.documentElement;
  for (const each of steps) {
    const children = Array.from(node.childNodes);
    if (each % 2 === 0) {
      const element = children.filter((child) => child.nodeType === ELEMENT)[each / 2 - 1];
      if (!element) break;
      node = element;
      continue;
    }
    // Odd: the text after the (each - 1) / 2'th element, and the character `offset` into it.
    let elements = 0;
    const run = children.filter((child) => {
      if (child.nodeType === ELEMENT) elements++;
      else if (elements === (each - 1) / 2 && isText(child)) return true;
      return false;
    }) as Text[];
    let left = offset ?? 0;
    for (const text of run) {
      if (left <= text.length) return { node: text, offset: left };
      left -= text.length;
    }
    break;
  }
  return { node, offset: 0 };
}
