import { pacing, withTimeout } from "../../lib/pacing";
import { webFetch } from "../../lib/platform";
import type { Paper, SearchPage } from "../../lib/plugins/types";
import { arxivIdIn } from "./links";

/*
 * Searching arXiv's papers through its API (info.arxiv.org/help/api), which answers in Atom. arXiv
 * asks for no more than one request every three seconds, one at a time, and for what's been asked
 * already not to be asked again; so requests wait their turn, and answers are kept until lines closes.
 */

const API = "https://export.arxiv.org/api/query";
const PER_PAGE = 20;
const SPACING = 3000;
/** How long a request waits for arXiv to answer, so one that never does holds up none after it. */
const TIMEOUT = 20_000;
/** As many answers as are kept. */
const KEPT = 50;
const ATOM = "http://www.w3.org/2005/Atom";
const ARXIV = "http://arxiv.org/schemas/atom";
const OPENSEARCH = "http://a9.com/-/spec/opensearch/1.1/";

/**
 * Words arXiv's search finds nothing for (Lucene's English stop words): a search with any of them
 * finds no paper at all, so they're left out.
 */
const STOP_WORDS = new Set(
  "a an and are as at be but by for if in into is it no not of on or such that the their then there these they this to was will with".split(" "),
);

/** arXiv's own query syntax: a field (`au:hinton`) or AND, OR, ANDNOT, which go to arXiv as typed. */
const OWN_SYNTAX = /\b(?:ti|au|abs|co|jr|cat|rn|id|all):\S|\b(?:AND|OR|ANDNOT)\b/;

/**
 * What's typed as arXiv's query: each word (or "quoted phrase") in the title or among the authors,
 * all of them needed; with `broad`, anywhere in the paper's details, its abstract too. arXiv ranks
 * the paper meant much higher when it looks in titles and authors only.
 */
export function searchQuery(typed: string, broad = false): string {
  if (OWN_SYNTAX.test(typed)) return typed.trim();
  const terms: string[] = [];
  // Brackets, colons and quotes are arXiv's syntax, not words.
  for (const [, phrase, word] of typed.matchAll(/"([^"]*)"|([^\s"():]+)/g)) {
    if (word && STOP_WORDS.has(word.toLowerCase())) continue;
    const text = word ?? phrase.replace(/[():]/g, " ").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const term = word ?? `"${text}"`;
    terms.push(broad ? `all:${term}` : `(ti:${term} OR au:${term})`);
  }
  return terms.join(" AND ");
}

const paced = pacing(SPACING);

/** Sends `url` once the request before it is done and three seconds have passed since it went. */
const inTurn = (url: string, signal: AbortSignal) =>
  paced(async () => {
    const fetch = await webFetch();
    const response = await fetch(url, { signal: withTimeout(signal, TIMEOUT) });
    if (!response.ok) throw new Error(`arXiv answered ${response.status}`);
    return response.text();
  }, signal);

const answers = new Map<string, SearchPage<Paper>>();

const text = (parent: Element, name: string, ns = ATOM) => parent.getElementsByTagNameNS(ns, name)[0]?.textContent?.replace(/\s+/g, " ").trim() ?? "";

/** The papers in an answer, each by its id with its version if `versioned`, and whether there are more after them. */
function read(xml: string, start: number, versioned: boolean): SearchPage<Paper> {
  const feed = new DOMParser().parseFromString(xml, "application/xml");
  const items: Paper[] = [];
  for (const entry of feed.getElementsByTagNameNS(ATOM, "entry")) {
    // A query arXiv can't read comes back as one entry saying so.
    const found = /arxiv\.org\/abs\/(.+?)(v\d+)?$/.exec(text(entry, "id"));
    if (!found) continue;
    const id = versioned ? found[1] + (found[2] ?? "") : found[1];
    const year = Number(text(entry, "published").slice(0, 4));
    items.push({
      id,
      title: text(entry, "title"),
      authors: [...entry.getElementsByTagNameNS(ATOM, "author")].map((author) => text(author, "name")).filter(Boolean),
      year: year || undefined,
      venue: entry.getElementsByTagNameNS(ARXIV, "primary_category")[0]?.getAttribute("term") ?? undefined,
      url: `https://arxiv.org/abs/${id}`,
      abstract: text(entry, "summary") || undefined,
    });
  }
  const total = Number(text(feed.documentElement, "totalResults", OPENSEARCH)) || 0;
  return { items, more: items.length > 0 && start + PER_PAGE < total };
}

/** One page of an answer to `params`, asked of arXiv unless it was already. */
async function ask(params: Record<string, string>, start: number, versioned: boolean, signal: AbortSignal) {
  const url = `${API}?${new URLSearchParams(params)}`;
  let answer = answers.get(url);
  if (!answer) {
    answer = read(await inTurn(url, signal), start, versioned);
    if (answers.size >= KEPT) answers.delete(answers.keys().next().value!);
    answers.set(url, answer);
  }
  return answer;
}

/** What was typed that found nothing in titles and authors, and so is looked for everywhere. */
const broadened = new Set<string>();

/**
 * One page of the papers `typed` finds: the one it names, if it names one (1706.03762, a link to
 * it), linked to by the version named, if one is.
 */
export async function search(typed: string, page: number, signal: AbortSignal): Promise<SearchPage<Paper>> {
  const id = arxivIdIn(typed);
  if (id) return ask({ id_list: id }, 0, /v\d+$/.test(id), signal);
  const start = (page - 1) * PER_PAGE;
  const find = (query: string) => ask({ search_query: query, start: String(start), max_results: String(PER_PAGE) }, start, false, signal);
  const query = searchQuery(typed, broadened.has(typed));
  if (!query) return { items: [], more: false };
  const found = await find(query);
  const broader = searchQuery(typed, true);
  if (found.items.length || page > 1 || broader === query) return found;
  broadened.add(typed);
  return find(broader);
}
