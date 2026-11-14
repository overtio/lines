import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Exported } from "../../src/lib/imports/exported";
import type { NewNote } from "../../src/lib/imports/imports.svelte";
import type { Tally } from "../../src/lib/imports/notes";
import type { Entry } from "../../src/lib/notes/store.svelte";
import type { NoteSource } from "../../src/lib/notes/types";
import { stubApp } from "./stubs";

/*
 * Notes from other apps: an Obsidian vault (fixtures/obsidian/Vault, written by hand as Obsidian
 * keeps one: Markdown files, its settings in .obsidian/, its trash in .trash/) read into Linedown,
 * what importing it would do against the notes there are, and the notes it makes. Messages are their
 * keys here (stubs.ts).
 */

stubApp();

const { readVault } = await import("../../src/plugins/obsidian/vault");
const { translate } = await import("../../src/plugins/obsidian/markdown");
const { attachmentPath, notesInput, notesWork, planNotes, Tally: Tallies, withTitle } = await import("../../src/lib/imports/notes");
const { exportedFrom } = await import("../../src/lib/imports/exported");
const { zip } = await import("../../src/lib/zip");
const { computeMeta } = await import("../../src/lib/notes/parse");

/** A folder of fixtures/ as a picker of folders gives it, each file dated alike. */
function folder(name: string): Exported {
  const root = new URL(`fixtures/${name}`, import.meta.url).pathname;
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => (statSync(join(dir, entry)).isDirectory() ? walk(join(dir, entry)) : [join(dir, entry)]));
  return {
    name: root.split("/").at(-1)!,
    files: walk(root).map((path) => ({
      path: relative(root, path),
      size: statSync(path).size,
      modified: DAY,
      text: async () => readFileSync(path, "utf8"),
      file: async () => new File([readFileSync(path)], path.split("/").at(-1)!),
    })),
  };
}

const DAY = Date.UTC(2024, 10, 14);
const vault = await readVault(folder("obsidian/Vault"));
const note = (id: string) => vault.notes.find((each) => each.id === id)!;
/** What's said of each kind that didn't come across as it was: how many, and its examples. */
const said = (report: Tally) => Object.fromEntries([...report.kinds].map(([kind, { count, examples }]) => [kind.replace("import.report.", ""), [count, ...examples]]));
/** Where a placeholder for an attachment is, as a test reads it. */
const shown = (body: string) => body.replace(/\.\.\/attachments\/\uE000(\d+)\uE000/g, (_, index) => `<${vault.attachments[Number(index)].path}>`);
const entries = (...notes: { body: string; source?: NoteSource; trashed?: boolean }[]): Entry[] =>
  notes.map(({ body, source, trashed = false }, i) => ({ note: { id: `note-${i}`, body, createdAt: 0, updatedAt: 0, pinned: false, trashed, source }, meta: computeMeta(body) }));
/** The vault imported before, as its notes say. */
const VAULT = { id: "c1", name: "Vault" };
/** A note imported from that vault before, by its path in it. */
const from = (id: string, { trashed = false, app = "obsidian" } = {}) => ({ body: `# ${id}`, source: { app, collection: VAULT, id, name: id }, trashed });

/** A note's translation on its own, with links leading to `notes` (by name) and `files` (by path). */
function translated(text: string, { notes = [] as string[], files = [] as string[] } = {}) {
  const report = new Tallies();
  const resolve = (target: string) => {
    const note = target.replace(/\.md$/, "");
    return notes.includes(note) ? { note } : files.includes(target) ? { file: files.indexOf(target), name: target } : null;
  };
  const done = translate(text, { report, resolve }, "Note");
  return { ...done, body: done.body.replace(/\.\.\/attachments\/\uE000(\d+)\uE000/g, (_, index) => `<${files[Number(index)]}>`), report: said(report) };
}

