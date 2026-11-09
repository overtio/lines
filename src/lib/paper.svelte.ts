import { committed, request } from "./notes/storage";
import { plugins } from "./plugins/registry.svelte";
import type { PaperStyle } from "./plugins/types";
import { smaller } from "./pictures";
import { prefs } from "./prefs.svelte";
import { ownColor } from "./themes/show.svelte";
import { announce, onAnnounce } from "./windows/channel";

/*
 * The paper notes are written on (Settings → Paper): the pattern and texture chosen, from plugins,
 * set here as custom properties that editor.css draws behind every note's page, or under each of its
 * lines. Following the text, a pattern has a row of cells for each line, a line of text wide, so
 * each bullet is in its own; or it's the size chosen. In the color and opacity chosen. With a
 * backdrop, the note is a page over it, and the paper is the page's.
 */

/** Papers as CSS's background properties, the first over the next: across the page, under each line, or down the text column. */
export function paperBackground(styles: (PaperStyle | undefined)[], scheme: "light" | "dark", where: "page" | "line" | "column" = "page") {
  const layers = styles.flatMap((style) => (where === "line" ? style?.lineLayers?.() : where === "column" ? style?.columnLayers?.() : style?.layers?.(scheme)) ?? []);
  if (!layers.length) return undefined;
  return {
    image: layers.map((layer) => layer.image).join(", "),
    size: layers.map((layer) => layer.size).join(", "),
    position: layers.map((layer) => layer.position ?? "0 0").join(", "),
  };
}

/** Whether a pattern is drawn under each line: while Spacing follows the text, or if it can't be drawn across the page. */
export const drawnPerLine = (style: PaperStyle | undefined) => !!style?.lineLayers && (prefs.paperSpacing === "text" || !style.layers);

/** The longest side a backdrop picture is kept at: sharp on a large screen, and small enough to keep. */
const IMAGE_SIZE = 2400;

/*
 * Your own backdrop picture, kept on this device in a database of its own, apart from Settings (it's
 * far too big for them) and from the notes (which erasing them leaves).
 */
