import { beforeAll, describe, expect, test } from "bun:test";
import { latexContent, markTitle } from "../../src/plugins/latex/text";
import { beforeWrite, devices, drive, editElsewhere, FOLDER, fileOf, languages, notes, serialize, sync } from "./sync";
// After ./sync, which sets up the page it runs in.
const { looks, tagLooks, typeLooks } = await import("../../src/lib/notes/looks.svelte");

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

describe("importing a note's file from a sync folder", () => {
  test("brings the note back as it was, and never in place of one that's here", async () => {
    const [here, there] = await devices(2);
    const id = notes.add("# Trip\n\nRome");
    notes.togglePin(id);
    notes.setIcon(id, "archive");
    await here.sync();
    const { createdAt, updatedAt } = notes.get(id)!.note;
    const file = () => new File([drive.get(fileOf(id))!.text], `${id}.md`);
    await there.open();
    await notes.importFiles([file()]);
    expect(notes.entries.map(({ note }) => note)).toEqual([{ id, body: "# Trip\n\nRome", createdAt, updatedAt, pinned: true, trashed: false, icon: "archive" }]);
    await notes.importFiles([file()]);
    expect(notes.entries.map(({ note }) => note.body)).toEqual(["# Trip\n\nRome", "# Trip\n\nRome"]);
    expect(notes.entries[0].note.id).not.toBe(id);
  });

  test("a locked note's comes in locked, not as its encrypted text", async () => {
    const { noteKeys } = await import("../../src/lib/notes/noteKeys.svelte");
    const { key } = await noteKeys.create("correct horse");
    noteKeys.save({ key, touchId: false });
    const [here, there] = await devices(2);
    const id = notes.add("# Bank\n\nPIN 1234");
    await notes.lock(id);
    await here.sync();
    const file = new File([drive.get(fileOf(id))!.text], `${id}.md`);
    await there.open();
    await notes.importFiles([file]);
    expect(notes.get(id)!.note.locked?.sealed).toBeTruthy();
    expect(notes.get(id)!.meta.title).toBe("Bank");
  });
});

const { noteKeys } = await import("../../src/lib/notes/noteKeys.svelte");

/** The notes on the device that's open: their text, and how they're kept. */
const listed = () => notes.entries.map(({ note }) => ({ body: note.body, pinned: note.pinned, trashed: note.trashed, icon: note.icon, color: note.color, locked: !!note.locked }));

describe("sync, of a note changed on two devices", () => {
  test("a note edited on two devices keeps the newer edit, and the other as a conflicted copy", async () => {
    const [here, there] = await devices(2);
    const id = notes.add("# Trip\n\nRome");
    await here.sync();
    await there.sync();
    notes.update(id, "# Trip\n\nRome\nVenice");
    await there.sync();
    await here.open();
    notes.update(id, "# Trip\n\nRome\nFlorence");
    await here.sync();
    expect(listed().map((note) => note.body)).toEqual(["# Trip (conflicted copy)\n\nRome\nVenice", "# Trip\n\nRome\nFlorence"]);
  });

  test("pinning a note, or giving it an icon and a color, while it's edited on another device keeps both, without a conflicted copy", async () => {
    const [here, there] = await devices(2);
    const id = notes.add("# Groceries\n\nmilk");
    await here.sync();
    await there.sync();
    notes.update(id, "# Groceries\n\nmilk\neggs");
    await there.sync();
    await here.open();
    notes.togglePin(id);
    notes.setIcon(id, "archive");
    notes.setColor(id, "orange");
    await here.sync();
    const merged: ReturnType<typeof listed> = [{ body: "# Groceries\n\nmilk\neggs", pinned: true, trashed: false, icon: "archive", color: "orange", locked: false }];
    expect(listed()).toEqual(merged);
    await there.sync();
    expect(listed()).toEqual(merged);
  });

  test("filing a note out of the Inbox while it's edited on another device keeps both, and the file says so only while it's in", async () => {
    const [here, there] = await devices(2);
    const id = notes.add("# Idea\n\none");
    notes.setInbox([id], true);
    await here.sync();
    expect(drive.get(fileOf(id))!.text).toContain("\ninbox: true\n");
    await there.sync();
    expect(notes.get(id)!.note.inbox).toBe(true);
    notes.update(id, "# Idea\n\none\ntwo");
    await there.sync();
    await here.open();
    notes.setInbox([id], false);
    await here.sync();
    expect(notes.get(id)!.note).toMatchObject({ body: "# Idea\n\none\ntwo", inbox: false });
    expect(drive.get(fileOf(id))!.text).not.toContain("inbox:");
    await there.sync();
    expect(notes.get(id)!.note.inbox).toBeFalsy();
  });

  test("a note moved to the trash while it's edited elsewhere goes there with the edit", async () => {
    const [here, there] = await devices(2);
    const id = notes.add("# Draft\n\none");
    await here.sync();
    await there.sync();
    notes.trash(id);
    await there.sync();
    await here.open();
    notes.update(id, "# Draft\n\none\ntwo");
    await here.sync();
    expect(listed()).toEqual([{ body: "# Draft\n\none\ntwo", pinned: false, trashed: true, icon: undefined, color: undefined, locked: false }]);
  });

  describe("locked on one device while edited on another", () => {
    beforeAll(async () => {
      const { key } = await noteKeys.create("correct horse");
      noteKeys.save({ key, touchId: false });
    });

    test("stays locked, with the edit", async () => {
      const [here, there] = await devices(2);
      const id = notes.add("# Bank\n\nPIN 1234");
      await here.sync();
      await there.sync();
      notes.update(id, "# Bank\n\nPIN 1234\nPUK 5678");
      await there.sync();
      await here.open();
      await notes.lock(id);
      await here.sync();
      const locked = [{ body: "# Bank\n\nPIN 1234\nPUK 5678", pinned: false, trashed: false, icon: undefined, color: undefined, locked: true }];
      expect(listed()).toEqual(locked);
      expect(drive.get(fileOf(id))!.text).not.toContain("PIN");
      await there.sync();
      expect(listed()).toEqual(locked);
    });

    test("also when it's edited here and locked there", async () => {
      const [here, there] = await devices(2);
      const id = notes.add("# Bank\n\nPIN 1234");
      await here.sync();
      await there.sync();
      await notes.lock(id);
      await there.sync();
      await here.open();
      notes.update(id, "# Bank\n\nPIN 1234\nPUK 5678");
      await here.sync();
      expect(listed()).toEqual([{ body: "# Bank\n\nPIN 1234\nPUK 5678", pinned: false, trashed: false, icon: undefined, color: undefined, locked: true }]);
      expect(drive.get(fileOf(id))!.text).not.toContain("PIN");
    });

    test("and with the password not given here, the locked note is kept as it is, the edit as a copy", async () => {
      const [here, there] = await devices(2);
      const id = notes.add("# Bank\n\nPIN 1234");
      await here.sync();
      await there.sync();
      await notes.lock(id);
      await there.sync();
      await here.open();
      notes.update(id, "# Bank\n\nPIN 1234\nPUK 5678");
      noteKeys.clear();
      await here.sync();
      expect(listed()).toEqual([
        { body: "# Bank (conflicted copy)\n\nPIN 1234\nPUK 5678", pinned: false, trashed: false, icon: undefined, color: undefined, locked: false },
        { body: "", pinned: false, trashed: false, icon: undefined, color: undefined, locked: true },
      ]);
    });
  });
});

