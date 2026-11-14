import { pathFrom } from "./epub";

/*
 * A chapter made safe to show. An EPUB is a little website, and can carry scripts, forms, frames,
 * plugins and links to anything; a book should only ever be read. So before it's shown:
 *
 * - What could run, load a page or take input goes: scripts, frames, objects, forms, image maps,
 *   SVG's animations (which can change a link), `on…` attributes. Each is swapped for an empty,
 *   hidden <span>, so the elements around it keep their places, as CFIs count them (cfi.ts).
 * - Nothing is a link the frame could follow: every link's address (`href`, in any namespace) is
 *   kept as `data-href`, for lines to follow (read.ts), and other addresses go but those to the
 *   book's own files.
 * - Its pictures, stylesheets and fonts are the book's own files, as blob: URLs (read.ts makes them,
 *   of harmless types only); anything elsewhere (a picture on the web, a font from a server) isn't
 *   fetched. Stylesheets, and `style` attributes, are read by the browser's CSS parser in a
 *   document of no window, so what's rewritten is what the browser would load, however it's
 *   escaped, and become <style>, with what they import put in.
 *
 * It's then shown in a frame under a policy that runs no script and loads nothing but those
 * blob: URLs and lines' fonts (read.ts): each would keep a book safe without the other.
 */

const XHTML = "http://www.w3.org/1999/xhtml";

/** Elements that run something, load a page, take input or change a link as they animate: none belongs in a book read here. */
const UNSAFE = new Set([
  "script",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "base",
  "portal",
  "noscript",
  "link",
  "meta",
  "area",
  "set",
  "animate",
  "animatemotion",
  "animatetransform",
  "animatecolor",
  "discard",
  "handler",
  "listener",
]);
/** Attributes that load or go somewhere, by their local name, other than `href` and `src`: none is kept. */
const ADDRESSES = new Set(["action", "formaction", "data", "srcset", "background", "ping", "longdesc", "lowsrc", "dynsrc", "usemap", "poster", "codebase", "archive", "manifest"]);
/** Elements whose `src` or `href` the page loads (a picture, a sound): the book's own file, or nothing. */
const LOADS = new Set(["img", "image", "video", "audio", "source", "track", "feimage"]);

export interface BookFiles {
  /** A blob: URL for one of the book's files, by its path; null for one it doesn't have. */
  url(path: string): Promise<string | null>;
  text(path: string): Promise<string | null>;
}

/** An address as a browser reads it: without the control characters and spaces it skips (`java&#9;script:`). */
// oxlint-disable-next-line no-control-regex -- control characters are what it takes out
const plain = (href: string) => href.replace(/[\u0000- \u007f-\u009f]/g, "");

/** Whether an address leads out of the book: it has a scheme of its own (`https:`, `javascript:`, `data:`). */
export const isOutside = (href: string) => /^[a-z][a-z0-9+.-]*:/i.test(plain(href));

/** A picture written into the book itself, of a kind that can't run anything. */
const isRasterData = (href: string) => /^data:image\/(?:png|jpeg|gif|webp|avif|bmp);/i.test(plain(href));

/** The book's own file at `href`, from the file at `from`, as a blob: URL; null for anything else. */
async function bookFile(href: string, from: string, files: BookFiles) {
  if (isRasterData(href)) return plain(href);
  if (isOutside(href) || !plain(href) || plain(href).startsWith("#")) return null;
  return files.url(pathFrom(from, href));
}

let scratch: Document | undefined;
/** A document of no window, for the browser to read CSS in: nothing in it is fetched or run. */
const inert = () => (scratch ??= document.implementation.createHTMLDocument(""));

/** CSS values that name a picture some other way than `url()`, which aren't followed. */
const OTHER_IMAGES = /(?:^|[^-\w])(?:-webkit-)?(?:image-set|image|element|cross-fade)\(/i;
/** A `url()` as the browser writes one back: quoted, or bare. */
const URL_VALUE = /url\((?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^)]*))\)/gi;

