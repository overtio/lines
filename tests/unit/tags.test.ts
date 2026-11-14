import { expect, mock, test } from "bun:test";
import { stubApp } from "./stubs";
import { parseHurl } from "../../src/plugins/http/hurl/parse";
import type { NoteLanguage } from "../../src/lib/plugins/types";

stubApp();
// Printing, which the code plugin imports for the app and doesn't need here.
mock.module("../../src/lib/print/parts", () => ({ el: () => null }));
const { cleanTagInput, extractTags, renameTagIn } = await import("../../src/lib/notes/parse");
const { mentionOf, readMention } = await import("../../src/lib/notes/properties");
const { code } = await import("../../src/plugins/code");

test("a tag in a script with combining marks is read whole, the same tag however its marks are typed", () => {
  expect(extractTags("#हिंदी notes #ภาษาไทย")).toEqual(["हिंदी", "ภาษาไทย"]);
  expect(extractTags(`${"#tiếng_việt".normalize("NFD")} #tiếng_việt`)).toEqual(["tiếng_việt"]);
  expect(extractTags("#İstanbul #istanbul")).toEqual(["istanbul"]);
  expect(cleanTagInput("हिंदी नोट्स")).toBe("हिंदी-नोट्स");
});

test("a # at the start of a heading's text, ## being typed there, isn't a tag; one later in it, or on a line of its own, is", () => {
  expect(extractTags("# #Boo\n\n## Plan #work\n#home\n  # #not")).toEqual(["home", "work"]);
  expect(renameTagIn("# #work\n#work", "work", "job")).toBe("# #work\n#job");
});

test("a # in code or an HTML comment isn't a tag: a span of two backticks, indented code; in a list an indent is its item's", () => {
  expect(extractTags("``a #incode`` and `#one` #real")).toEqual(["real"]);
  expect(extractTags("    #indented\n\nText\n\n\t#tabbed\n\n#real")).toEqual(["real"]);
  expect(extractTags("<!-- #commented -->\nText <!-- mark: #also -->\n#real")).toEqual(["real"]);
  expect(extractTags("Text\n    #continued\n\n- Item\n\n    #initem")).toEqual(["continued", "initem"]);
  expect(renameTagIn("``#work`` #work\n\n    #work\n\n<!-- #work -->", "work", "job")).toBe("``#work`` #job\n\n    #work\n\n<!-- #work -->");
});

test("renaming one keeps how the rest of a nested tag was written", () => {
  expect(renameTagIn("#İstanbul/Food and #Work/Meetings", "istanbul", "travel")).toBe("#travel/Food and #Work/Meetings");
  expect(renameTagIn("#हिंदी/नोट्स", "हिंदी", "hindi")).toBe("#hindi/नोट्स");
  expect(renameTagIn("#Work/Meetings #work//x", "work", "job")).toBe("#job/Meetings #job/x");
});

test("a comment of such tags is a comment of tags, not a title", () => {
  const python = (code().contributes.languages as NoteLanguage[]).find((language) => language.name === "Python")!;
  expect(python.meta("# Plan\n# #हिंदी\nx = 1")).toMatchObject({ title: "Plan", tags: ["हिंदी"] });
  expect(parseHurl("# Sign in\n# #हिंदी\nGET https://example.com").requests[0].title).toBe("Sign in");
});

test("a bare mention of a name with combining marks is read whole", () => {
  expect(readMention("@हिंदी.लेखक")).toEqual({ name: "हिंदी", key: "लेखक" });
  expect(mentionOf("हिंदी")).toBe("@हिंदी");
});

test("a wiki link in a table, its bar escaped as a table needs it, reads as one outside it", () => {
  expect(readMention("[[Ada Lovelace\\|Ada]]")).toEqual(readMention("[[Ada Lovelace|Ada]]"));
  expect(readMention("[[Ada Lovelace\\|Ada]]")).toEqual({ name: "Ada Lovelace", shown: "Ada" });
});
