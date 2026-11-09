import { describe, expect, test } from "bun:test";
import { latexContent, markTitle } from "../../src/plugins/latex/text";
import { beforeWrite, devices, drive, editElsewhere, fileOf, languages, notes, serialize } from "./sync";

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

/** The notes on the device that's open, by their text. */
const bodies = () => notes.entries.map((entry) => entry.note.body).sort();

describe("sync, as another device writes the same note", () => {
  test("an edit another device saves while this one syncs isn't written over, but kept with a conflicted copy", async () => {
    const [here, there] = await devices(2);
    const id = notes.add("# Shopping\n\nmilk");
    await here.sync();
    notes.update(id, "# Shopping\n\nmilk\neggs");
    // Saved by another device after this one listed the folder, before it wrote the note.
    beforeWrite.next = () => editElsewhere(id, { body: "# Shopping\n\nmilk\nbread" });
    await here.sync();
    expect(drive.get(fileOf(id))!.text).toContain("bread");
    // The next pass brings it in and keeps this edit as a copy, which the one after uploads.
    await here.sync();
    await here.sync();
    const both = ["# Shopping\n\nmilk\nbread", "# Shopping (conflicted copy)\n\nmilk\neggs"];
    expect(bodies()).toEqual(both);
    await there.sync();
    expect(bodies()).toEqual(both);
  });

  test("nor is a file the drive brings in under a new note's name", async () => {
    const [here] = await devices(1);
    const id = notes.add("# Plan\n\nhere");
    beforeWrite.next = (path) => drive.set(path, { text: serialize({ ...notes.get(id)!.note, body: "# Plan\n\nthere" }), etag: "elsewhere" });
    await here.sync();
    await here.sync();
    expect(bodies()).toEqual(["# Plan\n\nhere", "# Plan (conflicted copy)\n\nthere"]);
  });
});
