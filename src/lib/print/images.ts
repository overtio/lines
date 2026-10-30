import { domToBlob } from "modern-screenshot";

/*
 * A printed note as PNG images: lines' pages (pages.ts) drawn as pictures, at twice their size so
 * text stays sharp when zoomed (a very tall one smaller, see MAX_AREA). Each is drawn from a copy
 * at full size, put behind the preview (which covers the window), so the preview's zoom doesn't
 * shrink it.
 */

const SCALE = 2;
/**
 * The largest picture every browser draws: WebKit stops at 16.7 million pixels on iPhone and iPad,
 * and at 16,384 on a side. A taller one (a long note as one image) is drawn smaller to fit.
 */
const MAX_AREA = 16_777_216;
const MAX_SIDE = 16_384;

/** Each page as a PNG, in order. */
export async function pagesToPng(pages: HTMLElement[]): Promise<Uint8Array<ArrayBuffer>[]> {
  const stage = document.createElement("div");
  stage.className = "print-stage";
  document.body.append(stage);
  try {
    const images: Uint8Array<ArrayBuffer>[] = [];
    for (const page of pages) {
      const copy = page.cloneNode(true) as HTMLElement;
      stage.replaceChildren(copy);
      const { width, height } = copy.getBoundingClientRect();
      const scale = Math.min(SCALE, Math.sqrt(MAX_AREA / (width * height)), MAX_SIDE / Math.max(width, height));
      const blob = await domToBlob(copy, { scale, backgroundColor: "#ffffff", type: "image/png" });
      images.push(new Uint8Array(await blob.arrayBuffer()));
    }
    return images;
  } finally {
    stage.remove();
  }
}
