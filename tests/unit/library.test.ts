import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { LibraryItem, LibrarySource, Plugin } from "../../src/lib/plugins/types";
import { stubApp } from "./stubs";

/*
 * The library: a note's text from what a source found, a page's own description of itself, and each
 * source's lookups, against trimmed copies of what the sites and catalogs answered (fixtures/library/
 * and below). Nothing here reaches the network: every request is answered from `answers`.
 */

/** What each address asked for answers: JSON, a page's HTML, or a status; the first whose start matches. */
const answers = new Map<string, unknown>();
const asked: string[] = [];
const answer = (url: string, init?: RequestInit) => {
  asked.push(init?.method === "HEAD" ? `HEAD ${url}` : url);
  const found = [...answers].find(([start]) => url.startsWith(start))?.[1];
  if (found === undefined) return new Response("", { status: 404 });
  if (typeof found === "number") return new Response("", { status: found });
  if (typeof found === "string") return new Response(found, { headers: { "content-type": "text/html; charset=utf-8" } });
  return Response.json(found);
};
stubApp({ isTauri: false, webFetch: async () => async (url: string, init?: RequestInit) => answer(url, init) });

const text = await import("../../src/lib/library/text");
const { escapeMarkdown, propertyValue } = await import("../../src/lib/notes/escape");
const { frontMatter, mentionOf, nameOf, readMention } = await import("../../src/lib/notes/properties");
const { computeMeta, extractTags } = await import("../../src/lib/notes/parse");
const { plainLine } = await import("../../src/lib/notes/stats");
const { pacing, withTimeout } = await import("../../src/lib/pacing");
const { isPublic, pageSummary } = await import("../../src/lib/library/web");
const { libraryNote } = await import("../../src/lib/library/note");
const { subtitleOf } = await import("../../src/lib/library/rows");
const { readPage, decodeEntities } = await import("../../src/lib/library/page");
const { itemOfPage } = await import("../../src/plugins/web-pages/read");
const { webPages } = await import("../../src/plugins/web-pages");
const { youtube, youtubeId } = await import("../../src/plugins/youtube");
const { openLibrary, bookIn, isIsbn } = await import("../../src/plugins/open-library");
const { wikidata, itemIn } = await import("../../src/plugins/wikidata");
const { musicbrainz, musicIn } = await import("../../src/plugins/musicbrainz");
const { applePodcasts, podcastIn } = await import("../../src/plugins/apple-podcasts");
const { spotify, spotifyIn, spotifyLink } = await import("../../src/plugins/spotify");
const { soundcloud, soundcloudIn } = await import("../../src/plugins/soundcloud");
const { paperItem } = await import("../../src/plugins/arxiv");
const bookmarks = await import("../../src/lib/library/bookmarks");
const keys = await import("../../src/lib/library/keys");
const { dayOf } = await import("../../src/lib/notes/calendar");

const fixture = (name: string) => readFileSync(new URL(`fixtures/library/${name}`, import.meta.url), "utf8");
const page = (name: string, url: string) => readPage(fixture(name), url);
const sourceOf = (plugin: () => Plugin) => plugin().contributes.librarySources![0] as LibrarySource;
const look = (plugin: () => Plugin, link: string) => sourceOf(plugin).lookup(new URL(link), new AbortController().signal);

beforeEach(() => {
  answers.clear();
  asked.length = 0;
});

describe("a note that's a link", () => {
  test("is one link and nothing else: bare, in <…>, or as a Markdown link", () => {
    expect(text.linkOnly("https://www.imdb.com/title/tt15239678/")).toBe("https://www.imdb.com/title/tt15239678/");
    expect(text.linkOnly("  <https://youtu.be/dQw4w9WgXcQ>\n")).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(text.linkOnly("[Dune](https://en.wikipedia.org/wiki/Dune_(novel))")).toBe("https://en.wikipedia.org/wiki/Dune_(novel)");
    for (const not of ["https://example.com and more", "# https://example.com", "---\ntype: book\n---\nhttps://example.com", "ftp://example.com", "https://localhost", "https://", ""]) {
      expect(text.linkOnly(not), not).toBeNull();
    }
  });
  test("or a new note's start, as it was made, with only a link put in it", () => {
    const link = "https://www.imdb.com/title/tt15239678/";
    expect(text.linkNoteLink(`# ${link}`, "# ")).toBe(link);
    expect(text.linkNoteLink(`# ${link}\n`, "# ")).toBe(link);
    const shelf = "---\ntype: movie\nstatus: to watch\n---\n# ";
    expect(text.linkNoteLink(`${shelf}<${link}>`, shelf)).toBe(link);
    expect(text.linkNoteLink(`${shelf}\n${link}`, shelf)).toBe(link);
    // Anything else written in it, or a start that isn't the one it was made with, and it's a note.
    for (const not of [`# Dune ${link}`, `# ${link} ${link}`, `## ${link}`, `${shelf}${link}\nMore.`]) {
      expect(text.linkNoteLink(not, "# "), not).toBeNull();
    }
    expect(text.linkNoteLink(`# ${link}`)).toBeNull();
    expect(text.linkNoteLink(link, "# ")).toBe(link);
  });
});

