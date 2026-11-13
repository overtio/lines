import type { Attachment } from "svelte/attachments";

/*
 * A font's name drawn in that font, as the font pickers list them (FontPicker.svelte), once it's in
 * sight, two a frame. WebKit finds a family as it styles the text, and a page of sixty new ones at
 * once, as the list grows while it's scrolled, held it still for a third of a second. Until then a
 * name is in the interface's font.
 */

/** How many names take their font in one frame. */
const PER_FRAME = 2;

const families = new WeakMap<Element, string>();
const waiting = new Set<HTMLElement>();
let frame = 0;
let observer: IntersectionObserver | undefined;

function draw() {
  frame = 0;
  for (const element of [...waiting].slice(0, PER_FRAME)) {
    element.style.fontFamily = families.get(element) ?? "";
    waiting.delete(element);
  }
  if (waiting.size) frame = requestAnimationFrame(draw);
}

function seen(entries: IntersectionObserverEntry[]) {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    waiting.add(entry.target as HTMLElement);
    observer!.unobserve(entry.target);
  }
  if (waiting.size && !frame) frame = requestAnimationFrame(draw);
}

/** On a font's name: drawn in `family` once it's in sight. */
export const ownFace =
  (family: string): Attachment<HTMLElement> =>
  (element) => {
    families.set(element, family);
    observer ??= new IntersectionObserver(seen);
    observer.observe(element);
    return () => {
      observer!.unobserve(element);
      waiting.delete(element);
    };
  };
