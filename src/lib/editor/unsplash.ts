/*
 * Unsplash photos by the link to their page (unsplash.com/photos/ice-capped-mountain-at-daytime-xfngap_DToE).
 * As an image's address it shows the photo: Unsplash sends /photos/<id>/download on to the picture
 * itself, at the width asked for (but not for Unsplash+ photos, which it keeps for subscribers).
 * The note keeps the link to the page, which credits the photographer.
 */

/** Wide enough for the note column on a 2× screen; images are drawn no taller than 480px. */
const WIDTH = 1600;

/** The photo an Unsplash page link is for, and its description from the link, or null for anything else. */
export function unsplashPhoto(href: string): { id: string; alt: string } | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || !/^(www\.)?unsplash\.com$/i.test(url.hostname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  // Pages in other languages start with theirs: /de/fotos/…
  if (/^[a-z]{2}(-[a-z]{2})?$/i.test(parts[0] ?? "")) parts.splice(0, 2, "photos");
  const [photos, page, download] = parts;
  if (photos !== "photos" || !page || (download && download !== "download") || parts.length > 3) return null;
  // The id is the last 11 characters, after the description (ids can hold - and _ too).
  const id = page.slice(-11);
  if (!/^[\w-]{11}$/.test(id) || (page.length > 11 && page[page.length - 12] !== "-")) return null;
  const words = page.slice(0, -12).replace(/-/g, " ");
  return { id, alt: words.charAt(0).toUpperCase() + words.slice(1) };
}

/** The picture to load for an image address that's an Unsplash page link, or null for anything else. */
export function unsplashImage(src: string): string | null {
  const photo = unsplashPhoto(src);
  return photo && `https://unsplash.com/photos/${photo.id}/download?w=${WIDTH}`;
}

/** Whether a pasted address is an Unsplash photo: a page link, or the picture itself. */
export function isUnsplashPhoto(href: string) {
  return !!unsplashPhoto(href) || /^https:\/\/(images|plus)\.unsplash\.com\/\S+$/i.test(href);
}
