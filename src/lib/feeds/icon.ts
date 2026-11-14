import type { Page } from "../library/page";
import { getPage, isPublic, request } from "../library/web";
import { iconPicture } from "../pictures";

/*
 * A feed's picture when it gives none of its own: its site's icon, as the site gives it to phones
 * and browsers' tabs (apple-touch-icon, <link rel="icon">), else the favicon.ico at its root
 * (Hacker News' Y). Two requests at most: the site's page, then the icon it names or its favicon.
 * Kept as a small PNG, at the icon's own size up to ICON_SIDE.
 */

/** The largest side an icon is kept at: crisp in the sidebar and the player on a Retina screen. */
const ICON_SIDE = 128;
/** The most an icon may weigh as it's downloaded: anything heavier isn't one. */
const ICON_BYTES = 1_000_000;

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
    const body = await response.blob();
    if (body.size > ICON_BYTES) return undefined;
    // A drawing read as one, whatever the site said it is.
    return await iconPicture(VECTOR.test(icon) && !body.type.includes("svg") ? new Blob([body], { type: "image/svg+xml" }) : body, ICON_SIDE);
  } catch {
    signal.throwIfAborted();
    return undefined;
  }
}
