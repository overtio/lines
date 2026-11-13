import { familyName, installedFamily } from "./installedFonts";

/*
 * The formatting a font of its own can be chosen for (Settings → Typography → Fonts for formatting),
 * as its colors are (formatting.ts), each by its custom property (`--font-<part>`: editor.css,
 * print.css). Headings take one for every level, and lists one for their numbers (bullets are
 * drawn, not written). Unset, each is in the text's font, and code in the code font.
 */
export const FORMATTING_FONTS = ["headings", "bold", "italic", "underline", "strike", "highlight", "link", "mention", "quote", "number", "code", "code-block"] as const;
export type FormattingFont = (typeof FORMATTING_FONTS)[number];

/** Code is in the code font until another is chosen. */
export const isCode = (part: FormattingFont) => part === "code" || part === "code-block";

/** A font chosen: one of lines' (FONTS, or a plugin's) by id, or one installed on this device by its family name. */
export type FontChoice = { font: string } | { installed: string };
export type FormattingFonts = Partial<Record<FormattingFont, FontChoice>>;

/** A font chosen as settings keep it, checked; null for none, or for what can't be one. */
export function fontChoice(value: unknown): FontChoice | null {
  if (!value || typeof value !== "object") return null;
  const { font, installed } = value as Record<string, unknown>;
  if (typeof font === "string" && /^[a-z0-9][a-z0-9-]*$/.test(font)) return { font };
  const family = familyName(installed);
  return family ? { installed: family } : null;
}

/** Formatting's fonts as settings keep them, each checked; formatting lines doesn't have, and what isn't a font, left out. */
export function readFormattingFonts(raw: unknown): FormattingFonts {
  const stored = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(
    FORMATTING_FONTS.flatMap((part) => {
      const choice = fontChoice(stored[part]);
      return choice ? [[part, choice]] : [];
    }),
  );
}

/** Whether two settings give each formatting the same font, in whatever order they were chosen. */
export const sameFormattingFonts = (a: FormattingFonts, b: FormattingFonts) => FORMATTING_FONTS.every((part) => JSON.stringify(a[part]) === JSON.stringify(b[part]));

/**
 * The CSS font-family `part` is in for `choice`, of lines' `fonts`: an installed family, then the
 * text's font (code's for code) for what it hasn't letters for; none for a font whose plugin is
 * off, which leaves it as unset.
 */
export function formattingFamily(part: FormattingFont, choice: FontChoice, fonts: readonly { id: string; family: string }[]) {
  if ("installed" in choice) return installedFamily(choice.installed, isCode(part) ? "var(--font-mono)" : "var(--font-text)");
  return fonts.find((font) => font.id === choice.font)?.family;
}
