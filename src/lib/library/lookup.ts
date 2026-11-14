import { dayOf } from "../notes/calendar";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryItem } from "../plugins/types";
import { linkId } from "./keys";
import { absolute, type Page } from "./page";
import { known } from "./text";
import { getPage, LookupError } from "./web";

/**
 * What `link` is, asked of the sources in turn (the registry's order: each site's, then those that
 * read any page): the first to recognize it and find something the library keeps. Null when none
 * can say, so nothing is guessed; rejects when none found it and one couldn't be asked (offline).
 */
export async function lookUp(link: string, signal: AbortSignal): Promise<LibraryItem | null> {
  const url = new URL(link);
  let failure: unknown = null;
  for (const source of plugins.librarySources) {
    if (!source.recognizes(url)) continue;
    try {
      const item = await source.lookup(url, signal);
      if (item?.title.trim() && plugins.libraryKind(item.type)) return item;
    } catch (error) {
      signal.throwIfAborted();
      console.warn(`lines: ${source.name} couldn't look up ${url.hostname}`, error);
      failure ??= error;
    }
  }
  if (failure) throw failure;
  return null;
}

/** A site's host, as it's compared: without `www.`. */
const hostOf = (url: URL) => url.hostname.replace(/^www\./, "");

/** The first part of an address' path: `docs` of `/docs/install`; none for a home page. */
const firstPart = (url: URL) => url.pathname.split("/")[1] ?? "";

/**
 * Whether `other`, the address a page calls itself or was read from, is the page `link` is to by
 * another name: on its site, under the same first part of its path. Not a home page, which a site
 * whose pages are all one app names for every page.
 */
function sameFamily(other: string, link: string) {
  const [a, b] = [new URL(other), new URL(link)];
  return hostOf(a) === hostOf(b) && !!firstPart(a) && firstPart(a) === firstPart(b);
}

/**
 * A page nothing can say more of (a product's home page, say), as a resource: its title, its site,
 * the day it's added, its picture where it names one, and what it says of itself. Its `link` is the
 * one added, whatever the page calls itself or wherever it was read from: those are only other
 * addresses it can be found by, where they're of the same page.
 */
export function pageResource(page: Page, link: string): LibraryItem {
  const host = hostOf(new URL(link));
  const said = (...keys: string[]) => keys.map((key) => page.meta.get(key)?.trim()).find(Boolean);
  const picture = said("og:image", "twitter:image");
  return {
    type: "resource",
    title: said("og:title", "twitter:title") || page.title.trim() || host,
    link,
    properties: known([
      ["site", said("og:site_name") ?? host],
      ["added", dayOf(Date.now())],
    ]),
    ids: [...new Set([page.url, page.address])].filter((other) => other !== link && sameFamily(other, link)).map(linkId),
    cover: (picture && absolute(picture, page.address)) || undefined,
    description: said("og:description", "twitter:description", "description"),
  };
}

/** Where a site sends someone to sign in, or to agree to its cookies, rather than to the page. */
const GATES = /^(?:accounts\.google\.com|login\.microsoftonline\.com|login\.live\.com|consent\.[^/]+)$/i;
const GATE_PATHS = /\/(?:log-?in|sign-?in|auth|oauth2?|sso)(?:[/?#]|$)/i;

/** Whether reading `link` ended somewhere else that's a sign-in or consent page: not the page, which can't be read. */
function gated(link: string, address: string) {
  const [asked, read] = [new URL(link), new URL(address)];
  if (asked.href === read.href) return false;
  return GATES.test(read.hostname) || GATE_PATHS.test(read.pathname);
}

/** Titles a page gives itself that's only saying it isn't there, answering as if it were (a "soft 404"), in a few languages. */
const MISSING = /^(?:404|error 404|404 error|404 not found|not found|page not found|404 page not found|page introuvable|página no encontrada|página não encontrada|pagina non trovata|seite nicht gefunden)$/i;

/** Whether a title says only that its page isn't there, on its own or before its site's name: "Page not found | Site". */
const missing = (title: string) => title.split(/\s+[|–—:·-]\s+/).some((part) => MISSING.test(part.trim().replace(/[.!]+$/, "")));

/**
 * What `link` is, as `lookUp` says; or else, as it's being added on purpose (Add to Library, a
 * link's menu), the page itself, as a resource, kept rather than left out because nothing could
 * say more of it. Null when it isn't a page (not there, or not one); rejects when it couldn't be
 * asked (offline; on the web, a site that doesn't let pages read it), or read: what answered was a
 * sign-in or consent page it was sent to, or one saying it isn't there.
 */
export async function lookUpAny(link: string, signal: AbortSignal): Promise<LibraryItem | null> {
  const item = await lookUp(link, signal);
  if (item) return item;
  // As Web Pages read it, if it was asked: the address as `lookUp` gave it, the same.
  const page = await getPage(new URL(link).href, signal);
  if (!page) return null;
  if (gated(link, page.address)) throw new LookupError(`${new URL(link).hostname} sent lines to sign in`);
  if (missing(page.title) || missing(page.meta.get("og:title") ?? "")) throw new LookupError(`${new URL(link).hostname} says its page isn't there`);
  return pageResource(page, link);
}
