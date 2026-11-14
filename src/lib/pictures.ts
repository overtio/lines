/** The most pixels across a picture from elsewhere (a cover, an icon) may say it has: more isn't drawn at all, as it'd take that much memory to. */
export const PICTURE_SIDE_LIMIT = 8192;

const word = (bytes: Uint8Array, at: number) => (bytes[at] << 8) | bytes[at + 1];
const littleWord = (bytes: Uint8Array, at: number) => bytes[at] | (bytes[at + 1] << 8);
const long = (bytes: Uint8Array, at: number) => ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
const littleLong = (bytes: Uint8Array, at: number) => (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
const startsWith = (bytes: Uint8Array, text: string, at = 0) => [...text].every((char, i) => bytes[at + i] === char.charCodeAt(0));

/** A picture as its file says it is: its kind (`image/png`…) and its size. */
export interface PictureFile {
  type: string;
  width: number;
  height: number;
}

/**
 * What a picture's file says it is, read from its bytes before it's drawn (PNG, GIF, JPEG, WebP,
 * BMP, ICO, AVIF and HEIF), whatever it was called (a server's `application/octet-stream`, an app's
 * download that says nothing): its kind, and its size, to refuse one too big to draw. Null for a file
 * it can't tell, which isn't a picture lines keeps (an SVG, a page).
 */
export function pictureOf(bytes: Uint8Array): PictureFile | null {
  if (startsWith(bytes, "\x89PNG") && bytes.length >= 24) return { type: "image/png", width: long(bytes, 16), height: long(bytes, 20) };
  if (startsWith(bytes, "GIF8") && bytes.length >= 10) return { type: "image/gif", width: littleWord(bytes, 6), height: littleWord(bytes, 8) };
  if (startsWith(bytes, "BM") && bytes.length >= 26) return { type: "image/bmp", width: littleLong(bytes, 18), height: Math.abs(littleLong(bytes, 22) | 0) };
  if (startsWith(bytes, "RIFF") && startsWith(bytes, "WEBP", 8) && bytes.length >= 30) {
    const type = "image/webp";
    if (startsWith(bytes, "VP8 ", 12)) return { type, width: littleWord(bytes, 26) & 0x3fff, height: littleWord(bytes, 28) & 0x3fff };
    if (startsWith(bytes, "VP8L", 12)) return { type, width: 1 + (bytes[21] | ((bytes[22] & 0x3f) << 8)), height: 1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0xf) << 10)) };
    if (startsWith(bytes, "VP8X", 12)) return { type, width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
    return null;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    // Through its segments to the frame's header (SOF0 to SOF15, but for the tables that share their numbers).
    for (let at = 2; at + 9 < bytes.length; ) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1];
      if (marker === 0xff) at++;
      else if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { type: "image/jpeg", width: word(bytes, at + 7), height: word(bytes, at + 5) };
      else if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) at += 2;
      else at += 2 + word(bytes, at + 2);
    }
    return null;
  }
  if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0 && bytes.length >= 6) {
    // An icon file: the largest of its pictures, as their entries say, or as a PNG inside one says (which is what's drawn).
    let width = 0;
    let height = 0;
    for (let i = 0, at = 6; i < littleWord(bytes, 4) && at + 16 <= bytes.length; i++, at += 16) {
      const offset = littleLong(bytes, at + 12);
      const inner = offset >= 6 && startsWith(bytes, "\x89PNG", offset) ? pictureOf(bytes.subarray(offset)) : null;
      width = Math.max(width, inner?.width ?? (bytes[at] || 256));
      height = Math.max(height, inner?.height ?? (bytes[at + 1] || 256));
    }
    return width ? { type: "image/x-icon", width, height } : null;
  }
  // AVIF and HEIF: the size its image's properties say (`ispe`).
  const ispe = startsWith(bytes, "ftyp", 4) ? bytes.subarray(0, 4096).findIndex((_, i) => startsWith(bytes, "ispe", i)) : -1;
  const type = startsWith(bytes, "avif", 8) || startsWith(bytes, "avis", 8) ? "image/avif" : "image/heif";
  return ispe > 0 && ispe + 16 <= bytes.length ? { type, width: long(bytes, ispe + 8), height: long(bytes, ispe + 12) } : null;
}

/** The picture a file is (pictureOf), if it says it's small enough to draw; one it can't tell, none. */
export function drawablePicture(bytes: Uint8Array): PictureFile | null {
  const picture = pictureOf(bytes);
  return picture && picture.width > 0 && picture.height > 0 && Math.max(picture.width, picture.height) <= PICTURE_SIDE_LIMIT ? picture : null;
}

/** Whether a picture's file says it's small enough to draw (pictureOf); one it can't tell, not. */
export const drawable = (bytes: Uint8Array) => drawablePicture(bytes) !== null;

/** Whether some bytes are an SVG drawing, whatever they were said to be: its text starts with `<svg`, or XML's declaration before one. */
export function isDrawing(bytes: Uint8Array): boolean {
  const start = new TextDecoder().decode(bytes.subarray(0, 1024)).trimStart();
  return start.startsWith("<svg") || (/^<\?xml|^<!DOCTYPE svg|^<!--/i.test(start) && start.includes("<svg"));
}

/**
 * An icon (a site's: PNG, ICO, SVG…) as a PNG no larger than `side` pixels on its longest side, and
 * at its own size where it's smaller, never stretched; an SVG, which has no pixels of its own, at
 * `side`. With the side it's drawn at; nothing if it can't be drawn, or says it's too big to.
 */
export async function iconPicture(icon: Uint8Array, side: number): Promise<{ picture: Blob; side: number } | undefined> {
  const vector = isDrawing(icon);
  if (!vector && !drawable(icon)) return undefined;
  const url = URL.createObjectURL(new Blob([icon as BlobPart], vector ? { type: "image/svg+xml" } : {}));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    if (!longest && !vector) return undefined;
    const scale = vector ? side / (longest || side) : Math.min(1, side / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((image.naturalWidth || side) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || side) * scale));
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
    const picture = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return picture ? { picture, side: Math.max(canvas.width, canvas.height) } : undefined;
  } catch {
    // Not a picture this browser can draw.
    return undefined;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * `picture` no larger than `side` pixels on its longest side, as a JPEG: what a photo or a wallpaper
 * is kept as. Or as a PNG where it's see-through (a podcast's artwork, a logo), which a JPEG would
 * fill with black.
 */
export async function smaller(picture: Blob, side: number): Promise<Blob> {
  const bitmap = await createImageBitmap(picture);
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  const context = canvas.getContext("2d")!;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.convertToBlob(picture.type !== "image/jpeg" && seeThrough(context) ? { type: "image/png" } : { type: "image/jpeg", quality: 0.85 });
}

/** Whether what's drawn has a pixel that isn't opaque. */
function seeThrough(context: OffscreenCanvasRenderingContext2D) {
  const { data } = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}
