import { plugins } from "./plugins/registry.svelte";
import type { PaperStyle } from "./plugins/types";
import { prefs, type PaperSpacing } from "./prefs.svelte";
import { css, parse } from "./themes/color";
import { shownColor } from "./themes/show.svelte";
import { announce, onAnnounce } from "./windows/channel";

/*
 * The paper notes are written on (Settings → Paper): the pattern and texture chosen, from plugins,
 * set here as custom properties that editor.css draws behind every note's page, or under each of its
 * lines for a pattern drawn per line. A pattern's lines are a line of text apart, or three quarters
 * or one and a half of one, so they grow with the text, and in the color and opacity chosen. With a
 * backdrop, the note is a page over it, and the paper is the page's.
 */

export const PAPER_SPACINGS: Record<PaperSpacing, number> = { small: 0.75, medium: 1, large: 1.5 };

/** Papers as CSS's background properties, the first over the next; none if none are chosen. */
export function paperBackground(styles: (PaperStyle | undefined)[], scheme: "light" | "dark") {
  const layers = styles.flatMap((style) => style?.layers(scheme) ?? []);
  if (!layers.length) return undefined;
  return {
    image: layers.map((layer) => layer.image).join(", "),
    size: layers.map((layer) => layer.size).join(", "),
    position: layers.map((layer) => layer.position ?? "0 0").join(", "),
  };
}

const IMAGE_KEY = "lines.backdrop-image";
/** The longest side a backdrop picture is kept at: sharp on a large screen, and small enough to keep. */
const IMAGE_SIZE = 2400;

/** A picture kept as a data: URL, as an address to show it at. */
function urlOf(data: string | null) {
  if (!data) return null;
  const [head, body] = data.split(",");
  const bytes = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: head.slice(5, head.indexOf(";")) }));
}

function storedImage() {
  try {
    return localStorage.getItem(IMAGE_KEY);
  } catch {
    return null;
  }
}

/** Your own picture behind the page, if there is one. */
export const backdrop = $state({ image: urlOf(storedImage()) });

function showImage(data: string | null) {
  if (backdrop.image) URL.revokeObjectURL(backdrop.image);
  backdrop.image = urlOf(data);
}

const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * Makes `file`, a picture, the backdrop: no larger than it needs to be, kept on this device apart from
 * Settings (it's big), and shown in every window. Throws when it isn't a picture or there's no room.
 */
export async function chooseBackdropImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const data = await dataUrl(await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 }));
  localStorage.setItem(IMAGE_KEY, data);
  showImage(data);
  prefs.paperBackdrop = "image";
  void announce({ type: "backdrop-image", image: data });
}

void onAnnounce((message) => message.type === "backdrop-image" && showImage(message.image));

/** A color of your own, as Monochrome and Invert show it; or `fallback` if it isn't a color. */
function ownColor(value: string, fallback: string) {
  const color = parse(value);
  return color ? css(shownColor(color)) : fallback;
}

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
  showBackdrop(root);
  const pattern = plugins.paperStyle(prefs.paperPattern);
  const texture = plugins.paperStyle(prefs.paperTexture);
  const lines = pattern?.perLine ? paperBackground([pattern], "light") : undefined;
  const page = [pattern?.perLine ? undefined : pattern, texture];
  const light = paperBackground(page, "light");
  const dark = paperBackground(page, "dark");
  root.toggleAttribute("data-paper", !!light);
  root.toggleAttribute("data-paper-lines", !!lines);
  if (lines) {
    root.style.setProperty("--paper-lines", lines.image);
    root.style.setProperty("--paper-lines-size", lines.size);
  }
  if (!light || !dark) return;
  // On the root with the images, where their var(--paper-step) is worked out, from the text's size and line height.
  root.style.setProperty("--paper-step", `calc(var(--editor-size) * var(--editor-line-height) * ${PAPER_SPACINGS[prefs.paperSpacing]})`);
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
