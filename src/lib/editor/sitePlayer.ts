import { mount, unmount } from "svelte";
import type { Shown } from "../plugins/types";
import SitePlayerView from "./SitePlayer.svelte";

/*
 * A site's own player for a link on a line of its own (an embed: Spotify's, SoundCloud's), drawn as
 * a card until it's played and then as the site's player in a frame (SitePlayer.svelte). The frame
 * and lines talk in the messages the site's player takes, so it and whatever else plays in lines
 * take turns. The site goes in the apps' frame-src (src-tauri/tauri.conf.json).
 */

export interface SitePlayer {
  /** The site's name, as it writes it: "Spotify". */
  site: string;
  /** The link it plays, without what's added to it for sharing: what Open opens. */
  link: string;
  /** What the note's link says it is, and what kind of thing it is, in the plugin's words ("Track"). */
  title: string;
  kind: string;
  /** What its card says under its name, if not that the site's player loads once it's played. */
  note?: string;
  /** The player's address, and its height in pixels. */
  src: string;
  height: number;
  /** Where its messages come from, and lines' to it go. */
  origin: string;
  /** What a message from it says (parsed from JSON, if it's text): that it's ready, playing or paused; null for anything else. */
  read(message: unknown): "ready" | "playing" | "paused" | null;
  /** What it's sent once it's ready, if it has to be asked to say when it plays and pauses. */
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
