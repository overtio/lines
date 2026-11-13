import { feeds, type Row } from "../feeds/feeds.svelte";
import type { Episode } from "./player.svelte";

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