/** A declaration block's addresses as the book's files, or gone: in place. */
async function cleanDeclarations(style: CSSStyleDeclaration, from: string, files: BookFiles) {
  for (const name of Array.from(style)) {
    const value = style.getPropertyValue(name);
    if (!/url\(|image|element\(|cross-fade\(/i.test(value)) continue;
    if (OTHER_IMAGES.test(value)) {
      style.removeProperty(name);
      continue;
    }
    const priority = style.getPropertyPriority(name);
    const found = await Promise.all(Array.from(value.matchAll(URL_VALUE), (match) => bookFile((match[1] ?? match[2] ?? match[3]).replace(/\\(.)/g, "$1").trim(), from, files)));
    let at = 0;
    const cleaned = value.replace(URL_VALUE, () => {
      const url = found[at++];
      return url ? `url("${url}")` : "none";
    });
    if (found.some((url) => !url) && name === "src") style.removeProperty(name);
    else style.setProperty(name, cleaned, priority);
  }
}

/** A stylesheet, read by the browser, its addresses the book's files and its `@import`s put in (as deep as three), from the file at `from`. */
export async function cleanCss(css: string, from: string, files: BookFiles, depth = 0): Promise<string> {
  const style = inert().createElement("style");
  style.textContent = css;
  inert().head.append(style);
  const rules = Array.from(style.sheet?.cssRules ?? []);
  style.remove();
  const out: string[] = [];
  const clean = async (rule: CSSRule) => {
    if ("style" in rule) await cleanDeclarations((rule as CSSStyleRule).style, from, files);
    if ("cssRules" in rule) for (const inner of Array.from((rule as CSSGroupingRule).cssRules)) await clean(inner);
  };
  for (const rule of rules) {
    if (rule instanceof CSSImportRule) {
      const path = depth < 3 && !isOutside(rule.href) ? pathFrom(from, rule.href) : null;
      const text = path && (await files.text(path));
      const media = rule.media.mediaText;
      if (path && text) out.push(media ? `@media ${media} {\n${await cleanCss(text, path, files, depth + 1)}\n}` : await cleanCss(text, path, files, depth + 1));
      continue;
    }
    await clean(rule);
    out.push(rule.cssText);
  }
  return out.join("\n");
}

/** A `style` attribute's declarations, read by the browser, its addresses the book's files. */
async function cleanStyleAttribute(value: string, from: string, files: BookFiles) {
  const element = inert().createElement("span");
  element.setAttribute("style", value);
  await cleanDeclarations(element.style, from, files);
  return element.style.cssText;
}

/** Makes the chapter (or SVG picture) at `path` safe to show, as above: in place. */
export async function cleanChapter(doc: Document, path: string, files: BookFiles): Promise<void> {
  const placeholder = () => {
    const span = doc.createElementNS(XHTML, "span");
    span.setAttribute("hidden", "");
    return span;
  };
  await Promise.all(
    Array.from(doc.getElementsByTagNameNS("*", "*"), async (element) => {
      const name = element.localName.toLowerCase();
      // A stylesheet the book links to, as a <style> with its text.
      if (name === "link" && /\bstylesheet\b/i.test(element.getAttribute("rel") ?? "")) {
        const href = element.getAttribute("href");
        const sheet = href && !isOutside(href) ? pathFrom(path, href) : null;
        const css = sheet ? await files.text(sheet) : null;
        const style = doc.createElementNS(XHTML, "style");
        style.textContent = css && sheet ? await cleanCss(css, sheet, files) : "";
        element.replaceWith(style);
        return;
      }
      if (UNSAFE.has(name)) {
        element.replaceWith(placeholder());
        return;
      }
      if (name === "style") element.textContent = await cleanCss(element.textContent ?? "", path, files);
      for (const attribute of Array.from(element.attributes)) {
        const key = attribute.localName.toLowerCase();
        const value = attribute.value;
        if (key.startsWith("on") || ADDRESSES.has(key) || key === "target" || key === "download" || (key === "base" && attribute.prefix === "xml")) {
          element.removeAttributeNode(attribute);
        } else if (key === "style") {
          attribute.value = await cleanStyleAttribute(value, path, files);
        } else if (key === "href" && name === "a") {
          // A link: lines follows it, the frame never can.
          element.removeAttributeNode(attribute);
          element.setAttribute("data-href", plain(value));
          element.setAttribute("role", "link");
          element.setAttribute("tabindex", "0");
        } else if (key === "src" || key === "href") {
          // What a picture or sound loads is the book's own file; within the page (SVG's `<use href="#…">`), it stays.
          const url = LOADS.has(name) ? await bookFile(value, path, files) : plain(value).startsWith("#") ? plain(value) : null;
          if (url) attribute.value = url;
          else element.removeAttributeNode(attribute);
        }
      }
    }),
  );
}
