import { css, parse, type Rgb } from "./color";
import { FORMATTING, FORMATTING_COLORS } from "./formatting";

/*
 * What colors a part of lines is drawn in, by the theme's custom properties, to change by
 * right-clicking it (components/ColorPicking.svelte, themes/drafts.svelte.ts): its text, its
 * border, and what's behind it, layer by layer down to the first that isn't see-through (a row's
 * hover over the sidebar). Each is matched to the property it's drawn from, worked out where the
 * part is (a pane shown dark has its own), and named by the color a theme sets for it: the
 * sidebar's surface is its background, the highlight is mixed from Highlights. Text in a note is
 * the formatting it's in first (a bold word is Bold, then Text), to change that alone.
 */

export type Role = "background" | "text" | "border";

export interface FoundColor {
  role: Role;
  /** The theme's color it's drawn in, by its custom property without its `--`. */
  key: string;
  /** As it shows there, as CSS. */
  shown: string;
}

const PALETTE = ["red", "orange", "yellow", "green", "blue", "purple", "gray"].map((color) => `palette-${color}`);
const CALLOUTS = ["info", "question", "warning", "error", "decision"].map((kind) => `callout-${kind}`);
const CODE = ["keyword", "string", "number", "comment", "function", "type"].map((kind) => `syn-${kind}`);

/** The properties each kind of color can be drawn from, in the order a tie goes, as [property, the color it's made from]. */
const FROM: Record<Role, [string, string][]> = {
  background: [
    ...["hover", "active", "selection", "tag-bg", "code-bg", "input", "card-bg"].map((key): [string, string] => [key, key]),
    ["accent-soft", "accent"],
    ["highlight", "highlight-base"],
    ["surface", "bg"],
    ["surface-list", "bg-list"],
    ["surface-sidebar", "bg-sidebar"],
    ...["bg", "bg-list", "bg-sidebar", "bg-elevated", "accent", "danger", "success", "pin", "highlight-base", ...PALETTE].map((key): [string, string] => [key, key]),
  ],
  text: ["text", "text-sidebar", "text-muted", "text-faint", "accent", "tag-text", "on-accent", "danger", "success", "pin", ...PALETTE, ...CALLOUTS, ...CODE, ...FORMATTING_COLORS].map((key) => [key, key]),
  border: ["border", "card-border", "ink", "accent", "text", "tag-text", "danger"].map((key) => [key, key]),
};

/** Colors to try first where a part says what it is, for colors two properties share (code's background and a field's are both a little ink). */
const PLACES: [string, string[]][] = [
  ['[data-pane="sidebar"]', ["surface-sidebar", "bg-sidebar", "text-sidebar"]],
  ['[data-pane="list"]', ["surface-list", "bg-list"]],
  ['[role="dialog"], [role="menu"], [role="listbox"], .ui-menu, .ui-dialog', ["bg-elevated"]],
  ["code, pre, [class*='code']", ["code-bg"]],
  ["input, textarea, .ui-field, .ui-select", ["input"]],
  ["[class*='tag']", ["tag-bg", "tag-text"]],
];

const near = (a: Rgb, b: Rgb) => Math.abs(a.r - b.r) <= 1.5 && Math.abs(a.g - b.g) <= 1.5 && Math.abs(a.b - b.b) <= 1.5 && Math.abs(a.a - b.a) <= 0.01;

/** Reads colors as the browser works them out: a custom property's value, its var()s already filled in where it was read. */
class Resolver {
  #probe = document.createElement("span");
  #cache = new Map<string, Rgb | undefined>();

  constructor() {
    this.#probe.hidden = true;
    document.body.append(this.#probe);
  }

  color(value: string) {
    if (!this.#cache.has(value)) {
      this.#probe.style.color = "";
      this.#probe.style.color = value;
      this.#cache.set(value, this.#probe.style.color ? parse(getComputedStyle(this.#probe).color) : undefined);
    }
    return this.#cache.get(value);
  }

  done() {
    this.#probe.remove();
  }
}

/** The property `color` is drawn from at `el`, of those `role`'s colors can be: one its place says first, then in their order. */
function match(el: Element, role: Role, color: Rgb, resolver: Resolver): string | undefined {
  const style = getComputedStyle(el);
  const preferred = new Set(PLACES.flatMap(([selector, keys]) => (el.closest(selector) ? keys : [])));
  const candidates = [...FROM[role]].sort(([a], [b]) => Number(preferred.has(b)) - Number(preferred.has(a)));
  for (const [property, key] of candidates) {
    const value = style.getPropertyValue(`--${property}`).trim();
    const resolved = value && resolver.color(value);
    if (resolved && near(resolved, color)) return key;
  }
}

/**
 * The formatting in a note that draws `target`'s text in `color`, innermost first: each whose color
 * is that, or that has none (app.css) and so is in the color of the text around it. Only as far out
 * as the text is that color: a bold word in a link is Bold and Link, not the paragraph's too.
 */
function formattingAt(target: Element, color: Rgb, resolver: Resolver): string[] {
  const keys: string[] = [];
  for (let el: Element | null = target; el?.parentElement; el = el.parentElement) {
    const style = getComputedStyle(el);
    const shown = parse(style.color);
    if (!shown || !near(shown, color)) break;
    for (const [key, selector] of FORMATTING) {
      if (!el.matches(selector)) continue;
      const value = style.getPropertyValue(`--${key}`).trim();
      const drawn = value ? resolver.color(value) : parse(getComputedStyle(el.parentElement).color);
      if (drawn && near(drawn, color)) keys.push(key);
    }
  }
  return keys;
}

/** The color of a background image that's one color all over, as a layer over a background is drawn (`linear-gradient(c, c)`). */
function flat(image: string) {
  const [, from, to] = /^linear-gradient\(((?:rgba?|color)\([^)]*\)), ((?:rgba?|color)\([^)]*\))\)$/.exec(image) ?? [];
  return from && from === to ? from : undefined;
}

/** The colors `target` is drawn in, each once: its text, its border, then what's behind it, nearest first. */
export function colorsAt(target: Element): FoundColor[] {
  const resolver = new Resolver();
  const found: FoundColor[] = [];
  const add = (el: Element, role: Role, value: string) => {
    const color = parse(value);
    if (!color || color.a === 0) return color;
    const key = match(el, role, color, resolver);
    if (key && !found.some((each) => each.key === key)) found.push({ role, key, shown: css(color) });
    return color;
  };
  try {
    const style = getComputedStyle(target);
    const text = parse(style.color);
    if (text && text.a > 0) found.push(...formattingAt(target, text, resolver).map((key): FoundColor => ({ role: "text", key, shown: css(text) })));
    add(target, "text", style.color);
    if (parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== "none") add(target, "border", style.borderTopColor);
    for (let el: Element | null = target; el; el = el.parentElement) {
      const { backgroundImage, backgroundColor } = getComputedStyle(el);
      const layer = flat(backgroundImage);
      if (layer) add(el, "background", layer);
      const behind = add(el, "background", backgroundColor);
      if (behind && behind.a >= 0.99) break;
    }
  } finally {
    resolver.done();
  }
  return found;
}
