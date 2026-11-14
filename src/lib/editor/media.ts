import { type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { mount, unmount } from "svelte";
import { attachmentURL, type MediaKind, wasMissing, whenArrived } from "../notes/attachments";
import { oneAtATime } from "../playing";
import type { Shown } from "../plugins/types";
import { setWidth } from "./actions";
import AudioPlayer from "./AudioPlayer.svelte";

/*
 * Audio and video attached to a note, played where they are: audio in a card like a file's
 * (AudioPlayer.svelte), video with the browser's own controls. A note's players last while it's
 * open, so one keeps its place when its block is drawn again (scrolled back to, or its line
 * changed), and audio plays on while the note is scrolled far from it. A player stops once its
 * attachment is gone from the note, or another note opens; starting one pauses any other. Its
 * controls take their own clicks and keys (`cm-lp-own-input`, editor/util.ts).
 */

/** What a block draws, and what to do when it goes. */
export interface Drawn {
  dom: HTMLElement;
  destroy: () => void;
}

interface Player {
  media: HTMLMediaElement;
  /** How many blocks draw it now. */
  shown: number;
}

/** A note's players, by attachment. */
class Players {
  readonly players = new Map<string, Player>();

  constructor(readonly view: EditorView) {}

  /** The player for an attachment, made the first time a block draws it. */
  get(name: string, kind: MediaKind, url: string): Player {
    const player = this.players.get(name);
    // A video can't be in two places: one in the note twice gets a second player, kept only while it's drawn.
    if (player && !(kind === "video" && player.shown)) return player;
    const media = document.createElement(kind);
    if (media instanceof HTMLVideoElement) {
      media.className = "cm-lp-video cm-lp-own-input";
      media.controls = true;
      media.playsInline = true;
      // Focus can go to it (Enter on its block), from where Tab reaches its own controls.
      media.tabIndex = -1;
      // Safari shows a video's first frame only once it has loaded some of it.
      media.preload = "auto";
    } else {
      media.preload = "metadata";
    }
    media.src = url;
    oneAtATime(media);
    const made = { media, shown: 0 };
    if (!player) this.players.set(name, made);
    return made;
  }

  update(update: ViewUpdate) {
    if (update.docChanged) this.prune();
  }

  /** Stops the players no block draws whose attachment the note no longer has (deleted, or cut). */
  prune() {
    let text: string | undefined;
    for (const [name, player] of this.players) {
      if (player.shown) continue;
      text ??= this.view.state.doc.toString();
      if (!text.includes(name)) this.stop(name);
    }
  }

  stop(name: string) {
    this.players.get(name)?.media.pause();
    this.players.delete(name);
  }

  destroy() {
    for (const name of this.players.keys()) this.stop(name);
  }
}

/** Keeps a note's players; part of every editor that draws them. */
export const mediaPlayers = ViewPlugin.fromClass(Players);

/** The player itself, drawn for a block while it shows; a video at `width`, or its own size. Calls `failed` if it can't play. */
function playerElement(players: Players, player: Player, label: string, width: number | null, onChange: () => void, failed: () => void): Drawn {
  const { media } = player;
  player.shown++;
  let dom: HTMLElement;
  let component: ReturnType<typeof mount> | undefined;
  if (media instanceof HTMLVideoElement) {
    media.setAttribute("aria-label", label);
    setWidth(media, width);
    dom = media;
  } else {
    dom = document.createElement("span");
    component = mount(AudioPlayer, { target: dom, props: { audio: media as HTMLAudioElement, name: label } });
  }
  media.addEventListener("loadedmetadata", onChange);
  media.addEventListener("error", failed);
  return {
    dom,
    destroy() {
      media.removeEventListener("loadedmetadata", onChange);
      media.removeEventListener("error", failed);
      if (component) void unmount(component);
      player.shown--;
      players.prune();
    },
  };
}

/**
 * An attachment's player, for its block. While the attachment isn't on this device the block shows
 * `card` (the file's card), until it arrives; so does one the browser can't play (an AIFF file in
 * Chrome, say), to open in another app. `focus`, as Enter on the selected block does, plays it and
 * gives it the keyboard.
 */
export function mediaElement(
  view: EditorView,
  kind: MediaKind,
  name: string,
  label: string,
  width: number | null,
  onChange: () => void,
  card: () => Drawn,
): Drawn & Shown {
  const players = view.plugin(mediaPlayers);
  const dom = document.createElement("span");
  dom.className = `cm-lp-${kind}-slot`;
  let shown: Drawn | null = null;
  let media: HTMLMediaElement | null = null;
  let gone = false;
  let cancel = () => {};
  const put = (drawn: Drawn, playing: HTMLMediaElement | null = null) => {
    shown?.destroy();
    shown = drawn;
    media = playing;
    dom.replaceChildren(drawn.dom);
    onChange();
  };
  const show = () =>
    void attachmentURL(name).then((url) => {
      if (gone) return;
      if (!url) cancel = whenArrived(name, show);
      const player = url && players ? players.get(name, kind, url) : null;
      if (player && !player.media.error) put(playerElement(players!, player, label, width, onChange, () => put(card())), player.media);
      // Its card, unless that's what shows already.
      else if (!shown || media) put(card());
    });
  // One that wasn't on this device last time is its card from the start, rather than nothing until it's been looked for.
  if (wasMissing(name)) put(card());
  show();
  return {
    dom,
    focus() {
      if (!media) return;
      void media.play().catch(() => {});
      (media instanceof HTMLVideoElement ? media : dom.querySelector<HTMLElement>(".cm-lp-audio-play"))?.focus();
    },
    destroy() {
      gone = true;
      cancel();
      shown?.destroy();
    },
  };
}
