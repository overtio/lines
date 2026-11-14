import { readDuration } from "../feeds/dates";
import { feeds, type Row } from "../feeds/feeds.svelte";
import { t } from "../i18n/index.svelte";
import { libraryNoteOf } from "../library/same";
import { coverOf } from "../library/text";
import { propertyOf, readMention, setProperties } from "../notes/properties";
import { type Entry, notes } from "../notes/store.svelte";
import { type Episode, player } from "./player.svelte";

/** Whether an address is one to play or fetch: on the web, not `javascript:`, `file:` or `data:`. */
export const isWeb = (address: string) => /^https?:\/\/\S+$/i.test(address);

/** A feed's post as an episode to play, if it has sound. */
export function postEpisode({ feed, post }: Row): Episode | null {
  if (!post.audio) return null;
  const record = feeds.records.get(feed);
  return {
    key: post.key,
    audio: post.audio.url,
    title: post.title,
    show: feeds.subscription(feed)?.title ?? record?.title,
    artwork: post.image ?? record?.image,
    duration: post.duration,
    transcript: post.transcript,
    chapters: post.chapters,
    from: { feed, post: post.id },
  };
}

/** An `episode` note as an episode to play, if its `audio` is a link to it; its place kept by the note. */
export function noteEpisode({ note, meta }: Entry): Episode | null {
  if (meta.type !== "episode" || note.locked) return null;
  const value = (key: string) => propertyOf(meta.properties, key)?.value.trim() || undefined;
  const web = (key: string) => {
    const address = value(key);
    return address && isWeb(address) ? address : undefined;
  };
  const audio = web("audio");
  if (!audio) return null;
  const podcast = value("podcast");
  const [transcript, chapters] = [web("transcript"), web("chapters")];
  return {
    key: note.id,
    audio,
    title: meta.title || t("list.untitled"),
    // A mention of the podcast's note reads as its title.
    show: podcast && (readMention(podcast)?.name ?? podcast),
    cover: coverOf(note.body) ?? undefined,
    duration: readDuration(value("duration")),
    ...(transcript && { transcript: { url: transcript } }),
    ...(chapters && { chapters: { url: chapters } }),
    from: { note: note.id },
  };
}

/** The post of the feeds' with this sound, while its feed keeps it. */
const postWithSound = (audio: string) => feeds.posts().find(({ post }) => post.audio?.url === audio);

/** The feed's post an episode is: its own, or, for a note's or a sound's, the one with its sound. */
export function postOf({ from, audio }: Episode): Row | undefined {
  if (!("feed" in from)) return postWithSound(audio);
  const post = feeds.records.get(from.feed)?.posts.find((each) => each.id === from.post);
  return post && { feed: from.feed, post };
}

/**
 * The episode whose sound is at `audio` (a time's link in a note, times.ts): its `episode` note's,
 * else its feed's post's, so its place is the one kept for it; else the sound alone, named by its file.
 */
export function soundEpisode(audio: string): Episode | null {
  if (!isWeb(audio)) return null;
  const saved = libraryNoteOf({ type: "episode", properties: [["audio", audio]] });
  const ofNote = saved && noteEpisode(saved);
  if (ofNote) return ofNote;
  const row = postWithSound(audio);
  if (row) return postEpisode(row);
  let file = new URL(audio).pathname.split("/").pop() ?? "";
  try {
    file = decodeURIComponent(file);
  } catch {
    // Written as it is.
  }
  return { key: audio, audio, title: file.replace(/\.\w+$/, "") || audio, from: { sound: audio } };
}

// An `episode` note played to its end, or stopped near it, is listened to: by lines, not by hand,
// so ⌘Z stays with what was done last. Only the note whose episode it is: one whose sound it has.
player.onPlayed(({ from, audio }) => {
  if (!("note" in from)) return;
  const entry = notes.get(from.note);
  if (!entry || noteEpisode(entry)?.audio !== audio) return;
  notes.setText(from.note, (body) => setProperties(body, { status: "listened" }), { keepDate: true });
});
