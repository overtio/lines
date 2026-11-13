/*
 * One sound or video at a time, across lines: starting one (an attachment's in a note, a podcast
 * episode in the player) pauses whichever was playing.
 */

let playing: HTMLMediaElement | null = null;

/** Makes `media` one of those that play one at a time. */
export function oneAtATime(media: HTMLMediaElement) {
  media.addEventListener("play", () => {
    if (playing !== media) playing?.pause();
    playing = media;
  });
}