describe("an Obsidian vault", () => {
  test("each Markdown file a note, its title its file's name, in its folders; its settings and other hidden files left out", () => {
    expect(vault.name).toBe("Vault");
    expect(vault.notes.map(({ id, name, folders }) => [id, name, folders.join("/")]).sort()).toEqual([
      [".trash/Old idea.md", "Old idea", ""],
      ["Daily/2026-11-14.md", "2026-11-14", "Daily"],
      ["Ideas.md", "Ideas", ""],
      ["Projects/Acme/Plan.md", "Plan", "Projects/Acme"],
      ["Projects/Plan.md", "Plan", "Projects"],
      ["Welcome.md", "Welcome", ""],
    ]);
    // A title written as the note's first heading isn't written again.
    expect(note("Ideas.md").body).toBe("# Ideas\n\n- A garden #someday\n");
    expect(note("Projects/Plan.md").body).toBe("# Plan\n\nThe plan for #work, from [[Welcome]].\n");
  });

  test("bookmarked notes (in groups too) pinned, the trash's in the Trash, daily notes dated, dates from properties or the file", () => {
    expect(vault.notes.filter((each) => each.pinned).map((each) => each.id)).toEqual(["Ideas.md", "Projects/Plan.md"]);
    expect(note(".trash/Old idea.md")).toMatchObject({ trashed: true, folders: [] });
    expect(note("Daily/2026-11-14.md").body).toBe("---\ndate: 2026-11-14\n---\n# 2026-11-14\n\nRain all day.\n");
    expect(note("Welcome.md")).toMatchObject({ created: Date.UTC(2024, 2, 1, 9), updated: DAY });
  });

  test("its Markdown in Linedown: links to where they lead, pictures and files, callouts, comments; code as it is", () => {
    expect(shown(note("Welcome.md").body)).toBe(
      [
        "---",
        "aliases:",
        "  - Start",
        "cssclasses: wide",
        "created: 2024-03-01T09:00:00Z",
        "---",
        "# Welcome",
        "",
        "Welcome to the vault. See [[Plan]], [[Ideas|my ideas]] and [[Plan#Budget|Acme's budget]].",
        "",
        "![|300](<Attachments/diagram.png>)",
        "[Report 2026.pdf](<Attachments/Report 2026.pdf>)",
        "[[Ideas]]",
        "[[Missing note]], [[#Further reading]] and ![[gone.png]]",
        "",
        ":::info icon=lightbulb",
        "**Remember**",
        "",
        "Keep it **simple**.",
        "",
        ":::warning",
        "Nested.",
        ":::",
        ":::",
        "",
        "A ==highlight== and <!--a hidden comment--> here. A line with an id ^37066d",
        "",
        "<!--",
        "A comment",
        "over lines",
        "-->",
        "",
        "- [ ] Open task",
        "- [x] Done task",
        "- [/] Half done",
        "",
        "`[[not a link]]` stays code.",
        "",
        "```dataview",
        "LIST FROM #project",
        "```",
        "",
        "[[Plan|Plan as Markdown]], ![photo](<Attachments/diagram.png>) and [the site](https://obsidian.md).",
        "",
      ].join("\n"),
    );
    expect(note("Welcome.md").tags).toEqual(["inbox", "project/active"]);
    expect(note("Projects/Acme/Plan.md").body).toBe("# Plan\n\n## Budget\n\n:::question\n**Who pays?**\n\nAcme does.\n:::\n\nBack to [[Welcome#Ideas]].\n");
  });

  test("what doesn't come across as it was is counted, with where it is; files no note shows are left out", () => {
    // Not the picture of the same name in the trash, which is nearer: links never lead into it.
    expect(vault.attachments.map((file) => file.path)).toEqual(["Attachments/diagram.png", "Attachments/Report 2026.pdf"]);
    expect(said(vault.report)).toEqual({
      cssClasses: [1, "cssclasses: wide (Welcome)"],
      embeds: [1, "![[Ideas]] (Welcome)"],
      headingLinks: [1, "[[#Further reading]] (Welcome)"],
      missing: [1, "![[gone.png]] (Welcome)"],
      blockIds: [1, "^37066d (Welcome)"],
      taskStatuses: [1, "[/] (Welcome)"],
      dataview: [1, "Welcome"],
      sameName: [2, "Projects/Acme/Plan.md", "Projects/Plan.md"],
      unused: [2, "Attachments/unused.png", "Board.canvas"],
    });
  });

  test("read from a ZIP of it too, its top folder its name", async () => {
    const files = folder("obsidian/Vault").files;
    const bytes = zip(await Promise.all(files.map(async (file) => ({ name: `Vault/${file.path}`, data: new Uint8Array(await (await file.file()).arrayBuffer()), modified: new Date(DAY) }))));
    const exported = await exportedFrom([new File([bytes], "Vault.zip")]);
    expect(exported.name).toBe("Vault");
    expect(exported.files.map((file) => file.path).sort()).toEqual(files.map((file) => file.path).sort());
    const welcome = exported.files.find((file) => file.path === "Welcome.md")!;
    expect(await welcome.text()).toStartWith("---\ntags: [inbox, project/active]\n");
    expect(welcome.modified).toBe(new Date(DAY).setSeconds(0, 0));
    expect((await exported.files.find((file) => file.path.endsWith(".png"))!.file()).type).toBe("image/png");
  });
});

