/**
 * An icon (a site's: PNG, ICO, SVG…) as a PNG no larger than `side` pixels on its longest side, and
 * at its own size where it's smaller, never stretched; an SVG, which has no pixels of its own, at
 * `side`. With the side it's drawn at; nothing if it can't be drawn.
 */
export async function iconPicture(icon: Blob, side: number): Promise<{ picture: Blob; side: number } | undefined> {
  const url = URL.createObjectURL(icon);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const vector = icon.type.includes("svg");
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

/** `picture` no larger than `side` pixels on its longest side, as a JPEG: what a photo or a wallpaper is kept as. */
export async function smaller(picture: Blob, side: number): Promise<Blob> {
  const bitmap = await createImageBitmap(picture);
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
}
