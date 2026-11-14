import { namesOf, type Page, textOf, typesOf } from "../../lib/library/page";

/*
 * Telling a comic from a book by what its page says (read.ts asks): manga, manhwa, manhua, webtoons,
 * comics and graphic novels, which pages mostly call books. A page that says it's a comic (schema.org's
 * ComicSeries, an Open Graph type of a webcomic) is one, and so is a series on a site of comics.
 * Otherwise two of these must agree, as a book about comics, or a novel a site files under /comic/,
 * has only one: what the work's own description calls it (its genre, keywords, additionalType),
 * what the page labels it (a "Type" of "Manhwa"), and where it is (a /manhwa/ in its address). One
 * the page labels a novel isn't a comic.
 */

/** The forms comics come in, as written in a note, by the words pages use for them: the most particular first. */
const FORMATS: [format: string, words: RegExp][] = [
  ["manga", /\bmanga\b/],
  ["manhwa", /\bmanhwa\b/],
  ["manhua", /\bmanhua\b/],
  ["webtoon", /\bweb ?(?:toon|comic)s?\b/],
  ["graphic novel", /\bgraphic novels?\b/],
  ["comic", /\b(?:comics?|cómics?|bandes? dessinées?)\b/],
];

/** A part of an address that files what's under it as comics, and as which. */
const FOLDERS: Record<string, string> = { comic: "comic", comics: "comic", manga: "manga", manhwa: "manhwa", manhua: "manhua", webtoon: "webtoon", webtoons: "webtoon" };

/** Series' pages on sites of nothing but comics (and novels, which they label so), with the form a site's are in where it's one. */
const SITES: [host: RegExp, path: RegExp, format?: string][] = [
  [/(?:^|\.)webtoons\.com$/, /^\/[^/]+\/[^/]+\/[^/]+\/list$/, "webtoon"],
  [/(?:^|\.)tapas\.io$/, /^\/series\//, "webtoon"],
  [/(?:^|\.)mangadex\.org$/, /^\/title\//],
  [/(?:^|\.)mangaupdates\.com$/, /^\/series\//],
  [/(?:^|\.)myanimelist\.net$/, /^\/manga\//],
  [/(?:^|\.)anilist\.co$/, /^\/manga\//],
];

/** What schema.org calls the works a comic can be described as, and those it calls comics. */
const WORKS = new Set(["Book", "BookSeries", "CreativeWork", "CreativeWorkSeries", "ComicSeries", "ComicIssue", "ComicStory"]);
const COMICS = new Set(["ComicSeries", "ComicIssue", "ComicStory"]);

/** Words as they read, whatever joins them (`webcomic_series`, `Comics & Graphic Novels`). */
const words = (text: string) => text.toLowerCase().replace(/[_:/-]+/g, " ");

/** The form of comic `text` names, if it names one. */
const formatIn = (text: string | undefined) => (text ? FORMATS.find(([, said]) => said.test(words(text)))?.[0] : undefined);

/** Whether `text` names a novel (a light novel, a web novel), not a graphic one. */
const isNovel = (text: string | undefined) => !!text && /\bnovels?\b/.test(words(text).replace(/\bgraphic novels?\b/g, ""));

/** What the page labels it as: the label after its "Type" (or "Format"), where that's a comic's form or a novel. */
function labelled(labels: string[]): string | undefined {
  for (let i = 0; i < labels.length - 1; i++) {
    const next = labels[i + 1];
    if ((labels[i] === "type" || labels[i] === "format") && (formatIn(next) || isNovel(next))) return next;
  }
  return undefined;
}

/** A comic a page is about: the work it describes (its JSON-LD, if it has one), and its form where the page says. */
export interface Comic {
  object: Record<string, unknown>;
  format: string;
}

/** The comic the page is about, if it's one: read.ts asks only of a page about a book, or about nothing it says. */
export function comicOf(page: Page): Comic | null {
  const object = page.data.find((each) => typesOf(each).some((type) => WORKS.has(type))) ?? {};
  const url = new URL(page.url);
  // An Open Graph type of its own (a webtoon's, `com-linewebtoon:webtoon`), by what's after its site's name.
  const graph = page.meta.get("og:type")?.split(":").at(-1);
  const label = labelled(page.labels);
  if (isNovel(label) || isNovel(graph)) return null;

  const said = formatIn([...namesOf(object.genre), ...namesOf(object.keywords), textOf(object.additionalType)].join(", "));
  const shown = formatIn(label);
  const filed = url.pathname
    .toLowerCase()
    .split("/")
    .map((part) => FOLDERS[part])
    .find(Boolean);
  const site = SITES.find(([host, path]) => host.test(url.hostname) && path.test(url.pathname));
  const typed = formatIn(graph);
  const declared = typesOf(object).some((type) => COMICS.has(type));
  if (!declared && !typed && !site && [said, shown, filed].filter(Boolean).length < 2) return null;
  return { object, format: shown ?? said ?? typed ?? site?.[2] ?? filed ?? "comic" };
}

/** A comic's title, without what some pages add to theirs for search engines: "Read … | Tapas Web Community". */
export function comicTitle(title: string, url: string): string {
  const site = new URL(url).hostname.split(".").at(-2) ?? "";
  const [name, ...after] = title.split(/\s+[|–—]\s+/);
  return after.length && after.join(" ").toLowerCase().includes(site) ? name.replace(/^Read\s+/i, "") : title;
}