describe("sync, of a note's file saved by another app", () => {
  test("with a byte order mark and Windows line endings: lines' own header isn't taken for the note's text", async () => {
    const [here, there] = await devices(2);
    const id = notes.add("# Recipe\n\nflour");
    notes.togglePin(id);
    await here.sync();
    const { text } = drive.get(fileOf(id))!;
    drive.set(fileOf(id), { text: `\uFEFF${text.replace("flour", "flour\nsugar").replaceAll("\n", "\r\n")}`, etag: "saved elsewhere" });
    await here.sync();
    expect(notes.get(id)!.note).toMatchObject({ body: "# Recipe\n\nflour\nsugar", pinned: true });
    await there.sync();
    expect(notes.get(id)!.note).toMatchObject({ body: "# Recipe\n\nflour\nsugar", pinned: true });
  });
});

describe("sync, of tags' and types' icons and colors", () => {
  test("go to the folder, and come in from other devices choice by choice, the later winning", async () => {
    const [here] = await devices(1);
    tagLooks.setColor("work", "blue");
    await here.sync();
    const file = `${FOLDER.path}/library.json`;
    expect(JSON.parse(drive.get(file)!.text).tags.work).toMatchObject({ color: "blue" });

    // Another device chose a type's icon since, and gave the tag a color before this one did.
    const there = JSON.parse(drive.get(file)!.text);
    there.types.book = { icon: "book-open", at: Date.now() + 1000 };
    there.tags.work = { color: "red", at: 1 };
    drive.set(file, { text: JSON.stringify(there), etag: "elsewhere" });
    await here.sync();
    expect(typeLooks.icon("book")).toBe("book-open");
    expect(tagLooks.color("work")).toBe("blue");
    const merged = JSON.parse(drive.get(file)!.text);
    expect(merged.tags.work).toMatchObject({ color: "blue" });
    expect(merged.types.book).toMatchObject({ icon: "book-open" });
    expect(looks.looks.types.book.icon).toBe("book-open");
  });
});

describe("sync, once every synced note was deleted on another device", () => {
  /** A note synced to two devices and deleted for good on the other; one written here since. */
  async function deletedElsewhere() {
    const [here, there] = await devices(2);
    const id = notes.add("# Only note");
    await here.sync();
    await there.sync();
    await notes.deleteForever(id);
    await there.sync();
    await here.open();
    notes.add("# Written here since");
    await here.sync();
    return id;
  }

  /** The notes' files in the folder, without tags' and types' looks (library.json). */
  const noteFiles = () => [...drive].filter(([path]) => !path.endsWith("/library.json")).map(([, file]) => file);

  test("stops, deleting nothing, until the person says", async () => {
    await deletedElsewhere();
    await sync.syncNow();
    expect(sync.status).toBe("error");
    expect(sync.missing).toBe(1);
    expect(bodies()).toEqual(["# Only note", "# Written here since"]);
    expect(noteFiles()).toHaveLength(0);
  });

  test("deletes them here too, if they were, and syncs on", async () => {
    await deletedElsewhere();
    await sync.deleteMissing();
    await sync.syncNow();
    expect(sync.status).toBe("idle");
    expect(sync.missing).toBe(0);
    expect(bodies()).toEqual(["# Written here since"]);
    expect(noteFiles().map((file) => file.text.split("\n").at(-1))).toEqual(["# Written here since"]);
  });

  test("or uploads them again", async () => {
    await deletedElsewhere();
    await sync.uploadMissing();
    await sync.syncNow();
    expect(sync.status).toBe("idle");
    expect(bodies()).toEqual(["# Only note", "# Written here since"]);
    expect(noteFiles()).toHaveLength(2);
  });
});
