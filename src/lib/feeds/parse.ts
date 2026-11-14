import { readDate, readDuration } from "./dates";
import { address } from "./html";
import { plainText, saysMore } from "./markdown";
import { fingerprint } from "./posts";

/*
 * Reading a feed: RSS 2.0, Atom 1.0 and RSS 1.0 (RDF), with the podcast tags that matter (iTunes',
 * Podcasting 2.0's season and episode, Media RSS's pictures), and JSON Feed. XML is read by the
 * browser; one that isn't quite XML (a bare &, an HTML entity, a stray character, a prefix never
 * declared) is mended and read again, and one still broken is read as far as it goes.
 */

/** What a feed is written in: RSS 2.0, Atom, RSS 1.0 (RDF), or JSON Feed. */
export type FeedFormat = "rss" | "atom" | "rdf" | "json";

/** A feed as it was read. */
export interface Feed {
  title: string;
  /** What it's written in; not known of one only listed somewhere (an OPML file). */
  format?: FeedFormat;
  /** The site it's from. */
  link?: string;
  description?: string;
  author?: string;
  /** Its picture: a podcast's artwork, a site's logo. */
  image?: string;
  /** Its posts, as the feed lists them. */
  posts: Post[];
}

/** Whether it's a podcast's: its posts have sound. */
export const isPodcast = (feed: { posts: readonly Pick<Post, "audio">[] }) => feed.posts.some((post) => post.audio);

export interface Post {
  /** What tells it from the feed's other posts: its guid or id, else its link, else its title and date. */
  id: string;
  title: string;
  link?: string;
  /** Where it's talked about: its comments' page (Hacker News'), if the feed says. */
  comments?: string;
  author?: string;
  /** When it was published (or last updated, if that's all it says), in milliseconds. */
  date?: number;
  /** Its date is a guess, from "3 days ago" (a YouTube channel's page): kept as it was once one's known. */
  approximate?: boolean;
  /** Its content, as HTML. */
  html: string;
  /** Where its content's relative links and pictures are from. */
  base: string;
  /** What it says, in a sentence or two of plain text. */
  excerpt: string;
  image?: string;
  /** An episode's sound, or any file it comes with that plays. */
  audio?: { url: string; type?: string };
  /** In seconds. */
  duration?: number;
  season?: number;
  episode?: number;
  /** Podcasting 2.0's transcript of an episode, in the format with most in it that lines reads, and its chapters. */
  transcript?: Named;
  chapters?: Named;
}

export class NotAFeed extends Error {}

const NS = {
  atom: "http://www.w3.org/2005/Atom",
  itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd",
  content: "http://purl.org/rss/1.0/modules/content/",
  dc: "http://purl.org/dc/elements/1.1/",
  media: "http://search.yahoo.com/mrss/",
  podcast: "https://podcastindex.org/namespace/1.0",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rss1: "http://purl.org/rss/1.0/",
  googleplay: "http://www.google.com/schemas/play-podcasts/1.0",
};

