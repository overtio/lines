import { language, t } from "../../lib/i18n/index.svelte";
import { known, names, runtime, yearOf } from "../../lib/library/text";
import { getJson } from "../../lib/library/web";
import type { LibraryItem, LibrarySource, Plugin } from "../../lib/plugins/types";

/*
 * Wikidata (wikidata.org), the open database behind Wikipedia: films, series and books, found by a
 * link to IMDb, The Movie Database, Letterboxd, Wikipedia or Wikidata itself, and what they're
 * about from their Wikipedia page, in lines' language where there's one. Only the id in the link
 * (or the page's title) is sent. Wikidata and Wikipedia answer web pages too.
 */

const API = "https://www.wikidata.org/w/api.php";

/** The kinds of item each kind is, by their ids (`instance of`, P31): a film, a series, a book. */
const KINDS: Record<string, string[]> = {
  movie: ["Q11424", "Q24869", "Q202866", "Q93204", "Q506240", "Q24862", "Q229390", "Q20650540", "Q17517379", "Q1054574"],
  show: ["Q5398426", "Q63952888", "Q117467246", "Q581714", "Q1259759", "Q526877", "Q15416", "Q113687694"],
  book: ["Q7725634", "Q571", "Q8261", "Q47461344", "Q1667921", "Q49084", "Q12106333"],
};

/** What a link says the item is: its Wikidata id, a Wikipedia page, or another site's id for it and the property that holds it. */
type Found = { item: string } | { wiki: string; title: string } | { property: string; id: string };

/** The item a link is to, if it's one Wikidata can find. */
export function itemIn(url: URL): Found | null {
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  if (/^(?:www\.|m\.)?wikidata\.org$/.test(host)) {
    const item = /^\/wiki\/(Q\d+)$/.exec(path)?.[1];
    return item ? { item } : null;
  }
  const wiki = /^([a-z-]{2,12})(?:\.m)?\.wikipedia\.org$/.exec(host)?.[1];
  if (wiki) {
    const title = /^\/wiki\/([^/]+)$/.exec(path)?.[1];
    return title && !/^[^:]+:[^_]/.test(decodeURIComponent(title)) ? { wiki, title: decodeURIComponent(title) } : null;
  }
  const imdb = /(?:^|\.)imdb\.com$/.test(host) && /^\/title\/(tt\d+)/.exec(path)?.[1];
  if (imdb) return { property: "P345", id: imdb };
  const tmdb = /(?:^|\.)themoviedb\.org$/.test(host) && /^\/(movie|tv)\/(\d+)/.exec(path);
  if (tmdb) return { property: tmdb[1] === "movie" ? "P4947" : "P4983", id: tmdb[2] };
  const letterboxd = /(?:^|\.)letterboxd\.com$/.test(host) && /^\/film\/([^/]+)/.exec(path)?.[1];
  if (letterboxd) return { property: "P6127", id: letterboxd };
  return null;
}

interface Snak {
  rank?: string;
  mainsnak: { datavalue?: { value: unknown } };
}

interface Entity {
  labels?: Record<string, { value: string }>;
  claims?: Record<string, Snak[]>;
  sitelinks?: Record<string, { title: string }>;
}

interface Summary {
  wikibase_item?: string;
  extract?: string;
  originalimage?: { source: string };
}

const url = (params: Record<string, string>) => `${API}?${new URLSearchParams({ ...params, format: "json", origin: "*" })}`;

/** The values of an item's property, as Wikidata keeps them, without those marked wrong. */
const values = (entity: Entity, property: string) =>
  (entity.claims?.[property] ?? []).filter((claim) => claim.rank !== "deprecated").flatMap((claim) => (claim.mainsnak.datavalue ? [claim.mainsnak.datavalue.value] : []));

const itemIds = (entity: Entity, property: string) => values(entity, property).flatMap((value) => ((value as { id?: string }).id ? [(value as { id: string }).id] : []));
const amount = (entity: Entity, property: string) => Number((values(entity, property)[0] as { amount?: string } | undefined)?.amount) || undefined;
/** The earliest year among a property's dates (a film's first showing, not its later releases). */
const firstYear = (entity: Entity, property: string) =>
  values(entity, property)
    .map((value) => yearOf((value as { time?: string }).time))
    .filter(Boolean)
    .sort()[0];

