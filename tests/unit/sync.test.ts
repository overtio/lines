import { describe, expect, test } from "bun:test";
import { latexContent, markTitle } from "../../src/plugins/latex/text";
import { devices, languages, notes } from "./sync";

// LaTeX, its title read as the plugin reads it: a document's \title, or its first line of text.
const latexTitle = (body: string) => {
  const { text, title } = latexContent(body);
  return title ?? text.split("\n").find((line) => line.trim()) ?? "";
};
languages.push({ id: "latex", meta: (body) => ({ ...languages[0].meta!(""), title: latexTitle(body) }), markTitle });

/** Edits a note here and, later, on another device, and syncs them: the copy that makes, as it's written. */
async function conflictedCopy(body: string, format?: string) {
  const [here, there] = await devices(2);
  const now = Date.now();
  const id = crypto.randomUUID();
  await notes.insert({ id, body, format, createdAt: now, updatedAt: now, pinned: false, trashed: false });
  await here.sync();
  await there.sync();
  notes.update(id, `${body}\n\nthere`);
  await there.sync();
  await here.open();
  notes.update(id, `${body}\n\nhere`);
  await here.sync();
  return notes.entries.find(({ note }) => note.id !== id)!.note.body;
}

describe("sync", () => {
  test("a conflicted copy of a LaTeX document is titled as one in its \\title, and its preamble is left as it is", async () => {
    const copy = await conflictedCopy("\\documentclass{article}\n\\title{On \\emph{Graphs}}\n\\begin{document}\n\\maketitle\nHello\n\\end{document}", "latex");
    expect(copy.split("\n").slice(0, 2)).toEqual(["\\documentclass{article}", "\\title{On \\emph{Graphs} (conflicted copy)}"]);
  });

  test("a note in another language whose title line can't be marked is left as it is", async () => {
    const body = "\\documentclass{article}\n\\begin{document}\n\\end{document}";
    expect(await conflictedCopy(body, "latex")).toBe(`${body}\n\nthere`);
  });

  test("a Markdown note's is marked on its title", async () => {
    expect(await conflictedCopy("# Plan\n\nA")).toBe("# Plan (conflicted copy)\n\nA\n\nthere");
  });
});
