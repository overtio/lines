import { t } from "../../lib/i18n/index.svelte";
import { clock, dayOf, isoSeconds, known } from "../../lib/library/text";
import { getJson, getPage, request } from "../../lib/library/web";
import { isTauri } from "../../lib/platform";
import type { LibrarySource, Plugin } from "../../lib/plugins/types";

/*
 * YouTube's videos: what one is from YouTube's oEmbed (its title, channel and picture), which web
 * pages may ask too; and in the apps, from the video's page, when it came out, how long it is and
 * what it's about. Only the link to the video is sent.
 */

/** The video a link to YouTube is, by its id: `watch?v=`, youtu.be, Shorts, live and embedded videos. */
export function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^(?:www|m)\./, "");
  let id: string | null | undefined;
  if (host === "youtu.be") id = url.pathname.split("/")[1];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.pathname === "/watch" ? url.searchParams.get("v") : /^\/(?:shorts|live|embed|v)\/([^/]+)/.exec(url.pathname)?.[1];
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

interface OEmbed {
  title?: string;
  author_name?: string;
}

/** The video's largest picture without black bars: its full-size one, which older videos lack, or else a small one. */
async function thumbnail(id: string, signal: AbortSignal) {
  const large = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  const response = await request(large, signal, { method: "HEAD" }).catch(() => null);
  return response?.ok ? large : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

const source: LibrarySource = {
  id: "youtube",
  name: "YouTube",
  recognizes: (url) => youtubeId(url) !== null,
  async lookup(url, signal) {
    const id = youtubeId(url)!;
    const link = `https://www.youtube.com/watch?v=${id}`;
    const embed = await getJson<OEmbed>(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link)}`, signal);
    if (!embed?.title) return null;
    const page = isTauri
      ? await getPage(link, signal).catch(() => {
          signal.throwIfAborted();
          return null;
        })
      : null;
    const meta = page?.meta;
    return {
      type: "video",
      title: embed.title,
      link,
      properties: known([
        ["channel", embed.author_name],
        ["published", dayOf(meta?.get("uploaddate") ?? meta?.get("datepublished"))],
        ["duration", clock(isoSeconds(meta?.get("duration")))],
      ]),
      cover: meta?.get("og:image") ?? (await thumbnail(id, signal)),
      description: meta?.get("og:description"),
    };
  },
};

export const youtube = (): Plugin => ({
  id: "youtube",
  name: "YouTube",
  description: t("plugins.youtube.description"),
  icon: "square-play",
  enabledByDefault: true,
  requires: ["library"],
  contributes: { librarySources: [source] },
});
