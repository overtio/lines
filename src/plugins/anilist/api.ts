import { LookupError, request } from "../../lib/library/web";
import { pacing } from "../../lib/pacing";

/*
 * AniList's GraphQL API (docs.anilist.co), which answers web pages too and needs no key to read. It
 * asks for no more than 90 requests a minute (fewer while it's under strain), so lines asks once a
 * second at most.
 */

export const API = "https://graphql.anilist.co";
const paced = pacing(1000);

/** What AniList answers to `query` with `variables`. Rejects offline, and on AniList's own errors (a 429 says when to ask again). */
export function ask<T>(query: string, variables: Record<string, unknown>, signal: AbortSignal): Promise<T> {
  return paced(async () => {
    const response = await request(API, signal, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const answer = (await response.json().catch(() => null)) as { data?: T; errors?: { message: string; status?: number }[] } | null;
    if (!response.ok || !answer?.data) throw new LookupError(`AniList answered ${response.status}${answer?.errors?.[0] ? `: ${answer.errors[0].message}` : ""}`);
    return answer.data;
  }, signal);
}

/** Something on AniList, as lines asks for it. */
export interface Media {
  id: number;
  idMal?: number | null;
  format?: string | null;
  episodes?: number | null;
  season?: string | null;
  seasonYear?: number | null;
  startDate?: { year?: number | null } | null;
  title?: { romaji?: string | null; english?: string | null; native?: string | null } | null;
  coverImage?: { extraLarge?: string | null; large?: string | null; medium?: string | null } | null;
  description?: string | null;
  siteUrl?: string | null;
  studios?: { nodes?: { name: string }[] } | null;
}

/** What lines asks of an anime: what its note says of it. */
export const MEDIA = `id idMal format episodes season seasonYear startDate { year } title { romaji english native }
  coverImage { extraLarge large medium } siteUrl studios(isMain: true) { nodes { name } }`;
