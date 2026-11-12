import { describe, expect, mock, test } from "bun:test";
import { stubApp } from "./stubs";
import { readPack } from "../../src/lib/sounds/mechvibes";
import { parseHurl } from "../../src/plugins/http/hurl/parse";
import { parseHttp } from "../../src/plugins/http/parse";
import type { NoteLanguage } from "../../src/lib/plugins/types";

stubApp();
// Printing, which these modules import for the app and don't need here.
mock.module("../../src/lib/print/parts", () => ({ el: () => null }));
const { plainLine } = await import("../../src/lib/notes/stats");
const { code } = await import("../../src/plugins/code");
const { attachmentFileName, referencedAttachments } = await import("../../src/lib/notes/attachments");
const { fileName } = await import("../../src/lib/notes/fileName");
const { latexTags } = await import("../../src/plugins/latex/text");
const { addTagIn } = await import("../../src/lib/notes/parse");

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

  test("only the language's own comments are read: a C #include or 'use strict' is a title as written", () => {
    expect(language("C").meta("#include <stdio.h>\n\nint main(void) {}").title).toBe("#include <stdio.h>");
    expect(language("C++").meta("#pragma once\n\nclass A {};").title).toBe("#pragma once");
    expect(language("JavaScript").meta("'use strict';\n\nconst a = 1;").title).toBe("'use strict';");
    expect(language("Rust").meta("#[derive(Debug)]\nstruct A;").title).toBe("#[derive(Debug)]");
    expect(language("C").meta("/* Parser */\n// #work\nint x;")).toMatchObject({ title: "Parser", tags: ["work"] });
    expect(language("C").addTag("#include <stdio.h>", "work")).toBe("// #work\n#include <stdio.h>");
    expect(language("SPARQL").meta("# People\nSELECT ?name WHERE {}").title).toBe("People");
  });

  test("tags in a language whose comments close", () => {
    expect(language("CSS").addTag("/* Theme */\nbody {}", "web")).toBe("/* Theme */\n/* #web */\nbody {}");
    expect(language("CSS").addTag("/* #a */\nbody {}", "b")).toBe("/* #a #b */\nbody {}");
  });
});

test("a Hurl entry's title is the comment just above it, but not one of only tags", () => {
  // As a note made under a tag starts, and as adding a tag writes one.
  expect(parseHurl("# Sign in\n# #work #api\nPOST https://api.example.com/login\nHTTP 200").requests[0].title).toBe("Sign in");
  expect(parseHurl("# \n# #work\nGET https://api.example.com/").requests[0].title).toBe("");
  expect(parseHurl("# #1 priority\nGET https://api.example.com/").requests[0].title).toBe("#1 priority");
});

test("a LaTeX note's tags are in its comments, not in verbatim or a code listing", () => {
  const note = "Lab 3\n% #systems\n\n\\begin{lstlisting}[language=C]\n#include <stdio.h>\n% #not-a-tag\n\\end{lstlisting}\n\n\\begin{verbatim}\n#pragma once\n\\end{verbatim}\n\nA 100\\% #draft %#todo";
  expect(latexTags(note)).toEqual(["systems", "todo"]);
  // Added as a tag, though the listing has #include.
  expect(addTagIn(note, "include", "%", latexTags(note))).toBe(`${note}\n\n% #include`);
});

test("a Hurl body whose ``` isn't closed yet runs to the end of the note", () => {
  const request = 'POST https://example.com\n```\n{"name": "Ada"}';
  const response = "GET https://example.com\nHTTP 200\n```\nok";
  expect(parseHurl(request).requests[0]).toMatchObject({ body: '{"name": "Ada"}\n', to: request.length });
  expect(parseHurl(response).requests[0]).toMatchObject({ expect: { body: "ok\n" }, to: response.length });
});

test("a request's body ends before the comments after it: a Hurl entry's title, say", () => {
  const hurl = "# Create a user\nPOST https://example.com/users\n<user>ada</user>\n\n# Read it back\nGET https://example.com/users/ada\nHTTP 200";
  const [create, read] = parseHurl(hurl).requests;
  expect(create).toMatchObject({ body: "<user>ada</user>", to: hurl.indexOf("</user>") + "</user>".length });
  expect(read.title).toBe("Read it back");
  expect(parseHurl("POST https://example.com\n<user>ada</user>\n# Moved\nHTTP 302").requests[0]).toMatchObject({ body: "<user>ada</user>", expect: { status: 302 } });
  expect(parseHurl("GET https://example.com\nHTTP 200\n<ok/>\n\n# Then\nGET https://example.com/2").requests[0].expect?.body).toBe("<ok/>");
  const http = "### Create\nPOST https://example.com/users\nContent-Type: text/plain\n\nada\n\n# Try a longer name #todo\n\n### Read\nGET https://example.com/users/ada";
  const { requests, comments } = parseHttp(http);
  expect(requests[0]).toMatchObject({ body: "ada", to: http.indexOf("\nada") + "\nada".length });
  expect(comments).toEqual(["Try a longer name #todo"]);
});

test("a Hurl replace filter puts in its text as it's written, $ and all", async () => {
  const { check } = await import("../../src/plugins/http/hurl/check");
  const hurl = 'GET https://example.com\nHTTP 200\n[Captures]\nprice: body replace "{price}" "$&5"';
  const answer = { status: 200, url: "https://example.com", headers: [], text: "{price}", bytes: new Uint8Array(), type: "text/plain", time: 0 };
  const captured = new Map<string, unknown>();
  await check(parseHurl(hurl).requests[0].expect!, { answer, variable: () => undefined, fill: (text) => text, say: (key) => key }, captured);
  expect(captured.get("price")).toBe("$&5");
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

describe("attachments", () => {
  // Those a note doesn't use are deleted at launch, and left out of sync and exports.
  test("a note uses each one it mentions, however the link is written", () => {
    const [a, b, c, d, e, f] = ["a", "b", "c", "d", "e", "f"].map((digit) => `${digit.repeat(32)}.png`);
    const body = [
      `![](../attachments/${a})`,
      `![Lake](../attachments/${b} "Sunrise")`,
      `[Report]( ../attachments/${c} )`,
      `![Sky](<../attachments/${d}>)`,
      `[sky]: ../attachments/${e}`,
      `\\includegraphics[width=4cm]{../attachments/${f}}`,
    ].join("\n\n");
    expect([...referencedAttachments([body])].sort()).toEqual([a, b, c, d, e, f]);
    expect(referencedAttachments(["![](../attachments/sky.png) ![](attachments/" + a + ")"]).size).toBe(0);
  });
});

describe("file names", () => {
  test("safe on every system, and short enough for any", () => {
    expect(fileName("Trip: Rome/Paris?")).toBe("Trip - Rome-Paris");
    expect(fileName("  ...  ", "Untitled")).toBe("Untitled");
    expect([fileName("con"), fileName("Nul.backup"), fileName("COM1"), fileName("Console")]).toEqual(["_con", "_Nul.backup", "_COM1", "Console"]);
    const long = fileName("日本語".repeat(40));
    expect(new TextEncoder().encode(long).length).toBeLessThanOrEqual(200);
    expect(long.endsWith("語")).toBe(true);
  });

  test("an attachment is opened under what the note calls it, without its width", () => {
    const name = `${"a".repeat(32)}.png`;
    expect(attachmentFileName(name, "Lake at dawn|400")).toBe("Lake at dawn.png");
    expect(attachmentFileName(name, "Sky.PNG")).toBe("Sky.PNG");
    expect(attachmentFileName(name, "")).toBe(name);
  });
});
