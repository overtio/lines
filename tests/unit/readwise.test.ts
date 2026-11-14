import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { GFM, parser } from "@lezer/markdown";
import type { Entry } from "../../src/lib/notes/store.svelte";
import type { ExportBook, ExportHighlight, Highlight, ReaderDocument, Source } from "../../src/plugins/readwise/sources";
import { stubApp } from "./stubs";

/*
 * Readwise's export and Reader's list as the library has them: what each thing is, its properties
 * and where it's got to, its highlights as a note shows them, and what importing writes against the
 * notes there are, importing again too. The fixtures (fixtures/readwise/) are shaped as Readwise's
 * API documents its answers (readwise.io/api_deets, readwise.io/reader_api), with made-up things in
 * them. Messages are their keys here (stubs.ts).
 */

stubApp();

const { sourcesOf } = await import("../../src/plugins/readwise/sources");
const { highlightText, moreOf, quotesOf } = await import("../../src/plugins/readwise/write");
const { plan } = await import("../../src/plugins/readwise/plan");
const { libraryNoteText } = await import("../../src/lib/library/text");
const { escapeMarkdownText } = await import("../../src/lib/notes/escape");
const { computeMeta, extractTags } = await import("../../src/lib/notes/parse");
const { dayOf } = await import("../../src/lib/notes/calendar");

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`fixtures/readwise/${name}`, import.meta.url), "utf8"));
const books: ExportBook[] = fixture("export.json").results;
const reader: Record<string, { results: ReaderDocument[] }> = fixture("reader.json");
const documents = Object.values(reader).flatMap((page) => page.results);

const found = sourcesOf(books, documents);
const titled = (title: string) => found.sources.find((source) => source.item.title === title)!;
const said = (text: string) => ({ text, tags: [] }) as Highlight;

/** The kinds of Markdown `text` makes, as lines' editor reads it. */
function nodes(text: string) {
  const names = new Set<string>();
  parser.configure(GFM).parse(text).iterate({ enter: (node) => void names.add(node.name) });
  return names;
}

/** Notes as the store lists them, of these texts. */
const entries = (...bodies: string[]): Entry[] =>
  bodies.map((body, i) => ({ note: { id: `note-${i}`, body, createdAt: 0, updatedAt: 0, pinned: false, trashed: false }, meta: computeMeta(body) }));

/** What an import's work writes for each new note, as the library writes it (no cover). */
const written = (work: ReturnType<typeof plan>["work"]) =>
  work.add.map(({ item, status, more }) => `${libraryNoteText(item, { status: status ?? undefined })}${more ? `\n${more}\n` : ""}`);

