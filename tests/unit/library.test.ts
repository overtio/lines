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
// The version the app is built with, which requests from the apps say.
(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "0.0.0";

const text = await import("../../src/lib/library/text");
const { readPage, decodeEntities } = await import("../../src/lib/library/page");
const { itemOfPage } = await import("../../src/plugins/web-pages/read");
const { youtube, youtubeId } = await import("../../src/plugins/youtube");
const { openLibrary, bookIn, isIsbn } = await import("../../src/plugins/open-library");
const { wikidata, itemIn } = await import("../../src/plugins/wikidata");
const { musicbrainz, musicIn } = await import("../../src/plugins/musicbrainz");
const { applePodcasts, podcastIn } = await import("../../src/plugins/apple-podcasts");
const { paperItem } = await import("../../src/plugins/arxiv");

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
    expect(text.libraryNoteText(item, { status: "to watch", cover: "0123456789abcdef0123456789abcdef.jpg" })).toBe(
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
        "![Dune: Part Two](../attachments/0123456789abcdef0123456789abcdef.jpg)",
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
    const written = text.libraryNoteText(item, { cover: "0123456789abcdef0123456789abcdef.jpg" });
    expect(text.coverOf(written)).toBe("0123456789abcdef0123456789abcdef.jpg");
    expect(text.coverOf("![](https://example.com/a.png)")).toBeNull();
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

  test("adds no tags, mentions or headings to the note, and nothing for a page that says only dots", () => {
    expect(text.summary("Watch #rickroll with @rick now")).toEqual(["Watch with \\@rick now"]);
    expect(text.summary("# Not a heading\n\n- not a list")).toEqual(["\\# Not a heading", "\\- not a list"]);
    expect(text.summary("C# for #1 fans, mail a@b.com")).toEqual(["C# for #1 fans, mail a@b.com"]);
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
  });

  test("a film by its IMDb id: its director, first year, runtime, genres, and Wikipedia's summary and poster", async () => {
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
      originalimage: { source: "https://upload.wikimedia.org/wikipedia/en/5/52/Dune_Part_Two_poster.jpeg" },
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
    });
    expect(new URL(asked[0]).searchParams.get("srsearch")).toBe("haswbstatement:P345=tt15239678");
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

  test("a podcast, with its feed; an episode, a mention of its podcast", async () => {
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
      ["podcast", "@[The Daily]"],
      ["published", "2026-11-12"],
      ["duration", "24:40"],
      ["audio", "https://example.com/episode.mp3"],
    ]);
    expect(episode?.link).toBe("https://podcasts.apple.com/us/podcast/an-episode/id1200361736?i=1000801496509");
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