describe("Obsidian's Markdown", () => {
  test("callouts of each kind as lines' nearest, foldable or not, unknown ones as cards of their name", () => {
    expect(translated("> [!NOTE]\n> Hi").body).toBe(":::info icon=pencil\nHi\n:::");
    expect(translated("Before\n> [!faq]+ Why?\n> Because.\n\nAfter").body).toBe("Before\n\n:::question\n**Why?**\n\nBecause.\n:::\n\nAfter");
    // A line under the quote's text without its `>` goes on with it, as Markdown (and Obsidian) has it.
    expect(translated("> [!faq] Why?\n> Because\nof this.").body).toBe(":::question\n**Why?**\n\nBecause\nof this.\n:::");
    expect(translated("> [!danger] Careful").body).toBe(":::error icon=zap\n**Careful**\n:::");
    expect(translated("> [!recipe]\n> Flour").body).toBe("::: recipe\nFlour\n:::");
    // A quote is a quote, and a callout in code is code.
    expect(translated("> Just a quote").body).toBe("> Just a quote");
    expect(translated("```\n> [!note]\n```").body).toBe("```\n> [!note]\n```");
  });

  test("links by path, with a heading or text; Markdown links decoded; web links as they are", () => {
    const notes = ["Plan", "Other Note"];
    expect(translated("[[Plan#Goals|the goals]] [[Plan|Plan]] [[Plan.md]]", { notes }).body).toBe("[[Plan#Goals|the goals]] [[Plan]] [[Plan]]");
    expect(translated("[x](Other%20Note.md#Some%20Heading) [y](<Other Note.md>) [z](mailto:a@b.c) [w](#top)", { notes }).body).toBe(
      "[[Other Note#Some Heading|x]] [[Other Note|y]] [z](mailto:a@b.c) [w](#top)",
    );
  });

  test("pictures with their width or description, other files as links to them, wherever they're written", () => {
    const files = ["a.png", "b.pdf", "c.mp3"];
    expect(translated("![[a.png|640x480]] ![[a.png|A lake]] ![[b.pdf#page=3]] [[c.mp3|Interview]] ![alt|200](a.png) [doc](b.pdf)", { files }).body).toBe(
      "![|640](<a.png>) ![A lake](<a.png>) [b.pdf](<b.pdf>) [Interview](<c.mp3>) ![alt|200](<a.png>) [doc](<b.pdf>)",
    );
  });

  test("comments hide links in them, and stop at code; block ids and task statuses only outside code", () => {
    expect(translated("%%[[Plan]]%% `%%` [[Plan]]", { notes: ["Plan"] }).body).toBe("<!--[[Plan]]--> `%%` [[Plan]]");
    const { report } = translated("```\n- [?] Not a task ^not-an-id\n```\n- [?] A question ^q1");
    expect(report).toEqual({ taskStatuses: [1, "[?] (Note)"], blockIds: [1, "^q1 (Note)"] });
  });

  test("code as lines' Markdown reads it, indented or in a list too, is left as it is, and a comment never runs into it", () => {
    const notes = ["Plan"];
    const files = ["a.png"];
    expect(translated('Text\n\n    printf("%%d", x); ![[a.png]]\n\n[[Plan]] %%hidden%%', { notes, files }).body).toBe('Text\n\n    printf("%%d", x); ![[a.png]]\n\n[[Plan]] <!--hidden-->');
    expect(translated("- One\n  - Two\n\n        ```\n        %% [[Plan]]\n        ```\n\n[[Plan]]", { notes }).body).toBe("- One\n  - Two\n\n        ```\n        %% [[Plan]]\n        ```\n\n[[Plan]]");
    // A `%%` whose pair is past a code block, or which would be no HTML comment, stays as written.
    expect(translated("%% open\n\n```\nx\n```\n\nclose %% [[Plan]]", { notes }).body).toBe("%% open\n\n```\nx\n```\n\nclose %% [[Plan]]");
    const unsafe = translated("%% a --> b %% and [[Plan]]", { notes });
    expect([unsafe.body, unsafe.report]).toEqual(["%% a --> b %% and [[Plan]]", { comments: [1, "%% a --> b %% (Note)"] }]);
  });

  test("links in a table keep their bar escaped, `\\|`, as a table needs it", () => {
    const done = translated("| Picture | Link |\n|---|---|\n| ![[a.png\\|300]] | [[Plan\\|the plan]] |", { notes: ["Plan"], files: ["a.png"] });
    expect(done.body).toBe("| Picture | Link |\n|---|---|\n| ![\\|300](<a.png>) | [[Plan\\|the plan]] |");
  });

  test("Markdown links with brackets or reserved characters in their paths", () => {
    const done = translated("[m](Meeting%20(2024).md) ![](Screenshot%20(1).png) [x](A%26B.md) [y](<Q&A.md>)", { notes: ["Meeting (2024)", "A&B", "Q&A"], files: ["Screenshot (1).png"] });
    expect(done.body).toBe("[[Meeting (2024)|m]] ![](<Screenshot (1).png>) [[A&B|x]] [[Q&A|y]]");
  });

  test("properties: tags taken into the text, links in values followed, those lines can't read kept as YAML", () => {
    // Properties are YAML: a `%%` in one is text.
    expect(translated("---\nsale: 50%% off %%\n---\nText").front).toBe("---\nsale: 50%% off %%\n---\n");
    const done = translated("---\ntags:\n  - a\n  - b/c\nup: \"[[Plan]]\"\n---\nText", { notes: ["Plan"] });
    expect([done.front, done.body, done.tags]).toEqual(["---\nup: \"[[Plan]]\"\n---\n", "Text", ["a", "b/c"]]);
    expect(translated("---\ntags: one two\n---\nText").front).toBe("");
    // Nested ones are read as text; a key in quotes isn't read at all.
    expect(translated("---\nauthor:\n  name: Ada\n---\nText").front).toBe("---\nauthor:\n  name: Ada\n---\n");
    const unread = translated('---\n"Born on": 1815\n---\nText');
    expect([unread.front, unread.body, unread.report]).toEqual(["", '```yaml\n"Born on": 1815\n```\n\nText', { properties: [1, "Note"] }]);
  });
});