describe("a library note's text", () => {
  const item: LibraryItem = {
    type: "movie",
    title: "Dune: Part Two",
    link: "https://www.imdb.com/title/tt15239678/",
    properties: [
      ["director", "Denis Villeneuve"],
      ["year", "2024"],
    ],
    cover: "https://example.com/poster.jpg",
    description: "Paul Atreides unites with Chani and the Fremen.\n\nA second paragraph.",
  };

  test("is its properties, link and status, its title as a heading, its cover and what it's about", () => {
    expect(text.libraryNoteText(item, { status: "to watch", cover: { name: "0123456789abcdef0123456789abcdef.jpg", width: 240 } })).toBe(
      [
        "---",
        "type: movie",
        "director: Denis Villeneuve",
        "year: 2024",
        "link: https://www.imdb.com/title/tt15239678/",
        "status: to watch",
        "---",
        "# Dune: Part Two",
        "",
        "![Dune: Part Two|240](../attachments/0123456789abcdef0123456789abcdef.jpg)",
        "",
        "Paul Atreides unites with Chani and the Fremen.",
        "",
        "A second paragraph.",
        "",
      ].join("\n"),
    );
  });

  test("has no cover where none was kept, and leaves out what's empty", () => {
    const written = text.libraryNoteText({ ...item, properties: [["director", " "]], description: undefined });
    expect(written).toBe("---\ntype: movie\nlink: https://www.imdb.com/title/tt15239678/\n---\n# Dune: Part Two\n");
  });

  test("reads as a note's cover: its first picture that's an attachment", () => {
    const written = text.libraryNoteText(item, { cover: { name: "0123456789abcdef0123456789abcdef.jpg", width: 400 } });
    expect(text.coverOf(written)).toBe("0123456789abcdef0123456789abcdef.jpg");
    expect(text.coverOf("![](https://example.com/a.png)")).toBeNull();
  });

  test("reads as what was found: a title, a value or what it's about makes no tag, mention, heading, list, fence or picture", () => {
    const written = text.libraryNoteText({
      type: "video",
      title: "Insane card trick #shorts #magic @someone",
      properties: [["channel", "#Kids Band @home"]],
      description: "```js\n\n# Not a heading\n\n- not a list\n\n:::warning hello\n\nWatch #magic with @rick ![x](https://tracker.example/p.gif) <img src=https://tracker.example/q.gif> now.",
    });
    expect(extractTags(written)).toEqual([]);
    expect(written).not.toMatch(/(?<!\\)!\[|<img|(?<!\\)@(?:rick|home|someone)/);
    const meta = computeMeta(written);
    expect(meta.title).toBe("Insane card trick #shorts #magic @someone");
    expect(meta.properties.find((property) => property.key === "channel")?.value).toBe("#Kids Band @home");
    // What it's about, after its heading: none of it Markdown's, and read as written, escaped rather than taken out.
    const lines = written.split("\n");
    const about = lines.slice(lines.findIndex((line) => line.startsWith("# ")) + 1).filter(Boolean);
    expect(about.filter((line) => /^(?:`|#|-|:)/.test(line))).toEqual([]);
    expect(about.map(plainLine)).toEqual(["```js", "# Not a heading", "- not a list", ":::warning hello", "Watch #magic with @rick ![x](https://tracker.example/p.gif) now."]);
  });

  test("a title reads back as it was, as the note's title and as a mention of it", () => {
    for (const title of ["**BEST** moments of 2024", "Lab_Rats_ the movie", "Blade Runner (Final Cut)", "`git` explained", "Foo <3 Bar", "C++ in 100 Seconds", "Me & You", "1. Intro", "#1 Hits", "A == B", "$5 Shake"]) {
      const note = text.libraryNoteText({ type: "video", title, properties: [] });
      expect(computeMeta(note).title, title).toBe(title);
      expect(nameOf(readMention(mentionOf(title))!.name), title).toBe(nameOf(title));
    }
    expect(escapeMarkdown("  two\n lines ")).toBe("two lines");
  });

  test("a value YAML would read as something else is quoted, and lines reads each back as it was", () => {
    const values = ['"Weird Al" Yankovic', '"Heroes"', "Star Wars: Episode IV", "*NSYNC", "!!!", "@nytimes", "#Kids Band", "& Juliet", "[Remastered]", "Foo # bar", "yes", "It's", "%", "Ends:"];
    for (const value of values) {
      const body = text.libraryNoteText({ type: "song", title: "X", properties: [["artist", value]] });
      expect(frontMatter(body)?.properties.find((property) => property.key === "artist")?.value, value).toBe(value);
      expect(extractTags(body), value).toEqual([]);
    }
    expect([propertyValue("Star Wars: Episode IV"), propertyValue("It's"), propertyValue("Plain Words")]).toEqual(["'Star Wars: Episode IV'", "It's", "Plain Words"]);
  });

  test("an episode's podcast, a mention of it, where its kind says so; its row shows the podcast", () => {
    const written = text.libraryNoteText({ type: "episode", title: "An Episode", properties: [["podcast", "The Daily"], ["author", "@nytimes"]] }, { mentions: ["podcast"] });
    expect(written).toContain("podcast: @[The Daily]\nauthor: \\@nytimes\n");
    const kind = { type: "episode", subtitle: ["podcast", "author"], mentions: ["podcast"] } as unknown as Parameters<typeof subtitleOf>[0];
    const meta = computeMeta(written);
    const value = (key: string) => meta.properties.find((property) => property.key === key)?.value;
    expect(subtitleOf(kind, value)).toBe("The Daily · @nytimes");
  });

  test("a cover had later (a feed's site's icon) goes under the note's title, at the width it's given", () => {
    const cover = { name: "0123456789abcdef0123456789abcdef.png", width: 18 };
    expect(text.withCover("---\ntype: feed\nfeed: https://news.ycombinator.com/rss\n---\n# Hacker News\n\nLinks for the curious.\n", "Hacker News", cover)).toBe(
      "---\ntype: feed\nfeed: https://news.ycombinator.com/rss\n---\n# Hacker News\n\n![Hacker News|18](../attachments/0123456789abcdef0123456789abcdef.png)\n\nLinks for the curious.\n",
    );
    expect(text.withCover("---\ntype: feed\n---\n# Quiet\n", "Quiet", cover)).toBe("---\ntype: feed\n---\n# Quiet\n\n![Quiet|18](../attachments/0123456789abcdef0123456789abcdef.png)\n");
    expect(text.coverOf(text.withCover("# A [bracketed] title\n", "A [bracketed] title", cover))).toBe(cover.name);
  });
});

describe("what something's about", () => {
  test("is short, cut at a sentence, and a summary the source cut off goes back to its last sentence", () => {
    const long = "A sentence that goes on. ".repeat(40);
    const [kept] = text.summary(long);
    expect(kept.length).toBeLessThanOrEqual(600);
    expect(kept.endsWith("goes on.")).toBe(true);
    expect(text.summary("The official video. Follow this link to get your ...")).toEqual(["The official video."]);
    expect(text.summary("<p>One.</p><p>Two.</p>")).toEqual(["One.", "Two."]);
  });

  test("is the text as it was, without HTML, and nothing for a page that says only dots", () => {
    expect(text.summary("Watch #rickroll with @rick now")).toEqual(["Watch #rickroll with @rick now"]);
    expect(text.summary("<b>Bold</b> and <img src=x.gif> plain")).toEqual(["Bold and plain"]);
    expect(text.summary("...")).toEqual([]);
  });

  test("values are written alike, whatever the source", () => {
    expect([text.dayOf("2009-10-24T23:57:33-07:00"), text.dayOf("+2023-10-18T00:00:00Z"), text.dayOf("1987")]).toEqual(["2009-10-24", "2023-10-18", undefined]);
    expect([text.yearOf("September 1, 1990"), text.yearOf(2024), text.yearOf("05 Nov 2021 00:00:00 GMT")]).toEqual(["1990", "2024", "2021"]);
    expect([text.isoSeconds("PT2H47M"), text.isoSeconds("PT3M34S"), text.isoSeconds("P0DT1H"), text.isoSeconds("3:34")]).toEqual([10020, 214, 3600, undefined]);
    expect([text.clock(214), text.clock(3733), text.runtime(10020)]).toEqual(["3:34", "1:02:13", "167 min"]);
  });
});

describe("a page's description of itself", () => {
  test("reads JSON-LD wrapped in comments, tags in either quotes, and links made whole", () => {
    const read = page("letterboxd.html", "https://letterboxd.com/film/dune-part-two/?ref=share");
    expect(read.url).toBe("https://letterboxd.com/film/dune-part-two/");
    expect(read.data.map((each) => each["@type"])).toEqual(["Movie"]);
    expect(read.meta.get("og:type")).toBe("video.movie");
    expect(page("substack.html", "https://www.astralcodexten.com/p/x").links.find((link) => link.type === "application/rss+xml")?.href).toBe("https://www.astralcodexten.com/feed");
    expect(decodeEntities("Rock &amp; Roll &#8217;s &#x2014; &bull; &nope;")).toBe("Rock & Roll ’s — • &nope;");
  });

  test("a movie, from Letterboxd's JSON-LD", () => {
    expect(itemOfPage(page("letterboxd.html", "https://letterboxd.com/film/dune-part-two/"))).toEqual({
      type: "movie",
      title: "Dune: Part Two",
      link: "https://letterboxd.com/film/dune-part-two/",
      properties: [
        ["director", "Denis Villeneuve"],
        ["year", "2024"],
        ["runtime", "167 min"],
        ["genre", "Adventure, Science Fiction"],
      ],
      cover: "https://a.ltrbxd.com/resized/film-poster/6/1/7/4/4/3/617443-dune-part-two-0-600-0-900-crop.jpg?v=cc533700f8",
      description: expect.stringContaining("Follow the mythic journey of Paul Atreides"),
    });
  });

  test("a song, its artist and album from how Spotify describes it", () => {
    const item = itemOfPage(page("spotify.html", "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=x"))!;
    expect([item.type, item.title, item.link]).toEqual(["song", "Never Gonna Give You Up", "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"]);
    expect(item.properties).toEqual([
      ["artist", "Rick Astley"],
      ["album", "Whenever You Need Somebody"],
      ["year", "1987"],
      ["duration", "3:34"],
    ]);
  });

  test("an article, and an album", () => {
    const article = itemOfPage(page("substack.html", "https://www.astralcodexten.com/p/the-psychopolitics-of-trauma"))!;
    expect([article.type, article.title, article.properties]).toEqual([
      "article",
      "The Psychopolitics Of Trauma",
      [
        ["author", "Scott Alexander"],
        ["site", "Astral Codex Ten"],
        ["published", "2024-01-25"],
      ],
    ]);
    expect(text.libraryNoteText(article)).not.toContain("...");
    const album = itemOfPage(page("bandcamp.html", "https://radiohead.bandcamp.com/album/kid-a-mnesia"))!;
    expect([album.type, album.title, album.properties]).toEqual([
      "album",
      "KID A MNESIA",
      [
        ["artist", "Radiohead"],
        ["year", "2021"],
        ["tracks", "34"],
      ],
    ]);
  });

  test("a page that doesn't say what it is isn't anything: nothing is guessed", () => {
    expect(itemOfPage(readPage('<title>Hello</title><meta property="og:type" content="website">', "https://example.com/"))).toBeNull();
  });
});

describe("YouTube", () => {
  test("knows its videos' links, and only those", () => {
    for (const link of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "https://youtu.be/dQw4w9WgXcQ?si=x", "https://m.youtube.com/shorts/dQw4w9WgXcQ"]) {
      expect(youtubeId(new URL(link)), link).toBe("dQw4w9WgXcQ");
    }
    for (const link of ["https://www.youtube.com/@RickAstleyYT", "https://music.youtube.com/watch?v=dQw4w9WgXcQ", "https://notyoutube.com/watch?v=dQw4w9WgXcQ"]) {
      expect(youtubeId(new URL(link)), link).toBeNull();
    }
  });

  test("asks oEmbed for a video, sending only its link, and takes its largest picture there is", async () => {
    answers.set("https://www.youtube.com/oembed", { title: "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)", author_name: "Rick Astley", thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" });
    answers.set("https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg", {});
    const item = await look(youtube, "https://youtu.be/dQw4w9WgXcQ?si=shared");
    expect(item).toEqual({
      type: "video",
      title: "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
      link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      properties: [["channel", "Rick Astley"]],
      cover: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
      description: undefined,
    });
    expect(asked).toEqual([
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=dQw4w9WgXcQ")}`,
      "HEAD https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    ]);
  });

  test("a video gone or private is nothing", async () => {
    answers.set("https://www.youtube.com/oembed", 401);
    await expect(look(youtube, "https://youtu.be/dQw4w9WgXcQ")).rejects.toThrow();
    answers.set("https://www.youtube.com/oembed", 404);
    expect(await look(youtube, "https://youtu.be/dQw4w9WgXcQ")).toBeNull();
  });
});

describe("Open Library", () => {
  test("knows books by their links there and ISBNs in links, checked", () => {
    expect(isIsbn("9780441172719")).toBe(true);
    expect(isIsbn("0441172717")).toBe(true);
    expect(isIsbn("9780441172718")).toBe(false);
    expect(bookIn(new URL("https://openlibrary.org/works/OL893414W/Dune"))).toEqual({ work: "OL893414W" });
    expect(bookIn(new URL("https://www.amazon.com/Dune-Frank-Herbert/dp/0441172717/ref=sr_1_1"))).toEqual({ isbn: "0441172717" });
    expect(bookIn(new URL("https://bookshop.org/a/1/978-0-441-17271-9?isbn=978-0-441-17271-9"))).toEqual({ isbn: "9780441172719" });
    expect(bookIn(new URL("https://www.amazon.com/dp/B0CL5W2Z1L"))).toBeNull();
  });

  test("a book by its ISBN: the edition, its work's description, and its author", async () => {
    // Trimmed from openlibrary.org's answers (November 2026).
    answers.set("https://openlibrary.org/isbn/9780441172719.json", {
      title: "Dune",
      authors: [{ key: "/authors/OL79034A" }],
      publish_date: "2020",
      publishers: ["Ace"],
      number_of_pages: 896,
      isbn_13: ["9780441172719"],
      covers: [15110282],
      works: [{ key: "/works/OL893415W" }],
    });
    answers.set("https://openlibrary.org/works/OL893415W.json", { title: "Dune", description: { type: "/type/text", value: "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides." } });
    answers.set("https://openlibrary.org/authors/OL79034A.json", { name: "Frank Herbert" });
    expect(await look(openLibrary, "https://isbnsearch.org/isbn/9780441172719")).toEqual({
      type: "book",
      title: "Dune",
      link: "https://isbnsearch.org/isbn/9780441172719",
      properties: [
        ["author", "Frank Herbert"],
        ["year", "2020"],
        ["pages", "896"],
        ["publisher", "Ace"],
        ["isbn", "9780441172719"],
      ],
      cover: "https://covers.openlibrary.org/b/id/15110282-L.jpg",
      description: "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides.",
    });
  });
});

describe("Wikidata", () => {
  test("knows films and series by IMDb, The Movie Database, Letterboxd, Wikipedia and Wikidata links", () => {
    expect(itemIn(new URL("https://www.imdb.com/title/tt15239678/?ref_=nv"))).toEqual({ property: "P345", id: "tt15239678" });
    expect(itemIn(new URL("https://m.imdb.com/title/tt0903747/"))).toEqual({ property: "P345", id: "tt0903747" });
    expect(itemIn(new URL("https://www.themoviedb.org/tv/1396-breaking-bad"))).toEqual({ property: "P4983", id: "1396" });
    expect(itemIn(new URL("https://letterboxd.com/film/dune-part-two/"))).toEqual({ property: "P6127", id: "dune-part-two" });
    expect(itemIn(new URL("https://fr.m.wikipedia.org/wiki/Dune,_deuxi%C3%A8me_partie"))).toEqual({ wiki: "fr", title: "Dune,_deuxième_partie" });
    expect(itemIn(new URL("https://en.wikipedia.org/wiki/Special:Random"))).toBeNull();
    expect(itemIn(new URL("https://www.imdb.com/name/nm0898288/"))).toBeNull();
    // A `%` that isn't one of an address's escapes is no page's title, and nothing to fail on.
    expect(itemIn(new URL("https://en.wikipedia.org/wiki/100%"))).toBeNull();
    expect(itemIn(new URL("https://en.wikipedia.org/wiki/Caf%E9"))).toBeNull();
  });

  test("a film by its IMDb id: its director, first year, runtime, genres, Wikipedia's summary and the poster its page shows", async () => {
    // Trimmed from wikidata.org's and Wikipedia's answers (November 2026).
    answers.set("https://www.wikidata.org/w/api.php?action=query", { query: { search: [{ title: "Q109228991" }] } });
    const claim = (value: unknown) => ({ mainsnak: { datavalue: { value } } });
    answers.set("https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q109228991", {
      entities: {
        Q109228991: {
          labels: { en: { value: "Dune: Part Two", language: "mul" } },
          sitelinks: { enwiki: { title: "Dune: Part Two" } },
          claims: {
            P31: [claim({ id: "Q11424" })],
            P345: [claim("tt15239678")],
            P57: [claim({ id: "Q548823" })],
            P577: [claim({ time: "+2024-03-01T00:00:00Z" }), claim({ time: "+2023-10-18T00:00:00Z" })],
            P2047: [claim({ amount: "+165", unit: "http://www.wikidata.org/entity/Q7727" })],
            P136: [claim({ id: "Q471839" }), claim({ id: "Q188473" })],
          },
        },
      },
    });
    answers.set("https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q548823", {
      entities: {
        Q548823: { labels: { en: { value: "Denis Villeneuve" } } },
        Q471839: { labels: { en: { value: "science fiction film" } } },
        Q188473: { labels: { en: { value: "action film" } } },
      },
    });
    answers.set("https://en.wikipedia.org/api/rest_v1/page/summary/Dune%3A_Part_Two", {
      wikibase_item: "Q109228991",
      extract: "Dune: Part Two is a 2024 American epic space opera film directed by Denis Villeneuve.",
    });
    // Its poster isn't free: PageImages gives it, asked for any.
    answers.set("https://en.wikipedia.org/w/api.php?action=query&prop=pageimages", {
      query: { pages: { "1": { title: "Dune: Part Two", pageimage: "Dune_Part_Two_poster.jpeg", thumbnail: { source: "https://upload.wikimedia.org/wikipedia/en/5/52/Dune_Part_Two_poster.jpeg" } } } },
    });
    expect(await look(wikidata, "https://www.imdb.com/title/tt15239678/")).toEqual({
      type: "movie",
      title: "Dune: Part Two",
      link: "https://www.imdb.com/title/tt15239678/",
      properties: [
        ["director", "Denis Villeneuve"],
        ["year", "2023"],
        ["runtime", "165 min"],
        ["genre", "Science fiction, Action"],
      ],
      cover: "https://upload.wikimedia.org/wikipedia/en/5/52/Dune_Part_Two_poster.jpeg",
      description: "Dune: Part Two is a 2024 American epic space opera film directed by Denis Villeneuve.",
      ids: ["wikidata:Q109228991", "wikipedia:en:Dune:_Part_Two", "imdb:tt15239678"],
    });
    expect(new URL(asked[0]).searchParams.get("srsearch")).toBe("haswbstatement:P345=tt15239678");
    expect(new URL(asked.find((each) => each.includes("pageimages"))!).searchParams.get("pilicense")).toBe("any");
  });

  test("something Wikidata has that isn't a film, a series or a book is nothing", async () => {
    answers.set("https://en.wikipedia.org/api/rest_v1/page/summary/Paris", { wikibase_item: "Q90", extract: "Paris is the capital of France." });
    answers.set("https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q90", { entities: { Q90: { labels: { en: { value: "Paris" } }, claims: { P31: [{ mainsnak: { datavalue: { value: { id: "Q515" } } } }] } } } });
    expect(await look(wikidata, "https://en.wikipedia.org/wiki/Paris")).toBeNull();
  });
});

describe("MusicBrainz", () => {
  test("knows its own links, and those to music elsewhere it may know", () => {
    expect(musicIn(new URL("https://musicbrainz.org/recording/8f3471b5-7e6a-48da-86a9-c1c07a0f47ae"))).toEqual({ kind: "recording", id: "8f3471b5-7e6a-48da-86a9-c1c07a0f47ae" });
    expect(musicIn(new URL("https://open.spotify.com/intl-de/album/6N9PS4QXF1D0OWPk0Sxtb4?si=x"))).toBe("streaming");
    expect(musicIn(new URL("https://radiohead.bandcamp.com/album/kid-a-mnesia"))).toBe("streaming");
    expect(musicIn(new URL("https://open.spotify.com/user/someone"))).toBeNull();
  });

  test("a song: who it's by, the album it's on, its year and length, and the album's cover", async () => {
    // Trimmed from musicbrainz.org's answer (November 2026).
    answers.set("https://musicbrainz.org/ws/2/recording/8f3471b5-7e6a-48da-86a9-c1c07a0f47ae", {
      id: "8f3471b5-7e6a-48da-86a9-c1c07a0f47ae",
      title: "Never Gonna Give You Up",
      length: 212946,
      "first-release-date": "1987-07-27",
      "artist-credit": [{ name: "Rick Astley", joinphrase: "" }],
      releases: [
        { id: "7171f94c-7307-4ca7-a2db-a5e4be09cdac", title: "Never Gonna Give You Up", "release-group": { id: "19a8b6e5-f753-36c6-a3c6-189390d09935", title: "Never Gonna Give You Up", "primary-type": "Single" } },
        { id: "a1", title: "Whenever You Need Somebody", "release-group": { id: "082c6aff-a7cc-36e0-a960-35a578ecd937", title: "Whenever You Need Somebody", "primary-type": "Album" } },
      ],
    });
    expect(await look(musicbrainz, "https://musicbrainz.org/recording/8f3471b5-7e6a-48da-86a9-c1c07a0f47ae")).toEqual({
      type: "song",
      title: "Never Gonna Give You Up",
      link: "https://musicbrainz.org/recording/8f3471b5-7e6a-48da-86a9-c1c07a0f47ae",
      properties: [
        ["artist", "Rick Astley"],
        ["album", "Whenever You Need Somebody"],
        ["year", "1987"],
        ["duration", "3:33"],
      ],
      cover: "https://coverartarchive.org/release-group/082c6aff-a7cc-36e0-a960-35a578ecd937/front-500",
    });
    expect(asked[0]).toEndWith("?inc=artist-credits+releases+release-groups&fmt=json");
  });

  test("an album on Spotify that MusicBrainz knows, asked by its address alone", async () => {
    answers.set("https://musicbrainz.org/ws/2/url", { relations: [{ release: { id: "98c0cd5f-fa84-45d9-839f-cc5d276dd5be" } }] });
    answers.set("https://musicbrainz.org/ws/2/release/98c0cd5f", {
      id: "98c0cd5f-fa84-45d9-839f-cc5d276dd5be",
      title: "Whenever You Need Somebody",
      "artist-credit": [{ name: "Rick Astley", joinphrase: "" }],
      media: [{ "track-count": 10 }],
      "cover-art-archive": { front: true },
      "release-group": { id: "082c6aff-a7cc-36e0-a960-35a578ecd937", title: "Whenever You Need Somebody", "first-release-date": "1987-10-01" },
    });
    const item = await look(musicbrainz, "https://open.spotify.com/intl-de/album/6N9PS4QXF1D0OWPk0Sxtb4?si=shared");
    expect(item?.properties).toEqual([
      ["artist", "Rick Astley"],
      ["year", "1987"],
      ["tracks", "10"],
    ]);
    expect(new URL(asked[0]).searchParams.get("resource")).toBe("https://open.spotify.com/album/6N9PS4QXF1D0OWPk0Sxtb4");
  });
});

describe("Spotify", () => {
  test("knows its songs', albums', playlists', artists', podcasts' and episodes' links, and plays them without who shared them", () => {
    expect(spotifyIn(new URL("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=0123456789abcdef"))).toEqual({ kind: "track", id: "4uLU6hMCjMI75M1A2tKUQC" });
    expect(spotifyIn(new URL("https://open.spotify.com/intl-de/album/6N9PS4QXF1D0OWPk0Sxtb4"))).toEqual({ kind: "album", id: "6N9PS4QXF1D0OWPk0Sxtb4" });
    expect(spotifyIn(new URL("https://open.spotify.com/embed/show/4rOoJ6Egrf8K2IrywzwOMk"))).toEqual({ kind: "show", id: "4rOoJ6Egrf8K2IrywzwOMk" });
    for (const not of ["https://open.spotify.com/user/someone", "https://open.spotify.com/track/short", "https://spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC/more"]) {
      expect(spotifyIn(new URL(not)), not).toBeNull();
    }
    expect(spotifyLink("https://open.spotify.com/intl-fr/episode/0R6JJpgimzFfiGkdeFgimD?si=abc&context=x")).toBe("https://open.spotify.com/episode/0R6JJpgimzFfiGkdeFgimD");
    expect(spotifyLink("https://example.com/track/4uLU6hMCjMI75M1A2tKUQC")).toBeNull();
  });

  test("isn't a source for the library: its terms don't let what it says be kept, so its links go to MusicBrainz and Web Pages", () => {
    expect(spotify().contributes.librarySources).toBeUndefined();
  });
});

describe("SoundCloud", () => {
  /** The feed SoundCloud's source says a link names, as Subscribe asks it (namedFeed). */
  const feedOf = (link: string) => sourceOf(soundcloud).feed!(new URL(link), new AbortController().signal);

  test("knows tracks, sets and people's links, a private one's with its secret, and not SoundCloud's own pages or people's tabs", () => {
    expect(soundcloudIn(new URL("https://soundcloud.com/forss/flickermood?si=abc&utm_source=clipboard"))).toEqual({ kind: "track", page: "https://soundcloud.com/forss/flickermood" });
    expect(soundcloudIn(new URL("https://m.soundcloud.com/forss/sets/soulhack"))).toEqual({ kind: "set", page: "https://soundcloud.com/forss/sets/soulhack" });
    expect(soundcloudIn(new URL("https://soundcloud.com/forss"))).toEqual({ kind: "user", page: "https://soundcloud.com/forss" });
    expect(soundcloudIn(new URL("https://soundcloud.com/forss/demo/s-AbCdEfGhIjK"))).toEqual({ kind: "track", page: "https://soundcloud.com/forss/demo/s-AbCdEfGhIjK" });
    expect(soundcloudIn(new URL("https://soundcloud.com/forss/sets/demos/s-AbCdEfGhIjK"))).toEqual({ kind: "set", page: "https://soundcloud.com/forss/sets/demos/s-AbCdEfGhIjK" });
    // A track whose name starts like a secret is a track, as is someone's.
    expect(soundcloudIn(new URL("https://soundcloud.com/someone/s-curve"))).toEqual({ kind: "track", page: "https://soundcloud.com/someone/s-curve" });
    expect(soundcloudIn(new URL("https://soundcloud.com/s-curve"))).toEqual({ kind: "user", page: "https://soundcloud.com/s-curve" });
    for (const not of ["https://soundcloud.com/discover", "https://soundcloud.com/forss/likes", "https://soundcloud.com/forss/sets", "https://soundcloud.com/forss/flickermood/comments", "https://soundcloud.com/forss/demo/s-short", "https://soundcloudx.com/forss"]) {
      expect(soundcloudIn(new URL(not)), not).toBeNull();
    }
  });

  test("a track from its oEmbed: its title without who it's by, its artist, its cover and what it's about as text, sent only its link", async () => {
    // Trimmed from SoundCloud's oEmbed's answer (November 2026).
    answers.set("https://soundcloud.com/oembed", {
      title: "Flickermood by Forss",
      author_name: "Forss",
      description: 'From the Soulhack album,&nbsp;recently featured in this ad <a href="https://www.dswshoes.com/tv_commercial.jsp?m=october2007">https://www.dswshoes.com/tv_commercial.jsp?m=october2007</a> ',
      thumbnail_url: "https://i1.sndcdn.com/artworks-000067273316-smsiqx-t500x500.jpg",
      html: '<iframe width="100%" height="400" scrolling="no" frameborder="no" allow="autoplay; encrypted-media" src="https://w.soundcloud.com/player/?visual=true&url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F293&show_artwork=true"></iframe>',
    });
    const item = await look(soundcloud, "https://soundcloud.com/forss/flickermood?si=abc");
    expect(item).toMatchObject({ type: "song", title: "Flickermood", link: "https://soundcloud.com/forss/flickermood", properties: [["artist", "Forss"]], cover: "https://i1.sndcdn.com/artworks-000067273316-smsiqx-t500x500.jpg" });
    expect(item?.description).toStartWith("From the Soulhack album,");
    expect(item?.description).not.toContain("&nbsp;");
    expect(asked).toEqual(["https://soundcloud.com/oembed?format=json&url=https%3A%2F%2Fsoundcloud.com%2Fforss%2Fflickermood"]);
  });

  test("a set, an album or a playlist, isn't asked; nor is a track's link for a feed; and someone whose feed can't be read isn't a podcast", async () => {
    expect(await look(soundcloud, "https://soundcloud.com/forss/sets/soulhack")).toBeNull();
    expect(await feedOf("https://soundcloud.com/forss/flickermood")).toBeNull();
    expect(asked).toEqual([]);
    answers.set("https://soundcloud.com/oembed", { title: "Forss", author_name: "Forss", html: '<iframe src="https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Fusers%2F183"></iframe>' });
    expect(await look(soundcloud, "https://soundcloud.com/forss")).toBeNull();
    expect(asked).toEqual(["https://soundcloud.com/oembed?format=json&url=https%3A%2F%2Fsoundcloud.com%2Fforss", "https://feeds.soundcloud.com/users/soundcloud:users:183/sounds.rss"]);
    // One that couldn't answer couldn't be asked, which the library says.
    answers.set("https://feeds.soundcloud.com/", 503);
    await expect(look(soundcloud, "https://soundcloud.com/forss")).rejects.toThrow("HTTP 503");
  });
});

describe("Apple Podcasts", () => {
  // Trimmed from the iTunes Search API's answers (November 2026).
  const podcast = {
    kind: "podcast",
    collectionName: "The Daily",
    artistName: "The New York Times",
    feedUrl: "https://feeds.simplecast.com/Sl5CSM3S",
    collectionViewUrl: "https://podcasts.apple.com/us/podcast/the-daily/id1200361736?uo=4",
    artworkUrl600: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/ab/64/66/ab6466a9/mza_15084852813176276273.jpg/600x600bb.jpg",
  };

  test("knows podcasts' and episodes' links", () => {
    expect(podcastIn(new URL("https://podcasts.apple.com/us/podcast/the-daily/id1200361736"))).toEqual({ id: "1200361736", country: "us" });
    expect(podcastIn(new URL("https://podcasts.apple.com/gb/podcast/the-daily/id1200361736?i=1000801496509"))).toEqual({ id: "1200361736", country: "gb", episode: "1000801496509" });
    expect(podcastIn(new URL("https://podcasts.apple.com/us/artist/the-new-york-times/121664449"))).toBeNull();
  });

  test("a podcast, with its feed; an episode, and its podcast", async () => {
    answers.set("https://itunes.apple.com/lookup?id=1200361736&country=us&entity", {
      results: [
        podcast,
        {
          kind: "podcast-episode",
          trackId: 1000801496509,
          trackName: "An Episode",
          collectionName: "The Daily",
          releaseDate: "2026-11-12T10:52:06Z",
          trackTimeMillis: 1480000,
          episodeUrl: "https://example.com/episode.mp3",
          trackViewUrl: "https://podcasts.apple.com/us/podcast/an-episode/id1200361736?i=1000801496509&uo=4",
          description: "What it's about.",
        },
      ],
    });
    answers.set("https://itunes.apple.com/lookup?id=1200361736&country=us", { results: [podcast] });
    expect(await look(applePodcasts, "https://podcasts.apple.com/us/podcast/the-daily/id1200361736")).toEqual({
      type: "podcast",
      title: "The Daily",
      link: "https://podcasts.apple.com/us/podcast/the-daily/id1200361736",
      properties: [
        ["author", "The New York Times"],
        ["feed", "https://feeds.simplecast.com/Sl5CSM3S"],
      ],
      cover: podcast.artworkUrl600,
      description: undefined,
    });
    const episode = await look(applePodcasts, "https://podcasts.apple.com/us/podcast/the-daily/id1200361736?i=1000801496509");
    expect(episode?.properties).toEqual([
      ["podcast", "The Daily"],
      ["published", "2026-11-12"],
      ["duration", "24:40"],
      ["audio", "https://example.com/episode.mp3"],
    ]);
    expect(episode?.link).toBe("https://podcasts.apple.com/us/podcast/an-episode/id1200361736?i=1000801496509");
  });
});

describe("searching the catalogs (Add to Library)", () => {
  const find = (plugin: () => Plugin, type: string, text: string) => sourceOf(plugin).search!(type, text, new AbortController().signal);

  test("Open Library: books by title or author, each its work, with a small cover", async () => {
    // Trimmed from openlibrary.org's answer (November 2026).
    answers.set("https://openlibrary.org/search.json", { docs: [{ key: "/works/OL893414W", title: "Dune", author_name: ["Frank Herbert"], first_publish_year: 1965, cover_i: 11481354 }, { key: "/works/OL1W", title: "No Cover" }] });
    expect(await find(openLibrary, "book", "dune")).toEqual([
      { type: "book", title: "Dune", link: "https://openlibrary.org/works/OL893414W", properties: [["author", "Frank Herbert"], ["year", "1965"]], cover: "https://covers.openlibrary.org/b/id/11481354-M.jpg" },
      { type: "book", title: "No Cover", link: "https://openlibrary.org/works/OL1W", properties: [], cover: undefined },
    ]);
    expect(new URL(asked[0]).searchParams.get("q")).toBe("dune");
  });

  test("Wikidata: films of that title, the one titled as typed and the best known first, with Wikipedia's posters", async () => {
    // Trimmed from wikidata.org's and Wikipedia's answers (November 2026).
    answers.set("https://www.wikidata.org/w/api.php?action=query", { query: { search: [{ title: "Q20972530" }, { title: "Q60834962" }] } });
    answers.set("https://www.wikidata.org/w/api.php?action=wbgetentities", {
      entities: {
        Q20972530: { labels: { en: { value: "The Dune" } }, descriptions: { en: { value: "2013 French-Israeli drama film by Yossi Aviram" } }, sitelinks: { enwiki: { title: "The Dune (film)" } } },
        Q60834962: { labels: { en: { value: "Dune" } }, descriptions: { en: { value: "2021 film directed by Denis Villeneuve" } }, sitelinks: { enwiki: { title: "Dune (2021 film)" }, frwiki: { title: "Dune (film, 2021)" } } },
      },
    });
    answers.set("https://en.wikipedia.org/w/api.php", { query: { pages: { 1: { title: "Dune (2021 film)", pageimage: "Dune_(2021_film).jpg", thumbnail: { source: "https://upload.wikimedia.org/dune.jpg" } } } } });
    const found = await find(wikidata, "movie", "dune");
    expect(found.map((item) => [item.title, item.link, item.cover, item.description])).toEqual([
      ["Dune", "https://en.wikipedia.org/wiki/Dune_(2021_film)", "https://upload.wikimedia.org/dune.jpg", "2021 film directed by Denis Villeneuve"],
      ["The Dune", "https://en.wikipedia.org/wiki/The_Dune_(film)", undefined, "2013 French-Israeli drama film by Yossi Aviram"],
    ]);
    expect(new URL(asked[0]).searchParams.get("srsearch")).toStartWith("dune haswbstatement:P31=Q11424|");
    // Chosen, its Wikipedia link is what's looked up for the rest.
    expect(itemIn(new URL(found[0].link!))).toEqual({ wiki: "en", title: "Dune_(2021_film)" });
  });

  test("MusicBrainz: songs with the album they're on, and albums, the words searched for taken as words", async () => {
    // Trimmed from musicbrainz.org's answers (November 2026).
    answers.set("https://musicbrainz.org/ws/2/recording?", {
      recordings: [
        {
          id: "8f3471b5-7e6a-48da-86a9-c1c07a0f47ae",
          title: "Never Gonna Give You Up",
          "artist-credit": [{ name: "Rick Astley", joinphrase: "" }],
          releases: [{ id: "a1", title: "Whenever You Need Somebody", "release-group": { id: "082c6aff-a7cc-36e0-a960-35a578ecd937", title: "Whenever You Need Somebody", "primary-type": "Album" } }],
        },
      ],
    });
    answers.set("https://musicbrainz.org/ws/2/release-group?", { "release-groups": [{ id: "082c6aff-a7cc-36e0-a960-35a578ecd937", title: "Whenever You Need Somebody", "first-release-date": "1987-11-16", "artist-credit": [{ name: "Rick Astley", joinphrase: "" }] }] });
    const [song] = await find(musicbrainz, "song", "never gonna (give)");
    expect([song.title, song.properties, song.cover]).toEqual([
      "Never Gonna Give You Up",
      [
        ["artist", "Rick Astley"],
        ["album", "Whenever You Need Somebody"],
      ],
      "https://coverartarchive.org/release-group/082c6aff-a7cc-36e0-a960-35a578ecd937/front-250",
    ]);
    expect(new URL(asked[0]).searchParams.get("query")).toBe("never gonna \\(give\\)");
    const [album] = await find(musicbrainz, "album", "whenever");
    expect([album.type, album.link, album.properties]).toEqual([
      "album",
      "https://musicbrainz.org/release-group/082c6aff-a7cc-36e0-a960-35a578ecd937",
      [
        ["artist", "Rick Astley"],
        ["year", "1987"],
      ],
    ]);
  });

  test("Apple Podcasts: podcasts with their feeds", async () => {
    // Trimmed from the iTunes Search API's answer (November 2026).
    answers.set("https://itunes.apple.com/search", {
      results: [{ collectionName: "The Daily", artistName: "The New York Times", feedUrl: "https://feeds.simplecast.com/Sl5CSM3S", collectionViewUrl: "https://podcasts.apple.com/us/podcast/the-daily/id1200361736?uo=4", artworkUrl100: "https://is1-ssl.mzstatic.com/a/100x100bb.jpg" }],
    });
    expect(await find(applePodcasts, "podcast", "the daily")).toEqual([
      {
        type: "podcast",
        title: "The Daily",
        link: "https://podcasts.apple.com/us/podcast/the-daily/id1200361736",
        properties: [
          ["author", "The New York Times"],
          ["feed", "https://feeds.simplecast.com/Sl5CSM3S"],
        ],
        cover: "https://is1-ssl.mzstatic.com/a/100x100bb.jpg",
      },
    ]);
    expect(new URL(asked[0]).searchParams.get("term")).toBe("the daily");
  });
});

describe("arXiv", () => {
  test("a paper, as the library keeps it", () => {
    const item = paperItem({ id: "1706.03762", title: "Attention Is All You Need", authors: ["Ashish Vaswani", "Noam Shazeer"], year: 2017, url: "https://arxiv.org/abs/1706.03762", abstract: "The dominant sequence transduction models…" });
    expect(item.properties).toEqual([
      ["authors", "Ashish Vaswani, Noam Shazeer"],
      ["year", "2017"],
      ["arxiv", "1706.03762"],
    ]);
    expect(item.description).toBe("The dominant sequence transduction models…");
  });
});

describe("asking the web", () => {
  test("only asks a page's addresses on the web at large, over https", () => {
    for (const address of ["https://i.ytimg.com/vi/x/hq.jpg", "https://upload.wikimedia.org/a.jpg", "https://8.8.8.8/a.png", "https://172.32.0.1/a.png"]) {
      expect(isPublic(address), address).toBe(true);
    }
    for (const address of [
      "http://example.com/a.png",
      "file:///etc/passwd",
      "https://localhost/a.png",
      "https://printer/a.png",
      "https://nas.local/a.png",
      "https://127.0.0.1/a.png",
      "https://10.0.0.2/a.png",
      "https://172.16.0.1/a.png",
      "https://192.168.1.1/a.png",
      "https://169.254.169.254/latest/meta-data",
      "https://100.64.0.1/a.png",
      "https://[::1]/a.png",
      "not an address",
    ]) {
      expect(isPublic(address), address).toBe(false);
    }
  });

  test("what a page says of itself in a few words: its description, and its picture made whole, if it's one to ask", async () => {
    const signal = new AbortController().signal;
    answers.set("https://article.example/post", '<head><meta property="og:description" content="Six hundred runs, and what they showed."><meta property="og:image" content="/cover.png"></head>');
    answers.set("https://lan.example/post", '<head><meta name="description" content="On the network."><meta property="og:image" content="https://192.168.1.1/a.png"></head>');
    answers.set("https://quiet.example/", "<head><title>Nothing said</title></head>");
    expect(await pageSummary("https://article.example/post", signal)).toEqual({ description: "Six hundred runs, and what they showed.", image: "https://article.example/cover.png" });
    expect(await pageSummary("https://lan.example/post", signal)).toEqual({ description: "On the network.", image: undefined });
    expect(await pageSummary("https://quiet.example/", signal)).toBeNull();
    expect(await pageSummary("https://gone.example/", signal)).toBeNull();
  });

  test("a cover that isn't on the web at large isn't asked for, and nothing's kept", async () => {
    const note = await libraryNote({ type: "movie", title: "Dune", properties: [], cover: "https://192.168.1.1/poster.jpg" });
    expect(asked).toEqual([]);
    expect(text.coverOf(note.text)).toBeNull();
    await note.keep();
  });

  test("a page's oEmbed on this computer's network isn't asked", async () => {
    answers.set("https://example.com/video", '<html><head><link rel="alternate" type="application/json+oembed" href="http://127.0.0.1:8080/oembed"></head></html>');
    expect(await look(webPages, "https://example.com/video")).toBeNull();
    expect(asked).toEqual(["https://example.com/video"]);
  });

  test("a request waiting behind one that never answers gives up as soon as it's stopped", async () => {
    const paced = pacing(10);
    void paced(() => new Promise(() => {}), new AbortController().signal).catch(() => {});
    const later = new AbortController();
    const second = paced(async () => "second", later.signal);
    later.abort();
    expect(await second.then(() => "answered", () => "stopped")).toBe("stopped");
  });

  test("a request gives up after a while by itself, or when it's stopped", async () => {
    const timed = withTimeout(new AbortController().signal, 10);
    await new Promise((resolve) => timed.addEventListener("abort", resolve));
    expect((timed.reason as DOMException).name).toBe("TimeoutError");
    const stop = new AbortController();
    const stopped = withTimeout(stop.signal, 60_000);
    stop.abort();
    expect(stopped.aborted).toBe(true);
  });
});

describe("bookmarks", () => {
  const backup = readFileSync(new URL("fixtures/bookmarks/firefox.json", import.meta.url), "utf8");

  test("Firefox's backup: its bookmarks in their folders, its own folders named as its bookmark file names them", () => {
    const read = bookmarks.readBookmarks(backup)!;
    expect(read.map(({ title, url, folders }) => [title, url, folders.join(" / ")])).toEqual([
      ["Firefox", "https://www.mozilla.org/en-US/firefox/", ""],
      ["The Food Lab | Serious Eats", "https://www.seriouseats.com/the-food-lab", "Recipes"],
      ["Recently Bookmarked", "place:parent=menu________&sort=12&maxResults=10", ""],
      ["GitHub", "https://github.com/", "Bookmarks Toolbar"],
      ["HTML 5.2", "https://www.w3.org/TR/html52/", "Other Bookmarks"],
    ]);
    // Its microseconds, as milliseconds; its tags and description.
    expect(read[0]).toEqual({
      title: "Firefox",
      url: "https://www.mozilla.org/en-US/firefox/",
      folders: [],
      added: 1650000100000,
      tags: ["mozilla", "Web Browsers"],
      description: "The browser that puts you first",
    });
  });

  test("are told from other files by their start", () => {
    expect(bookmarks.isBookmarks(backup)).toBe(true);
    expect(bookmarks.isBookmarks("\uFEFF<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<TITLE>Bookmarks</TITLE>")).toBe(true);
    expect(bookmarks.isBookmarks('<ul><li><a href="https://example.com" time_added="1600000000">x</a></li></ul>')).toBe(true);
    for (const other of ['{"notes": []}', "<!doctype html><title>A page</title><a href='https://example.com'>x</a>", "# A note", "not json {"]) {
      expect(bookmarks.isBookmarks(other), other).toBe(false);
      expect(bookmarks.readBookmarks(other), other).toBeNull();
    }
  });

  test("dates in seconds, milliseconds or microseconds; none that can't be one", () => {
    expect([bookmarks.bookmarkTime("1700000000"), bookmarks.bookmarkTime(1700000000000), bookmarks.bookmarkTime(1700000000000000)]).toEqual([1700000000000, 1700000000000, 1700000000000]);
    for (const none of ["", "0", "-5", "soon", 123, Date.now() + 7 * 86_400_000, undefined]) expect(bookmarks.bookmarkTime(none), String(none)).toBeUndefined();
  });

  test("once each: not those in the library already, nor repeats (however their links are written), nor what isn't a web page", () => {
    const at = (url: string, title = url) => ({ title, url, folders: [], tags: [] });
    const plan = bookmarks.planImport(
      [
        at("https://example.com/a", "first"),
        at("HTTPS://EXAMPLE.com/a", "again"),
        at("http://www.example.com/a/?utm_source=feed", "and again"),
        at("https://example.com"),
        at("https://kept.org/x"),
        at("javascript:void(0)"),
        at("place:sort=8"),
        at("chrome://settings/"),
      ],
      (link) => keys.linkKey(link) === keys.linkKey("https://kept.org/x"),
    );
    expect(plan.add.map((each) => each.title)).toEqual(["first", "https://example.com"]);
    expect([plan.there, plan.repeated, plan.other]).toEqual([1, 2, 3]);
  });

  test("a resource's note: its folder, the day it was bookmarked, what it says of itself as text, and its tags as lines' own", () => {
    const bookmark = {
      title: "HTML 5.2",
      url: "https://www.w3.org/TR/html52/",
      folders: ["Other Bookmarks", "Specs & #Drafts"],
      added: 1650000400000,
      tags: ["reference", "#spec", "2024", "Web Browsers", "C++"],
      description: "#not-a-tag, and **not bold**",
    };
    expect(text.libraryNoteText(bookmarks.bookmarkItem(bookmark))).toBe(
      [
        "---",
        "type: resource",
        "folder: Other Bookmarks / Specs & \\#Drafts",
        `added: ${dayOf(1650000400000)}`,
        "link: https://www.w3.org/TR/html52/",
        "---",
        "# HTML 5.2",
        "",
        "\\#not-a-tag, and \\*\\*not bold\\*\\*",
        "",
        "#reference #spec #web-browsers #c",
        "",
      ].join("\n"),
    );
    // Tagged with its folders, asked: nested, as they are.
    expect(bookmarks.bookmarkItem(bookmark, { folderTags: true }).tags).toContain("other-bookmarks/specs-drafts");
    // Untitled, named by its link; undated, no day.
    const untitled = bookmarks.bookmarkItem({ title: "", url: "https://www.example.com/page/", folders: [], tags: [] });
    expect([untitled.title, untitled.properties]).toEqual(["example.com/page", []]);
  });
});

describe("the same thing, however it's added", () => {
  test("a link is the same page however it's written: its scheme, www., a closing /, where it was shared from", () => {
    const same = ["https://www.imdb.com/title/tt8962124/", "HTTP://IMDB.com/title/tt8962124", "https://www.imdb.com/title/tt8962124/?ref_=nv_sr_srsg_0", "https://imdb.com/title/tt8962124#"];
    expect(new Set(same.map(keys.linkKey))).toEqual(new Set(["imdb.com/title/tt8962124"]));
    // What's after `#` can be what the page shows, not only where on it.
    expect(keys.linkKey("https://app.example/#json=1")).not.toBe(keys.linkKey("https://app.example/#json=2"));
    expect(keys.linkKey("https://app.example/#!/inbox")).toBe("app.example#!/inbox");
    // But words on the page a browser's link goes to are only where on it.
    expect(keys.linkKey("https://example.com/a#:~:text=hello%20there")).toBe("example.com/a");
    expect(keys.linkKey("https://example.com/a#notes:~:text=hello")).toBe("example.com/a#notes");
    // What the query says of the page itself stays, in its order.
    expect(keys.linkKey("https://example.com/search?b=2&utm_medium=x&a=1")).toBe("example.com/search?a=1&b=2");
    expect(keys.linkKey("https://example.com/watch?v=1")).not.toBe(keys.linkKey("https://example.com/watch?v=2"));
  });

  test("an ISBN-10 is the ISBN-13 of the same book; one whose check digit doesn't add up is no book's", () => {
    expect(keys.isbnKey("0-441-17271-7")).toBe("9780441172719");
    expect(keys.isbnKey("978-0-441-17271-9")).toBe("9780441172719");
    expect(keys.isbnKey("080442957X")).toBe("9780804429573");
    for (const none of ["0000000000", "9780000000000", "0441172718", "978-0-441-17271-0", "12345"]) expect(keys.isbnKey(none), none).toBeNull();
  });

  test("each source knows its links by its own id, written any way", () => {
    const keyOf = (plugin: () => Plugin, link: string) => sourceOf(plugin).key?.(new URL(link));
    expect(keyOf(wikidata, "https://www.imdb.com/title/tt8962124/episodes/?season=2")).toBe("imdb:tt8962124");
    expect(keyOf(wikidata, "https://m.imdb.com/title/tt8962124")).toBe("imdb:tt8962124");
    expect(keyOf(wikidata, "https://en.wikipedia.org/wiki/Emily_in_Paris")).toBe("wikipedia:en:Emily_in_Paris");
    expect(keyOf(wikidata, "https://www.wikidata.org/wiki/Q64584978")).toBe("wikidata:Q64584978");
    expect([keyOf(youtube, "https://youtu.be/dQw4w9WgXcQ?si=abc"), keyOf(youtube, "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42")]).toEqual(["youtube:dQw4w9WgXcQ", "youtube:dQw4w9WgXcQ"]);
    expect([keyOf(openLibrary, "https://www.amazon.com/dp/0441172717"), keyOf(openLibrary, "https://openlibrary.org/isbn/9780441172719")]).toEqual(["isbn:9780441172719", "isbn:9780441172719"]);
    expect(keyOf(musicbrainz, "https://musicbrainz.org/recording/b1a9c0e9-d987-4042-ae91-78d6a3267d69")).toBe("musicbrainz:recording/b1a9c0e9-d987-4042-ae91-78d6a3267d69");
    expect(keyOf(applePodcasts, "https://podcasts.apple.com/gb/podcast/the-daily/id1200361736?i=1000801496509")).toBe("apple-podcasts:1200361736/1000801496509");
  });

  test("what Wikidata finds is known by its other sites' ids too, so a note of it from another link is found", async () => {
    answers.set("https://en.wikipedia.org/api/rest_v1/page/summary/Emily_in_Paris", { wikibase_item: "Q64584978", extract: "An American comedy-drama series." });
    answers.set("https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q64584978", {
      entities: {
        Q64584978: {
          labels: { en: { value: "Emily in Paris" } },
          sitelinks: { enwiki: { title: "Emily in Paris" } },
          claims: {
            P31: [{ mainsnak: { datavalue: { value: { id: "Q5398426" } } } }],
            P345: [{ mainsnak: { datavalue: { value: "tt8962124" } } }],
            P154: [{ mainsnak: { datavalue: { value: "Emily in Paris logo.svg" } } }],
          },
        },
      },
    });
    // Its page's picture is its logo: no cover, rather than a logo.
    answers.set("https://en.wikipedia.org/w/api.php?action=query&prop=pageimages", { query: { pages: { "1": { title: "Emily in Paris", pageimage: "Emily_in_Paris_logo.svg", thumbnail: { source: "https://upload.wikimedia.org/x/600px-Emily_in_Paris_logo.svg.png" } } } } });
    const item = (await look(wikidata, "https://en.wikipedia.org/wiki/Emily_in_Paris"))!;
    expect(item.ids).toEqual(expect.arrayContaining(["wikidata:Q64584978", "imdb:tt8962124", "wikipedia:en:Emily_in_Paris"]));
    expect(item.cover).toBeUndefined();
  });
});