let db: Promise<IDBDatabase> | undefined;
function pictures(mode: IDBTransactionMode) {
  db ??= new Promise((resolve, reject) => {
    const open = indexedDB.open("lines-pictures", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("pictures");
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  return db.then((database) => database.transaction("pictures", mode));
}

/** A picture as kept: its bytes and their type, which every browser's database takes (Safari's private windows take no Blob). */
interface Kept {
  type: string;
  data: ArrayBuffer;
}

async function keep(picture: Blob | null) {
  const kept: Kept | null = picture && { type: picture.type, data: await picture.arrayBuffer() };
  const tx = await pictures("readwrite");
  const store = tx.objectStore("pictures");
  if (kept) store.put(kept, "backdrop");
  else store.delete("backdrop");
  await committed(tx);
}

/** Your own picture behind the page, if there is one, as an address to show it at. */
export const backdrop = $state({ image: null as string | null });

function showImage(picture: Blob | null) {
  if (backdrop.image) URL.revokeObjectURL(backdrop.image);
  backdrop.image = picture && URL.createObjectURL(picture);
}

/** The picture as kept; and, once, one kept before in Settings' storage, moved here. */
async function loadImage() {
  try {
    const OLD = "lines.backdrop-image";
    const old = localStorage.getItem(OLD);
    if (old) {
      await keep(await (await fetch(old)).blob());
      localStorage.removeItem(OLD);
    }
    const tx = await pictures("readonly");
    const kept = await request(tx.objectStore("pictures").get("backdrop") as IDBRequest<Kept | undefined>);
    showImage(kept ? new Blob([kept.data], { type: kept.type }) : null);
  } catch {
    // Not kept (no database here, as in private browsing): no picture.
  }
}

/**
 * Makes `file`, a picture, the backdrop: no larger than it needs to be, kept on this device, and
 * shown in every window. Throws when it isn't a picture or there's no room.
 */
export async function chooseBackdropImage(file: Blob) {
  const picture = await smaller(file, IMAGE_SIZE);
  await keep(picture);
  showImage(picture);
  prefs.paperBackdrop = "image";
  void announce({ type: "backdrop-image" });
}

/** Takes the picture away, and the backdrop with it if it's the one shown. */
export async function removeBackdropImage() {
  await keep(null);
  showImage(null);
  if (prefs.paperBackdrop === "image") prefs.paperBackdrop = "none";
  void announce({ type: "backdrop-image" });
}

if (typeof indexedDB !== "undefined") void loadImage();
void onAnnounce((message) => message.type === "backdrop-image" && void loadImage());

/** The backdrop chosen, as CSS's background properties, in the scheme shown; none without one. */
function backdropBackground(scheme: "light" | "dark") {
  switch (prefs.paperBackdrop) {
    case "color": {
      const color = ownColor(prefs.backdropColor, "transparent");
      return { image: `linear-gradient(${color}, ${color})`, size: "100% 100%", position: "0 0" };
    }
    case "image":
      return backdrop.image ? { image: `url("${backdrop.image}")`, size: "cover", position: "center" } : undefined;
    default:
      return paperBackground([plugins.paperStyle(prefs.paperBackdrop)], scheme);
  }
}

/** The color patterns are drawn in: the theme's ink or accent, or your own as Monochrome and Invert show it. */
function paperColor() {
  if (prefs.paperColor === "custom") return ownColor(prefs.paperCustomColor, "var(--ink)");
  return prefs.paperColor === "accent" ? "var(--accent)" : "var(--ink)";
}

const PROPERTIES = [
  "--paper-step",
  "--paper-light",
  "--paper-dark",
  "--paper-size",
  "--paper-position",
  "--paper-lines",
  "--paper-lines-size",
  "--paper-lines-position",
  "--paper-columns",
  "--paper-columns-size",
  "--backdrop-light",
  "--backdrop-dark",
  "--backdrop-size",
  "--backdrop-position",
  "--page-bg",
  "--page-blur",
];

/** The backdrop chosen, and the page over it: its color, as solid as asked, blurring what shows through. */
function showBackdrop(root: HTMLElement) {
  const light = backdropBackground("light");
  const dark = backdropBackground("dark");
  root.toggleAttribute("data-backdrop", !!light);
  if (!light || !dark) return;
  root.style.setProperty("--backdrop-light", light.image);
  root.style.setProperty("--backdrop-dark", dark.image);
  root.style.setProperty("--backdrop-size", light.size);
  root.style.setProperty("--backdrop-position", light.position);
  const page = prefs.pageColor === "custom" ? ownColor(prefs.pageCustomColor, "var(--bg)") : "var(--bg)";
  root.style.setProperty("--page-bg", `color-mix(in srgb, ${page} ${prefs.pageOpacity * 100}%, transparent)`);
  root.style.setProperty("--page-blur", prefs.pageOpacity < 1 ? "blur(24px) saturate(1.2)" : "none");
}

function showPaper() {
  const root = document.documentElement;
  for (const name of PROPERTIES) root.style.removeProperty(name);
  // Always set, for Settings' previews too.
  root.style.setProperty("--paper-color", paperColor());
  root.style.setProperty("--paper-opacity", String(prefs.paperOpacity));
  // On the root with the images, where their var(--paper-step) is worked out: a line of text, or the size chosen.
  root.style.setProperty("--paper-step", prefs.paperSpacing === "text" ? "calc(var(--editor-size) * var(--editor-line-height))" : `${prefs.paperSize}px`);
  showBackdrop(root);
  const pattern = plugins.paperStyle(prefs.paperPattern);
  const texture = plugins.paperStyle(prefs.paperTexture);
  const perLine = drawnPerLine(pattern);
  const lines = perLine ? paperBackground([pattern], "light", "line") : undefined;
  const columns = perLine ? paperBackground([pattern], "light", "column") : undefined;
  const page = [perLine ? undefined : pattern, texture];
  const light = paperBackground(page, "light");
  const dark = paperBackground(page, "dark");
  root.toggleAttribute("data-paper", !!light);
  root.toggleAttribute("data-paper-lines", !!lines);
  root.toggleAttribute("data-paper-columns", !!columns);
  if (lines) {
    root.style.setProperty("--paper-lines", lines.image);
    root.style.setProperty("--paper-lines-size", lines.size);
    root.style.setProperty("--paper-lines-position", lines.position);
  }
  if (columns) {
    root.style.setProperty("--paper-columns", columns.image);
    root.style.setProperty("--paper-columns-size", columns.size);
  }
  if (!light || !dark) return;
  // Light and dark differ only in a texture's color; the scheme shown picks one (editor.css).
  root.style.setProperty("--paper-light", light.image);
  root.style.setProperty("--paper-dark", dark.image);
  root.style.setProperty("--paper-size", light.size);
  root.style.setProperty("--paper-position", light.position);
}

showPaper();
$effect.root(() => {
  $effect(showPaper);
});