describe("importing notes", () => {
  test("its title above its text, unless it starts with it, written so nothing in it is more than text", () => {
    expect(withTitle("Plan", "Text")).toBe("# Plan\n\nText");
    expect(withTitle("Plan", "\n## plan\nText")).toBe("## plan\nText");
    expect(withTitle("Ideas #inbox", "Text", "---\na: b\n---\n")).toBe("---\na: b\n---\n# Ideas \\#inbox\n\nText");
  });

  test("what it would do: notes not imported before (but those in the Trash), their folders and the files they show", () => {
    const plan = planNotes("obsidian", vault, entries(from("Ideas.md"), from("Projects/Plan.md", { trashed: true })), { fresh: "new" });
    expect([plan.add.length, plan.there.map((each) => each.id), plan.folders, plan.attachments]).toEqual([5, ["Ideas.md"], 3, [0, 1]]);
    expect(plan.collection).toEqual(VAULT);
    expect(plan.earlier).toEqual({ ...VAULT, notes: 2, shared: 2 });
    // One that was in Obsidian's trash is here while it's in lines' Trash.
    expect(planNotes("obsidian", vault, entries(from(".trash/Old idea.md", { trashed: true }))).there.length).toBe(1);
    // Another app's isn't this.
    expect(planNotes("obsidian", vault, entries(from("Ideas.md", { app: "bear" }))).there.length).toBe(0);
  });

  test("a vault imported before, by its name or the same paths, is asked about: as another, all of it is imported", () => {
    const there = entries(from("Welcome.md"), from("Daily/2026-11-14.md"));
    // Renamed since, its notes say it may be the same.
    const renamed = { ...vault, name: "Brain" };
    const same = planNotes("obsidian", renamed, there, { fresh: "new" });
    expect(same.earlier).toEqual({ ...VAULT, notes: 2, shared: 2 });
    expect([same.there.map((each) => each.id).sort(), same.collection]).toEqual([["Daily/2026-11-14.md", "Welcome.md"], { id: "c1", name: "Brain" }]);
    const another = planNotes("obsidian", renamed, there, { same: false, fresh: "new" });
    expect([another.there.length, another.add.length, another.collection]).toEqual([0, 6, { id: "new", name: "Brain" }]);
    // One of the same name, none of whose notes these are: asked about too, nothing of it here.
    const named = planNotes("obsidian", vault, entries({ ...from("Elsewhere.md") }), { fresh: "new" });
    expect([named.earlier?.shared, named.there.length]).toEqual([0, 0]);
    // Nothing imported before: a collection of its own, nothing asked.
    const first = planNotes("obsidian", vault, [], { fresh: "new" });
    expect([first.earlier, first.collection]).toEqual([undefined, { id: "new", name: "Vault" }]);
  });

  test("the notes it makes: their attachments as kept, their tags and folders' tags, where they came from", () => {
    const plan = planNotes("obsidian", vault, [], { fresh: "c1" });
    const input = notesInput("obsidian", plan, new Map([[0, "3f2a9c0d1e8b4a7f6c5d2e1f0a9b8c7d.png"]]), vault, { folderTags: true });
    const made = (id: string) => input.notes.find((each) => "source" in each && each.source.id === id) as Extract<NewNote, { body: string }>;
    const welcome = made("Welcome.md");
    expect(welcome.body).toContain("![|300](../attachments/3f2a9c0d1e8b4a7f6c5d2e1f0a9b8c7d.png)\n[Report 2026.pdf](Attachments/Report%202026.pdf)\n");
    expect(welcome.body).toEndWith("and [the site](https://obsidian.md).\n\n#inbox #project/active\n");
    expect(welcome).toMatchObject({ source: { app: "obsidian", collection: VAULT, id: "Welcome.md", name: "Welcome" }, created: Date.UTC(2024, 2, 1, 9), pinned: false });
    expect(made("Projects/Acme/Plan.md").body).toEndWith("Back to [[Welcome#Ideas]].\n\n#projects/acme\n");
    expect(made(".trash/Old idea.md")).toMatchObject({ body: "# Old idea\n\nSomething I let go of.\n", trashed: true });
    const plain = notesInput("obsidian", plan, new Map(), vault, { folderTags: false });
    expect(plain.notes.find((each) => "source" in each && each.source.id === "Projects/Plan.md")!).toMatchObject({ body: "# Plan\n\nThe plan for #work, from [[Welcome]].\n", pinned: true });
  });

  test("written against the notes there by then: one imported meanwhile isn't made twice", () => {
    const input = notesInput("obsidian", planNotes("obsidian", vault, [], { fresh: "c1" }), new Map(), vault, { folderTags: true });
    const work = notesWork(JSON.parse(JSON.stringify(input)), entries(from("Ideas.md")));
    expect(work.add.length).toBe(5);
    expect(work.add.some((each) => "source" in each && each.source.id === "Ideas.md")).toBe(false);
  });

  test("a placeholder for an attachment is a path in the note until it's kept", () => {
    expect(attachmentPath(3)).toBe("../attachments/\uE0003\uE000");
  });
});

