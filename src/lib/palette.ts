/*
 * The colors things can be given: a tag or type (its icon), an event, a mark in the margin. Each is
 * kept by its name, and the theme says what it looks like (`--palette-red`…, app.css), so a theme
 * changed, or light changed to dark, changes them all, each readable on its backgrounds.
 */

export const PALETTE = ["accent", "red", "orange", "yellow", "green", "blue", "purple", "gray"] as const;
export type PaletteColor = (typeof PALETTE)[number];

export const isPaletteColor = (value: unknown): value is PaletteColor => PALETTE.includes(value as PaletteColor);

/** The color as CSS, as the theme has it. */
export const paletteVar = (color: PaletteColor) => (color === "accent" ? "var(--accent)" : `var(--palette-${color})`);
