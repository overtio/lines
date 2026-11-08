import JSON5 from "json5";
import wavedrom from "wavedrom";
import defaultSkin from "wavedrom/skins/default.js";
import lowkey from "wavedrom/skins/lowkey.js";
import narrow from "wavedrom/skins/narrow.js";
import narrower from "wavedrom/skins/narrower.js";
import narrowerer from "wavedrom/skins/narrowerer.js";
import { t } from "../../lib/i18n/index.svelte";

/*
 * Draws WaveJSON (https://wavedrom.com) with WaveDrom: timing diagrams (`signal`), registers' bit
 * fields (`reg`) and logic circuits (`assign`). The source is read as JSON5, as WaveDrom's own
 * command line reads it, never run as code.
 *
 * WaveDrom describes a drawing as a tree (onml), which is made into SVG here rather than through its
 * markup, which doesn't escape text: only the elements WaveDrom draws with, nothing that runs or
 * loads from elsewhere, whatever a name written as markup asks for. Its drawings share ids and
 * global styles, so each gets ids of its own and styles that reach only it, and the parts it
 * reuses (`<use>`) are copied where they're used, which such styles reach. Its colors become
 * what they're for (text, lines, boxes…), as Pele's diagrams are drawn (plugins/pele): the theme's
 * on screen, black on white with light fills on paper.
 */

/** Its looks other than the dark one, which the theme's colors stand in for: `config: { skin: "narrow" }`. */
const skins = { ...defaultSkin, ...narrow, ...narrower, ...narrowerer, ...lowkey };

const SVG = "http://www.w3.org/2000/svg";
const XML = "http://www.w3.org/XML/1998/namespace";

/** What WaveDrom draws with. Anything else in a drawing is left out. */
const ELEMENTS = new Set(["svg", "g", "defs", "style", "marker", "path", "rect", "line", "polyline", "polygon", "circle", "ellipse", "text", "tspan", "title"]);

/** Attributes taken into the style, where colors are custom properties, which attributes can't hold. */
const PAINTED = new Set(["fill", "stroke", "color", "font-family"]);

