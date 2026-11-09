import { describe, expect, mock, test } from "bun:test";
import { stubApp } from "./stubs";
import { readPack } from "../../src/lib/sounds/mechvibes";
import { parseHurl } from "../../src/plugins/http/hurl/parse";
import type { NoteLanguage } from "../../src/lib/plugins/types";

stubApp();
// Printing, which these modules import for the app and don't need here.
mock.module("../../src/lib/print/parts", () => ({ el: () => null }));
const { plainLine } = await import("../../src/lib/notes/stats");
const { code } = await import("../../src/plugins/code");

const languages = code().contributes.languages as NoteLanguage[];
const language = (name: string) => languages.find((each) => each.name === name)!;

describe("code notes", () => {
  test("download as their language's usual file", () => {
    expect(language("Python").extensions[0]).toBe("py");
    expect(language("TypeScript").extensions[0]).toBe("ts");
    expect(language("SystemVerilog").extensions[0]).toBe("sv");
  });

  test("Markdown and LaTeX are formats of their own, not code", () => {
    expect(languages.some((each) => each.name === "Markdown" || each.name === "LaTeX")).toBe(false);
  });

  test("a tag goes in the comment of tags at the top, or below the title, never renaming the note", () => {
    const python = language("Python");
    const note = "# Code notes\n# #tour\n\nprint('hi')";
    const tagged = python.addTag(note, "python");
    expect(tagged).toBe("# Code notes\n# #tour #python\n\nprint('hi')");
    expect(python.meta(tagged).title).toBe("Code notes");
    expect([...python.meta(tagged).tags].sort()).toEqual(["python", "tour"]);
    expect(python.addTag("# Report\nx = 1", "work")).toBe("# Report\n# #work\nx = 1");
    expect(python.meta(python.addTag("x = 1", "work")).title).toBe("x = 1");
  });

  test("a script's #! line stays first", () => {
    const tagged = language("Shell").addTag("#!/bin/sh\necho hi", "ops");
    expect(tagged.split("\n")[0]).toBe("#!/bin/sh");
    expect(language("Shell").meta(tagged).title).toBe("echo hi");
  });

  test("tags in a language whose comments close", () => {
    expect(language("CSS").addTag("/* Theme */\nbody {}", "web")).toBe("/* Theme */\n/* #web */\nbody {}");
    expect(language("CSS").addTag("/* #a */\nbody {}", "b")).toBe("/* #a #b */\nbody {}");
  });
});

test("a Hurl body whose ``` isn't closed yet runs to the end of the note", () => {
  const request = 'POST https://example.com\n```\n{"name": "Ada"}';
  const response = "GET https://example.com\nHTTP 200\n```\nok";
  expect(parseHurl(request).requests[0]).toMatchObject({ body: '{"name": "Ada"}\n', to: request.length });
  expect(parseHurl(response).requests[0]).toMatchObject({ expect: { body: "ok\n" }, to: response.length });
});

test("a line's comments, a line mark among them, aren't part of its text", () => {
  expect(plainLine("# Plan <!-- mark green: due -->")).toBe("Plan");
  expect(plainLine("Before <!-- note --> after")).toBe("Before after");
});

test("a pack's empty or backwards sound timings are left out", () => {
  const bytes = (text: string) => new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;
  const files = new Map([
    ["config.json", bytes(JSON.stringify({ audio_file: "a.ogg", definitions: { KeyA: { timing: [[50, 20]] }, KeyB: { timing: [[-5, 20]] }, KeyC: { timing: [[0, 30]] } } }))],
    ["a.ogg", bytes("OggS")],
  ]);
  expect(Object.keys(readPack(files, "x").keys)).toEqual(["KeyC"]);
  const v1 = new Map([["config.json", bytes(JSON.stringify({ sound: "a.ogg", defines: { "30": [10, 0], "31": [10, 5] } }))], ["a.ogg", bytes("OggS")]]);
  expect(Object.keys(readPack(v1, "x").keys)).toEqual(["KeyS"]);
});
