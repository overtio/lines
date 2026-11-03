import { t } from "../i18n/index.svelte";
import { addTagIn, extractTags } from "../notes/parse";
import { countLines } from "../notes/stats";
import type { NoteLanguage } from "./types";

/*
 * Plain text: how a note shows while the plugin for its language is off (or isn't on this device),
 * just as it was written, so it can still be read and changed. Its tags still count.
 */

const lines = (body: string) =>
  body
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

export const plainTextLanguage: NoteLanguage = {
  id: "text",
  name: t("plugins.plainText"),
  extensions: ["txt"],
  mimeType: "text/plain",
  editor: () => [],
  meta: (body) => {
    const [title = "", ...rest] = lines(body);
    return {
      title,
      excerpt: rest.join(" ").slice(0, 200),
      tags: extractTags(body),
      hasOpenTodos: false,
      searchText: body.toLowerCase(),
      properties: [],
      type: "",
    };
  },
  plainText: (body) => body.trim(),
  stats: (body) => countLines(body.split("\n").map((text) => ({ text, heading: false }))),
  addTag: (body, tag) => addTagIn(body, tag),
  newNote: () => "",
  file: (body) => body,
  print: (body) => {
    const doc = document.createElement("div");
    doc.className = "doc doc-text";
    for (const paragraph of body.trim().split(/\n\s*\n/)) {
      const p = document.createElement("p");
      paragraph.split("\n").forEach((line, i) => p.append(...(i ? [document.createElement("br"), line] : [line])));
      doc.append(p);
    }
    return doc;
  },
};
