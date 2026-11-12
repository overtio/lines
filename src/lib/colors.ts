/*
 * The theme's colors as plain hex, for what draws with colors of its own rather than CSS: Mermaid's
 * diagrams, 3D models, and the color picker, which works on numbers.
 */

let probe: HTMLElement | undefined;
let canvas: CanvasRenderingContext2D | undefined;

/** `css` (any color, `var()` and `color-mix()` included) as a solid hex color, drawn over the note's background. */
export function solid(css: string) {
  if (!probe || !canvas) {
    probe = document.createElement("span");
    probe.hidden = true;
    document.body.append(probe);
    const element = document.createElement("canvas");
    element.width = element.height = 1;
    canvas = element.getContext("2d", { willReadFrequently: true })!;
  }
  const computed = (value: string) => {
    probe!.style.color = value;
    return getComputedStyle(probe!).color;
  };
  canvas.fillStyle = computed("var(--bg)");
  canvas.fillRect(0, 0, 1, 1);
  canvas.fillStyle = computed(css);
  canvas.fillRect(0, 0, 1, 1);
  const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