/** How long an excerpt runs, in characters. */
const EXCERPT = 240;
const PLAYABLE = /^(?:audio|video)\//i;
const PLAYABLE_FILE = /\.(?:mp3|m4a|m4b|aac|ogg|oga|opus|wav|flac|mp4|m4v|mov)(?:$|[?#])/i;

const FEED_ROOT = /<(?:[\w-]+:)?(?:rss|feed|RDF)[\s>]/iy;

/**
 * Whether some text is a feed rather than a page: JSON Feed's object, or XML whose first element,
 * past the declaration, comments and a doctype, is RSS's, Atom's or RDF's. Read through once,
 * whatever comes before it.
 */
export function isFeed(text: string): boolean {
  if (JSON_START.test(text)) return jsonFeed(text) !== null;
  let at = text.startsWith("\uFEFF") ? 1 : 0;
  for (;;) {
    while (at < text.length && /\s/.test(text[at])) at++;
    const end = text.startsWith("<?", at) ? text.indexOf("?>", at) + 2 : text.startsWith("<!--", at) ? text.indexOf("-->", at) + 3 : /^<!doctype/i.test(text.slice(at, at + 9)) ? doctypeEnd(text, at) : -1;
    if (end === -1) break;
    // Never closed: no element follows.
    if (end < at + 2) return false;
    at = end;
  }
  FEED_ROOT.lastIndex = at;
  return FEED_ROOT.test(text);
}

/** Where a doctype starting at `at` ends, past its internal subset (`[…]`) if it has one; -1 if it doesn't. */
function doctypeEnd(text: string, at: number) {
  const close = text.indexOf(">", at);
  const subset = text.indexOf("[", at);
  if (subset !== -1 && (close === -1 || subset < close)) {
    const end = text.indexOf("]", subset);
    return end === -1 ? -1 : text.indexOf(">", end) + 1;
  }
  return close === -1 ? -1 : close + 1;
}

/** Reads a feed fetched from `url`; throws NotAFeed if it isn't one. */
export function readFeed(text: string, url: string): Feed {
  const json = JSON_START.test(text) ? jsonFeed(text) : null;
  if (json) return { ...readJson(json, url), format: "json" };
  const root = parseXml(text).documentElement;
  const kind = root?.localName;
  if (kind === "rss") return { ...readRss(child(root, "channel", null) ?? root, url, null), format: "rss" };
  if (kind === "RDF") return { ...readRdf(root, url), format: "rdf" };
  if (kind === "feed") return { ...readAtom(root, url), format: "atom" };
  throw new NotAFeed(`Not a feed: ${url}`);
}

/* Reading the XML, and mending it where it isn't quite. */

function parseXml(text: string): Document {
  const parser = new DOMParser();
  const clean = text.replace(/^[^<]*/, "");
  const document = parser.parseFromString(clean, "application/xml");
  if (!broken(document)) return document;
  const mended = parser.parseFromString(mend(clean), "application/xml");
  // Still broken: the browser keeps what it read before the mistake, which is often every post but the last.
  for (const error of mended.getElementsByTagNameNS("*", "parsererror")) error.remove();
  return mended;
}

const broken = (document: Document) => document.getElementsByTagNameNS("*", "parsererror").length > 0;

/** XML's own entities, which need no mending. */
const XML_ENTITIES = new Set(["amp", "lt", "gt", "quot", "apos"]);
const decoded = new Map<string, string>();

/** An HTML entity's character, as a numeric one XML reads; a name HTML doesn't know stays text. */
function entity(name: string): string {
  let value = decoded.get(name);
  if (value === undefined) {
    const text = new DOMParser().parseFromString(`&${name};`, "text/html").body.textContent ?? "";
    value = text && text !== `&${name};` ? [...text].map((char) => `&#${char.codePointAt(0)};`).join("") : `&amp;${name};`;
    decoded.set(name, value);
  }
  return value;
}

/**
 * The text in parts, each whether it's a CDATA section or a comment (which are kept as written); one
 * never closed runs to the end. Read through once, each start and end found from where the last was.
 */
function untouched(text: string): [part: string, kept: boolean][] {
  const parts: [string, boolean][] = [];
  // Where each next opens; Infinity once there are no more, so it isn't looked for again.
  const marks = [
    { open: "<![CDATA[", close: "]]>", next: -1 },
    { open: "<!--", close: "-->", next: -1 },
  ];
  let at = 0;
  for (;;) {
    for (const mark of marks) {
      if (mark.next >= at) continue;
      const next = text.indexOf(mark.open, at);
      mark.next = next === -1 ? Infinity : next;
    }
    const found = marks[0].next <= marks[1].next ? marks[0] : marks[1];
    if (found.next === Infinity) break;
    if (found.next > at) parts.push([text.slice(at, found.next), false]);
    const close = text.indexOf(found.close, found.next + found.open.length);
    const end = close === -1 ? text.length : close + found.close.length;
    parts.push([text.slice(found.next, end), true]);
    at = end;
  }
  if (at < text.length) parts.push([text.slice(at), false]);
  return parts;
}

/**
 * The usual mistakes made right, outside CDATA sections and comments: characters XML doesn't
 * allow, a bare `&`, HTML's named entities, and namespace prefixes used but never declared.
 */
export function mend(text: string): string {
  const mendPart = (part: string) =>
    part
      // oxlint-disable-next-line no-control-regex -- control characters are what it takes out
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
      .replace(/&(?!#\d+;|#x[\da-f]+;|[a-z][\w.-]*;)/gi, "&amp;")
      .replace(/&([a-z][\w.-]*);/gi, (whole, name: string) => (XML_ENTITIES.has(name) ? whole : entity(name)));
  const mended = untouched(text)
    .map(([part, kept]) => (kept ? part : mendPart(part)))
    .join("");
  const declared = new Set([...mended.matchAll(/xmlns:([\w.-]+)\s*=/g)].map((match) => match[1]));
  const used = new Set([...mended.matchAll(/<\/?([\w.-]+):[\w.-]+/g)].map((match) => match[1]));
  const missing = [...used].filter((prefix) => !declared.has(prefix) && prefix !== "xml" && prefix !== "xmlns");
  if (!missing.length) return mended;
  const declarations = missing.map((prefix) => ` xmlns:${prefix}="${NS[prefix as keyof typeof NS] ?? `urn:lines:${prefix}`}"`).join("");
  return mended.replace(/<(?![?!])[\w.:-]+/, (start) => start + declarations);
}

/* Finding things in it. */

/** The children of `parent` named `name` in namespace `ns` (null for none). */
function children(parent: Element, name: string, ns: string | null): Element[] {
  return [...parent.children].filter((element) => element.localName === name && (element.namespaceURI ?? null) === ns);
}

const child = (parent: Element, name: string, ns: string | null): Element | undefined => children(parent, name, ns)[0];

/** The trimmed text of the first child named so, if it has any. */
function text(parent: Element, name: string, ns: string | null): string | undefined {
  return child(parent, name, ns)?.textContent?.trim() || undefined;
}

/** A title as plain text: some feeds write theirs as HTML, or with its entities written twice. */
const titleText = (value: string | undefined) => (!value ? "" : /&[#\w]+;|<\/[a-z]/i.test(value) ? plainText(value) : value.replace(/\s+/g, " ").trim());

/** Text's paragraphs and lines as HTML, each line put through `escape`. */
const paragraphs = (value: string, escape: (line: string) => string) =>
  value
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${paragraph.trim().split("\n").map(escape).join("<br>")}</p>`)
    .join("");

/** HTML for content that may be plain text: plain text's paragraphs and lines kept as such. */
function asHtml(value: string): string {
  // A tag: its name, then a space or its end (read without looking further, however long the text).
  if (/<\/?[a-z][\w:-]*(?:\s|\/?>)/i.test(value)) return value;
  return paragraphs(value, (line) => line.replace(/&(?![#\w]+;)/g, "&amp;").replace(/</g, "&lt;"));
}

/** HTML for what's only ever text (JSON Feed's, and Media RSS's descriptions, YouTube's): nothing in it read as a tag or an entity. */
const textHtml = (value: string) => paragraphs(value, (line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;"));

/**
 * A few sentences of a post, as plain text, cut at a word; none for one that says nothing but links
 * to its `own` addresses (itself, its comments), as Hacker News' say only "Comments".
 */
function excerptOf(html: string, base?: string, own: (string | undefined)[] = []): string {
  if (base && !saysMore(html, base, own)) return "";
  const text = plainText(html);
  if (text.length <= EXCERPT) return text;
  const cut = text.slice(0, EXCERPT);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), EXCERPT - 40)).trimEnd()}…`;
}

/** An author as RSS writes one: `jo@example.com (Jo Bloggs)` is Jo Bloggs. */
function authorName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const named = /^\S+@\S+\s*\((.+)\)$/.exec(value);
  if (named) return named[1].trim();
  return /^\S+@\S+$/.test(value) ? undefined : value;
}

const number = (value: string | undefined) => (value && /^\d+$/.test(value) ? Number(value) : undefined);

/** A file a feed names for an episode: its transcript (`podcast:transcript`), its chapters (`podcast:chapters`). */
export interface Named {
  url: string;
  type?: string;
}

/** Transcripts' formats lines reads, the one with most in it first: times and who's speaking, then times alone. */
const TRANSCRIPTS = ["json", "vtt", "srt", "subrip", "html"];

/** Where a transcript's format is among TRANSCRIPTS, by its type or else its name; past them all, one lines doesn't read. */
function rank({ url, type = "" }: Named) {
  const at = TRANSCRIPTS.findIndex((format) => type.toLowerCase().includes(format) || new URL(url).pathname.toLowerCase().endsWith(`.${format}`));
  return at === -1 ? TRANSCRIPTS.length : at;
}

/** Files named by Podcasting 2.0's tags (`<podcast:transcript url="…" type="text/vtt"/>`), those on the web. */
function named(elements: Element[], base: string): Named[] {
  return elements.flatMap((element) => {
    const url = address(element.getAttribute("url"), base);
    return url ? [{ url, type: element.getAttribute("type") ?? undefined }] : [];
  });
}

/** The transcript lines reads best of those an episode names: one with times, in the format with most in it. */
function bestTranscript(files: Named[]): Named | undefined {
  return files.filter((file) => rank(file) < TRANSCRIPTS.length).sort((a, b) => rank(a) - rank(b))[0];
}

/** What a post or a channel says of itself in iTunes' and Podcasting 2.0's tags, and Media RSS's. */
function podcastTags(element: Element, base: string) {
  // Media RSS's, as they come or in a group of them (YouTube's).
  const holders = [element, ...children(element, "group", NS.media)];
  const media = holders.flatMap((holder) => children(holder, "content", NS.media));
  const thumbnail = holders.map((holder) => child(holder, "thumbnail", NS.media)).find(Boolean) ?? media.flatMap((content) => children(content, "thumbnail", NS.media))[0];
  const picture = media.find((content) => content.getAttribute("medium") === "image" || (content.getAttribute("type") ?? "").startsWith("image/"));
  const playable = media.find((content) => ["audio", "video"].includes(content.getAttribute("medium") ?? "") || PLAYABLE.test(content.getAttribute("type") ?? ""));
  return {
    image: address(child(element, "image", NS.itunes)?.getAttribute("href") ?? child(element, "image", NS.googleplay)?.getAttribute("href") ?? thumbnail?.getAttribute("url") ?? picture?.getAttribute("url"), base),
    author: text(element, "author", NS.itunes) ?? text(element, "creator", NS.dc),
    summary: text(element, "summary", NS.itunes) ?? holders.map((holder) => text(holder, "description", NS.media)).find(Boolean),
    duration: readDuration(text(element, "duration", NS.itunes)) ?? readDuration(playable?.getAttribute("duration")),
    season: number(text(element, "season", NS.itunes) ?? text(element, "season", NS.podcast)),
    episode: number(text(element, "episode", NS.itunes) ?? text(element, "episode", NS.podcast)),
    playable: playable && { url: playable.getAttribute("url"), type: playable.getAttribute("type") },
    transcript: bestTranscript(named(children(element, "transcript", NS.podcast), base)),
    chapters: named(children(element, "chapters", NS.podcast), base)[0],
  };
}

/** A post's sound (or video): an enclosure that plays, else a Media RSS one. */
function audioOf(enclosures: { url: string | null; type: string | null }[], base: string) {
  for (const { url, type } of enclosures) {
    const href = address(url, base);
    if (href && (PLAYABLE.test(type ?? "") || (!type && PLAYABLE_FILE.test(href)))) return { url: href, ...(type ? { type } : {}) };
  }
  return undefined;
}

/** Posts in the feed's order, each with an id of its own (a feed with two alike keeps the first). */
function distinct(posts: Post[]): Post[] {
  const seen = new Set<string>();
  return posts.filter((post) => !seen.has(post.id) && seen.add(post.id));
}

/* RSS 2.0 (and 0.9x). */

function readRss(channel: Element, url: string, ns: string | null): Feed {
  const link = address(text(channel, "link", ns), url);
  const tags = podcastTags(channel, url);
  const posts = children(channel, "item", ns).map((item) => readItem(item, link ?? url, ns));
  return {
    title: titleText(text(channel, "title", ns)) || new URL(url).hostname,
    link,
    description: plainText(text(channel, "description", ns) ?? tags.summary ?? "") || undefined,
    author: authorName(tags.author ?? text(channel, "managingEditor", ns)),
    image: tags.image ?? address(child(channel, "image", ns) && text(child(channel, "image", ns)!, "url", ns), url),
    posts: distinct(posts),
  };
}

function readItem(item: Element, base: string, ns: string | null): Post {
  const tags = podcastTags(item, base);
  const guid = child(item, "guid", ns);
  const guidText = guid?.textContent?.trim();
  const link = address(text(item, "link", ns), base) ?? (guid?.getAttribute("isPermaLink") !== "false" ? address(guidText, base) : undefined);
  const title = titleText(text(item, "title", ns) ?? text(item, "title", NS.dc));
  const date = readDate(text(item, "pubDate", ns) ?? text(item, "date", NS.dc));
  const description = text(item, "description", ns);
  const html = asHtml(text(item, "encoded", NS.content) ?? description ?? tags.summary ?? "");
  const enclosures = children(item, "enclosure", ns).map((enclosure) => ({ url: enclosure.getAttribute("url"), type: enclosure.getAttribute("type") }));
  const comments = address(text(item, "comments", ns), base);
  return {
    id: guidText || link || `${title}\n${date ?? ""}\n${fingerprint(html)}`,
    title: title || excerptOf(html).slice(0, 80),
    link,
    comments,
    author: authorName(text(item, "author", ns) ?? tags.author),
    date,
    html,
    // A post's relative links are from its own page, if it has one.
    base: link ?? base,
    excerpt: excerptOf(description ? asHtml(description) : html, link ?? base, [link, comments]),
    image: tags.image ?? address(enclosures.find(({ type }) => type?.startsWith("image/"))?.url, base),
    audio: audioOf(tags.playable ? [...enclosures, tags.playable] : enclosures, base),
    duration: tags.duration,
    season: tags.season,
    episode: tags.episode,
    transcript: tags.transcript,
    chapters: tags.chapters,
  };
}

/* RSS 1.0, as RDF: its channel, and its items beside it rather than in it. */

function readRdf(root: Element, url: string): Feed {
  const ns = child(root, "channel", NS.rss1) ? NS.rss1 : null;
  const channel = child(root, "channel", ns) ?? root;
  const feed = readRss(channel, url, ns);
  const base = feed.link ?? url;
  const posts = children(root, "item", ns).map((item) => {
    const post = readItem(item, base, ns);
    const about = item.getAttributeNS(NS.rdf, "about");
    return about && !child(item, "guid", ns) ? { ...post, id: about } : post;
  });
  return { ...feed, image: feed.image ?? address(child(root, "image", ns) && text(child(root, "image", ns)!, "url", ns), url), posts: distinct(posts) };
}

/* Atom 1.0 (and 0.3, in its own namespace). */

/** An Atom text (a title, a summary, content) as HTML: it may be text, HTML, or XHTML written in place. */
function atomHtml(element: Element | undefined): string {
  if (!element) return "";
  const type = element.getAttribute("type") ?? "text";
  if (type === "xhtml" || type === "application/xhtml+xml") {
    const div = [...element.children].find((each) => each.localName === "div") ?? element;
    return [...div.childNodes].map((node) => new XMLSerializer().serializeToString(node)).join("");
  }
  const value = element.textContent?.trim() ?? "";
  return type === "html" || type === "text/html" ? value : asHtml(value);
}

/** The `href` of the first link with this `rel` (Atom's links without one are `alternate`). */
function atomLink(parent: Element, ns: string | null, rel: string, base: string) {
  // A page, not a feed: an entry's replies may be a feed of its comments as well as their page.
  const page = rel === "alternate" || rel === "replies";
  const link = children(parent, "link", ns).find((each) => (each.getAttribute("rel") ?? "alternate") === rel && !(page && /xml/.test(each.getAttribute("type") ?? "")));
  return address(link?.getAttribute("href"), base);
}

/** Where an Atom element's relative URLs are from: its `xml:base`, else its parent's. */
const baseOf = (element: Element, base: string) => address(element.getAttributeNS("http://www.w3.org/XML/1998/namespace", "base"), base) ?? base;

function readAtom(root: Element, url: string): Feed {
  const ns = root.namespaceURI;
  const base = baseOf(root, url);
  const name = (parent: Element) => {
    const author = child(parent, "author", ns);
    return author ? text(author, "name", ns) : undefined;
  };
  const feedAuthor = name(root);
  const tags = podcastTags(root, base);
  const posts = children(root, "entry", ns).map((entry): Post => {
    const entryBase = baseOf(entry, base);
    const entryTags = podcastTags(entry, entryBase);
    const link = atomLink(entry, ns, "alternate", entryBase);
    const comments = atomLink(entry, ns, "replies", entryBase);
    const title = plainText(atomHtml(child(entry, "title", ns)));
    const date = readDate(text(entry, "published", ns) ?? text(entry, "issued", ns) ?? text(entry, "updated", ns) ?? text(entry, "modified", ns));
    const summary = atomHtml(child(entry, "summary", ns));
    const content = child(entry, "content", ns);
    // Or, where it has neither, what its media say (YouTube's).
    const html = atomHtml(content) || summary || textHtml(entryTags.summary ?? "");
    const enclosures = children(entry, "link", ns)
      .filter((each) => each.getAttribute("rel") === "enclosure")
      .map((each) => ({ url: each.getAttribute("href"), type: each.getAttribute("type") }));
    return {
      id: text(entry, "id", ns) || link || `${title}\n${date ?? ""}\n${fingerprint(html)}`,
      title: title || excerptOf(html).slice(0, 80),
      link,
      comments,
      author: name(entry) ?? entryTags.author ?? feedAuthor,
      date,
      html,
      base: content ? baseOf(content, entryBase) : entryBase,
      excerpt: excerptOf(summary || html, entryBase, [link, comments]),
      image: entryTags.image,
      audio: audioOf(entryTags.playable ? [...enclosures, entryTags.playable] : enclosures, entryBase),
      duration: entryTags.duration,
      season: entryTags.season,
      episode: entryTags.episode,
      transcript: entryTags.transcript,
      chapters: entryTags.chapters,
    };
  });
  return {
    title: plainText(atomHtml(child(root, "title", ns))) || new URL(url).hostname,
    link: atomLink(root, ns, "alternate", base),
    description: plainText(atomHtml(child(root, "subtitle", ns) ?? child(root, "tagline", ns))) || tags.summary,
    author: feedAuthor ?? tags.author,
    image: tags.image ?? address(text(root, "logo", ns) ?? text(root, "icon", ns), base),
    posts: distinct(posts),
  };
}

/* JSON Feed (1.0 and 1.1): an object, whose `version` says it's one. */

type Fields = Record<string, unknown>;

/** Text at the start of a JSON object, past a byte-order mark and spaces. */
const JSON_START = /^\uFEFF?\s*\{/;
const JSON_FEED = /^https?:\/\/jsonfeed\.org\/version\/\d+(?:\.\d+)?\/?$/;

const isFields = (value: unknown): value is Fields => !!value && typeof value === "object" && !Array.isArray(value);
/** A field's text, if it's text with something in it: a feed may give anything anywhere. */
const textOf = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const listOf = (value: unknown) => (Array.isArray(value) ? value.filter(isFields) : []);
/** A title, which JSON Feed writes as plain text: what looks like a tag or an entity in it is what it says. */
const plainTitle = (value: unknown) => textOf(value)?.replace(/\s+/g, " ") ?? "";

/** The feed the text is, if it's JSON Feed's object. */
function jsonFeed(text: string): Fields | null {
  try {
    const value: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
    return isFields(value) && JSON_FEED.test(String(value.version)) ? value : null;
  } catch {
    return null;
  }
}

/** Who wrote it: 1.1's `authors`, or 1.0's `author`. */
function jsonAuthors(fields: Fields): string | undefined {
  const authors = Array.isArray(fields.authors) ? listOf(fields.authors) : isFields(fields.author) ? [fields.author] : [];
  return authors.flatMap((author) => textOf(author.name) ?? []).join(", ") || undefined;
}

function readJson(feed: Fields, url: string): Feed {
  const home = address(textOf(feed.home_page_url), url);
  const feedAuthor = jsonAuthors(feed);
  const posts = listOf(feed.items).map((item): Post => {
    const own = address(textOf(item.url), url);
    // A link post's `external_url` is a page elsewhere: its own relative links are still from its site.
    const link = own ?? address(textOf(item.external_url), url);
    const base = own ?? home ?? url;
    const title = plainTitle(item.title);
    const date = readDate(textOf(item.date_published) ?? textOf(item.date_modified));
    const summary = textOf(item.summary);
    const html = textOf(item.content_html) ?? textHtml(textOf(item.content_text) ?? summary ?? "");
    const attachments = listOf(item.attachments).map((file) => ({ url: textOf(file.url) ?? null, type: textOf(file.mime_type) ?? null, seconds: file.duration_in_seconds }));
    const audio = audioOf(attachments, base);
    const seconds = attachments.find((file) => audio && address(file.url, base) === audio.url)?.seconds;
    const id = typeof item.id === "number" ? String(item.id) : textOf(item.id);
    return {
      id: id || link || `${title}\n${date ?? ""}\n${fingerprint(html)}`,
      title: title || excerptOf(html).slice(0, 80),
      link,
      author: jsonAuthors(item) ?? feedAuthor,
      date,
      html,
      base,
      excerpt: excerptOf(summary ? textHtml(summary) : html, base, [link]),
      image: address(textOf(item.image) ?? textOf(item.banner_image), base),
      audio,
      duration: typeof seconds === "number" && seconds > 0 ? Math.round(seconds) : undefined,
    };
  });
  return {
    title: plainTitle(feed.title) || new URL(url).hostname,
    link: home,
    description: textOf(feed.description)?.replace(/\s+/g, " "),
    author: feedAuthor,
    image: address(textOf(feed.icon) ?? textOf(feed.favicon), url),
    posts: distinct(posts),
  };
}
