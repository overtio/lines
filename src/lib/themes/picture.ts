import { groups, points, themeFromSwatches } from "./swatches";

/*
 * A theme from a picture (Settings → Theme → New → From a Picture…): a wallpaper's colors, read on
 * this device and grouped into a few (swatches.ts), which make the theme.
 */

/** The longest side the picture is read at: enough for its colors, quick to group. */
const SIDE = 96;
const GROUPS = 8;

/** A picture's pixels, as RGBA bytes, at most SIDE pixels on its longest side. */
async function pixels(picture: Blob) {
  const bitmap = await createImageBitmap(picture);
  const scale = Math.min(1, SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return context.getImageData(0, 0, width, height).data;
}

/** A theme, light and dark, from a picture's pixels (RGBA bytes), called `name`. Throws if they can't make one. */
export const themeFromPixels = (data: ArrayLike<number>, name: string) => themeFromSwatches(groups(points(data), GROUPS), name);

/** A theme, light and dark, from `picture`'s colors, called `name`. Throws if the picture can't be read. */
export const themeFromPicture = async (picture: Blob, name: string) => themeFromPixels(await pixels(picture), name);

/** For a picture called "Lake at dawn.jpg": "Lake at dawn". */
export const pictureName = (fileName: string) => fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
