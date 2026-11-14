/*
 * HTML from the web (a feed's posts, a site's comments), read safely: into a document of its own,
 * DOMParser's, where nothing in it runs or loads, and its addresses kept only where they lead
 * somewhere allowed. What's made of it (markdown.ts, text.ts) is only ever text.
 */

/** Addresses on the web: no `file:`, `javascript:` or `data:`. */
export const WEB = /^https?:/i;

/** Elements left out with everything in them: what runs or styles a page, asks for input, or is drawn rather than written. */
export const SKIPPED = new Set(["script", "style", "noscript", "template", "head", "title", "meta", "link", "svg", "math", "form", "button", "input", "select", "textarea", "object", "embed", "canvas", "map"]);
/** Blocks whose inline content is a paragraph of its own. */
export const BLOCKS = new Set(["p", "div", "section", "article", "header", "footer", "main", "aside", "nav", "figure", "address", "details", "summary", "center", "hgroup", "body"]);
/** Every element that makes a block: those above, headings, lists, quotes, code, rules, tables, and what's embedded. */
export const BLOCK_ELEMENTS = new Set([...BLOCKS, "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "hr", "table", "figcaption", "dl", "iframe", "video", "audio"]);

/** Some HTML, read where nothing in it runs or loads: its body. */
export const parseHtml = (html: string) => new DOMParser().parseFromString(html, "text/html").body;

/** An address as a page wrote it, made whole against `base`, if it's one `allowed` keeps (the web's, unless said). */
export function address(value: string | null | undefined, base?: string, allowed = WEB): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim(), base).href;
    return allowed.test(url) ? url : undefined;
  } catch {
    return undefined;
  }
}
