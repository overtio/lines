import { readDuration } from "../feeds/dates";
import { feeds, type Row } from "../feeds/feeds.svelte";
import { fingerprint } from "../feeds/posts";
import { t } from "../i18n/index.svelte";
import { coverOf } from "../library/text";
import { propertyOf, readMention, setProperties } from "../notes/properties";
import { type Entry, notes } from "../notes/store.svelte";
import { type Episode, player } from "./player.svelte";

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
    from: { feed, post: post.id },
  };
}

/** An `episode` note as an episode to play, if its `audio` is a link to it; its place kept by that link. */
export function noteEpisode({ note, meta }: Entry): Episode | null {
  if (meta.type !== "episode" || note.locked) return null;
  const value = (key: string) => propertyOf(meta.properties, key)?.value.trim() || undefined;
  const audio = value("audio");
  if (!audio || !/^https?:\/\/\S+$/i.test(audio)) return null;
  const podcast = value("podcast");
  return {
    key: fingerprint(audio),
    audio,
    title: meta.title || t("list.untitled"),
    // A mention of the podcast's note reads as its title.
    show: podcast && (readMention(podcast)?.name ?? podcast),
    cover: coverOf(note.body) ?? undefined,
    duration: readDuration(value("duration")),
    from: { note: note.id },
  };
}

// An `episode` note played to its end is listened to, as its row's menu would mark it (⌘Z puts it back).
player.onPlayed(({ from }) => {
  if (!("note" in from)) return;
  const entry = notes.get(from.note);
  if (!entry || entry.meta.type !== "episode" || propertyOf(entry.meta.properties, "status")?.value.trim() === "listened") return;
  notes.edit(from.note, setProperties(entry.note.body, { status: "listened" }), t("library.didUndoStatus"), { keepDate: true });
});
