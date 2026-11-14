import { FetchError, fetchFeed } from "../../lib/feeds/fetch";
import type { Named } from "../../lib/feeds/parse";
import { isWeb, postOf } from "../../lib/player/episodes";
import type { Episode } from "../../lib/player/player.svelte";
import { type Chapter, type Cue, readChapters, readTranscript, sentences } from "./transcripts";

/*
 * An episode's transcript and chapters (transcripts.ts): those its note keeps (`transcript:` and
 * `chapters:`, as Save to Library writes them), or its feed's post names. Read the first time they're
 * asked for, and kept while lines runs.
 */

/** Why what an episode names couldn't be read: its site doesn't let web pages read it, it isn't there any more, or it couldn't be fetched or read. */
export type Failure = "blocked" | "gone" | "unreadable";

/** What's read of an episode: its transcript's sentences and its chapters, either maybe none, and why one that's named couldn't be. */
export interface Heard {
  cues: Cue[];
  chapters: Chapter[];
  failure?: Failure;
}

/** The transcript and chapters an episode has: its own (a note's, or its post's), else its post's, while its feed keeps it. */
export function filesOf(episode: Episode): { transcript?: Named; chapters?: Named } {
  const post = episode.transcript || episode.chapters ? undefined : postOf(episode)?.post;
  const web = (file: Named | undefined) => (file && isWeb(file.url) ? file : undefined);
  return { transcript: web(episode.transcript ?? post?.transcript), chapters: web(episode.chapters ?? post?.chapters) };
}

const failureOf = (error: unknown): Failure =>
  error instanceof FetchError && error.message === "blocked" ? "blocked" : error instanceof FetchError && (error.status === 404 || error.status === 410) ? "gone" : "unreadable";

async function read(url: string): Promise<string> {
  const response = await fetchFeed(url);
  if (!response.changed) throw new FetchError("unchanged");
  return response.text;
}

const heard = new Map<string, Promise<Heard>>();

/** An episode's transcript and chapters, read once for its sound; tried again next time if one couldn't be. */
export function hear(episode: Episode): Promise<Heard> {
  let found = heard.get(episode.audio);
  if (!found) {
    const { transcript, chapters } = filesOf(episode);
    found = Promise.allSettled([
      transcript ? read(transcript.url).then((text) => sentences(readTranscript(text, transcript.type))) : [],
      chapters ? read(chapters.url).then(readChapters) : [],
    ]).then(([cues, marks]): Heard => {
      const failed = [cues, marks].find((result) => result.status === "rejected");
      if (failed) console.warn("lines: couldn't read the episode's transcript or chapters", failed.reason);
      const got = { cues: cues.status === "fulfilled" ? cues.value : [], chapters: marks.status === "fulfilled" ? marks.value : [] };
      const failure = failed ? failureOf(failed.reason) : transcript && !got.cues.length ? "unreadable" : undefined;
      return failure ? { ...got, failure } : got;
    });
    void found.then(({ failure }) => failure && heard.delete(episode.audio));
    heard.set(episode.audio, found);
  }
  return found;
}
