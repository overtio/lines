import { t } from "../../lib/i18n/index.svelte";
import { clock, known, yearOf } from "../../lib/library/text";
import { getJson } from "../../lib/library/web";
import { pacing } from "../../lib/pacing";
import type { LibraryItem, LibrarySource, Plugin } from "../../lib/plugins/types";

/*
 * MusicBrainz (musicbrainz.org), the open encyclopedia of music: songs and albums by a link to them
 * there, or by a link to them on Spotify, Apple Music, Bandcamp, Deezer or Tidal that MusicBrainz
 * knows; their covers from the Cover Art Archive. MusicBrainz asks for one request a second, and for
 * apps to say who they are (web.ts). Only the link, or the id in it, is sent. It answers web pages too.
 */

const API = "https://musicbrainz.org/ws/2";
const paced = pacing(1000);

/** What a link to MusicBrainz is: a recording (a song), or a release or release group (an album). */
type Entity = { kind: "recording" | "release" | "release-group"; id: string };

const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Links to music elsewhere that MusicBrainz may know, by the address it keeps them by. */
const STREAMING = [
  /^open\.spotify\.com\/(?:intl-[a-z]+\/)?(?:track|album)\//,
  /^music\.apple\.com\/[a-z]{2}\/(?:album|song)\//,
  /^[a-z0-9-]+\.bandcamp\.com\/(?:track|album)\//,
  /^(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?(?:track|album)\//,
  /^(?:listen\.)?tidal\.com\/(?:browse\/)?(?:track|album)\//,
];

export function musicIn(url: URL): Entity | "streaming" | null {
  if (/^(?:beta\.)?musicbrainz\.org$/i.test(url.hostname)) {
    const [, kind, id] = url.pathname.split("/");
    return (kind === "recording" || kind === "release" || kind === "release-group") && MBID.test(id ?? "") ? { kind, id } : null;
  }
  const address = `${url.hostname}${url.pathname}`.toLowerCase();
  return STREAMING.some((pattern) => pattern.test(address)) ? "streaming" : null;
}

interface Credit {
  name: string;
  joinphrase?: string;
}

interface ReleaseGroup {
  id: string;
  title: string;
  "primary-type"?: string;
  "first-release-date"?: string;
  "artist-credit"?: Credit[];
}

interface Release {
  id: string;
  title: string;
  date?: string;
  "artist-credit"?: Credit[];
  "release-group"?: ReleaseGroup;
  media?: { "track-count"?: number }[];
  "cover-art-archive"?: { front?: boolean };
}

interface Recording {
  id: string;
  title: string;
  length?: number;
  "first-release-date"?: string;
  "artist-credit"?: Credit[];
  releases?: Release[];
}

interface UrlRelations {
  relations?: Partial<Record<Entity["kind"], { id: string }>>[];
}

const ask = <T>(path: string, signal: AbortSignal) => paced(() => getJson<T>(`${API}/${path}${path.includes("?") ? "&" : "?"}fmt=json`, signal), signal);

/** Who's credited, as MusicBrainz writes it: `Simon & Garfunkel`. */
const artistOf = (credits: Credit[] | undefined) => credits?.map((credit) => credit.name + (credit.joinphrase ?? "")).join("").trim() || undefined;

/** The album a recording's on: the first of its releases that's an album, else the first of any. */
const albumOf = (recording: Recording) => recording.releases?.find((each) => each["release-group"]?.["primary-type"] === "Album") ?? recording.releases?.[0];

const cover = (kind: "release" | "release-group", id: string, size = 500) => `https://coverartarchive.org/${kind}/${id}/front-${size}`;

/** The recording, release or release group MusicBrainz keeps a link to elsewhere under (as the site writes it, without what's shared with it), if it does. */
async function entityOf(url: URL, signal: AbortSignal): Promise<Entity | null> {
  const resource = url.origin + url.pathname.replace(/^\/intl-[a-z]+(?=\/)/, "");
  const kept = await ask<UrlRelations>(`url?resource=${encodeURIComponent(resource)}&inc=recording-rels+release-rels+release-group-rels`, signal);
  for (const kind of ["recording", "release-group", "release"] as const) {
    const related = kept?.relations?.find((relation) => relation[kind])?.[kind];
    if (related) return { kind, id: related.id };
  }
  return null;
}

async function lookup(url: URL, signal: AbortSignal): Promise<LibraryItem | null> {
  const found = musicIn(url);
  const entity = found === "streaming" ? await entityOf(url, signal) : found;
  if (!entity) return null;
  if (entity.kind === "recording") {
    const recording = await ask<Recording>(`recording/${entity.id}?inc=artist-credits+releases+release-groups`, signal);
    if (!recording) return null;
    const release = albumOf(recording);
    const group = release?.["release-group"];
    return {
      type: "song",
      title: recording.title,
      link: url.href,
      properties: known([
        ["artist", artistOf(recording["artist-credit"])],
        ["album", release?.title],
        ["year", yearOf(recording["first-release-date"])],
        ["duration", clock(recording.length && recording.length / 1000)],
      ]),
      cover: group ? cover("release-group", group.id) : undefined,
    };
  }
  const release = entity.kind === "release" ? await ask<Release>(`release/${entity.id}?inc=artist-credits+release-groups+media`, signal) : null;
  const group = release?.["release-group"] ?? (entity.kind === "release-group" ? await ask<ReleaseGroup>(`release-group/${entity.id}?inc=artist-credits`, signal) : null);
  const title = release?.title ?? group?.title;
  if (!title) return null;
  const tracks = release?.media?.reduce((sum, medium) => sum + (medium["track-count"] ?? 0), 0);
  return {
    type: "album",
    title,
    link: url.href,
    properties: known([
      ["artist", artistOf(release?.["artist-credit"] ?? group?.["artist-credit"])],
      ["year", yearOf(group?.["first-release-date"] ?? release?.date)],
      ["tracks", tracks || undefined],
    ]),
    cover: release?.["cover-art-archive"]?.front ? cover("release", release.id) : group ? cover("release-group", group.id) : undefined,
  };
}

/** Words as MusicBrainz's search reads them, its syntax's characters taken as they are. */
const words = (text: string) => text.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&");

/** Songs or albums `text` names (a title, perhaps with who it's by), the album's cover small. */
async function search(type: string, text: string, signal: AbortSignal): Promise<LibraryItem[]> {
  if (type === "song") {
    const found = await ask<{ recordings?: Recording[] }>(`recording?query=${encodeURIComponent(words(text))}&limit=15`, signal);
    return (found?.recordings ?? []).map((recording) => {
      const release = albumOf(recording);
      const group = release?.["release-group"];
      return {
        type: "song",
        title: recording.title,
        link: `https://musicbrainz.org/recording/${recording.id}`,
        properties: known([
          ["artist", artistOf(recording["artist-credit"])],
          ["album", release?.title],
        ]),
        cover: group && cover("release-group", group.id, 250),
      };
    });
  }
  const found = await ask<{ "release-groups"?: ReleaseGroup[] }>(`release-group?query=${encodeURIComponent(`${words(text)} AND primarytype:album`)}&limit=15`, signal);
  return (found?.["release-groups"] ?? []).map((group) => ({
    type: "album",
    title: group.title,
    link: `https://musicbrainz.org/release-group/${group.id}`,
    properties: known([
      ["artist", artistOf(group["artist-credit"])],
      ["year", yearOf(group["first-release-date"])],
    ]),
    cover: cover("release-group", group.id, 250),
  }));
}

const source: LibrarySource = {
  id: "musicbrainz",
  name: "MusicBrainz",
  recognizes: (url) => musicIn(url) !== null,
  key: (url) => {
    const found = musicIn(url);
    return found && found !== "streaming" ? `musicbrainz:${found.kind}/${found.id}` : null;
  },
  lookup,
  searches: ["album", "song"],
  search,
};

export const musicbrainz = (): Plugin => ({
  id: "musicbrainz",
  name: "MusicBrainz",
  description: t("plugins.musicbrainz.description"),
  icon: "music",
  enabledByDefault: true,
  requires: ["library"],
  contributes: { librarySources: [source] },
});
