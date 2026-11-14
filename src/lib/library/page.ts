/*
 * What a web page says about itself, read from its HTML as text: its JSON-LD (schema.org's
 * descriptions, `<script type="application/ld+json">`), its `<meta>` tags (Open Graph's `og:…`,
 * Twitter's, microdata's `itemprop`) and the links in it (canonical, oEmbed, feeds). Nothing of
 * the page is run or shown, so it's as safe to read as any text.
 */

export interface PageLink {
  rel: string;
  type: string;
  /** Where it points, made whole against the page's address. */
  href: string;
  title: string;
  /** What sizes it comes in, as a site's icons say (`32x32`, `any`). */
  sizes: string;
}

export interface Page {
  /** The page's own address, or its canonical one where it names it. */
  url: string;
  /** Where it was read from, after any redirects: what `url` is, unless the page names another. */
  address: string;
  title: string;
  /** Its JSON-LD's objects, each one found in lists and `@graph`s too, in order. */
  data: Record<string, unknown>[];
  /** Its `<meta>` tags' content, by property, name or itemprop in lowercase: the first of each. */
  meta: Map<string, string>;
  links: PageLink[];
}

/** The characters named in HTML that pages' descriptions use most. */
const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  middot: "·",
  bull: "•",
  copy: "©",
  reg: "®",
  trade: "™",
};

/** HTML's character references written out: `&amp;` as `&`, `&#8217;` as `’`. */
export function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (whole, decimal?: string, hex?: string, name?: string) => {
    if (name) return NAMED[name.toLowerCase()] ?? whole;
    const code = decimal ? Number(decimal) : parseInt(hex!, 16);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

/** A tag's attributes, by name in lowercase, their values decoded. */
function attributes(source: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, name, double, single, bare] of source.matchAll(/([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const key = name.toLowerCase();
    if (!found.has(key)) found.set(key, decodeEntities(double ?? single ?? bare ?? ""));
  }
  return found;
}

/** JSON-LD's objects, out of lists and `@graph`s. */
function flatten(value: unknown, into: Record<string, unknown>[]) {
  if (Array.isArray(value)) for (const each of value) flatten(each, into);
  else if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (object["@type"]) into.push(object);
    if (object["@graph"]) flatten(object["@graph"], into);
  }
}

/** The JSON in a script, inside the comments some pages wrap it in (`/* <![CDATA[ *\/`, `<!--`). */
function json(script: string): unknown {
  const bare = script
    .replace(/^(?:\s*(?:\/\*[\s\S]*?\*\/|<!--|\/\/[^\n]*\n))*/, "")
    .replace(/(?:\s*(?:\/\*[\s\S]*?\*\/|-->|;))*\s*$/, "");
  try {
    return JSON.parse(bare);
  } catch {
    return null;
  }
}

/** An address made whole against `base`, if it's a web address. */
export function absolute(href: string, base: string): string | null {
  try {
    const url = new URL(href.trim(), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** What the page at `url` says about itself, from its HTML. */
export function readPage(html: string, url: string): Page {
  const meta = new Map<string, string>();
  const links: PageLink[] = [];
  const data: Record<string, unknown>[] = [];
  for (const [, tag, source] of html.matchAll(/<(meta|link)\b([^>]*)>/gi)) {
    const attrs = attributes(source);
    if (tag.toLowerCase() === "meta") {
      const key = (attrs.get("property") ?? attrs.get("name") ?? attrs.get("itemprop"))?.toLowerCase();
      const content = attrs.get("content");
      if (key && content !== undefined && !meta.has(key)) meta.set(key, content.trim());
    } else {
      const href = attrs.get("href") && absolute(attrs.get("href")!, url);
      if (href) links.push({ rel: (attrs.get("rel") ?? "").toLowerCase(), type: (attrs.get("type") ?? "").toLowerCase(), href, title: attrs.get("title") ?? "", sizes: (attrs.get("sizes") ?? "").toLowerCase() });
    }
  }
  for (const [, source, script] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/application\/ld\+json/i.test(attributes(source).get("type") ?? "")) flatten(json(script), data);
  }
  const canonical = links.find((link) => link.rel.split(/\s+/).includes("canonical"))?.href;
  const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").replace(/\s+/g, " ").trim();
  return { url: canonical ?? url, address: url, title, data, meta, links };
}

/** A JSON-LD object's types, by their names (`Movie`, of `https://schema.org/Movie` too). */
export function typesOf(object: Record<string, unknown>): string[] {
  const type = object["@type"];
  return (Array.isArray(type) ? type : [type]).filter((each): each is string => typeof each === "string").map((each) => each.replace(/^.*[/#]/, ""));
}

/** The text a JSON-LD value says: a string, or a thing's name; the first of a list. */
export function textOf(value: unknown): string | undefined {
  if (Array.isArray(value)) return textOf(value[0]);
  if (typeof value === "string") return decodeEntities(value).trim() || undefined;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") return textOf((value as Record<string, unknown>).name);
  return undefined;
}

/** Every name a JSON-LD value lists (people, say), leaving out those that are only a link. */
export function namesOf(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return list.map(textOf).filter((name): name is string => !!name && !/^https?:\/\//.test(name));
}

/** A picture's address in a JSON-LD value: a string, an ImageObject's `url`, or the first of a list. */
export function imageOf(value: unknown): string | undefined {
  if (Array.isArray(value)) return imageOf(value[0]);
  if (typeof value === "string") return value.trim() || undefined;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return imageOf(object.url ?? object.contentUrl);
  }
  return undefined;
}