describe("what Readwise has", () => {
  test("each source is a kind of library note, tweets an article, and Readwise's suggestions are left out", () => {
    expect(found.sources.map(({ item }) => [item.type, item.title])).toEqual([
      ["book", "Moby-Dick"],
      ["book", "Walden"],
      ["article", "On Gardens"],
      ["episode", "Episode 12: Slow Reading"],
      ["article", "Tweets From Example Person"],
      // Saved in Reader, not highlighted.
      ["article", "Notes That Last"],
      ["paper", "Attention and Reading"],
      ["video", "How Books Are Bound"],
    ]);
    expect(found.leftOut).toBe(1);
  });

  test("a book from Kindle: its author, the link Readwise gives (none), its cover, and no status, which Readwise doesn't know", () => {
    const moby = titled("Moby-Dick");
    expect([moby.readwise, moby.reader]).toEqual([1001, undefined]);
    expect(moby.item).toEqual({
      type: "book",
      title: "Moby-Dick",
      link: undefined,
      properties: [["author", "Herman Melville"]],
      cover: "https://m.media-amazon.com/images/I/41example.jpg",
      description: undefined,
      tags: ["classics"],
    });
    expect([moby.progress, moby.note]).toEqual([undefined, "Read on the train, a chapter a day."]);
    // In the book's order, without the one deleted; on the day each was made, here.
    expect(moby.highlights.map((highlight) => [highlight.text, highlight.where, highlight.day, highlight.tags])).toEqual([
      ["Call me Ishmael.", { kind: "location", at: 12 }, dayOf(Date.parse("2024-03-01T20:11:24.000Z")), ["openings"]],
      ["It is not down in any map; true places never are.", { kind: "location", at: 2210 }, dayOf(Date.parse("2024-03-09T07:30:00.000Z")), []],
    ]);
    expect(moby.created).toBe(Date.parse("2024-03-01T20:11:24.000Z"));
  });

  test("Readwise's own cover for something without one isn't a cover", () => {
    expect(titled("Walden").item.cover).toBeUndefined();
    expect(titled("Attention and Reading").item.cover).toBeUndefined();
  });

  test("an article read in Reader is one thing: Reader's id, site, date, tags and where it's got to, with the export's highlights", () => {
    const garden = titled("On Gardens");
    expect([garden.readwise, garden.reader]).toEqual([1003, "01readerarticle"]);
    expect(garden.item.properties).toEqual([
      ["author", "Ada Example"],
      ["site", "Example Gardens"],
      ["published", "2026-05-01"],
    ]);
    expect([garden.progress, garden.note, garden.item.tags]).toEqual([1, "Send to Mum.", ["gardening"]]);
    // Reader's own highlight document is the export's highlight: it's there once.
    expect(garden.highlights).toHaveLength(1);
    // Tags as lines writes them; one of only digits isn't one.
    expect(garden.highlights[0].tags).toEqual(["continental-philosophy"]);
  });

  test("what's saved in Reader: its id, where it's got to, a PDF as a paper, a date given in milliseconds", () => {
    const notes = titled("Notes That Last");
    expect([notes.readwise, notes.reader, notes.progress]).toEqual([undefined, "01readernew", 0]);
    const paper = titled("Attention and Reading");
    expect([paper.item.properties, paper.progress]).toEqual([
      [
        ["authors", "A. Researcher, B. Scholar"],
        ["year", "2024"],
      ],
      2,
    ]);
    expect(titled("How Books Are Bound").item.properties).toEqual([
      ["channel", "Example Bindery"],
      ["published", "2025-11-11"],
    ]);
  });

  test("an episode is by its podcast, and its highlights are times into it", () => {
    const episode = titled("Episode 12: Slow Reading");
    expect(episode.item.properties).toEqual([["podcast", "The Example Podcast"]]);
    expect(episode.highlights[0].where).toEqual({ kind: "time", at: 754 });
  });

  test("nothing in Reader's Feed is brought, nor its highlights and notes on their own", () => {
    const feed: ReaderDocument = { id: "01feed", category: "rss", location: "feed", title: "A post in the Feed", source_url: "https://example.com/post" };
    expect(sourcesOf([], [feed, ...reader["later:later2"].results]).sources).toEqual([]);
  });

  test("what can't be read is left out rather than stopping it: a date out of range, an address that isn't one", () => {
    const odd: ReaderDocument = { id: "01odd", category: "article", location: "new", title: "Odd", published_date: 1e20, source_url: "https://[", image_url: "javascript:alert(1)" };
    const [source] = sourcesOf([], [odd]).sources;
    expect([source.item.link, source.item.cover, source.item.properties]).toEqual([undefined, undefined, []]);
    const highlight: ExportHighlight = { id: 1, text: "x", url: "https://[", highlighted_at: "not a date" };
    const [book] = sourcesOf([{ user_book_id: 1, title: "B", category: "books", highlights: [highlight] }], []).sources;
    expect([book.highlights[0].url, book.highlights[0].day]).toEqual([undefined, undefined]);
    expect(highlightText(book.highlights[0])).toBe("> x");
  });
});

