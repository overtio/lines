import { readAtMost } from "../feeds/fetch";
import { attachmentNameOf } from "../notes/attachments";
import { iconPicture } from "../pictures";
import type { Cover } from "./note";
import type { Page } from "./page";
import { getPage, isPublic, request } from "./web";

/*
 * A site's icon, as the cover of a note for something of the site's that has no picture of its own
 * (a feed's: Hacker News' Y): the largest its page names (apple-touch-icon, <link rel="icon">), else
 * the favicon.ico at its root. Two requests at most to a site, its page and the icon, a few sites
 * at a time, and each site asked once while lines runs however many of its feeds are (again, when
 * asked, only where it had none to give). Kept as a small PNG at the icon's own size, up to ICON_SIDE.
 */

/** The largest side an icon is kept at: crisp in the sidebar and the player on a Retina screen. */
const ICON_SIDE = 128;
/** The most an icon may weigh as it's downloaded: it stops being read past that. */
const ICON_BYTES = 1_000_000;
/** How many sites are asked for their icons at once. */
const AT_ONCE = 3;

const VECTOR = /\.svgz?(?:$|[?#])/i;

/** The icon to ask the site at `site` for: the best its page names (iconsOf), else the favicon.ico at its root. */
export const iconToAsk = (page: Page | null, site: string) => (page && iconsOf(page)[0]) ?? new URL("/favicon.ico", site).href;

/** The icons a page names, the best first: pictures by their size, the largest first, then drawings (SVG), which are kept drawn at ICON_SIDE. */
export function iconsOf(page: Page): string[] {
  const icons = page.links.filter((link) => /(?:^|\s)(?:icon|apple-touch-icon(?:-precomposed)?)(?:\s|$)/.test(link.rel) && isPublic(link.href));
  const vector = (link: Page["links"][number]) => link.type === "image/svg+xml" || link.sizes === "any" || VECTOR.test(link.href);
  // An apple-touch-icon that doesn't say its size is 180 pixels, as phones ask; another, the 16 of a tab's.
  const side = (link: Page["links"][number]) =>
    Math.max(0, ...link.sizes.split(/\s+/).map((size) => Number(/^(\d+)x\d+$/.exec(size)?.[1] ?? 0))) || (link.rel.includes("apple-touch-icon") ? 180 : 16);
  return icons.sort((a, b) => Number(vector(a)) - Number(vector(b)) || side(b) - side(a)).map(({ href }) => href);
}

/** The site at `site`'s icon, as a PNG with the side it's drawn at; nothing where none can be had (on the web, most sites). */
export async function siteIcon(site: string, signal: AbortSignal): Promise<{ picture: Blob; side: number } | undefined> {
  const page = isPublic(site) ? await getPage(site, signal).catch(() => null) : null;
  signal.throwIfAborted();
  const icon = iconToAsk(page, site);
  if (!isPublic(icon)) return undefined;
  try {
    const response = await request(icon, signal);
    if (!response.ok || Number(response.headers.get("content-length")) > ICON_BYTES) return undefined;
    // Read as far as an icon goes, and drawn only if what it says of its size is an icon's.
    return await iconPicture(await readAtMost(response.body, ICON_BYTES), ICON_SIDE);
  } catch {
    signal.throwIfAborted();
    return undefined;
  }
}

/** Each site's icon as it's being found or was, by its origin. */
const found = new Map<string, Promise<{ picture: Blob; side: number } | undefined>>();
let asking = 0;
const waiting: (() => void)[] = [];

/** A turn to ask a site, AT_ONCE at a time; what it gives ends it, handing it to the next waiting. */
async function turn(): Promise<() => void> {
  if (asking < AT_ONCE) asking++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  return () => {
    const next = waiting.shift();
    if (next) next();
    else asking--;
  };
}

/** `site`'s icon as a note's cover, shown at its own size; nothing where it has none to give. */
export async function iconCover(site: string): Promise<Cover | undefined> {
  const origin = new URL(site).origin;
  let icon = found.get(origin);
  if (!icon) {
    icon = (async () => {
      const done = await turn();
      try {
        // Not for one note: others may wait for it.
        return await siteIcon(site, new AbortController().signal);
      } finally {
        done();
      }
    })();
    found.set(origin, icon);
    void icon.then((got) => got || found.delete(origin));
  }
  const got = await icon;
  return got && { picture: got.picture, name: await attachmentNameOf(got.picture), width: got.side };
}
