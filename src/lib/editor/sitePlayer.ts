import { mount, unmount } from "svelte";
import type { Shown } from "../plugins/types";
import SitePlayerView from "./SitePlayer.svelte";

/*
 * A site's own player for a link on a line of its own (an embed: Spotify's, SoundCloud's), drawn
 * as a card until it's played, and then as the site's player in a frame (SitePlayer.svelte). The
 * frame and lines talk in messages, as the sites' players allow, so starting one pauses whatever
 * else plays in lines, and the other way round.
 */

export interface SitePlayer {
  /** The site's name, as it writes it: "Spotify". */
  site: string;
  /** What it plays, as the link's text says, and what kind of thing it is. */
  title: string;
  kind: "track" | "album" | "playlist" | "artist" | "podcast" | "episode";
  /** The player's address, and its height in pixels: it's as wide as the note. */
  src: string;
  height: number;
  /** Where the player's messages come from, and lines' to it go. */
  origin: string;
  /** What a message from the player says (parsed from JSON, if it's text): that it's ready, or playing or paused; null for anything else. */
  read(message: unknown): "ready" | "playing" | "paused" | null;
  /** What's sent to it once it's ready: to say when it plays and pauses, if it has to be asked. */
  listen?: unknown[];
  /** What plays it, and what pauses it. */
  play: unknown;
  pause: unknown;
}

/** Where a link goes, if it's an address at all. */
export function webLink(href: string | null): URL | null {
  try {
    return href ? new URL(href) : null;
  } catch {
    return null;
  }
}

/** Draws `player` into `dom`, calling `changed` when its size changes. Enter on it (`focus`) plays it. */
export function drawSitePlayer(dom: HTMLElement, player: SitePlayer, changed: () => void): Shown {
  dom.classList.add("cm-lp-site-player");
  const view = mount(SitePlayerView, { target: dom, props: { player, changed } });
  changed();
  return {
    focus: () => void view.play(),
    destroy: () => void unmount(view),
  };
}