describe("as a note", () => {
  test("a highlight: a quote, where it is and when, its tags, and the note on it after", () => {
    const day = titled("Moby-Dick").highlights[0].day;
    expect(highlightText(titled("Moby-Dick").highlights[0])).toBe(`> Call me Ishmael.\n> — readwise.location · ${day} #openings\n\nThe best first line there is.`);
    // Paragraphs stay paragraphs of the one quote.
    expect(highlightText(titled("Walden").highlights[0])).toBe(
      `> I went to the woods because I wished to live deliberately.\n>\n> I wanted to live deep and suck out all the marrow of life.\n> — readwise.page · ${titled("Walden").highlights[0].day}`,
    );
  });

  test("what came from Readwise is just text: no heading, link, tag, mention, emphasis or list is made of it", () => {
    const highlight = titled("On Gardens").highlights[0];
    const text = highlightText(highlight);
    expect(text).toBe(
      [
        "> \\# Weeds are \\*plants\\* in the wrong \\[place](https://example.com) — ask \\@gardener about \\#compost \\=\\=now\\=\\=",
        `> — ${highlight.day} #continental-philosophy`,
        "",
        "Try \\*\\*this\\*\\* in spring.",
        "\\- not a list",
      ].join("\n"),
    );
    expect(extractTags(text)).toEqual(["continental-philosophy"]);
  });

  test("nor what only lines together make: a heading's underline, a table, a divider", () => {
    for (const said of ["Hello\n=", "Hello\n--", "Hello\n---", "a | b\n|---|---|", "Title\n- - -", "x\n***", "x\n___"]) {
      const quote = highlightText({ text: said, tags: [] });
      const note = highlightText({ text: "q", note: said, tags: [] });
      for (const made of [nodes(quote), nodes(note)]) {
        for (const name of ["SetextHeading1", "SetextHeading2", "ATXHeading1", "Table", "HorizontalRule", "BulletList"]) expect(made.has(name), `${JSON.stringify(said)}: ${name}`).toBe(false);
      }
    }
    expect(escapeMarkdownText("Hello\n=\n\na | b\n|---|---|")).toEqual(["Hello\n\\=", "a \\| b\n\\|---\\|---\\|"]);
  });

  test("a highlight with a page of its own links to it, its parentheses kept from ending the link; with no place or day, by its site", () => {
    const episode = titled("Episode 12: Slow Reading").highlights[0];
    expect(highlightText(episode)).toBe(`> Read slowly, and write in the margins.\n> — [12:34](https://share.example.com/snip/%2812%29) · ${episode.day}`);
    expect(highlightText({ text: "A tweet.", url: "https://twitter.com/example/status/1", tags: [] })).toBe("> A tweet.\n> — [twitter.com](https://twitter.com/example/status/1)");
  });

  test("the whole note: the library's part with Readwise's id, then the person's note on it and its highlights under Highlights, in English", () => {
    const moby = titled("Moby-Dick");
    const [body] = written(plan({ sources: [moby], leftOut: 0 }, []).work);
    const [first, second] = moby.highlights;
    expect(body).toBe(`---
type: book
author: Herman Melville
readwise: 1001
---
# Moby-Dick

#classics

Read on the train, a chapter a day.

## Highlights

> Call me Ishmael.
> — readwise.location · ${first.day} #openings

The best first line there is.

> It is not down in any map; true places never are.
> — readwise.location · ${second.day}
`);
    const meta = computeMeta(body);
    expect([meta.title, meta.type, meta.tags]).toEqual(["Moby-Dick", "book", ["classics", "openings"]]);
    expect(moreOf({ ...moby, note: undefined, highlights: [] })).toBe("");
  });
});

describe("what's there already", () => {
  test("a short highlight isn't taken for one there because its words are in another", () => {
    const there = quotesOf("# Moby-Dick\n\n## Highlights\n\n> Call me Ishmael.\n> — Location 12\n");
    expect(["Ishmael", "me", "Location 12", "Call me Ishmael."].map((text) => there.take(said(text)))).toEqual([true, true, true, false]);
    // Taken once: the same highlight twice is added once.
    expect(there.take(said("Ishmael"))).toBe(false);
  });

  test("a long one is found however it's been laid out since, and one with escapes as it was written", () => {
    const long = "It is not down in any map; true places never are, and nothing on the chart says where they lie.";
    const reflowed = `# X\n\n> It is not down in any map;\n> true places never are, and nothing on the chart\n> says where they lie.\n\nMy note.\n`;
    expect(quotesOf(reflowed).take(said(long))).toBe(false);
    const code = said("Escape it as C:\\Users\\me or \\*x\\* and $\\alpha$.");
    expect(quotesOf(`# Code\n\n${highlightText(code)}\n`).take(code)).toBe(false);
  });
});

