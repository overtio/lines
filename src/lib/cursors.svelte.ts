import { plugins } from "./plugins/registry.svelte";
import { prefs } from "./prefs.svelte";
import { ownColor } from "./themes/show.svelte";

/*
 * Cursors (Settings → Cursor). The text cursor's look as the page's attributes and --caret-color,
 * which editor.css and editor/cursor.ts draw it by. The pointer as images of its own (app.css):
 * pixel art, as screens of the 90s drew it, or a dot in the accent; and what follows it about, a
 * comet's tail or sparkles, drawn on a canvas over the window only while something's moving, and
 * not at all with reduced motion.
 */

const root = document.documentElement;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

function showCaret() {
  const { caretShape, caretWidth, caretColor, caretCustomColor, caretBlink, caretMotion, caretEffect } = prefs;
  Object.assign(root.dataset, { caretShape, caretWidth, caretBlink, caretMotion, caretEffect });
  root.style.setProperty("--caret-color", caretColor === "custom" ? ownColor(caretCustomColor, "var(--accent)") : caretColor === "text" ? "var(--text)" : "var(--accent)");
}

/**
 * Pixel art, a row a line: `#` the outline, `o` the fill, `.` see-through. An arrow as 90s screens
 * had it, its point the hot spot, and a hand pointing at a link.
 */
const ARROW = ["#...........", "##..........", "#o#.........", "#oo#........", "#ooo#.......", "#oooo#......", "#ooooo#.....", "#oooooo#....", "#ooooooo#...", "#oooooooo#..", "#ooooooooo#.", "#oooooo#####", "#ooo#oo#....", "#oo#.#oo#...", "#o#..#oo#...", "##....#oo#..", "#.....#oo#..", ".......#oo#.", ".......###.."];
const HAND = [".....##.........", "....#oo#........", "....#oo#........", "....#oo#........", "....#oo###......", "....#oo#oo###...", "....#oo#oo#oo##.", ".##.#oo#oo#oo#o#", "#oo##oooooooo#o#", "#ooo#ooooooooo#.", ".#oo#ooooooooo#.", "..#o#ooooooooo#.", "..#oooooooooo#..", "...#ooooooooo#..", "...#oooooooo#...", "....#ooooooo#...", "....#ooooooo#...", "....#########..."];

const svg = (width: number, height: number, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" shape-rendering="crispEdges">${body}</svg>`)}")`;

function pixels(rows: string[], outline: string, fill: string) {
  const runs = rows.flatMap((row, y) => [...row].flatMap((cell, x) => (cell === "." ? [] : [`<rect x="${x}" y="${y}" width="1" height="1" fill="${cell === "#" ? outline : fill}"/>`])));
  return svg(rows[0].length, rows.length, runs.join(""));
}

/** The pointer's images, as the `cursor` property takes them (with their hot spots), in the accent shown now. */
function pointerImages(style: string, accent: string) {
  if (style === "retro") return { arrow: `${pixels(ARROW, "#000", "#fff")} 0 0`, hand: `${pixels(HAND, "#000", "#fff")} 6 1` };
  const dot = svg(14, 14, `<circle cx="7" cy="7" r="5" fill="${accent}" stroke="#fff" stroke-width="1.5"/>`);
  const ring = svg(24, 24, `<circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="4"/><circle cx="12" cy="12" r="9" fill="none" stroke="${accent}" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="${accent}"/>`);
  return { arrow: `${dot} 7 7`, hand: `${ring} 12 12` };
}

/** The accent as the page shows it now (a theme's, through Monochrome and Invert), for what's drawn here. */
let accent = "";

function showPointer() {
  // Read after the theme's colors are set, which this effect follows: your own theme's as you change
  // them, and Increased contrast's as the system's setting changes too.
  void plugins.theme(prefs.windowLook.theme);
  void prefs.windowLook;
  void prefs.monochrome;
  void prefs.invert;
  void prefs.moreContrast;
  accent = getComputedStyle(root).getPropertyValue("--accent").trim() || "#0e7a7e";
  if (prefs.pointerStyle === "system") {
    delete root.dataset.pointer;
    return;
  }
  const { arrow, hand } = pointerImages(prefs.pointerStyle, accent);
  root.dataset.pointer = prefs.pointerStyle;
  root.style.setProperty("--pointer-arrow", arrow);
  root.style.setProperty("--pointer-hand", hand);
}

