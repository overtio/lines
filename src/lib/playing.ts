/*
 * One sound or video at a time, across lines: starting one (an attachment's in a note, a podcast
 * episode in the player, a site's player in a note) pauses whichever was playing.
 */

/** Something that plays, and can be paused. */
export interface Playing {
  pause(): void;
}

let playing: Playing | null = null;

/** Says `player` has started: whichever was playing before it pauses. */
export function started(player: Playing) {
  if (playing !== player) playing?.pause();
  playing = player;
}

/** Makes `media` one of those that play one at a time. */
export function oneAtATime(media: HTMLMediaElement) {
  media.addEventListener("play", () => started(media));
}
