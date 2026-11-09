import type { Mascot, MascotPose } from "../plugins/types";

/*
 * A mascot's poses drawn from its pixel art, once each: in its palette, with the theme's accent for
 * its `accent` colors, eyes open or shut, facing right or left. Drawn a pixel to a pixel, and shown
 * scaled up without smoothing, as pixel art is.
 */

const cache = new Map<string, HTMLCanvasElement>();

/** The rows of `pose`, and whether its eyes are shut. */
function rowsOf(mascot: Mascot, pose: MascotPose): [string[], boolean] {
  const frame = mascot.frames[pose];
  if (Array.isArray(frame)) return [frame, false];
  const like = mascot.frames[frame.like];
  return [Array.isArray(like) ? like : [], frame.closed];
}

/** `pose` as a canvas the size of its art: `blink` shuts its eyes, `left` turns it round. */
export function frame(mascot: Mascot, pose: MascotPose, { blink = false, left = false, accent = "#0e7a7e", accentDark = "#09585b" } = {}) {
  const key = [mascot.id, pose, blink, left, accent, accentDark].join(" ");
  const found = cache.get(key);
  if (found) return found;
  const [rows, closed] = rowsOf(mascot, pose);
  const shut = blink || closed;
  const width = rows[0]?.length ?? 0;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = rows.length;
  const context = canvas.getContext("2d")!;
  const color = (key: string) => {
    const value = mascot.palette[key];
    return value === "accent" ? accent : value === "accent-dark" ? accentDark : value;
  };
  const eye = (cell: string | undefined) => cell === "e" || cell === "i";
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === ".") return;
      // A blink leaves each eye's lowest row as a line, and the rest the lid's color.
      const shown = shut && eye(cell) ? (eye(rows[y + 1]?.[x]) ? mascot.lid : "e") : cell;
      const fill = color(shown);
      if (!fill) return;
      context.fillStyle = fill;
      context.fillRect(left ? width - 1 - x : x, y, 1, 1);
    });
  });
  if (cache.size > 200) cache.clear();
  cache.set(key, canvas);
  return canvas;
}

/** How big a mascot's art is, in its pixels. */
export function sizeOf(mascot: Mascot) {
  const [rows] = rowsOf(mascot, "stand");
  return { width: rows[0]?.length ?? 16, height: rows.length };
}