/** A link to anything outside the drawing. */
const ELSEWHERE = /url\(\s*(?!['"]?#)/i;

/** A color as WaveDrom writes them, with or without its opacity. */
const COLOR = /#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})\b|\b(?:black|white)\b/gi;

/** What WaveDrom's text escapes. */
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** On screen, the theme's colors, as Pele's are (plugins/pele), and its colors of each hue. */
const SCREEN = {
  "--wd-text": "var(--text)",
  "--wd-muted": "var(--text-muted)",
  "--wd-line": "var(--text-muted)",
  "--wd-faint": "color-mix(in srgb, var(--text) 25%, var(--bg))",
  "--wd-bg": "var(--bg)",
  "--wd-surface": "color-mix(in srgb, var(--accent) 14%, var(--bg))",
  "--wd-surface-alt": "color-mix(in srgb, var(--ink) 5%, var(--bg))",
  "--wd-border": "color-mix(in srgb, var(--accent) 60%, var(--bg))",
  "--wd-accent": "var(--accent)",
  "--wd-red": "var(--danger)",
  "--wd-orange": "var(--callout-warning)",
  "--wd-yellow": "var(--highlight-base)",
  "--wd-green": "var(--success)",
  "--wd-teal": "var(--callout-decision)",
  "--wd-blue": "var(--callout-info)",
  "--wd-purple": "var(--callout-question)",
};

/** On paper: black lines and text, light fills. */
const PAPER: typeof SCREEN = {
  "--wd-text": "#1a1a1a",
  "--wd-muted": "#555555",
  "--wd-line": "#555555",
  "--wd-faint": "#bbbbbb",
  "--wd-bg": "#ffffff",
  "--wd-surface": "#eef1f6",
  "--wd-surface-alt": "#f6f6f6",
  "--wd-border": "#7d8796",
  "--wd-accent": "#555555",
  "--wd-red": "#d53c40",
  "--wd-orange": "#d97706",
  "--wd-yellow": "#ffd60a",
  "--wd-green": "#278553",
  "--wd-teal": "#12866f",
  "--wd-blue": "#2f6fdb",
  "--wd-purple": "#8250df",
};

/** Those colors by the hue they're nearest. */
const HUES: [number, string][] = [
  [0, "red"],
  [35, "orange"],
  [58, "yellow"],
  [125, "green"],
  [172, "teal"],
  [215, "blue"],
  [275, "purple"],
  [360, "red"],
];

/** What WaveDrom's classes draw: signals' names as text, unknown values' hatching faint, and plain data, gates and their inputs in boxes like Pele's. */
const CLASSES =
  ".info{fill:var(--wd-text)} .s2{stroke:var(--wd-faint)} .s7{fill:var(--wd-surface)} .gate,.dff{fill:var(--wd-surface);stroke:var(--wd-border)} .port,.bind,.siglabel{fill:var(--wd-surface-alt);stroke:var(--wd-faint)}";

let drawings = 0;

/** A ```wavedrom block's SVG; throws, saying what's wrong, on WaveJSON it can't read. */
export function draw(source: string, paper: boolean): string {
  const tree = wavedrom.renderAny(0, read(source), skins);
  const id = `lines-wavedrom-${++drawings}`;
  const svg = document.createElementNS(SVG, "svg");
  const drawing: Drawing = { id, root: svg, parts: new Map() };
  build(tree, svg, drawing);
  // WaveDrom's own <svg>, inside the one it was built in.
  const root = svg.firstElementChild;
  if (!(root instanceof SVGSVGElement)) throw new Error(t("editor.wavedrom.what"));
  root.id = id;
  for (const [name, value] of Object.entries(paper ? PAPER : SCREEN)) root.style.setProperty(name, value);
  // What's drawn in no color of its own is black: text.
  root.style.fill = "var(--wd-text)";
  const style = root.querySelector(":scope > style") ?? root.insertBefore(document.createElementNS(SVG, "style"), root.firstChild);
  style.textContent += scope(CLASSES, drawing);
  // The parts copied where they're used, and a timing diagram's white background, where the note's own shows instead.
  for (const part of root.querySelectorAll(`defs > :not(marker), [id^="${id}-waves_"] > rect:first-child`)) part.remove();
  fit(root);
  return new XMLSerializer().serializeToString(root);
}

/**
 * Grows a drawing to hold all it draws, measured in the page in the note's fonts: WaveDrom makes
 * room for names as Helvetica draws them, and for a name written as markup, none at all.
 */
function fit(svg: SVGSVGElement) {
  if (!svg.getAttribute("viewBox")) return;
  const holder = document.body.appendChild(document.createElement("div"));
  holder.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  holder.append(svg);
  const drawn = svg.getBBox();
  holder.remove();
  const box = svg.viewBox.baseVal;
  const left = Math.min(box.x, Math.floor(drawn.x));
  const top = Math.min(box.y, Math.floor(drawn.y));
  const width = Math.max(box.x + box.width, Math.ceil(drawn.x + drawn.width)) - left;
  const height = Math.max(box.y + box.height, Math.ceil(drawn.y + drawn.height)) - top;
  svg.setAttribute("viewBox", `${left} ${top} ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
}

/** WaveJSON with something to draw: signals, a register's fields or logic. */
function read(source: string): object {
  const diagram: unknown = JSON5.parse(source);
  const kind = diagram && typeof diagram === "object" ? ["signal", "assign", "reg"].find((key) => key in diagram) : undefined;
  if (!kind || !Array.isArray((diagram as Record<string, unknown>)[kind])) throw new Error(t("editor.wavedrom.what"));
  return diagram as object;
}

interface Drawing {
  id: string;
  root: Element;
  /** Its parts, by WaveDrom's ids for them, for `<use>`s to copy. */
  parts: Map<string, Element>;
}

const isAttributes = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Adds an onml node to `parent`: an element (`[name, attributes?, ...children]`), a list of them, or text. */
function build(node: unknown, parent: Element, drawing: Drawing) {
  if (typeof node === "string" || typeof node === "number") return void parent.append(unescape(String(node)));
  if (!Array.isArray(node) || !node.length) return;
  const [name, ...rest]: unknown[] = node;
  if (typeof name !== "string") {
    for (const child of node) build(child, parent, drawing);
    return;
  }
  if (name === "use") return copy(rest[0], parent, drawing);
  // Styles only where WaveDrom puts its own, on the drawing itself.
  if (!ELEMENTS.has(name) || (name === "style" && parent.parentNode !== drawing.root)) return;
  const element = parent.appendChild(document.createElementNS(SVG, name));
  for (const [i, child] of rest.entries()) {
    if (i === 0 && isAttributes(child)) setAttributes(element, child, drawing);
    else build(child, element, drawing);
  }
  if (name === "style") element.textContent = scope(element.textContent ?? "", drawing);
}

/** A `<use>`: a copy of the part it shows, without its ids. */
function copy(attributes: unknown, parent: Element, drawing: Drawing) {
  if (!isAttributes(attributes)) return;
  const { "xlink:href": link, href = link, ...rest } = attributes;
  const part = drawing.parts.get(String(href).slice(1));
  if (!part) return;
  const g = parent.appendChild(document.createElementNS(SVG, "g"));
  setAttributes(g, rest, drawing);
  const shown = g.appendChild(part.cloneNode(true) as Element);
  for (const each of [shown, ...shown.querySelectorAll("[id]")]) each.removeAttribute("id");
}

/** Text as WaveDrom gives it, escaped for markup. */
const unescape = (text: string) =>
  text.replace(/&(?:#(\d{1,6})|#x([\da-f]{1,5})|(\w+));/gi, (entity, decimal?: string, hex?: string, name?: string) => {
    const code = decimal ? Number(decimal) : hex ? parseInt(hex, 16) : null;
    return code === null ? (ENTITIES[name!] ?? entity) : code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });

function setAttributes(element: Element, attributes: Record<string, unknown>, drawing: Drawing) {
  const style: string[] = [];
  for (const [name, raw] of Object.entries(attributes)) {
    const value = Array.isArray(raw) ? raw.join(" ") : String(raw);
    // No scripts, and no links: a part shown elsewhere is copied there.
    if (!/^[a-z][\w:.-]*$/i.test(name) || /^(?:on|xmlns)|href$/i.test(name) || ELSEWHERE.test(value)) continue;
    if (name === "style") style.push(restyle(value, drawing));
    else if (name === "id") {
      element.id = `${drawing.id}-${value}`;
      drawing.parts.set(value, element);
    } else if (PAINTED.has(name)) style.unshift(restyle(`${name}:${value}`, drawing));
    else if (name.startsWith("xml:")) element.setAttributeNS(XML, name, value);
    else if (!name.includes(":")) element.setAttribute(name, ownLinks(value, drawing));
  }
  if (style.length) element.setAttribute("style", style.filter(Boolean).join(";"));
}

/** A `<style>`'s rules, each reaching only this drawing, without hovering effects. */
function scope(css: string, drawing: Drawing) {
  let scoped = "";
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/:hover|@/.test(selectors)) continue;
    const within = selectors
      .split(",")
      .map((selector) => `#${drawing.id} ${selector.trim()}`)
      .join(",");
    scoped += `${within}{${restyle(body, drawing)}}`;
  }
  return scoped;
}

/** Declarations (`fill:#000;stroke:none`) pointing at this drawing's own parts, in its colors and the note's fonts. */
function restyle(declarations: string, drawing: Drawing) {
  return declarations
    .split(";")
    .flatMap((declaration) => {
      const colon = declaration.indexOf(":");
      if (colon < 0 || ELSEWHERE.test(declaration)) return [];
      const property = declaration.slice(0, colon).trim().toLowerCase();
      let value = ownLinks(declaration.slice(colon + 1).trim(), drawing);
      value = property === "font-family" ? font(value) : value.replace(COLOR, (color) => paint(color, property));
      return [`${property}:${value}`];
    })
    .join(";");
}

/** `url(#arrowhead)` as this drawing's own. */
const ownLinks = (value: string, drawing: Drawing) => value.replace(/url\(\s*(['"]?)#/gi, `url($1#${drawing.id}-`);

/** The note's fonts, as Pele's diagrams are in: its code font for WaveDrom's monospace, its text's for the rest. */
const font = (family: string) => (/mono/i.test(family) ? "var(--font-mono)" : "var(--font-text)");

/**
 * One of WaveDrom's colors as what it's for: black is text, or lines; white the background; greys
 * between are faint lines, muted text or light boxes. Its blue, for arrows, is the accent; its
 * pale colors are tints of the nearest hue, as boxes are, and its others that hue.
 */
function paint(color: string, property: string) {
  const hex = color.toLowerCase() === "black" ? "#000" : color.toLowerCase() === "white" ? "#fff" : color.toLowerCase();
  if (hex === "#0041c4") return "var(--wd-accent)";
  const full = hex.length <= 5 ? hex.replace(/[\da-f]/g, "$&$&") : hex;
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(full.slice(at, at + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const line = property.startsWith("stroke");
  if (max - min < 0.1) {
    if (lightness < 0.3) return line ? "var(--wd-line)" : "var(--wd-text)";
    if (lightness > 0.95) return "var(--wd-bg)";
    return line ? "var(--wd-faint)" : lightness > 0.85 ? "var(--wd-surface-alt)" : "var(--wd-muted)";
  }
  const sector = max === r ? ((g - b) / (max - min) + 6) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  const angle = sector * 60;
  const [, hue] = HUES.reduce((near, each) => (Math.abs(each[0] - angle) < Math.abs(near[0] - angle) ? each : near));
  return lightness > 0.7 ? `color-mix(in srgb, var(--wd-${hue}) 14%, var(--wd-bg))` : `var(--wd-${hue})`;
}