/** A point of the comet's tail, or a sparkle: where, which way it drifts, when it was made, and its hue. */
interface Mote {
  x: number;
  y: number;
  dx: number;
  dy: number;
  born: number;
  hue: number;
}

const LIFE = { comet: 220, sparkles: 650 };

let canvas: HTMLCanvasElement | undefined;
let motes: Mote[] = [];
let frame = 0;
let lastMove = 0;

function draw(now: number) {
  const context = canvas!.getContext("2d")!;
  const scale = devicePixelRatio;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, innerWidth, innerHeight);
  const trail = prefs.pointerTrail === "sparkles" ? "sparkles" : "comet";
  motes = motes.filter((mote) => now - mote.born < LIFE[trail]);
  for (const mote of motes) {
    const life = (now - mote.born) / LIFE[trail];
    context.globalAlpha = 1 - life;
    if (trail === "comet") {
      context.fillStyle = accent;
      context.beginPath();
      context.arc(mote.x, mote.y, 5 * (1 - life) + 0.5, 0, Math.PI * 2);
      context.fill();
    } else {
      // A four-pointed star, drifting and falling.
      const t = (now - mote.born) / 1000;
      const x = mote.x + mote.dx * t;
      const y = mote.y + mote.dy * t + 60 * t * t;
      const size = 4 * (1 - life) + 1;
      context.fillStyle = `oklch(0.82 0.16 ${mote.hue})`;
      context.beginPath();
      context.moveTo(x, y - size * 1.8);
      context.lineTo(x + size * 0.45, y - size * 0.45);
      context.lineTo(x + size * 1.8, y);
      context.lineTo(x + size * 0.45, y + size * 0.45);
      context.lineTo(x, y + size * 1.8);
      context.lineTo(x - size * 0.45, y + size * 0.45);
      context.lineTo(x - size * 1.8, y);
      context.lineTo(x - size * 0.45, y - size * 0.45);
      context.fill();
    }
  }
  context.globalAlpha = 1;
  // Only while something's still there: an idle window draws nothing.
  frame = motes.length ? requestAnimationFrame(draw) : 0;
}

function size() {
  if (!canvas) return;
  canvas.width = Math.round(innerWidth * devicePixelRatio);
  canvas.height = Math.round(innerHeight * devicePixelRatio);
}

function moved(event: PointerEvent) {
  if (event.pointerType !== "mouse" || reducedMotion.matches) return;
  const now = performance.now();
  if (prefs.pointerTrail === "comet") motes.push({ x: event.clientX, y: event.clientY, dx: 0, dy: 0, born: now, hue: 0 });
  else if (now - lastMove > 28) {
    // A sparkle every so often, not at every move, so a quick sweep leaves a scatter.
    const angle = Math.random() * Math.PI * 2;
    motes.push({ x: event.clientX + 6, y: event.clientY + 10, dx: Math.cos(angle) * 30, dy: Math.sin(angle) * 30 - 20, born: now, hue: Math.random() * 360 });
    lastMove = now;
  }
  if (motes.length > 120) motes = motes.slice(-120);
  if (!frame) frame = requestAnimationFrame(draw);
}

function showTrail() {
  if (prefs.pointerTrail === "none") return;
  canvas = document.createElement("canvas");
  canvas.className = "pointer-trail";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  size();
  addEventListener("resize", size);
  addEventListener("pointermove", moved, { passive: true });
  return () => {
    removeEventListener("resize", size);
    removeEventListener("pointermove", moved);
    cancelAnimationFrame(frame);
    frame = 0;
    motes = [];
    canvas?.remove();
    canvas = undefined;
  };
}

showCaret();
$effect.root(() => {
  $effect(showCaret);
  $effect(showPointer);
  $effect(showTrail);
});
