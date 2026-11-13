import { describe, expect, test } from "bun:test";
import { stubApp } from "./stubs";

stubApp();
const { familyName, installedFamily, matchingFamilies, tidyFamilies } = await import("../../src/lib/themes/installedFonts");

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
    expect(matchingFamilies(families, " sans")).toEqual(["Sansation", "Fira Sans", "IBM Plex Sans", "Noto Sans Mono", "Transans"]);
    expect(matchingFamilies(families, "MONO")).toEqual(["Noto Sans Mono"]);
    expect(matchingFamilies(families, "")).toEqual(families);
    expect(matchingFamilies(families, "Helvetica")).toEqual([]);
  });
});
