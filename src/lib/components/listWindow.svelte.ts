import type { Attachment } from "svelte/attachments";

/** How tall a row is taken to be before any has been measured. */
const GUESS = 100;

/** A drawn row: its item, where it is in the list, and its `top` if it's drawn apart from the others. */
export interface DrawnRow<T> {
  item: T;
  index: number;
  top?: number;
}

/** The row `y` px down a list falls in, by where each row starts. */
function rowAt(tops: Float64Array, y: number) {
  let low = 0;
  let high = tops.length - 2;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (tops[mid] <= y) low = mid;
    else high = mid - 1;
  }
  return Math.max(0, low);
}

/**
 * Which rows of a long list to draw: those in view and `overscan` px past it either way, so that
 * thousands of rows aren't all in the page (where every change, and in WebKit every keystroke
 * anywhere, pays for each). Rows are measured as they're drawn and remembered, and the ones not
 * yet drawn taken to be as tall as the average, so the list is as tall as all its rows and its
 * scrollbar true. The list puts the space of the rows not drawn (`before` and `after`) in its flow,
 * so the browser's scroll anchoring keeps the rows in view still as rows above them are drawn and
 * measured. One row (`keep`) is always drawn, in its place, so it can hold focus wherever the list
 * is scrolled.
 */
export class ListWindow<T> {
  /** How far the list is scrolled (`scrolled()`), and how tall its view is. */
  scrollTop = $state(0);
  viewHeight = $state(0);

  /** The list's scrolling element. */
  #element: () => HTMLElement | undefined;
  #items: () => readonly T[];
  #key: (item: T) => string;
  #keep: () => number;
  /** The space between rows, part of each row's height but the first's. */
  #gap: number;
  #overscan: number;

  /** Each row's height as last drawn, without the gap above it, by its item's key. */
  #heights = new Map<string, number>();
  #measuredTotal = 0;
  /** Bumped as rows are measured, as `#heights` isn't reactive. */
  #measured = $state(0);
  #frame = 0;
  #keys = new WeakMap<Element, string>();
  #observer = new ResizeObserver((records) => this.#resized(records));

  constructor(options: {
    element: () => HTMLElement | undefined;
    items: () => readonly T[];
    key: (item: T) => string;
    keep: () => number;
    gap: number;
    overscan: number;
  }) {
    this.#element = options.element;
    this.#items = options.items;
    this.#key = options.key;
    this.#keep = options.keep;
    this.#gap = options.gap;
    this.#overscan = options.overscan;
  }

  /** Where each row starts, the gap above it included; the last is where the list ends. */
  #tops = $derived.by(() => {
    void this.#measured;
    const items = this.#items();
    const guess = this.#heights.size ? this.#measuredTotal / this.#heights.size : GUESS;
    const tops = new Float64Array(items.length + 1);
    for (let i = 0; i < items.length; i++) tops[i + 1] = tops[i] + (i ? this.#gap : 0) + (this.#heights.get(this.#key(items[i])) ?? guess);
    return tops;
  });

  /** Where the view starts: where the browser will have scrolled to, should the list just have got shorter. */
  #viewTop = $derived(Math.max(0, Math.min(this.scrollTop, this.#tops[this.#tops.length - 1] - this.viewHeight)));
  /** The first row drawn, and the one after the last. */
  #start = $derived.by(() => rowAt(this.#tops, this.#viewTop - this.#overscan));
  #end = $derived.by(() => Math.min(this.#tops.length - 1, rowAt(this.#tops, this.#viewTop + this.viewHeight + this.#overscan) + 1));

  /** The rows to draw, in order: those from `#start` to `#end`, and the kept row wherever it is. */
  drawn = $derived.by(() => {
    const items = this.#items();
    const start = this.#start;
    const end = this.#end;
    const keep = this.#keep();
    const rows: DrawnRow<T>[] = [];
    if (keep >= 0 && keep < start) rows.push({ item: items[keep], index: keep, top: this.#tops[keep] });
    for (let i = start; i < end; i++) rows.push({ item: items[i], index: i });
    if (keep >= end && keep < items.length) rows.push({ item: items[keep], index: keep, top: this.#tops[keep] });
    return rows;
  });

  /** The space the rows not drawn take above the drawn ones, and below. */
  before = $derived(this.#tops[this.#start]);
  after = $derived(this.#tops[this.#tops.length - 1] - this.#tops[this.#end]);

  /** Keeps a drawn row's height (its element's, without the gap) up to date. */
  measure(key: string): Attachment<HTMLElement> {
    return (element) => {
      this.#keys.set(element, key);
      this.#observer.observe(element);
      return () => this.#observer.unobserve(element);
    };
  }

  /** Draws the rows for where the list is scrolled now. */
  scrolled() {
    this.scrollTop = this.#element()?.scrollTop ?? 0;
  }

  /** Scrolls the list to row `index` if none of it shows; the scroll draws it. */
  show(index: number) {
    const list = this.#element();
    const tops = this.#tops;
    if (!list || index < 0 || index >= tops.length - 1) return;
    const top = tops[index] + (index ? this.#gap : 0);
    const bottom = tops[index + 1];
    if (bottom > list.scrollTop && top < list.scrollTop + list.clientHeight) return;
    list.scrollTop = top < list.scrollTop ? top : bottom - list.clientHeight;
  }

  #resized(records: ResizeObserverEntry[]) {
    let changed = false;
    for (const { target, borderBoxSize } of records) {
      const key = this.#keys.get(target);
      const height = borderBoxSize[0].blockSize;
      const last = key === undefined ? undefined : this.#heights.get(key);
      // A hidden row measures nothing; it's as tall as it was.
      if (key === undefined || !height || height === last) continue;
      this.#heights.set(key, height);
      this.#measuredTotal += height - (last ?? 0);
      changed = true;
    }
    // Laid out again on the next frame: rows drawn now, while the browser is measuring, would be
    // measured late (a "ResizeObserver loop" error).
    if (changed && !this.#frame) {
      this.#frame = requestAnimationFrame(() => {
        this.#frame = 0;
        this.#measured++;
      });
    }
  }
}