/** A Wikipedia page's summary: what it's about, the picture at its top, and its item. */
const summaryOf = (wiki: string, title: string, signal: AbortSignal) =>
  getJson<Summary>(`https://${wiki}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, signal);

async function itemId(found: Found, signal: AbortSignal): Promise<string | undefined> {
  if ("item" in found) return found.item;
  if ("wiki" in found) return undefined;
  const search = await getJson<{ query?: { search?: { title: string }[] } }>(
    url({ action: "query", list: "search", srsearch: `haswbstatement:${found.property}=${found.id}`, srlimit: "1" }),
    signal,
  );
  return search?.query?.search?.[0]?.title;
}

async function lookup(link: URL, signal: AbortSignal): Promise<LibraryItem | null> {
  const found = itemIn(link);
  if (!found) return null;
  const wiki = "wiki" in found ? found.wiki : language;
  let summary = "wiki" in found ? await summaryOf(found.wiki, found.title, signal) : null;
  const id = (await itemId(found, signal)) ?? summary?.wikibase_item;
  if (!id) return null;
  const languages = [...new Set([wiki, "en"])].join("|");
  const entities = await getJson<{ entities?: Record<string, Entity> }>(
    url({ action: "wbgetentities", ids: id, props: "claims|labels|sitelinks", languages, languagefallback: "1", sitefilter: `${wiki}wiki|enwiki` }),
    signal,
  );
  const entity = entities?.entities?.[id];
  if (!entity) return null;
  const kinds = new Set(itemIds(entity, "P31"));
  const type = Object.keys(KINDS).find((kind) => KINDS[kind].some((each) => kinds.has(each)));
  if (!type) return null;
  const title = entity.labels?.[wiki]?.value ?? entity.labels?.en?.value;
  if (!title) return null;

  // The people, genres and publishers it names, by their names in one go.
  const named = { director: "P57", creator: "P170", author: "P50", genre: "P136", publisher: "P123" };
  const referred = [...new Set(Object.values(named).flatMap((property) => itemIds(entity, property).slice(0, 4)))].slice(0, 50);
  const labelled = referred.length
    ? await getJson<{ entities?: Record<string, Entity> }>(url({ action: "wbgetentities", ids: referred.join("|"), props: "labels", languages, languagefallback: "1" }), signal)
    : null;
  const label = (each: string) => labelled?.entities?.[each]?.labels?.[wiki]?.value ?? labelled?.entities?.[each]?.labels?.en?.value;
  const labels = (property: keyof typeof named, count = 3) => names(itemIds(entity, named[property]).slice(0, count).map(label));
  const genre = names(
    itemIds(entity, named.genre)
      .slice(0, 3)
      .map((each) => {
        const name = label(each);
        // English names a film's genre "science fiction film": the genre alone reads better.
        const shown = wiki === "en" ? name?.replace(/ (?:film|television series|TV series)$/, "") : name;
        return shown && shown.charAt(0).toUpperCase() + shown.slice(1);
      }),
  );

  const page = entity.sitelinks?.[`${wiki}wiki`] ?? entity.sitelinks?.enwiki;
  summary ??= page ? await summaryOf(entity.sitelinks?.[`${wiki}wiki`] ? wiki : "en", page.title, signal) : null;
  const minutes = amount(entity, "P2047");
  const properties: Record<string, [string, string | number | undefined][]> = {
    movie: [
      ["director", labels("director")],
      ["year", firstYear(entity, "P577")],
      ["runtime", runtime(minutes && minutes * 60)],
      ["genre", genre],
    ],
    show: [
      ["creator", labels("creator")],
      ["year", firstYear(entity, "P580") ?? firstYear(entity, "P577")],
      ["seasons", amount(entity, "P2437")],
      ["genre", genre],
    ],
    book: [
      ["author", labels("author")],
      ["year", firstYear(entity, "P577")],
      ["pages", amount(entity, "P1104")],
      ["publisher", labels("publisher", 1)],
      ["isbn", (values(entity, "P212")[0] ?? values(entity, "P957")[0]) as string | undefined],
    ],
  };
  return {
    type,
    title,
    link: link.href,
    properties: known(properties[type]),
    cover: summary?.originalimage?.source,
    description: summary?.extract,
  };
}

const source: LibrarySource = {
  id: "wikidata",
  name: "Wikidata",
  recognizes: (url) => itemIn(url) !== null,
  lookup,
};

export const wikidata = (): Plugin => ({
  id: "wikidata",
  name: "Wikidata",
  description: t("plugins.wikidata.description"),
  icon: "film",
  enabledByDefault: true,
  requires: ["library"],
  contributes: { librarySources: [source] },
});
