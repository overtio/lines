import { describe, expect, test } from "bun:test";
import { stubApp } from "./stubs";

stubApp();
const { familyName, installedFamily, matching, tidyFamilies } = await import("../../src/lib/themes/installedFonts");
const { formattingFamily, readFormattingFonts, sameFormattingFonts } = await import("../../src/lib/themes/formattingFonts");

describe("fonts installed on this device", () => {
  test("a family kept in settings is read back as it was; settings from before, or anything that isn't one, have none", () => {
    expect(familyName("Avenir Next")).toBe("Avenir Next");
    expect(familyName("  Iowan Old Style ")).toBe("Iowan Old Style");
    for (const value of [undefined, null, 12, {}, "", "Evil; color: red", 'Quote"d', "Back\\slash", "<style>", "Two\nlines", "x".repeat(101)]) {
      expect(familyName(value)).toBe("");
    }
  });

  test("notes fall back on the system's font (or a style's) where the family isn't installed", () => {
    expect(installedFamily("Avenir Next")).toBe('"Avenir Next", var(--font-system)');
    expect(installedFamily("Avenir Next", "Tahoma, sans-serif")).toBe('"Avenir Next", Tahoma, sans-serif');
  });

  test("the system's list: once each whatever the case, in alphabetical order, without hidden families or names that can't be kept", () => {
    expect(tidyFamilies(["Zapfino", ".SF NS", "avenir", "Avenir", " Menlo ", "", "Arial", "Font 10", "Font 9", "Bad;Name"])).toEqual(["Arial", "avenir", "Font 9", "Font 10", "Menlo", "Zapfino"]);
  });

  test("found by what's typed: names starting with it first, then a word in them, then anywhere in them", () => {
    const families = ["Arial", "Fira Sans", "IBM Plex Sans", "Noto Sans Mono", "Sansation", "Transans"];
    expect(matching(families, " sans")).toEqual(["Sansation", "Fira Sans", "IBM Plex Sans", "Noto Sans Mono", "Transans"]);
    expect(matching(families, "MONO")).toEqual(["Noto Sans Mono"]);
    expect(matching(families, "")).toEqual(families);
    expect(matching(families, "Helvetica")).toEqual([]);
    expect(matching([{ name: "Serif" }, { name: "Mono" }], "mo", (font) => font.name)).toEqual([{ name: "Mono" }]);
  });
});

describe("formatting's fonts", () => {
  test("read back as kept; settings from before have none, and formatting lines doesn't have, or what isn't a font, is left out", () => {
    expect(readFormattingFonts(undefined)).toEqual({});
    expect(readFormattingFonts({ headings: { font: "serif" }, bold: { installed: "Avenir Next" }, "code-block": { installed: " Menlo " } })).toEqual({
      headings: { font: "serif" },
      bold: { installed: "Avenir Next" },
      "code-block": { installed: "Menlo" },
    });
    expect(readFormattingFonts({ bullet: { font: "serif" }, italic: { font: "Not An Id" }, quote: { installed: "x; color: red" }, link: "serif", code: null })).toEqual({});
  });

  test("the same fonts are the same whatever order they were chosen in", () => {
    expect(sameFormattingFonts({ bold: { font: "serif" }, code: { installed: "Menlo" } }, { code: { installed: "Menlo" }, bold: { font: "serif" } })).toBe(true);
    expect(sameFormattingFonts({ bold: { font: "serif" } }, { bold: { installed: "serif" } })).toBe(false);
    expect(sameFormattingFonts({ bold: { font: "serif" } }, {})).toBe(false);
  });

  test("drawn in lines' font by its id, or an installed one, falling back on the text's font (code's for code); a font whose plugin is off is as none", () => {
    const fonts = [{ id: "serif", family: "var(--font-serif)" }];
    expect(formattingFamily("bold", { font: "serif" }, fonts)).toBe("var(--font-serif)");
    expect(formattingFamily("bold", { installed: "Avenir Next" }, fonts)).toBe('"Avenir Next", var(--font-text)');
    expect(formattingFamily("code-block", { installed: "Iosevka" }, fonts)).toBe('"Iosevka", var(--font-mono)');
    expect(formattingFamily("headings", { font: "agave" }, fonts)).toBeUndefined();
  });
});
