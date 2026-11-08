/*
 * The OFF format (Object File Format): what OpenSCAD writes a model as for lines to show, and a file
 * that can be attached. A face's line can end in its color, which OpenSCAD writes for every face once
 * any part of a model has one.
 */

/** OpenSCAD's own colors, for faces that weren't given one and those `difference()` cut: they're drawn in the theme's. */
const OPENSCAD_DEFAULTS = new Set(["249,215,44", "157,203,81"]);

/** Triangles, as three numbers a corner and three corners a triangle. */
export interface Triangles {
  /** Faces without a color of their own, drawn in the theme's. */
  plain: Float32Array;
  /** Faces with one, and each corner's red, green and blue, from 0 to 255. */
  colored: { positions: Float32Array; colors: Uint8Array };
}

/** An OFF file's faces, as triangles. Throws on one that isn't OFF. */
export function readOff(text: string): Triangles {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean);
  // The header can share its line with the counts.
  const head = lines[0]?.split(/\s+/) ?? [];
  if (!/^[CN]*OFF$/.test(head[0] ?? "")) throw new Error("Not an OFF file");
  let at = head.length > 1 ? 0 : 1;
  const [vertexCount, faceCount] = (head.length > 1 ? head.slice(1) : (lines[at] ?? "").split(/\s+/)).map(Number);
  at++;
  if (!Number.isInteger(vertexCount) || !Number.isInteger(faceCount)) throw new Error("Not an OFF file");
  const vertices = lines.slice(at, (at += vertexCount)).map((line) => line.split(/\s+/, 3).map(Number));
  const plain: number[] = [];
  const positions: number[] = [];
  const colors: number[] = [];
  for (const line of lines.slice(at, at + faceCount)) {
    const words = line.split(/\s+/);
    const sides = Number(words[0]);
    const corners = words.slice(1, sides + 1).map(Number);
    // What follows is its color, as 0–255, or as 0–1 written with decimals.
    const color = words.slice(sides + 1, sides + 4);
    const scale = color.some((c) => c.includes(".")) ? 255 : 1;
    const rgb = color.length === 3 ? color.map((c) => Math.round(Number(c) * scale)) : null;
    const own = rgb && !OPENSCAD_DEFAULTS.has(rgb.join()) ? rgb : null;
    // A face with more than three corners, as a fan of triangles.
    for (let i = 1; i < sides - 1; i++) {
      for (const corner of [corners[0], corners[i], corners[i + 1]]) {
        const vertex = vertices[corner];
        if (!vertex) throw new Error("Not an OFF file");
        if (!own) plain.push(...vertex);
        else {
          positions.push(...vertex);
          colors.push(...own);
        }
      }
    }
  }
  return { plain: new Float32Array(plain), colored: { positions: new Float32Array(positions), colors: new Uint8Array(colors) } };
}
