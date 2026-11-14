import type { Attachment } from "svelte/attachments";

/**
 * A picture in a box (a cover, a feed's artwork): filling it where it's at least as big, as a
 * podcast's artwork is; else at its own size in the middle of the box, never stretched, so a site's
 * small icon stays crisp on the box's background rather than blurred. One you can see through
 * that's dark or light all over is marked so (`data-tone`), for TONE_BACKING to put it on a tile
 * where it would vanish into the theme: a black icon in a dark theme, a white one in a light.
 */
export const fitPicture: Attachment<HTMLImageElement> = (image) => {
  const fit = () => {
    const small = image.naturalWidth < image.clientWidth || image.naturalHeight < image.clientHeight;
    image.style.objectFit = small ? "scale-down" : "cover";
    const tone = toneOf(image);
    if (tone) image.dataset.tone = tone;
    else delete image.dataset.tone;
  };
  if (image.complete) fit();
  image.addEventListener("load", fit);
  return () => image.removeEventListener("load", fit);
};

/** The tile behind a picture fitPicture marks, in the theme's own text color, which stands out from its background. */
export const TONE_BACKING = "data-[tone=dark]:[:root[data-scheme=dark]_&]:bg-fg/75 data-[tone=light]:[:root[data-scheme=light]_&]:bg-fg/75";

/** How much of a picture must be see-through, and how dark or light what's seen, to be on a tile. */
const SEE_THROUGH = 1 / 8;
const DARK = 0.3;
const LIGHT = 0.8;

/** Whether a picture is lines' own (a note's attachment), whose pixels it may read: one from a site isn't to be. */
const own = (src: string) => /^(?:blob|data):/.test(src) || new URL(src, location.href).origin === location.origin;

/** Whether a picture of lines' own you can see through is dark or light all over, by its seen pixels' lightness; null for any other. */
function toneOf(image: HTMLImageElement): "dark" | "light" | null {
  const side = 16;
  if (!image.naturalWidth || !own(image.currentSrc || image.src)) return null;
  try {
    const context = Object.assign(document.createElement("canvas"), { width: side, height: side }).getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, side, side);
    const { data } = context.getImageData(0, 0, side, side);
    let clear = 0;
    let seen = 0;
    let light = 0;
    for (let at = 0; at < data.length; at += 4) {
      const alpha = data[at + 3] / 255;
      if (alpha < 0.9) clear++;
      seen += alpha;
      light += (alpha * (0.2126 * data[at] + 0.7152 * data[at + 1] + 0.0722 * data[at + 2])) / 255;
    }
    if (clear < SEE_THROUGH * side * side || !seen) return null;
    const lightness = light / seen;
    return lightness < DARK ? "dark" : lightness > LIGHT ? "light" : null;
  } catch {
    // One the browser won't read back after all: as it is.
    return null;
  }
}