describe("the import itself", () => {
  test("keeping the files says how far it's got now and then, not for each; stopped then, it says so and makes nothing", async () => {
    // The notes store as sync's tests set it up, in memory, which the import writes to.
    await import("./sync");
    const { imports } = await import("../../src/lib/imports/imports.svelte");
    // Each state it says, as Settings (and a screen reader) hears it.
    const said: unknown[] = [];
    const { get, set } = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(imports), "state")!;
    Object.defineProperty(imports, "state", {
      get,
      set(value) {
        said.push(value);
        set!.call(imports, value);
      },
      configurable: true,
    });
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const files = Array.from({ length: 60 }, (_, i) => ({
      path: `p${i}.png`,
      size: 1,
      text: async () => "",
      // The last takes a while, as a big one would.
      file: async () => {
        if (i === 59) await held;
        return new File([new Uint8Array([i])], `p${i}.png`, { type: "image/png" });
      },
    }));
    const warn = console.warn;
    // Nowhere to keep them here (no IndexedDB): each is said not to be kept, which is no matter.
    console.warn = () => {};
    try {
      const going = imports.importNotes("obsidian", { name: "Vault", notes: [], attachments: files, report: new Tallies() }, { add: [], there: [], folders: 0, attachments: files.map((_, i) => i) }, { folderTags: true, report: [] });
      await Bun.sleep(50);
      imports.cancel();
      release();
      await going;
    } finally {
      console.warn = warn;
      delete (imports as { state?: unknown }).state;
    }
    expect(said.length).toBeLessThan(5);
    expect(imports.state).toEqual({ id: "obsidian", kind: "done", added: 0, appended: 0, stopped: true, failed: false });
  });
});