describe("importing", () => {
  const source = (title: string, more: Partial<Source> & { by?: string; link?: string; type?: string } = {}): Source => ({
    readwise: more.readwise,
    reader: more.reader,
    item: { type: more.type ?? "article", title, link: more.link, properties: more.by ? [["author", more.by]] : [] },
    highlights: more.highlights ?? [said(`A sentence from ${title}.`)],
  });

  test("something there by its title is added to only if both say who it's by and they don't link to different pages", () => {
    const mine = entries(
      "---\ntype: article\nlink: https://mine.example/intro\n---\n# Introduction\n\nMy own notes.\n",
      "---\ntype: article\n---\n# Untitled\n",
      "---\ntype: article\nauthor: Ada Example\n---\n# On Gardens\n",
    );
    const planned = plan(
      {
        sources: [
          // Another page of the same title.
          source("Introduction", { link: "https://other.example/intro", by: "Someone" }),
          // Neither says who it's by.
          source("Untitled"),
          // The same, by its title and author; it has a link, the note doesn't.
          source("On Gardens", { by: "Ada Example", link: "https://example.com/on-gardens" }),
        ],
        leftOut: 0,
      },
      mine,
    );
    expect(planned.work.add.map(({ item }) => item.title)).toEqual(["Introduction", "Untitled"]);
    expect(planned.work.append).toEqual([{ id: "note-2", text: "## Highlights\n\n> A sentence from On Gardens." }]);
    expect([planned.adding, planned.addingTo]).toEqual([1, ["On Gardens"]]);
  });

  test("importing again adds only what's new: things saved in Reader by Reader's id, the rest by Readwise's", () => {
    const first = plan(found, []);
    expect(first.work.add).toHaveLength(8);
    expect(first.highlights).toBe(6);
    const there = entries(...written(first.work));
    const again = plan(found, there);
    expect([again.work, again.highlights, again.adding]).toEqual([{ add: [], append: [] }, 0, 0]);
    // A highlight made in Readwise since is added to its note's end, under the heading it has.
    const moby = titled("Moby-Dick");
    const later = plan({ sources: [{ ...moby, highlights: [...moby.highlights, said("Better to sleep with a sober cannibal than a drunken Christian.")] }], leftOut: 0 }, there);
    expect(later.work.add).toEqual([]);
    expect(later.work.append).toEqual([{ id: "note-0", text: "> Better to sleep with a sober cannibal than a drunken Christian." }]);
  });

  test("two copies of one book (Kindle's and Apple Books') are one note, and a highlight in both is there once", () => {
    const kindle = source("Walden", { type: "book", by: "Henry David Thoreau", readwise: 1, highlights: [said("Simplify, simplify."), said("From the Kindle copy.")] });
    const books = source("Walden", { type: "book", by: "Henry David Thoreau", readwise: 2, highlights: [said("Simplify, simplify."), said("From the Apple Books copy.")] });
    const planned = plan({ sources: [kindle, books], leftOut: 0 }, []);
    expect(planned.work.add).toHaveLength(1);
    expect(planned.highlights).toBe(3);
    // Added to one there, once.
    const there = plan({ sources: [kindle, books], leftOut: 0 }, entries("---\ntype: book\nauthor: Henry David Thoreau\n---\n# Walden\n"));
    expect(there.work.append).toHaveLength(1);
    expect(there.adding).toBe(3);
  });

  test("a locked note that's closed is there, but isn't added to", () => {
    const [entry] = entries("---\ntype: article\nreadwise: 7\n---\n# Locked\n");
    entry.note.locked = { key: { id: "k", changed: 0 } as never, title: "Locked", files: [], sealed: "…" };
    const planned = plan({ sources: [source("Locked", { readwise: 7 })], leftOut: 0 }, [entry]);
    expect(planned.work).toEqual({ add: [], append: [] });
  });
});
