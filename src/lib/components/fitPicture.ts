import type { Attachment } from "svelte/attachments";

/**
 * A picture in a box (a cover, a feed's artwork): filling it where it's at least as big, as a
 * podcast's artwork is; else at its own size in the middle of the box, never stretched, so a site's
 * small icon stays crisp on the box's background rather than blurred.
 */
export const fitPicture: Attachment<HTMLImageElement> = (image) => {
  const fit = () => {
    const small = image.naturalWidth < image.clientWidth || image.naturalHeight < image.clientHeight;
    image.style.objectFit = small ? "scale-down" : "cover";
  };
  if (image.complete) fit();
  image.addEventListener("load", fit);
  return () => image.removeEventListener("load", fit);
};
