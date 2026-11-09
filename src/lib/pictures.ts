/** `picture` no larger than `side` pixels on its longest side, as a JPEG: what a photo or a wallpaper is kept as. */
export async function smaller(picture: Blob, side: number): Promise<Blob> {
  const bitmap = await createImageBitmap(picture);
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
}
