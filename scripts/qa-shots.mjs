#!/usr/bin/env node
/*
 * Pictures of lines for a person to look over before a release: each of its looks and the things
 * it draws, light and dark, at a desktop's width and a phone's, with what to look for beside each.
 * It builds the app with the tests' helpers (src/test/), serves it, and takes them headless, into
 * qa/shots/ with a page to see them on (qa/shots/index.html). qa/README.md says when to use it.
 *
 *   bun run qa-shots                     Chromium, everything
 *   bun run qa-shots --browser webkit    WebKit (Safari, and the Apple apps' web view)
 *   bun run qa-shots --only paper,typing the scenes whose names have these words
 *   bun run qa-shots --no-build          the last build again
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build, preview } from "vite";
import { answerFile, ico, png, wav } from "../tests/browser/files.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const engine = option("browser", "chromium");
const only = option("only", "").split(",").filter(Boolean);
const out = `${root}qa/shots/`;
const outDir = "dist-test";

const PROSE = `# A day's notes

Writing is easier when the page is **calm**, the words are *clear*, and nothing gets in the way.

## What to do

- Plan the week, with a [link](https://example.com) and \`code\`
- [ ] Call the bank
- [x] Water the plants

> A quote, to see how it sits on the page.

The last paragraph runs long enough to wrap onto a second line, so its rows show under each line.`;

/** A note with properties of each kind lines draws: a type, text, a date, a score and a list. */
const PERSON = `---
type: person
fullname: Ada Lovelace
born: 1815-12-10
rating: 4/5
languages:
  - English
  - French
---
# Ada

She wrote the first program, for Charles Babbage's Analytical Engine, and saw that it could do more than count.

## To read

- [ ] Her notes on the Engine
- [ ] The letters to Babbage`;

const CODE = `# Code notes
# #tour

def greet(name: str) -> str:
    """Say hello."""
    return f"Hello, {name}"

for person in ["Ada", "Grace", "Alan"]:
    print(greet(person))
`;

/** A day `days` from today, here, as a note's `date` property writes it. */
function dayFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Things in the library, as a link looked up makes them: movies with posters (one without), a book,
 * songs and an album with square covers, and a video; and a person, under Types. The covers are drawn
 * here, a gradient and a title, and kept as attachments.
 */
/**
 * The tests' books (tests/browser/books/), Pride and Prejudice as a PDF and The Yellow Wallpaper as
 * an EPUB, dropped on lines as files; then `title`'s opened, and read in its place. Only Chromium
 * keeps them: Playwright's WebKit keeps no files in IndexedDB but on disk.
 */
const BOOKS = [
  { name: "Pride and Prejudice.pdf", type: "application/pdf", data: readFileSync(`${root}tests/browser/books/pride-and-prejudice.pdf`).toString("base64") },
  { name: "The Yellow Wallpaper.epub", type: "application/epub+zip", data: readFileSync(`${root}tests/browser/books/the-yellow-wallpaper.epub`).toString("base64") },
];
async function readBook(page, title) {
  await page.evaluate((books) => {
    const transfer = new DataTransfer();
    for (const { name, type, data } of books) transfer.items.add(new File([Uint8Array.from(atob(data), (char) => char.charCodeAt(0))], name, { type }));
    document.body.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }));
  }, BOOKS);
  await page.waitForFunction(() => window.testing.notes.entries.filter((entry) => entry.meta.type === "book").length === 2);
  await page.evaluate((title) => window.testing.notes.select(window.testing.notes.entries.find((entry) => entry.meta.title === title).note.id), title);
  await page.getByRole("button", { name: "Read the Book" }).click();
  if (title === "The Yellow Wallpaper") {
    await page.getByRole("button", { name: "Contents" }).click();
    await page.getByRole("menuitem", { name: "The Yellow Wallpaper" }).click();
    await page.frameLocator("iframe.epub-reader").getByRole("heading", { level: 1 }).waitFor();
  } else {
    await page.locator(".pdf-page canvas").first().waitFor();
  }
}

/** Chooses the first sentence of the book read, as one about to keep as a quote does. */
const chooseSentence = (page) =>
  page.evaluate(() => {
    const doc = document.querySelector("iframe.epub-reader")?.contentDocument;
    if (doc) return doc.getSelection().selectAllChildren([...doc.querySelectorAll("p")].find((p) => p.textContent.includes("ancestral halls")));
    getSelection().selectAllChildren([...document.querySelectorAll(".pdf-page[data-page='1'] .textLayer span")].find((span) => span.textContent.includes("It is a truth")));
  });

const seedLibrary = (page) =>
  page.evaluate(async () => {
    const { notes, saveAttachment } = window.testing;
    const cover = async ([width, height, top, bottom], title) => {
      const canvas = new OffscreenCanvas(width, height);
      const draw = canvas.getContext("2d");
      const gradient = draw.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, top);
      gradient.addColorStop(1, bottom);
      draw.fillStyle = gradient;
      draw.fillRect(0, 0, width, height);
      draw.fillStyle = "rgba(255, 255, 255, 0.92)";
      draw.font = `600 ${Math.round(Math.min(width, height) / 9)}px sans-serif`;
      draw.textAlign = "center";
      draw.fillText(title.toUpperCase(), width / 2, height * 0.84, width * 0.9);
      return saveAttachment(await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 }));
    };
    const tall = (top, bottom) => [400, 600, top, bottom];
    const square = (top, bottom) => [500, 500, top, bottom];
    const items = [
      ["movie", "Dune: Part Two", { director: "Denis Villeneuve", year: "2024", runtime: "166 min", genre: "Science fiction, Adventure" }, "to watch", tall("#e0a94a", "#4a210a"), "Paul Atreides unites with Chani and the Fremen while on a path of revenge against the conspirators who destroyed his family. Facing a choice between the love of his life and the fate of the known universe, he endeavors to prevent a terrible future only he can foresee."],
      ["movie", "Arrival", { director: "Denis Villeneuve", year: "2016", runtime: "116 min" }, "watched", tall("#9fb3c4", "#1b2733"), "A linguist works with the military to talk with the visitors after twelve spacecraft appear around the world.", "4.5/5"],
      ["movie", "Paris, Texas", { director: "Wim Wenders", year: "1984", runtime: "147 min" }, "watching", null, "A man wanders out of the desert, and sets out to put his family back together.", "3/5"],
      ["book", "Dune", { author: "Frank Herbert", year: "1965", pages: "896" }, "reading", tall("#c86c2b", "#391507"), "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides."],
      ["album", "Kid A", { artist: "Radiohead", year: "2000", tracks: "10" }, "listened", square("#d2dde4", "#56677a"), "", "5/5"],
      ["song", "Never Gonna Give You Up", { artist: "Rick Astley", album: "Whenever You Need Somebody", year: "1987", duration: "3:33" }, "to listen", square("#7aa7d8", "#1f3554"), ""],
      ["video", "How Dune Was Made", { channel: "Behind the Scenes", duration: "14:02" }, "to watch", [640, 360, "#b98a50", "#2f1a0b"], ""],
    ];
    const now = Date.now();
    for (const [i, [type, title, properties, status, picture, about, rating]] of items.entries()) {
      const name = picture && (await cover(picture, title));
      const front = Object.entries({ type, ...properties, link: `https://example.com/${i}`, status, ...(rating && { rating }) }).map(([key, value]) => `${key}: ${value}`);
      // As wide as the library shows a cover: a video's wider than a poster or an album.
      const shown = picture && (picture[0] > picture[1] ? 400 : 240);
      const body = [`---\n${front.join("\n")}\n---\n# ${title}`, ...(name ? [`![${title}|${shown}](../attachments/${name})`] : []), ...(about ? [about] : [])].join("\n\n");
      await notes.insert({ id: crypto.randomUUID(), body, createdAt: now - i * 60_000, updatedAt: now - i * 60_000, pinned: false, trashed: false });
    }
    await notes.insert({ id: crypto.randomUUID(), body: "---\ntype: person\n---\n# Ada Lovelace", createdAt: now, updatedAt: now - 3_600_000, pinned: false, trashed: false });
  });

/**
 * Settings → Library's Readwise, having asked Readwise (answered here from the tests' fixtures, shaped
 * as its API documents its answers) what it has; then, with `importing`, having imported it.
 */
async function readwise(page, { importing = false } = {}) {
  const fixture = (name) => readFileSync(`${root}tests/unit/fixtures/readwise/${name}`, "utf8");
  const reader = JSON.parse(fixture("reader.json"));
  const cors = { "access-control-allow-origin": "*" };
  await page.route("https://readwise.io/api/v2/auth/", (route) => route.fulfill({ headers: cors, status: 204 }));
  await page.route("https://readwise.io/api/v2/export/**", (route) => route.fulfill({ headers: { ...cors, "content-type": "application/json" }, body: fixture("export.json") }));
  await page.route("https://readwise.io/api/v3/list/**", (route) => {
    const url = new URL(route.request().url());
    const cursor = url.searchParams.get("pageCursor");
    return route.fulfill({ headers: cors, json: reader[`${url.searchParams.get("location")}${cursor ? `:${cursor}` : ""}`] });
  });
  for (const pictures of ["https://m.media-amazon.com/**", "https://example.com/images/**", "https://i.ytimg.com/**"]) {
    await page.route(pictures, (route) => route.fulfill({ body: png(200, 300, (x, y) => [40 + y / 3, 70 + x / 4, 110]), contentType: "image/png", headers: cors }));
  }
  await page.evaluate(() => window.testing.open("---\ntype: book\nauthor: Henry David Thoreau\nstatus: read\n---\n# Walden\n"));
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("dialog").getByRole("navigation").getByText("Library", { exact: true }).first().click();
  const group = page.getByRole("dialog").getByRole("region", { name: "Readwise" });
  await group.getByLabel("Access token").fill("a-token-from-readwise");
  await group.getByRole("button", { name: "Find", exact: true }).click();
  await group.getByRole("button", { name: "Import", exact: true }).waitFor();
  if (importing) {
    await group.getByRole("button", { name: "Import", exact: true }).click();
    await group.getByRole("button", { name: "Undo Import" }).waitFor();
  }
  await group.scrollIntoViewIfNeeded();
}

/**
 * Add to Library, searching Books for "dune": Open Library's answer (trimmed) and its covers, drawn
 * here as the library's are, answered in place of the network.
 */
async function searchLibrary(page) {
  const books = [
    ["OL893414W", "Dune", "Frank Herbert", 1965, "#c86c2b", "#391507"],
    ["OL893461W", "Dune Messiah", "Frank Herbert", 1969, "#4f7fa8", "#16263a"],
    ["OL893516W", "Children of Dune", "Frank Herbert", 1976, "#9a5aa0", "#2a1330"],
    ["OL15331214W", "The Dune Encyclopedia", "Willis E. McNelly", 1984, "#7a9a5a", "#1f2a14"],
  ];
  const covers = await page.evaluate(async (books) => {
    const drawn = [];
    for (const [, title, , , top, bottom] of books) {
      const canvas = new OffscreenCanvas(200, 300);
      const draw = canvas.getContext("2d");
      const gradient = draw.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, top);
      gradient.addColorStop(1, bottom);
      draw.fillStyle = gradient;
      draw.fillRect(0, 0, 200, 300);
      draw.fillStyle = "rgba(255, 255, 255, 0.92)";
      draw.font = "600 22px sans-serif";
      draw.textAlign = "center";
      draw.fillText(title.toUpperCase(), 100, 252, 180);
      const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 })).arrayBuffer());
      drawn.push(btoa(String.fromCharCode(...bytes)));
    }
    return drawn;
  }, books);
  const cors = { "access-control-allow-origin": "*" };
  await page.route("https://openlibrary.org/search.json**", (route) =>
    route.fulfill({ headers: cors, json: { docs: books.map(([key, title, author, year], i) => ({ key: `/works/${key}`, title, author_name: [author], first_publish_year: year, cover_i: i + 1 })) } }),
  );
  await page.route("https://covers.openlibrary.org/b/id/*", (route) => {
    const i = Number(/\/id\/(\d+)-/.exec(route.request().url())[1]) - 1;
    return route.fulfill({ headers: { ...cors, "content-type": "image/jpeg" }, body: Buffer.from(covers[i], "base64") });
  });
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Add to Library" }).click();
  await page.getByRole("menuitem", { name: "Add to Library" }).click();
  await page.keyboard.type("dune");
  await page.getByRole("dialog", { name: "Add to Library" }).getByRole("option").nth(3).waitFor();
}

/**
 * Feeds subscribed to, answered from the tests' copies of real ones (tests/browser/feeds/), their
 * pictures a plain square (as big as artwork, so it's drawn as artwork is), and what `sites` gives
 * (a site's page, its icon), by address: nothing's fetched from the web.
 */
async function subscribe(page, feeds, sites = {}) {
  const cors = { "access-control-allow-origin": "*" };
  // Nothing else of the web (a site's page, looked through for its icon) is asked for: answered with nothing, after any of the scene's own answers.
  await page.context().route((url) => url.protocol.startsWith("http") && url.hostname !== "127.0.0.1", (route) => route.fulfill({ body: "", contentType: "text/plain", headers: cors }));
  await page.route(
    (url) => /\.(png|jpe?g|gif)(\?|$)/.test(url.pathname) && url.hostname !== "127.0.0.1",
    (route) => route.fulfill({ body: png(64, 64, () => [96, 132, 168]), contentType: "image/png", headers: cors }),
  );
  for (const [url, [body, contentType]] of Object.entries(sites)) await page.route(url, (route) => route.fulfill({ body, contentType, headers: cors }));
  for (const [url, fixture] of Object.entries(feeds)) {
    const body = readFileSync(`${root}tests/browser/feeds/${fixture}`, "utf8");
    await page.route((asked) => asked.href === url, (route) => route.fulfill({ body, contentType: "application/rss+xml", headers: cors }));
    await page.evaluate((url) => window.testing.feeds.subscribe(url), url);
  }
}

const FEEDS = { "https://svelte.dev/blog/rss.xml": "blog.rss", "https://daringfireball.net/feeds/main": "blog.atom", "https://feeds.megaphone.fm/FSI1483080183": "podcast.rss" };

/**
 * Sites' icons for feeds that give no picture of their own: Hacker News' Y (named by its page here,
 * as Playwright answers no request for a favicon.ico), a blog's icon for phones, and a blog's black
 * mark on nothing, which a dark theme puts on a tile.
 */
const SITE_ICONS = {
  "https://news.ycombinator.com/": ['<html><head><link rel="icon" href="y18.ico"></head></html>', "text/html"],
  "https://news.ycombinator.com/y18.ico": [
    ico(png(18, 18, (x, y) => (Math.abs(x - 8.5) <= (y < 9 ? 1.2 + (9 - y) * 0.75 : 1) && Math.abs(x - 8.5) >= (y < 9 ? (9 - y) * 0.75 - 1.2 : -1) && y >= 3 && y <= 14 ? [255, 255, 255] : [255, 102, 0])), 18),
    "image/x-icon",
  ],
  "https://daringfireball.net/": ['<html><head><link rel="apple-touch-icon" href="/touch-icon"></head></html>', "text/html"],
  "https://daringfireball.net/touch-icon": [png(180, 180, (x, y) => (Math.hypot(x - 90, y - 90) < 52 ? [236, 239, 244] : [74, 85, 104])), "image/png"],
  "https://plain.example/": ['<html><head><link rel="icon" href="/mark.png" sizes="32x32"></head></html>', "text/html"],
  "https://plain.example/mark.png": [png(32, 32, (x, y) => (Math.hypot(x - 15.5, y - 15.5) < 14 && Math.hypot(x - 15.5, y - 15.5) > 8 ? [24, 23, 23, 255] : [0, 0, 0, 0])), "image/png"],
};
const ICON_FEEDS = {
  "https://news.ycombinator.com/rss": "hn.rss",
  "https://plain.example/feed.xml": "plain.rss",
  "https://daringfireball.net/feeds/main": "blog.atom",
  "https://feeds.megaphone.fm/FSI1483080183": "podcast.rss",
};

/** lines' own look, and three styles with their themes: a scene taken in each, `-neon` after its id. */
const LOOKS = [
  ["", {}],
  ["-neon", { style: "neon", theme: "neon" }],
  ["-classic", { style: "classic", theme: "classic" }],
  ["-pixel", { style: "pixel", theme: "pixel" }],
];

/** " in Neon", for a look's suffix. */
const inLook = (suffix) => (suffix ? ` in ${suffix[1].toUpperCase()}${suffix.slice(2)}` : "");

/** A comment, and a reply under it, down to `depth`. */
const chain = (depth, at = 1) => ({
  id: 900_000 + at,
  type: "comment",
  author: `person${at}`,
  created_at_i: Math.floor(Date.now() / 1000) - 3600 * (depth - at + 1),
  text: `Depth ${at}. ${"A reply that goes on for a while, as replies do. ".repeat(2)}`,
  children: at < depth ? [chain(depth, at + 1)] : [],
});

/**
 * Hacker News' feed subscribed to, and the IceWM story's discussion open under it, from the tests'
 * copy of it (tests/browser/feeds/), with a thread `deep` comments deep first, if asked for.
 */
async function openDiscussion(page, deep = 0) {
  const cors = { "access-control-allow-origin": "*" };
  const story = JSON.parse(readFileSync(`${root}tests/browser/feeds/hn-story.json`, "utf8"));
  const official = JSON.parse(readFileSync(`${root}tests/browser/feeds/hn-official.json`, "utf8"));
  if (deep) {
    story.children.unshift(chain(deep));
    official.kids.unshift(900_001);
  }
  await page.route(/^https:\/\/(hn\.algolia\.com|hacker-news\.firebaseio\.com)\//, (route) => route.fulfill({ json: route.request().url().includes("algolia") ? story : official, headers: cors }));
  await subscribe(page, { "https://news.ycombinator.com/rss": "hn.rss" });
  await page.evaluate(() => window.testing.notes.setFilter({ kind: "feeds" }));
  await page.locator(".note-list").getByRole("button", { name: /^IceWM/ }).click();
  await page.locator("[data-fold]").first().waitFor();
}

/** The podcast's latest episode played (a minute of sound), paused 12 seconds in. */
async function playEpisode(page) {
  const audio = wav(60_000);
  await page.route((url) => url.hostname === "traffic.megaphone.fm", (route) => answerFile(route, audio, "audio/wav"));
  await subscribe(page, { "https://feeds.megaphone.fm/FSI1483080183": "podcast.rss" });
  await page.evaluate(() => window.testing.notes.setFilter({ kind: "feeds" }));
  await page.locator(".note-list li").filter({ hasText: "1055:" }).getByRole("button", { name: "Play Episode" }).click();
  await page.waitForFunction(() => window.testing.player.playing);
  await page.evaluate(() => {
    window.testing.player.pause();
    window.testing.player.seek(12);
  });
}

/** A browser's exported bookmarks, as Chrome writes them, for the import's pictures. */
const BOOKMARKS = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
<DT><H3 PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
<DL><p>
<DT><A HREF="https://developer.mozilla.org/en-US/" ADD_DATE="1700000100">MDN Web Docs</A>
<DT><H3>Dev</H3>
<DL><p>
<DT><H3>Rust</H3>
<DL><p>
<DT><A HREF="https://doc.rust-lang.org/book/" ADD_DATE="1710000400">The Rust Programming Language</A>
<DT><A HREF="https://doc.rust-lang.org/book/" ADD_DATE="1710000450">The Rust Book</A>
</DL><p>
<DT><A HREF="https://svelte.dev/docs" ADD_DATE="1720000700">Svelte Docs</A>
<DT><A HREF="javascript:void(0)" ADD_DATE="1700000600">A bookmarklet</A>
</DL><p>
</DL><p>
<DT><H3>Other bookmarks</H3>
<DL><p>
<DT><A HREF="https://en.wikipedia.org/wiki/Bookmark_(digital)" ADD_DATE="1730000800">Bookmark (digital) - Wikipedia</A>
<DT><A HREF="https://www.refactoringui.com/" ADD_DATE="1725000800">Refactoring UI</A>
<DT><A HREF="https://jvns.ca/" ADD_DATE="1715000800">Julia Evans</A>
</DL><p>
</DL><p>
`;

/** The podcast's latest episode, 16 seconds in, its transcript and chapters (the tests' copies) shown above the player. */
async function openTranscript(page) {
  const cors = { "access-control-allow-origin": "*" };
  const served = { "/1055/transcript.vtt": "transcript.vtt", "/1055/chapters.json": "chapters.json" };
  await page.route(
    (url) => url.hostname === "syntax.fm" && url.pathname in served,
    (route) => route.fulfill({ body: readFileSync(`${root}tests/browser/feeds/${served[new URL(route.request().url()).pathname]}`, "utf8"), headers: cors }),
  );
  await playEpisode(page);
  await page.evaluate(() => window.testing.player.seek(16));
  const mini = page.getByRole("region", { name: "Podcast player" });
  await mini.getByRole("button", { name: "Transcript" }).click();
  await mini.getByRole("list", { name: "Transcript" }).getByRole("button").nth(5).waitFor();
}

/** What takes each theme's own colors besides its accent: a highlight, callouts and line marks. */
const THEME_COLORS = `# Colors

A ==highlighted phrase== beside a #tag and a [link](https://example.com).

Ready <!-- mark green: ready -->
Check <!-- mark yellow: check -->
Fix <!-- mark red: fix -->
Note <!-- mark blue: note -->
Idea <!-- mark purple: idea -->

:::info
Info
:::

:::question
Question
:::

:::warning
Warning
:::

:::error
Error
:::

:::decision
Decision
:::`;

/** Every kind of formatting a theme can color (themes/formatting.ts), in a Markdown note and a LaTeX one. */
const FORMATTING = `# Heading one

## Heading two

### Heading three

#### Heading four

##### Heading five

###### Heading six

Text with **bold**, *italics*, **bold with *italics* inside**, ~~struck through~~, <u>underlined</u>, ==highlighted==, \`inline code\`, a [link](https://example.com) and a mention of @Ada.

> A quote, with **bold** in it.

- A bullet
  - A nested bullet

1. A numbered item`;

const FORMATTING_LATEX = String.raw`\section{Section}

\subsection{Subsection}

\subsubsection{Subsubsection}

Text with \textbf{bold}, \emph{italics}, \sout{struck through}, \underline{underlined}, \texttt{code} and a \href{https://example.com}{link}.

\begin{quote}
A quote, with \textbf{bold} in it.
\end{quote}

\begin{itemize}
\item A bullet
\end{itemize}`;

/** A theme of your own: Lines with a color for each kind of formatting, light and dark. */
const FORMATTING_COLORS = {
  light: {
    "text-h1": "#be123c",
    "text-h2": "#b45309",
    "text-h3": "#15803d",
    "text-h4": "#0e7490",
    "text-h5": "#6d28d9",
    "text-h6": "#64748b",
    "text-bold": "#9a3412",
    "text-italic": "#7c3aed",
    "text-strike": "#be185d",
    "text-underline": "#0369a1",
    "text-highlight": "#713f12",
    "text-code": "#c2410c",
    "text-link": "#2563eb",
    "text-mention": "#db2777",
    "text-quote": "#4d7c0f",
    "text-bullet": "#e11d48",
    "text-number": "#0f766e",
  },
  dark: {
    "text-h1": "#fb7185",
    "text-h2": "#fbbf24",
    "text-h3": "#4ade80",
    "text-h4": "#22d3ee",
    "text-h5": "#a78bfa",
    "text-h6": "#94a3b8",
    "text-bold": "#fdba74",
    "text-italic": "#c4b5fd",
    "text-strike": "#f9a8d4",
    "text-underline": "#7dd3fc",
    "text-highlight": "#fde68a",
    "text-code": "#fb923c",
    "text-link": "#60a5fa",
    "text-mention": "#f472b6",
    "text-quote": "#a3e635",
    "text-bullet": "#fb7185",
    "text-number": "#2dd4bf",
  },
};

/** A font for most kinds of formatting (Settings → Typography → Fonts for formatting), each from those lines brings. */
const FORMATTING_FONTS = {
  headings: { font: "serif" },
  bold: { font: "ibm-plex-sans" },
  italic: { font: "fira-sans" },
  link: { font: "serif" },
  mention: { font: "fira-sans" },
  quote: { font: "serif" },
  number: { font: "mono" },
  code: { font: "agave" },
  "code-block": { font: "agave" },
};

/** Opens `note`, and the note it mentions, once the fonts it's drawn in have loaded. */
const openFormatting = (note, format) => (page) =>
  page.evaluate(
    async ([note, format]) => {
      await window.testing.open("# Ada");
      await window.testing.open(note, format);
      await new Promise(requestAnimationFrame);
      await document.fonts.ready;
    },
    [note, format],
  );

/** Settings → Typography, at Fonts for formatting. */
const formattingFontsSettings = async (page) => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("navigation").getByText("Typography", { exact: true }).click();
  // Its heading just under the preview, which stays in sight above.
  await dialog.locator('section[aria-label="Fonts for formatting"]').evaluate((group) => {
    group.style.scrollMarginTop = "230px";
    group.scrollIntoView({ block: "start" });
  });
};

/** Chooses a theme of your own with formatting's colors, then opens `note` (and a note it mentions). */
const formattingTheme = (note, format) => (page) =>
  page.evaluate(
    async ([note, format, colors]) => {
      const { customThemes, plugins, prefs } = window.testing;
      const id = customThemes.copy(plugins.theme("lines").definition, (each) => plugins.palette(each), "Formatted");
      for (const scheme of ["light", "dark"]) for (const [part, color] of Object.entries(colors[scheme])) customThemes.setColor(id, scheme, part, color);
      prefs.theme = id;
      await window.testing.open("# Ada");
      await window.testing.open(note, format);
    },
    [note, format, FORMATTING_COLORS],
  );

/*
 * Each scene: a note (and its format), Settings to start with, what to open, what to photograph,
 * and what a person should see in it. `schemes` defaults to light and dark, `language` to English.
 */
const SCENES = [
  { id: "paper-lines", title: "Paper: ruled lines", look: "Every line of text, wrapped lines and headings too, sits on a rule; the rules end at the text's width; none under code.", prefs: { paperPattern: "lines" }, note: PROSE },
  { id: "paper-graph", title: "Paper: graph paper following the text", look: "A row of cells for each line, columns unbroken down the note, faint enough to read over.", prefs: { paperPattern: "graph" }, note: PROSE },
  { id: "paper-texture", title: "Paper: linen texture", look: "A soft texture under the text, in light and dark, never stronger than the text.", prefs: { paperTexture: "linen" }, note: PROSE },
  { id: "backdrop-pages", title: "Backdrop, with a page break", look: "Two pages over the gradient, a gap between them where the break is; the toolbar frosted; the line before the break looks as any line.", prefs: { paperBackdrop: "dawn" }, note: `${PROSE}\n\n<!-- pagebreak -->\n\n## The second page\n\nIt starts on a page of its own.` },
  { id: "backdrop-nothing-open", title: "A backdrop with no note open", look: "Select a note, or start a new one, and the New Note button on a page of their own over the picture, readable.", prefs: { paperBackdrop: "dawn" } },
  { id: "page-break", title: "A page break, without a backdrop", look: "A dashed line named Page break, with room around it; the line above it in the text's own color and size.", note: "The first page ends here.\n<!-- pagebreak -->\nThe second page starts here." },
  { id: "code-note", title: "A code note", look: "Line numbers beside each line, a fixed-width font, highlighting in the theme's colors.", note: CODE, format: "code-python" },
  { id: "code-note-backdrop", title: "A code note over a backdrop", look: "The page holds the line numbers, each exactly beside its line, with even room on both sides.", prefs: { paperBackdrop: "dawn" }, note: CODE, format: "code-python" },
  ...[
    ["right", 1512],
    ["left", 1728],
  ].map(([side, width]) => ({
    id: `properties-${side}`,
    title: `Properties beside the note, on the ${side}, in a ${width} px window (a MacBook's) with the sidebar and the note list`,
    look: `The note's text and a column of its properties ${side === "right" ? "after it" : "before it, clear of where the line grip shows"}, together a two-column page centred in the pane (as much room left of the one as right of the other)${width === 1512 ? ", the text narrowed for them but a comfortable width still" : ", the text as wide as it's chosen"}; their first line level with the title's; keys muted in their column, the type's icon, the stars, the list's items in the values' column; no line under them; the note's text starting with its title.`,
    prefs: { propertiesPlace: side },
    note: PERSON,
    width,
  })),
  {
    id: "properties-right-editing",
    title: "Properties beside the note, the cursor in them",
    look: "Their `---` lines showing faint above and below them, as at the top, the cursor on the last one's value; the note's text where it was.",
    prefs: { propertiesPlace: "right" },
    note: PERSON,
    width: 1512,
    act: async (page) => {
      await page.evaluate(() => window.testing.place(window.testing.text().indexOf("# Ada")));
      await page.keyboard.press("ArrowUp");
    },
    schemes: ["light"],
  },
  {
    id: "properties-right-panes",
    title: "Properties on the right, the note beside another, in a 2,400 px window",
    look: "In the left pane, the note and its properties a two-column page centred in that pane, the text narrowed; the note beside it as it always is.",
    prefs: { propertiesPlace: "right" },
    note: PERSON,
    width: 2400,
    act: async (page) => {
      await page.evaluate(() => window.testing.open("# Beside\n\nAnother note, open beside it."));
      await page.evaluate(() => window.testing.notes.select(window.testing.notes.entries.find((entry) => entry.meta.title === "Ada").note.id));
      await page.locator(".note-list [data-id]").filter({ hasText: "Beside" }).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Open to the Side" }).click();
      await page.getByRole("region", { name: /Beside/ }).waitFor();
    },
    schemes: ["light"],
  },
  { id: "properties-bottom", title: "Properties after the note", look: "After the last line, a line across the text's width, then the properties drawn as at the top, lined up with the text; the note's text starting with its title.", prefs: { propertiesPlace: "bottom" }, note: PERSON },
  {
    id: "properties-bottom-editing",
    title: "Properties after the note, the cursor in them",
    look: "Their `---` lines showing faint, the line across gone, the cursor on the first property, as ↓ from the last line left it.",
    prefs: { propertiesPlace: "bottom" },
    note: PERSON,
    act: async (page) => {
      await page.evaluate(() => window.testing.place());
      await page.keyboard.press("ArrowDown");
    },
    schemes: ["light"],
  },
  { id: "properties-narrow", title: "Properties on the right, without room beside the note (1,280 px)", look: "At the top, as they always were, the text as wide as it's chosen.", prefs: { propertiesPlace: "right" }, note: PERSON, schemes: ["light"] },
  { id: "properties-backdrop", title: "Properties beside a page over a backdrop, in a 1,728 px window", look: "The page and a card of their own (its corners, shadow and color, as the page's) centred together, the room between pages around and between them; readable over the picture.", prefs: { propertiesPlace: "right", paperBackdrop: "dawn" }, note: PERSON, width: 1728 },
  { id: "properties-backdrop-bottom", title: "Properties after the note over a backdrop", look: "On the page, after its text and a line across, with no card of their own; the page as long as they need.", prefs: { propertiesPlace: "bottom", paperBackdrop: "dawn" }, note: PERSON },
  ...["classic", "pixel", "neon"].map((style) => ({
    id: `properties-${style}`,
    title: `Properties beside the note, in ${style[0].toUpperCase()}${style.slice(1)}`,
    look: "In the style's type and colors, as the note's text is, lined up with the title.",
    prefs: { propertiesPlace: "right", style, theme: style },
    note: PERSON,
    width: 1512,
    schemes: ["light"],
  })),
  {
    id: "line-marks",
    title: "Marks in the margin, and Changes",
    look: "Colored bars beside the marked lines, runs joined into one; the comments hidden; Changes' lane outside them, after an edit.",
    prefs: { plugins: { changes: true } },
    note: "Ready to send <!-- mark green: ready -->\nStill checking <!-- mark yellow: check -->\nAnd this one <!-- mark yellow: check -->\nNeeds work <!-- mark red: fix -->\nA plain line",
    act: async (page) => {
      await page.evaluate(() => window.testing.place());
      await page.keyboard.type(" (edited)");
      await page.evaluate(() => window.testing.editor().contentDOM.blur());
    },
  },
  ...["source", "visible", "live", "hidden"].map((mode) => ({
    id: `markdown-${mode}`,
    title: `Show Markdown: ${mode[0].toUpperCase()}${mode.slice(1)}`,
    look: { source: "The Markdown exactly as written, no styling.", visible: "Styled text with every mark still in sight.", live: "Marks only on the line the cursor's in (the heading).", hidden: "No marks anywhere, the cursor's line too." }[mode],
    prefs: { markdownMode: mode },
    note: PROSE,
    act: (page) => page.evaluate(() => window.testing.place(4)),
    schemes: ["light"],
  })),
  {
    id: "formatting-colors",
    title: "Formatting's colors, in a theme of your own",
    look: "Each heading level in its own color, bold, italics, strikethrough, underline, highlighted text, inline code, the link, the mention, the quote and the bullets and number each in theirs; italics inside bold in italics' color; bold in the quote in bold's; the strikethrough's line and the link's underline quiet; everything readable on the note, the highlighted text on the highlighter too.",
    act: formattingTheme(FORMATTING),
  },
  {
    id: "formatting-colors-source",
    title: "Formatting's colors, Markdown as written",
    look: "Headings, bold, italics, strikethrough, the link, the mention and the quote in their colors, the marks (`#`, `**`) faint; the rest as written.",
    prefs: { markdownMode: "source" },
    act: formattingTheme(FORMATTING),
    schemes: ["light"],
  },
  {
    id: "formatting-colors-editor",
    title: "Formatting's colors, in your theme's editor",
    look: "More Colors' Formatting group under its heading and note: Heading 1 to 6, Bold, Italic and the rest, each name beside its swatch and value, the swatches the colors set, lined up with the groups above and below.",
    act: async (page) => {
      await formattingTheme(FORMATTING)(page);
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("navigation").getByText("Theme", { exact: true }).first().click();
      await dialog.getByRole("button", { name: "More Colors" }).click();
      await dialog.locator('section[aria-label="Formatting"]').evaluate((group) => group.scrollIntoView({ block: "start" }));
    },
    shoot: "dialog",
  },
  {
    id: "formatting-colors-latex",
    title: "Formatting's colors, in a LaTeX note",
    look: "\\section, \\subsection and \\subsubsection in the first three headings' colors; bold, italics, strikethrough, underline, code, the link, the quote and the bullet in theirs, as in the Markdown note.",
    act: formattingTheme(FORMATTING_LATEX, "latex"),
    schemes: ["light"],
  },
  {
    id: "formatting-fonts",
    title: "Formatting's fonts",
    look: "Every heading in the serif font; bold in IBM Plex Sans's bold (the quote's bold too), italics in Fira Sans's italic, the link in the serif font, the mention in Fira Sans, the quote in the serif font, the number in Mono, inline code and the code block in Agave; struck through, underlined and highlighted text, the bullets and the rest in the system's font. Lines evenly spaced, nothing clipped.",
    prefs: { formattingFonts: FORMATTING_FONTS },
    act: openFormatting(`${FORMATTING}\n\n\`\`\`js\nconst greeting = "Hello";\n\`\`\``),
    height: 1000,
  },
  {
    id: "formatting-fonts-latex",
    title: "Formatting's fonts, in a LaTeX note",
    look: "\\section and the rest in the serif font, \\textbf in IBM Plex Sans's bold, \\emph in Fira Sans's italic, \\texttt and the verbatim block in Agave, the quote in the serif font, as in the Markdown note.",
    prefs: { formattingFonts: FORMATTING_FONTS },
    act: openFormatting(`${FORMATTING_LATEX}\n\n\\begin{verbatim}\nconst greeting = "Hello";\n\\end{verbatim}`, "latex"),
    schemes: ["light"],
  },
  {
    id: "formatting-fonts-settings",
    title: "Settings → Typography → Fonts for formatting",
    look: "A row for each, Headings to Code blocks, its name beside its field, the fields lined up with Installed font's and the sliders; those chosen show their font's name (Serif, Rounded…), the rest Same as text, or Code font for code.",
    prefs: { formattingFonts: FORMATTING_FONTS },
    act: formattingFontsSettings,
    shoot: "dialog",
  },
  {
    id: "formatting-fonts-neon",
    title: "Headings' font picker, in Neon",
    look: "The preview's heading in Orbitron, Neon's display face; Headings' field says Orbitron, and its list starts with Orbitron drawn in it, then Recommended with Chakra Petch in System's place.",
    prefs: { style: "neon", theme: "neon" },
    act: async (page) => {
      await formattingFontsSettings(page);
      await page.getByRole("combobox", { name: "Headings" }).click();
      await page.getByRole("option", { name: "Chakra Petch" }).waitFor();
    },
  },
  {
    id: "formatting-fonts-picker",
    title: "A formatting's font picker, open",
    look: "Under Headings' field, as wide: Same as text first, then the recommended fonts under Recommended, each in its own face, Serif checked; then Installed's fonts under theirs, from the list Chrome gives, each in its own face.",
    prefs: { formattingFonts: FORMATTING_FONTS },
    act: async (page) => {
      await page.evaluate(() => {
        const families = ["Avenir Next", "Baskerville", "Didot", "Futura", "Georgia", "Gill Sans", "Menlo", "Optima"];
        Object.assign(window, { queryLocalFonts: async () => families.map((family) => ({ family })) });
      });
      await formattingFontsSettings(page);
      await page.getByRole("combobox", { name: "Headings" }).click();
      await page.getByRole("option", { name: "Georgia" }).waitFor();
    },
  },
  ...["ink", "indigo", "plum", "moss", "amber", "mono"].map((theme) => ({ id: `theme-${theme}`, title: `Theme: ${theme[0].toUpperCase()}${theme.slice(1)}`, look: "Text, links, tags and the chosen row read clearly; the accent stands out but isn't loud.", prefs: { theme }, note: PROSE })),
  ...[
    ["green-world", "Green World", "Violet backgrounds, the accent a leaf's green, tags magenta"],
    ["miku", "Miku", "Cool grey backgrounds with a teal sidebar in dark, the accent teal, tags pink"],
    ["teto", "Teto", "Warm near-black and blush backgrounds, the accent crimson, tags gold"],
  ].map(([theme, name, colors]) => ({
    id: `theme-${theme}`,
    title: `Theme: ${name}`,
    look: `${colors}; callouts and code in its own colors, each readable.`,
    prefs: { theme },
    note: `${PROSE}\n\n#garden\n\n:::info\nA callout, in the theme's blue.\n:::\n\n\`\`\`js\n// Code in its colors\nconst leaves = grow(3, "green");\n\`\`\``,
  })),
  ...["lines", "ember", "ink", "indigo", "plum", "moss", "amber", "mono", "graphite", "sepia", "forest", "ocean", "green-world", "miku", "teto", "solarized", "nord", "dracula", "catppuccin", "tokyo-night", "gruvbox", "everforest", "ayu", "void", "puddle", "lightbulb"].map((theme) => ({
    id: `theme-colors-${theme}`,
    title: `Theme colors: ${theme}`,
    look: "The highlight, callouts and marks in the theme's own colors, sitting with its accent rather than lines' own; the highlighted text readable; each callout's icon clear on its tint.",
    prefs: { theme },
    note: THEME_COLORS,
  })),
  ...["classic", "pixel", "neon", "adventure", "aero", "brutalist", "constructivist", "void"].map((style) => ({
    id: `style-${style}`,
    title: `Style: ${style[0].toUpperCase()}${style.slice(1)}`,
    look: { classic: "Bevels lit from the top left, the title bar's gradient, white text on its light end still readable.", pixel: "2px lines, square corners, what's chosen turned around, the pixel font without broken letters.", neon: "Glowing headings and lines, the grid behind the note, scan lines faint.", adventure: "Slots with notched pixel corners, the chosen row framed in the accent, grass under the title bars, headings with a hard shadow.", aero: "Gel buttons and a glossy chosen row, a sheen on the panes, the sky and bubbles behind the note faint under the text.", brutalist: "Solid rules between everything, uppercase monospace titles, the chosen row a block of the accent, a big tight heading.", constructivist: "Red bands on black rules under the title bars, the chosen row a red wedge, condensed capitals, a circle and diagonal faint behind the note.", void: "No lines or boxes, the title bars out of sight (the pointer is away), the chosen row in black with an accent dot, the rest grey but readable, headings the text's size." }[style],
    prefs: { style, theme: style },
    note: PROSE,
  })),
  {
    id: "style-classic-settings",
    title: "Classic, in Settings",
    look: "Raised buttons and sunken fields; a red Delete-like button readable; switches and sliders square.",
    prefs: { style: "classic", theme: "classic" },
    settings: "Theme",
    shoot: "dialog",
  },
  { id: "style-adventure-settings", title: "Adventure, in Settings", look: "Buttons, fields, switches and groups as framed slots; the chosen segment raised; focus rings inside the notched corners.", prefs: { style: "adventure", theme: "adventure" }, settings: "Theme", shoot: "dialog" },
  { id: "style-aero-settings", title: "Aero, in Settings", look: "Gel buttons and switches, frosted dialog glass, fields as pills; everything readable.", prefs: { style: "aero", theme: "aero" }, settings: "Theme", shoot: "dialog" },
  { id: "style-brutalist-settings", title: "Brutalist, in Settings", look: "Thick rules around groups and fields, uppercase monospace buttons, switches as boxes.", prefs: { style: "brutalist", theme: "brutalist" }, settings: "Editor", shoot: "dialog" },
  { id: "style-constructivist-settings", title: "Constructivist, in Settings", look: "Groups with a red band on top, condensed capitals on buttons and segments, the chosen segment red, square switches whose knob reaches the end, the dialog's red shadow.", prefs: { style: "constructivist", theme: "constructivist" }, settings: "Editor", shoot: "dialog" },
  { id: "hide-bars-no-icons", title: "Hide toolbars and no icons, in Void, the toolbar reached for", look: "The note list's title bar and the sidebar's edges out of sight; pointing at the note's toolbar brings it back, its buttons as words (Lock note, Share…) that fit without crowding; no icons in the sidebar; the search text lined up with the note titles.", prefs: { style: "void", theme: "void", hideBars: true, showIcons: false }, note: PROSE, act: (page) => page.hover("main.editor-pane .toolbar") },
  { id: "no-icons-blocks", title: "No icons, a block's buttons", look: "A spreadsheet block's button beside it keeps its icon, in its round button, with no words spilling out.", prefs: { showIcons: false }, note: "# Costs\n\n```csv\nItem,Cost\nTea,4\nBread,3\n```\n\nEnd", act: (page) => page.hover(".cm-content .cm-lp-sheet, .cm-content table, .cm-content [class*=sheet]") },
  { id: "no-icons-lines", title: "No icons, in Lines", look: "Buttons that were only an icon show their names, sized to their words, with Lines' hovers; no icons in the sidebar; the nested tags' chevron kept, turned open, clear of the count; the pinned note's row saying Pinned before its date, with no icons.", prefs: { showIcons: false }, note: `${PROSE}\n\n#idea/lenstica #idea/lines`, act: async (page) => {
      await page.click(".sidebar button[aria-expanded]");
      await page.click('main.editor-pane .toolbar button[aria-label="Pin to top"]');
    } },
  { id: "style-void-settings", title: "Void, in Settings", look: "Groups without boxes, buttons and choices as words (the chosen one black), hairline switches and fields, one size of type; everything still clearly a control.", prefs: { style: "void", theme: "void" }, settings: "Editor", shoot: "dialog" },
  { id: "style-pixel-settings", title: "Pixel, in Settings", look: "Each switch's knob all the way across when it's on; the chosen segment turned around.", prefs: { style: "pixel", theme: "pixel" }, settings: "Editor", shoot: "dialog" },
  ...["sidebar", "list", "both"].map((panes) => ({
    id: `dark-panes-${panes}`,
    title: `Dark panes: ${panes}`,
    look: "The dark panes' text, counts, search field, chosen row and scroll bars all readable; the note light; the divider between them clean.",
    prefs: { darkPanes: panes },
    note: PROSE,
    schemes: ["light"],
  })),
  { id: "dark-panes-pixel", title: "Dark panes in Pixel", look: "Pixel's 2px lines light in the dark panes, dark in the note.", prefs: { darkPanes: "both", style: "pixel", theme: "pixel" }, note: PROSE, schemes: ["light"] },
  { id: "folder-links", title: "Links to a folder and a file on the computer", look: "A folder's icon before Projects and a file's before the plan, in the link's color, lined up with the text.", note: "Work is in [Projects](file:///Users/me/My%20Projects/), and [the plan](file:///Users/me/plan.pdf) says what's next.\n\nEnd", act: (page) => page.evaluate(() => window.testing.place()), shoot: ".editor-pane" },
  {
    id: "calendar",
    title: "The Calendar",
    look: "The month under the search field, its weekday letters over their columns; today filled in the accent; under each day with notes a dot for each of their colors (tomorrow green and purple); days of other months faint; the day's notes listed below. Beside it the week: Plan the trip at 10 AM in today's column in the accent, an hour tall, its title and time readable; the trip under All day from three days on; tomorrow Gym in green (#health's) and, after it, Standup in purple (Meeting's color) with Meeting's calendar icon before its title, in purple; the colored events' text as readable as the accent's; today's heading in the accent and a line at the time now; the columns lined up with their headings and the hour lines. In the sidebar, Meeting's icon purple and #health's green.",
    storage: { "lines.looks": { tags: { health: { color: "green", at: 1 } }, types: { meeting: { color: "purple", at: 1 } } } },
    note: `---\ndate: ${dayFromToday(0)} 10:00\nstart: ${dayFromToday(3)}\nend: ${dayFromToday(5)}\n---\n# Plan the trip`,
    act: async (page) => {
      for (const body of [`---\ntype: meeting\ndate: ${dayFromToday(1)} 13:00\n---\n# Standup`, `---\ndate: ${dayFromToday(1)} 12:00\n---\n# Gym\n\n#health`]) {
        await page.evaluate((body) => window.testing.open(body), body);
      }
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
    },
  },
  {
    id: "icon-picker-color",
    title: "A tag's icon and color",
    look: "Over the search field, No Color (a ring with a line across) and the theme's eight colors, evenly spaced, Green ringed in its own color with a gap; the tag's icon in the header green; every swatch readable against the menu's background.",
    storage: { "lines.looks": { tags: { work: { icon: "briefcase", color: "green", at: 1 } }, types: {} } },
    note: "# Standup\n\n#work",
    act: async (page) => {
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^work/ }).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Icon and Color" }).click();
    },
    shoot: "dialog",
  },
  ...["stars", "hearts", "circles"].map((scores) => ({
    id: `scores-${scores}`,
    title: `Scores as ${scores}`,
    look: "Rating's 3 of 5 and Score's 4 of 7 drawn as marks: the filled ones in the color (stars yellow, hearts red, circles the accent), the rest faint outlines, the same size as the text and sitting on its line, evenly spaced; Plate's value plain.",
    prefs: { scores },
    note: "---\nrating: 3/5\n---\n# Film\n\nScore: 4/7\nPlate: 3WBZ56\n\nEnd",
    act: (page) => page.evaluate(() => window.testing.place()),
    shoot: ".editor-pane",
  })),
  {
    id: "tag-colors",
    title: "Tags in a note in their colors",
    look: "#work's lightbulb and pill green, #work/meetings green too (from #work), #home blue with its house, #misc in the accent as always; each name in the text's color and easy to read on its tint; the pills the same size and shape as before.",
    storage: { "lines.looks": { tags: { work: { icon: "lightbulb", color: "green", at: 1 }, home: { icon: "house", color: "blue", at: 1 } }, types: {} } },
    note: "# Week\n\nPlans for #work, #work/meetings, #home and #misc.",
    shoot: ".editor-pane",
  },
  {
    id: "panes",
    title: "Notes in panes: one on top, two at the bottom",
    look: "The open note across the top with its toolbar; below it, two notes side by side, each with its title, Swap and Close in a short header (not a title bar's height); thin lines between the panes, lined up with each other and the panes' edges; each note readable, nothing cut off but at the panes' own edges.",
    height: 900,
    act: async (page) => {
      for (const body of ["# Groceries\n\n- milk\n- eggs", "# Trip\n\nRome, then Florence.", "# Plan\n\nThe week ahead."]) await page.evaluate((body) => window.testing.open(body), body);
      const row = (title) => page.locator(".note-list [data-id]").filter({ hasText: title });
      await row("Trip").click({ button: "right" });
      await page.getByRole("menuitem", { name: "Open Below" }).click();
      await page.getByRole("region", { name: /Trip/ }).locator(".cm-content").click();
      await row("Groceries").click({ button: "right" });
      await page.getByRole("menuitem", { name: "Open to the Side" }).click();
    },
  },
  {
    id: "panes-drop",
    title: "A note dragged over the panes",
    look: "Groceries being dragged from the list over the open note's right edge: the right half of that pane tinted in the accent with an accent outline, inset a little from its edges, the note readable through it; nothing else highlighted.",
    act: async (page) => {
      for (const body of ["# Groceries\n\n- milk\n- eggs", "# Plan\n\nThe week ahead."]) await page.evaluate((body) => window.testing.open(body), body);
      const at = await page.locator("[data-pane-place='main']").boundingBox();
      await page.locator(".note-list [data-id]").filter({ hasText: "Groceries" }).hover();
      await page.mouse.down();
      await page.mouse.move(at.x + at.width - 40, at.y + at.height / 2, { steps: 8 });
    },
  },
  {
    id: "sidebar-divider",
    title: "Dividers in the sidebar",
    look: "A thin line under Calendar among the places; one after Trash, halfway between it and the Types heading (as much room above the line as below); one under Person, halfway between it and the Tags heading; one between #home and #work; each lined up with the rows' text, as quiet as the borders.",
    note: "---\ntype: person\n---\n# Ada\n\n#work #home",
    act: async (page) => {
      const sidebar = page.getByRole("navigation", { name: "Library" });
      for (const row of [/^Calendar/, /^Trash/, /^Person/, /^home/]) {
        await page.getByRole("menu").waitFor({ state: "detached" });
        await sidebar.getByRole("button", { name: row }).click({ button: "right" });
        await page.getByRole("menuitem", { name: "Add Divider Below" }).click();
      }
    },
    shoot: ".sidebar",
  },
  {
    id: "icon-picker-nested",
    title: "A nested tag's color, from its tag",
    look: "Over the search field, first a hollow ring in #work's blue (\"Same as #work\"), ringed as chosen, then the eight colors; the header's icon blue; behind, in the sidebar, meetings' # blue like work's.",
    storage: { "lines.looks": { tags: { work: { color: "blue", at: 1 } }, types: {} } },
    note: "# Plan\n\n#work/meetings",
    act: async (page) => {
      const sidebar = page.getByRole("navigation", { name: "Library" });
      await sidebar.getByRole("button", { name: "Tags in work" }).click();
      await sidebar.getByRole("button", { name: /^meetings/ }).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Icon and Color" }).click();
    },
  },
  {
    id: "icon-picker-money",
    title: "Icons found by what they're for",
    look: "Searching \"money\": the banknote, wallets, coins, hand with coins, piggy bank, the currencies, the card and the vault, each once, in a tidy grid with no gaps.",
    note: "# Budget\n\n#finance",
    act: async (page) => {
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^finance/ }).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Icon and Color" }).click();
      await page.getByRole("searchbox", { name: "Search icons" }).fill("money");
    },
    shoot: "dialog",
  },
  ...["neon", "classic", "pixel"].map((style) => ({
    id: `calendar-${style}`,
    title: `The Calendar in ${style[0].toUpperCase()}${style.slice(1)}`,
    look: "The week's own lines only, hour and day lines lined up with their labels and headings, no grid or pattern of the style's behind them; events, the now line and the headings in the style's colors and shapes, readable.",
    prefs: { style, theme: style },
    note: `---\nstart: ${dayFromToday(0)} ${String(new Date().getHours()).padStart(2, "0")}:00\nend: ${dayFromToday(0)} ${String(Math.min(23, new Date().getHours() + 2)).padStart(2, "0")}:00\n---\n# Standup`,
    act: (page) => page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click(),
    schemes: ["light", "dark"],
  })),
  {
    id: "feeds",
    title: "The Feeds by kind, an Atom feed's post open",
    look: "In the Library, before its shelves: RSS Feeds (the Svelte blog), Atom Feeds (Daring Fireball) and Podcast Feeds (Syntax), each with its unread count and its feeds under it, lined up as the tag tree nests tags; the Podcasts shelf after them, apart. Atom Feeds chosen: its posts in the list, newest first, an unread dot in the row's margin, the excerpt two lines at most, where it's from and when under it. The open post in the note's place, drawn as a note: its title, a smaller, quieter line of where it's from, by whom and when, then its text with its links, list and quote; the toolbar's Mark as Unread and Open in Browser lined up with the other buttons.",
    act: async (page) => {
      await subscribe(page, FEEDS);
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^Atom Feeds/ }).click();
      await page.locator(".note-list").getByRole("button", { name: /^Jensen Huang/ }).click();
    },
  },
  ...LOOKS.filter(([suffix]) => suffix !== "-classic").map(([suffix, prefs]) => ({
    id: `feeds-icons${suffix}`,
    title: `Feeds' pictures: a site's icon, as a podcast's artwork${inLook(suffix)}`,
    look: "Under RSS Feeds, Hacker News with its orange Y and Plain Notes with its black ring (in a dark theme on a light rounded tile, so it doesn't vanish; in a light one as it is); under Atom Feeds, Daring Fireball with its site's icon; under Podcast Feeds, the podcast's artwork: each the same small rounded square beside its title, lined up with the rows' icons, crisp, the Y not blurred or stretched.",
    prefs,
    act: async (page) => {
      await subscribe(page, ICON_FEEDS, SITE_ICONS);
      await page.waitForFunction(() => window.testing.notes.entries.filter((entry) => entry.note.body.includes("](../attachments/")).length === 4);
      await page.getByRole("navigation", { name: "Library" }).locator("li li img").nth(3).waitFor();
    },
  })),
  {
    id: "feeds-together",
    title: "The Feeds together (Settings → Library → Feeds in the sidebar)",
    look: "One Feeds row in the Library with every feed under it and every feed's posts in the list, newest first (an episode with its headphones and length, and its play button clear of the text).",
    prefs: { feedsInSidebar: "together" },
    act: async (page) => {
      await subscribe(page, FEEDS);
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^Feeds/ }).click();
    },
  },
  ...["neon", "classic", "pixel"].map((style) => ({
    id: `feeds-${style}`,
    title: `The Feeds in ${style[0].toUpperCase()}${style.slice(1)}`,
    look: "The posts' rows as the style draws the note list's, the unread dots in its accent; the open post as it draws a note, its byline quieter than its text.",
    prefs: { style, theme: style },
    act: async (page) => {
      await subscribe(page, FEEDS);
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^RSS Feeds/ }).click();
      await page.locator(".note-list").getByRole("button", { name: /^SvelteKit 3 is here/ }).click();
    },
  })),
  {
    id: "feeds-subscribe",
    title: "Subscribing to a feed",
    look: "The box under the + over the list: its heading, the field with the feed icon and its placeholder, the Subscribe button in the accent; on the web, the quiet line under it about which feeds the web can read.",
    act: async (page) => {
      await page.evaluate(() => window.testing.notes.setFilter({ kind: "feeds" }));
      await page.locator(".note-list").getByRole("button", { name: "Subscribe to a Feed" }).first().click();
    },
  },
  {
    id: "feeds-phone",
    title: "Phone: a post open",
    look: "The post filling the screen with the back button at the top left, its title wrapping, its byline and text inside the margins.",
    width: 390,
    height: 780,
    act: async (page) => {
      await subscribe(page, FEEDS);
      await page.evaluate(() => window.testing.notes.setFilter({ kind: "feeds" }));
      await page.locator(".note-list").getByRole("button", { name: /^What’s new in Svelte/ }).click();
    },
  },
  ...LOOKS.map(([suffix, prefs]) => ({
    id: `feeds-discussion${suffix}`,
    title: `A Hacker News post's discussion${inLook(suffix)}`,
    look: "Under the post, after a rule across the text's width: how many comments, and Open on Hacker News at the end of that line. Each comment's header, a chevron, its author (the poster's in the accent) and how long ago, quieter than the text; its text lined up with the name, quotes with the bar quotes have; replies drawn in under a thin line down from the chevron. The thread inside the note's margins, lined up with the post's text.",
    prefs,
    act: (page) => openDiscussion(page),
  })),
  {
    id: "feeds-discussion-folded",
    title: "A Hacker News post's discussion, a comment folded and the keyboard on it",
    look: "The first comment folded, with the keyboard's ring around its header: its chevron pointing right, how many replies went with it after its time, and the next comment straight under it.",
    act: async (page) => {
      await openDiscussion(page);
      await page.locator("[data-fold]").first().focus();
      await page.keyboard.press("ArrowLeft");
    },
  },
  ...[
    ["backdrop", "over a backdrop", { paperBackdrop: "dawn" }],
    ["ruled", "on ruled paper", { paperPattern: "lines" }],
  ].map(([id, title, prefs]) => ({
    id: `feeds-discussion-${id}`,
    title: `A Hacker News post's discussion ${title}`,
    look: "The post and its discussion on one page: over a backdrop, one card from the title down past the comments (none round the post alone); on ruled paper, the comments' text ruled at its own lines, their headers not.",
    prefs,
    act: (page) => openDiscussion(page),
  })),
  {
    id: "feeds-discussion-phone",
    title: "Phone: a Hacker News post's deep thread",
    look: "A thread fourteen replies deep: replies drawn in four levels, then in line with the fourth, each saying whom it answers (↳ reply to …); every comment's text a good width, nothing running off the side.",
    width: 390,
    height: 780,
    act: async (page) => {
      await openDiscussion(page, 14);
      await page.locator("[data-fold]").nth(5).focus();
    },
  },
  ...LOOKS.map(([suffix, prefs]) => ({
    id: `player${suffix}`,
    title: `The podcast player${inLook(suffix)}`,
    look: "At the bottom of the sidebar, over Set up sync: the episode's artwork, its title and show cut short, the close button lined up with them; the slider across with the time played and left under its ends; Take Notes and the transcript's button at the left, then back 15, play and forward 30 with the same room either side, the speed at the end, all in line. The episode's row says how much is left, its play button clear of the text.",
    prefs,
    act: (page) => playEpisode(page),
  })),
  {
    id: "player-phone",
    title: "Phone: the podcast player",
    look: "At the bottom of the list, above the screen's edge: the same player, nothing cut off, the list scrolling above it.",
    width: 390,
    height: 780,
    act: (page) => playEpisode(page),
  },
  ...["", "pixel"].map((style) => ({
    id: `player-note${style && `-${style}`}`,
    title: `An episode note, playing${style && ` in ${style[0].toUpperCase()}${style.slice(1)}`}`,
    look: "Before the audio link, a round Play (here Pause) button in the accent, the size of the text, lined up with the value and clear of the key's column; the mini player below the sidebar with the note's title and show.",
    prefs: style ? { style, theme: style } : {},
    note: "---\ntype: episode\npodcast: @[Syntax]\npublished: 2026-11-11\nduration: 1:00\naudio: https://traffic.megaphone.fm/FSI3647670844.mp3\nstatus: to listen\n---\n# 1055: What the hell is going on with GitHub?\n\nScott and Wes sit down with GitHub's Kyle Daigle to ask what the hell is going on with GitHub.",
    act: async (page) => {
      const audio = wav(60_000);
      await page.route((url) => url.hostname === "traffic.megaphone.fm", (route) => answerFile(route, audio, "audio/wav"));
      await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
      await page.waitForFunction(() => window.testing.player.playing);
      await page.evaluate(() => window.testing.player.seek(20));
    },
  })),
  ...["", "pixel"].map((style) => ({
    id: `listening${style && `-${style}`}`,
    title: `Notes taken while listening${style && ` in ${style[0].toUpperCase()}${style.slice(1)}`}`,
    look: "The note's list of times, each a chip in the accent with a small play icon before the time, its text's baseline the item's, the text after it a space away; the last item just started by Take Notes, the cursor after its chip. In the mini player, the pen (Take Notes) at the left, lined up with the speed at the right.",
    prefs: style ? { style, theme: style } : {},
    note: "---\ntype: episode\npodcast: @[Syntax]\npublished: 2026-11-11\nduration: 1:00\naudio: https://traffic.megaphone.fm/FSI3647670844.mp3\nstatus: listening\n---\n# 1055: What the hell is going on with GitHub?\n\nScott and Wes sit down with GitHub's Kyle Daigle to ask what the hell is going on with GitHub.\n\n- [0:12] Why it keeps going down: the move to Azure, and how big the monorepo got\n- [4:05] Copilot's agents are most of the traffic now\n- [0:31] ",
    act: async (page) => {
      const audio = wav(60_000);
      await page.route((url) => url.hostname === "traffic.megaphone.fm", (route) => answerFile(route, audio, "audio/wav"));
      await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
      await page.waitForFunction(() => window.testing.player.playing);
      await page.evaluate(() => {
        window.testing.player.pause();
        window.testing.player.seek(31);
        const view = window.testing.editor();
        view.focus();
        view.dispatch({ selection: { anchor: view.state.doc.length } });
      });
    },
  })),
  {
    id: "listening-enter",
    title: "Notes taken while listening, each Enter starting the next at the time it's at",
    look: "The note's list of times, built with Take Notes and then Enter: each item's chip with the time it was written at (0:12, 0:41, 0:55), the last just started, the cursor after its chip; the chips lined up, the text after them a space away.",
    note: "---\ntype: episode\npodcast: @[Syntax]\naudio: https://traffic.megaphone.fm/FSI3647670844.mp3\nstatus: listening\n---\n# 1055: What the hell is going on with GitHub?\n\nScott and Wes sit down with GitHub's Kyle Daigle.",
    act: async (page) => {
      const audio = wav(60_000);
      await page.route((url) => url.hostname === "traffic.megaphone.fm", (route) => answerFile(route, audio, "audio/wav"));
      await page.locator(".cm-content").getByRole("button", { name: "Play Episode" }).click();
      await page.waitForFunction(() => window.testing.player.playing);
      await page.evaluate(() => {
        window.testing.player.pause();
        window.testing.player.seek(12);
      });
      await page.getByRole("region", { name: "Podcast player" }).getByRole("button", { name: "Take Notes" }).click();
      await page.waitForFunction(() => window.testing.text()?.endsWith("] "));
      await page.keyboard.type("Why it keeps going down: the move to Azure");
      await page.evaluate(() => window.testing.player.seek(41));
      await page.keyboard.press("Enter");
      await page.keyboard.type("Copilot's agents are most of the traffic now");
      await page.evaluate(() => window.testing.player.seek(55));
      await page.keyboard.press("Enter");
    },
  },
  {
    id: "listening-transcript",
    title: "An episode's transcript, quoted into a note",
    look: "Above the mini player, with room under it, the transcript: its chapter's title faint at the top with the quote button at its right; lines with their time and speaker small and faint over the text, chapters as small bold headings between them, the line playing on a soft background, those played muted; no taller than about a third of the window, the Library still in sight above it; nothing cut off at the sidebar's edges. In the player's row, Take Notes and the transcript's button (on) at the left, the controls centered. In the note, the quote with its time's chip.",
    act: async (page) => {
      await openTranscript(page);
      await page.evaluate(() => window.testing.open("# Outages\n\nWhy GitHub keeps going down."));
      await page.locator(".cm-content").click();
      await page.keyboard.press("Meta+End");
      await page.getByRole("region", { name: "Podcast player" }).getByRole("button", { name: "Quote in Note" }).click();
      await page.waitForFunction(() => window.testing.text()?.includes("> ["));
      await page.evaluate(() => window.testing.editor().contentDOM.blur());
    },
  },
  {
    id: "listening-transcript-phone",
    title: "Phone: an episode's transcript",
    look: "At the bottom of the list, the transcript above the player, as on a desktop, at most about a third of the screen, the list scrolling above; nothing cut off at the screen's edges.",
    width: 390,
    height: 780,
    act: (page) => openTranscript(page),
  },
  {
    id: "listening-phone",
    title: "Phone: Take Notes",
    look: "The episode's note open, its list's new item's chip with the cursor after it, ready to type; nothing cut off.",
    width: 390,
    height: 780,
    act: async (page) => {
      await playEpisode(page);
      await page.getByRole("region", { name: "Podcast player" }).getByRole("button", { name: "Take Notes" }).click();
      await page.waitForFunction(() => window.testing.text()?.endsWith("] "));
    },
  },
  {
    id: "listening-elsewhere",
    title: "Times in another note",
    look: "In a note that isn't the episode's, each time a link to its sound drawn as the same chip (no address in sight), in the middle of a sentence, its text's baseline the line's.",
    note: "# Outages, and what to do about them\n\nKyle's point about status pages [4:05](https://traffic.megaphone.fm/FSI3647670844.mp3#t=245) is the one to take to the team, with the bit on the monorepo [0:12](https://traffic.megaphone.fm/FSI3647670844.mp3#t=12).",
    act: (page) => page.evaluate(() => window.testing.editor().contentDOM.blur()),
  },
  {
    id: "calendar-repeat",
    title: "A repeating event and its Repeat menu",
    look: "Standup on each weekday this week at the hour now, each with the small repeat mark after its title; its Repeat menu open: Doesn't Repeat, Every Day, Every Weekday (checked), Every Week on today's weekday, Every 2 Weeks, Every Month on Day n, on the nth weekday, Every Year; the dots in the month on weekdays only.",
    note: `---\nstart: ${dayFromToday(0)} ${String(new Date().getHours()).padStart(2, "0")}:00\nend: ${dayFromToday(0)} ${String(Math.min(23, new Date().getHours() + 1)).padStart(2, "0")}:00\nrepeat: every weekday\n---\n# Standup`,
    act: async (page) => {
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
      await page.getByRole("button", { name: /^Standup, / }).first().click({ button: "right" });
      await page.getByRole("menuitem", { name: "Repeat" }).click();
    },
  },
  {
    id: "calendar-rename",
    title: "Renaming an event",
    look: "The event looks as it did, its color, bar, icon and time where they were, with a soft outline; its title selected in place, in the same size and weight, the cursor in it; no box of another color over it.",
    storage: { "lines.looks": { tags: {}, types: { meeting: { color: "purple", at: 1 } } } },
    // At the hour now, which the week opens just below.
    note: `---\ntype: meeting\nstart: ${dayFromToday(0)} ${String(new Date().getHours()).padStart(2, "0")}:00\nend: ${dayFromToday(0)} ${String(Math.min(23, new Date().getHours() + 2)).padStart(2, "0")}:00\n---\n# Standup`,
    act: async (page) => {
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
      await page.getByRole("button", { name: /^Standup, / }).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Rename" }).click();
    },
  },
  { id: "heading-accent", title: "Headings in the accent", look: "Every heading in the accent; h6 not muted.", prefs: { headingColor: "accent" }, note: "# Heading one\n\n## Heading two\n\n### Heading three\n\nText under them." },
  ...["lines", "classic", "pixel", "neon"].map((style) => ({
    id: `library-shelf-${style}`,
    title: `The Library and a shelf of it, in ${style[0].toUpperCase()}${style.slice(1)}`,
    look: "In the sidebar, Library after the places and before Types with its + at the heading's end, quiet like the heading: Books, Movies, Music and Videos with their icons and counts, lined up with the rows above; Types with Person only. Movies listed: each row's poster beside its title, the director and year under it, and its status in a quiet outline before the date; Arrival's four and a half stars and Paris, Texas's three small after its status, lined up with it, the half filled to its middle, the rest faint; Paris, Texas without a poster shows the film icon in a box of the same size; titles lined up with each other. Dune: Part Two open: its properties, its title, its poster 240 pixels wide (not the note's width) and what it's about.",
    prefs: style === "lines" ? {} : { style, theme: style },
    act: async (page) => {
      await seedLibrary(page);
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^Movies/ }).click();
      await page.locator(".note-list [data-id]").first().click();
    },
    schemes: style === "lines" ? ["light", "dark"] : ["light"],
  })),
  {
    id: "ratings-marks",
    title: "A rating in stars, and scores on lines of their own",
    look: "In the properties, rating's three and a half stars in the theme's yellow, the fourth filled to its middle, the fifth a faint outline, the size of the text and on its baseline like the values above; in the text, Score's six of seven and Half's two and a half, the same. Nothing jumps from the text around them.",
    note: "---\ntype: book\nauthor: Mary Shelley\nyear: 1818\nstatus: read\nrating: 3.5/5\n---\n# Frankenstein\n\nScore: 6/7\nHalf: 2.5/5\n\nThe last line, for the cursor.",
    act: (page) => page.evaluate(() => window.testing.place()),
    shoot: ".cm-lp-editable",
  },
  {
    id: "ratings-points",
    title: "A show rated out of 10, with ratings of its own",
    look: "Shows on Out of 10, with Story and Music: rating 9, story 8.5 and music 10, each bold, its /10 faint, and a short bar in the accent filled as far, the bars lined up under each other; the keys in their column like any property's.",
    storage: { "lines.looks": { ratings: { kinds: { show: { scale: { id: "10", at: 1 }, named: { names: ["Story", "Music"], at: 1 } } } } } },
    note: "---\ntype: show\ncreator: Kanehito Yamada\nrating: 9/10\nstory: 8.5/10\nmusic: 10/10\nstatus: watched\n---\n# Frieren: Beyond Journey's End\n\nThe last line, for the cursor.",
    act: (page) => page.evaluate(() => window.testing.place()),
    shoot: ".cm-lp-editable",
  },
  {
    id: "ratings-words",
    title: "Ratings in words, on Grades",
    look: "Movies on Grades: rating A, a chip in the accent, its corners as round as a mention's; story on the same. Under them a Key: Value line as written. Nothing taller than the line.",
    storage: { "lines.looks": { ratings: { kinds: { movie: { scale: { id: "grades", at: 1 }, named: { names: ["Story"], at: 1 } } } } } },
    note: "---\ntype: movie\ndirector: Denis Villeneuve\nrating: A\nstory: S\nstatus: watched\n---\n# Arrival\n\nNot a grade: Q\n\nThe last line, for the cursor.",
    act: (page) => page.evaluate(() => window.testing.place()),
    shoot: ".cm-lp-editable",
  },
  {
    id: "ratings-rate-menu",
    title: "Rate ▸ in an item's menu on its shelf",
    look: "Arrival's menu: its statuses, Watched checked, then Rate with a chevron at its end; beside it, Rate's own menu lined up with it, 5 out of 5 to 1 out of 5, none checked (it's 4.5), then a line and Remove Rating. Both menus' rows as tall as each other, checks and icons in one column.",
    act: async (page) => {
      await seedLibrary(page);
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^Movies/ }).click();
      await page.locator(".note-list [data-id]").filter({ hasText: "Arrival" }).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Rate" }).click();
      await page.getByRole("menuitem", { name: "Remove Rating" }).waitFor();
    },
  },
  {
    id: "ratings-settings",
    title: "Settings → Library → Ratings",
    look: "Ratings after Links: a row for each kind, its name, its note (Show's: \u201cAlso rated for Story and Music.\u201d) and a select of its scale with the pencil after it, lined up down the card. Show's pencil open: Story and Music in fields, each with up, down and remove, the up of the first and the down of the last dimmed; the field to add another and Add; the note under them. Scales after it: Vibes (\u201cWords: …\u201d) and Hearts with a heart, each with a pencil and a trash, the one in use dimmed; New Scale quiet at the heading's end.",
    storage: {
      "lines.looks": {
        ratings: {
          kinds: { show: { scale: { id: "10", at: 1 }, named: { names: ["Story", "Music"], at: 1 } }, movie: { scale: { id: "vibes", at: 1 } } },
          scales: { vibes: { name: "Vibes", scale: { kind: "labels", labels: ["Masterpiece", "Great", "Fine", "Meh"] }, at: 1 }, hearts: { name: "Hearts", scale: { kind: "marks", of: 7, icon: "heart" }, at: 1 } },
        },
      },
    },
    act: async (page) => {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("navigation").getByText("Library", { exact: true }).click();
      await dialog.getByRole("button", { name: "Show ratings" }).click();
      await dialog.getByRole("textbox", { name: "Rating 1" }).evaluate((field) => field.scrollIntoView({ block: "center" }));
    },
    shoot: "dialog",
    height: 1000,
  },
  {
    id: "ratings-new-scale",
    title: "Settings → Library → Ratings → New Scale",
    look: "Under Scales, a form in the card: the name field focused (a 2px accent ring) and Marks, Points and Words beside it; Out of and its number, the icons in a row at the end, Hearts chosen; Cancel and Save at the end, Save primary. Then Words chosen: one field for the words, its note under it.",
    act: async (page) => {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("navigation").getByText("Library", { exact: true }).click();
      await dialog.getByRole("button", { name: "New Scale" }).click();
      await dialog.getByRole("textbox", { name: "Scale’s name" }).fill("Hearts");
      await dialog.getByRole("radio", { name: "Hearts" }).click();
      await dialog.getByRole("textbox", { name: "Scale’s name" }).focus();
      await dialog.getByRole("button", { name: "Save", exact: true }).evaluate((button) => button.scrollIntoView({ block: "center" }));
    },
    shoot: "dialog",
  },
  ...["lines", "classic", "pixel", "neon"].map((style) => ({
    id: `library-add-${style}`,
    title: `Add to Library, searching Books, in ${style[0].toUpperCase()}${style.slice(1)}`,
    look: "Under the Library's +, the kinds to search for in a row (Books chosen, then Movies, Shows, Music, Podcasts; no Papers on the web), the field with “dune”, and four books, each its cover small and tall at its left, its title and its author · year under it, lined up; Blank at the bottom right, quiet. Nothing cut off or crowded.",
    prefs: style === "lines" ? {} : { style, theme: style },
    act: searchLibrary,
    schemes: style === "lines" ? ["light", "dark"] : ["light"],
  })),
  ...["lines", "classic", "pixel", "neon"].map((style) => ({
    id: `book-epub-${style}`,
    title: `An EPUB read in its note's place, in ${style[0].toUpperCase()}${style.slice(1)}`,
    look: "The Yellow Wallpaper's story in a column as wide as a note's, in the theme's colors and the notes' font (the style's own in Pixel and Neon), its italics and centered title kept; a sentence chosen in the selection's color. Above it, lined up: Contents, the search field, Pages and Scroll, Keep Quote (on now). Under it the chapter's name, a thin line of how far through and its percent, between the turn buttons. Nothing cut off, no second page peeking in at the side.",
    prefs: style === "lines" ? {} : { style, theme: style },
    act: async (page) => {
      await readBook(page, "The Yellow Wallpaper");
      await chooseSentence(page);
    },
    schemes: style === "lines" ? ["light", "dark"] : ["light"],
  })),
  {
    id: "book-pdf",
    title: "A PDF read in its note's place, as printed",
    look: "Pride and Prejudice's first page whole, as printed (black on white, in the dark theme too), centered with room around it and no next page showing under it; its first line chosen over the text. Page 1 of 6 under it.",
    act: async (page) => {
      await readBook(page, "Pride and Prejudice");
      await chooseSentence(page);
    },
  },
  {
    id: "book-pdf-theme-colors",
    title: "A PDF in the theme's colors",
    look: "The paintbrush on: the page's paper the theme's background and its type the theme's text, the brush in the accent; the page's edge still a quiet line.",
    prefs: { bookThemeColors: true },
    act: (page) => readBook(page, "Pride and Prejudice"),
    schemes: ["dark"],
  },
  {
    id: "book-pdf-scrolled",
    title: "A PDF scrolled",
    look: "Scroll chosen: the pages one under another, as wide as the column allows (no wider than reads well), with room between them.",
    prefs: { bookFlow: "scrolled" },
    act: async (page) => {
      await readBook(page, "Pride and Prejudice");
      await page.locator(".pdf-reader").evaluate((reader) => reader.scrollBy(0, 500));
    },
  },
  {
    id: "book-contents",
    title: "A book's contents",
    look: "Under Contents, the book's table of contents in a menu no longer than the window, each entry on its own lines if it's long, entries within others indented.",
    act: async (page) => {
      await readBook(page, "The Yellow Wallpaper");
      await page.getByRole("button", { name: "Contents" }).click();
    },
  },
  {
    id: "book-search",
    title: "Searching a book",
    look: "Under the search field, the matches under the chapter each is in (its name small and quiet), each match the words around it, wrapping to three lines at most; the list no longer than the window, scrolling inside.",
    act: async (page) => {
      await readBook(page, "The Yellow Wallpaper");
      const field = page.getByRole("searchbox", { name: "Search the book" });
      await field.fill("paper");
      await field.press("Enter");
      await page.getByRole("menu").waitFor();
    },
  },
  {
    id: "book-quote",
    title: "A quote kept, and how far through on the shelf",
    look: "Back in the note: `progress` and `status: reading` among its properties, the quote at its end with — Page 1 under it as a link. In the list, the book's row with Reading and a thin line of how far through in the accent, under its date.",
    act: async (page) => {
      await readBook(page, "Pride and Prejudice");
      await chooseSentence(page);
      await page.getByRole("button", { name: "Keep Quote" }).click();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await page.getByRole("button", { name: "Back to the Note" }).click();
      await page.evaluate(() => window.testing.place());
    },
  },
  {
    id: "phone-book-epub",
    title: "Phone: an EPUB",
    look: "The toolbar on one row: Contents, the field (Search, not cut), Pages and Scroll as icons, the quote button as an icon; the text in a column the phone's width, with margins.",
    act: (page) => readBook(page, "The Yellow Wallpaper"),
    width: 390,
    height: 780,
  },
  {
    id: "phone-book-pdf",
    title: "Phone: a PDF, a page at a time",
    look: "One page fitting the phone's width, centered, and nothing of the next page under it; the toolbar on one row.",
    act: (page) => readBook(page, "Pride and Prejudice"),
    width: 390,
    height: 780,
  },
  {
    id: "library-link-menu",
    title: "A link's menu in a note",
    look: "Right-clicked, the link outlined by nothing new; its menu: Open Link, Copy Link, then Add to Library with the library's icon, after a line.",
    note: "# Plans\n\nWatch https://youtu.be/dQw4w9WgXcQ tonight, and read more.",
    act: (page) => page.locator(".cm-content .cm-lp-link").click({ button: "right" }),
  },
  {
    id: "library-music",
    title: "A shelf of square covers: Music",
    look: "Songs and albums together, each cover square and the same size, its artist and album or year under its title.",
    act: async (page) => {
      await seedLibrary(page);
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^Music/ }).click();
    },
    shoot: ".note-list",
  },
  {
    id: "library-bookmarks-import",
    title: "Importing bookmarks: what it will do",
    look: "Settings → Library → Bookmarks: Import Bookmarks… then, in the same card, \u201c8 bookmarks in bookmarks.html\u201d with what's left out under it, quieter, a line each; Tag with their folders with its note and switch, lined up like the rows above; Import 6 Resources and Cancel at the start of their row. Nothing cut off.",
    act: async (page) => {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("navigation").getByText("Library", { exact: true }).click();
      await dialog.locator("input[type=file][accept*='.json']").setInputFiles({ name: "bookmarks.html", mimeType: "text/html", buffer: Buffer.from(BOOKMARKS) });
      await dialog.getByText("8 bookmarks in bookmarks.html").evaluate((line) => line.scrollIntoView({ block: "center" }));
    },
    shoot: "dialog",
  },
  {
    id: "library-resources",
    title: "Resources: imported bookmarks on their shelf",
    look: "Library → Resources: each bookmark its title and folder under it (Bookmarks bar / Dev / Rust), the bookmark icon in its box where a cover would be, the date it was bookmarked on the right, the latest first; the Rust book open: its folder, added and link, its title, and its tag.",
    act: async (page) => {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("navigation").getByText("Library", { exact: true }).click();
      await dialog.locator("input[type=file][accept*='.json']").setInputFiles({ name: "bookmarks.html", mimeType: "text/html", buffer: Buffer.from(BOOKMARKS) });
      await dialog.getByRole("switch", { name: "Tag with their folders" }).click();
      await dialog.getByRole("button", { name: "Import 6 Resources" }).click();
      await dialog.getByText("Imported 6 resources").waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^Resources/ }).click();
      await page.locator(".note-list [data-id]").filter({ hasText: "The Rust Programming Language" }).click();
    },
  },
  {
    id: "library-looking-up",
    title: "A link being looked up",
    look: "After the link, “Looking up…” small and faint with a ring before it, on the link's line; the link as any link.",
    act: async (page) => {
      // Never answered, so it stays looking.
      await page.route("https://www.youtube.com/oembed**", () => {});
      await page.evaluate(() => window.testing.open(""));
      await page.evaluate(() => window.testing.place());
      await page.evaluate(() => {
        const data = new DataTransfer();
        data.setData("text/plain", "https://youtu.be/dQw4w9WgXcQ");
        document.querySelector(".editor-pane [data-pane-content='main'] .cm-content").dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
      });
    },
    shoot: ".editor-pane",
  },
  ...["lines", "classic", "pixel", "neon"].map((style) => ({
    id: `site-players-${style}`,
    title: `Spotify and SoundCloud links before they're played, in ${style[0].toUpperCase()}${style.slice(1)}`,
    look: "Three cards like an audio file's, the same width: a round play button in the accent's soft box, then Never Gonna Give You Up, Flickermood and Album on Spotify, faint under each “Loads … player when you play it” (Spotify's: with “30-second previews without a Spotify login”, wrapped if it must be); lined up with the text above, with room between them.",
    prefs: style === "lines" ? {} : { style, theme: style },
    note: "# Listening\n\nA few things to listen to this week.\n\n[Never Gonna Give You Up](https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC)\n\n[Flickermood](https://soundcloud.com/forss/flickermood)\n\n[Spotify](https://open.spotify.com/album/6N9PS4QXF1D0OWPk0Sxtb4)\n",
    shoot: ".editor-pane",
    schemes: style === "lines" ? ["light", "dark"] : ["light"],
  })),
  {
    id: "site-players-playing",
    title: "Spotify's and SoundCloud's players, played (stand-ins for the sites')",
    look: "Where each card was, its player (a stand-in box the height the site's is, a track's 152 and 166 pixels tall), as wide as its card was, the corners round, an Open button beside each; the album still a card, the same width. Nothing cut off, nothing refused, no message that it couldn't load.",
    note: "# Listening\n\n[Never Gonna Give You Up](https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC)\n\n[Flickermood](https://soundcloud.com/forss/flickermood)\n\n[Spotify](https://open.spotify.com/album/6N9PS4QXF1D0OWPk0Sxtb4)\n",
    act: async (page) => {
      // Stand-ins, which say they're ready as the sites' players do, and play nothing.
      const standIn = (site, ready) =>
        `<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;display:grid;place-items:center;background:#3b4b55;color:#fff;font:600 15px system-ui">${site}’s player<script>parent.postMessage(${ready}, "*")</script>`;
      await page.route("https://open.spotify.com/embed/**", (route) => route.fulfill({ contentType: "text/html", body: standIn("Spotify", '{ type: "ready" }') }));
      await page.route("https://w.soundcloud.com/player/**", (route) => route.fulfill({ contentType: "text/html", body: standIn("SoundCloud", 'JSON.stringify({ method: "ready", value: null })') }));
      await page.getByRole("button", { name: "Play with Spotify" }).first().click();
      await page.getByRole("button", { name: "Play with SoundCloud" }).click();
      await page.locator(".cm-lp-site-player").first().hover();
    },
    shoot: ".editor-pane",
  },
  ...["block", "underline", "thick"].map((shape) => ({
    id: `cursor-${shape}`,
    title: `Text cursor: ${shape}`,
    look: "The cursor where the next character goes, as wide as the character for a block or underline, in the accent.",
    prefs: { caretShape: shape, caretBlink: "off" },
    note: "Where the cursor sits: here",
    act: (page) => page.evaluate(() => window.testing.place(20)),
    shoot: ".editor-pane",
  })),
  ...["cat", "alien", "slime", "girl"].map((mascot) => ({
    id: `mascot-${mascot}`,
    title: `Mascot: ${mascot}`,
    look: "Crisp pixel art at the bottom of the note, in the accent where it has one; never over the text.",
    prefs: { mascot },
    note: PROSE,
    wait: 1200,
    shoot: ".editor-pane",
  })),
  {
    id: "typing-going",
    title: "Typing practice, going",
    look: "Typed text in the text's color, mistakes in red with a tint, the cursor before the next character, the speed and time above.",
    note: "Practice\n\n```typing\nSphinx of black quartz, judge my vow! The five boxing wizards jump quickly.\n```\n",
    act: async (page) => {
      await page.evaluate(() => window.testing.place());
      await page.keyboard.press("ArrowUp");
      await page.keyboard.type("Sphinx of blsck quartz, judge", { delay: 80 });
    },
    shoot: ".cm-lp-editable",
  },
  {
    id: "typing-done",
    title: "Typing practice, done",
    look: "Words a minute large, accuracy, time, mistakes, the keys missed most as keys, and A new best with a trophy; Again on the right.",
    note: "Practice\n\n```typing\nSphinx of black quartz.\n```\n",
    act: async (page) => {
      await page.evaluate(() => window.testing.place());
      await page.keyboard.press("ArrowUp");
      await page.keyboard.type("Sphinx of blsck quartz.", { delay: 60 });
    },
    shoot: ".cm-lp-editable",
  },
  ...["lines", "classic", "pixel", "neon"].flatMap((style) => [
    {
      id: `readwise-found-${style}`,
      title: `Settings → Library → Readwise, having found what's there, in ${style[0].toUpperCase()}${style.slice(1)}`,
      look: "Readwise's group after Bookmarks, its rows as Bookmarks' are: the token's row with its note, the field (empty again) and Find lined up at its end; what was found, the first line plain and the rest quieter (adding to Walden, a supplemental book left out); then Import, focused, and Cancel.",
      prefs: style === "lines" ? {} : { style, theme: style },
      act: (page) => readwise(page),
      shoot: "dialog",
      schemes: style === "lines" ? ["light", "dark"] : ["light"],
    },
    {
      id: `readwise-done-${style}`,
      title: `Settings → Library → Readwise, imported, in ${style[0].toUpperCase()}${style.slice(1)}`,
      look: "A check and what was added, Undo Import quiet at the row's end, as Bookmarks' is; the field empty.",
      prefs: style === "lines" ? {} : { style, theme: style },
      act: (page) => readwise(page, { importing: true }),
      shoot: "dialog",
      schemes: style === "lines" ? ["light", "dark"] : ["light"],
    },
  ]),
  {
    id: "readwise-note",
    title: "A book brought from Readwise",
    look: "Its properties (author, readwise), title and cover; its tag, then the person's note; Highlights, each a quote with where it is and when in it, the person's note on it under it as text.",
    act: async (page) => {
      await readwise(page, { importing: true });
      await page.keyboard.press("Escape");
      await page.evaluate(() => window.testing.notes.select(window.testing.notes.entries.find((entry) => entry.meta.title === "Moby-Dick").note.id));
      await page.locator(".cm-content").getByText("Call me Ishmael.").waitFor();
    },
    height: 1400,
  },
  ...["Theme", "Paper", "Typography", "Cursor", "Mascots", "Editor", "Library", "All Plugins"].map((section) => ({
    id: `settings-${section.toLowerCase().replaceAll(" ", "-")}`,
    title: `Settings → ${section}`,
    look: "Rows lined up, notes under their labels, nothing cut off or crowded; the new rows (Dark panes, Heading color, Writing, Typing sounds…) like their neighbors.",
    settings: section,
    shoot: "dialog",
  })),
  ...["lines", "classic", "pixel", "neon"].map((style) => ({
    id: `color-picker-${style}`,
    title: `The color picker, in ${style[0].toUpperCase()}${style.slice(1)}`,
    look: "Under Your color's swatch, in the style's own menu look: the theme's colors as round swatches in rows of eight, evenly spaced, the accent first and ringed as chosen; under them the square of saturation and brightness in the accent's hue, its thumb a white ring on the accent; the rainbow of hues, its thumb at the accent's hue; the color's hex in a field, the eyedropper beside it (Chromium only). Nothing cut off or crowded.",
    prefs: { style, theme: style, headingColor: "custom" },
    act: async (page) => {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("dialog").getByRole("navigation").getByText("Typography", { exact: true }).click();
      await page.getByRole("button", { name: "Choose a color for Your color" }).click();
      await page.getByRole("dialog", { name: "Choose a color for Your color" }).getByRole("radio").first().click();
    },
  })),
  ...["lines", "classic", "pixel", "neon"].map((style) => ({
    id: `installed-fonts-${style}`,
    title: `Typography's installed fonts, in ${style[0].toUpperCase()}${style.slice(1)}`,
    look: "Under Font family's recommended fonts (none marked), Installed font's field shows Georgia, like a select in the style's look; its list under it as wide, each name in its own face, Georgia checked, rows evenly spaced and nothing cut off. The preview above is in Georgia.",
    prefs: { style, theme: style, installedFont: "Georgia" },
    act: async (page) => {
      // The fonts as Chrome lists them, the same on every computer.
      await page.evaluate(() => {
        const families = ["American Typewriter", "Avenir Next", "Baskerville", "Courier New", "Didot", "Futura", "Georgia", "Gill Sans", "Helvetica Neue", "Menlo", "Optima", "Palatino", "Times New Roman", "Verdana"];
        Object.assign(window, { queryLocalFonts: async () => families.map((family) => ({ family })) });
      });
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("dialog").getByRole("navigation").getByText("Typography", { exact: true }).click();
      await page.getByRole("combobox", { name: "Installed font" }).click();
      await page.getByRole("option", { name: "Georgia" }).waitFor();
    },
  })),
  {
    id: "settings-typography-groups",
    title: "Settings → Typography, under the fonts",
    look: "Font size's Text size, then Heading color's Color (Theme, Accent, Custom) as a titled group like it, then Font ligatures; headings, cards and rows lined up and evenly spaced.",
    act: async (page) => {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("navigation").getByText("Typography", { exact: true }).click();
      await dialog.locator('section[aria-label="Heading color"]').evaluate((group) => group.scrollIntoView({ block: "center" }));
    },
    shoot: "dialog",
  },
  {
    id: "installed-font-missing",
    title: "Typography, with an installed font this computer hasn't",
    look: "Installed font says “Zz Not A Font isn’t installed on this device, so notes are in the system font.” under its label, the field keeping the name; no recommended font marked; the preview in the system's font.",
    prefs: { installedFont: "Zz Not A Font" },
    settings: "Typography",
    shoot: "dialog",
  },
  ...["lines", "classic", "pixel", "neon"].flatMap((style) => {
    /** Settings → Theme, with a theme of yours made from Nord (its palette copied as yours), scrolled to `at`. */
    const yours = async (page, at) => {
      await page.evaluate(() => {
        const { customThemes, plugins, prefs } = window.testing;
        prefs.theme = customThemes.copy(plugins.theme("nord").definition, (id) => plugins.palette(id), "Nord Copy");
      });
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("dialog").getByRole("navigation").getByText("Theme", { exact: true }).click();
      await at(page.getByRole("dialog")).scrollIntoViewIfNeeded();
    };
    const name = `${style[0].toUpperCase()}${style.slice(1)}`;
    return [
      {
        id: `palettes-${style}`,
        title: `Palettes, in ${name}`,
        look: "Every palette a strip of its colors with its name under it, in an even grid, the chosen one ringed in the accent; yours under their own heading; below, the chosen one's colors by name.",
        prefs: { style, theme: style },
        act: (page) => yours(page, (dialog) => dialog.getByRole("radiogroup", { name: "Palettes" })),
        shoot: "dialog",
      },
      {
        id: `palette-editor-${style}`,
        title: `A palette of yours, in ${name}`,
        look: "Its name, then a row for each color: its swatch and hex, its name (or the one lines gives it, greyed), and arrows and a cross that line up row to row; Add a Color at the end. Nothing cut off or crowded.",
        prefs: { style, theme: style },
        act: async (page) => {
          await yours(page, (dialog) => dialog.getByRole("radiogroup", { name: "Palettes" }));
          await page.getByRole("dialog").getByRole("textbox", { name: "Name of Polar Night 1" }).scrollIntoViewIfNeeded();
        },
        shoot: "dialog",
      },
      {
        id: `theme-parts-${style}`,
        title: `A theme of yours, its parts, in ${name}`,
        look: "The palette chosen for light and for dark; each part's swatch as drawn and its palette color's name (or Auto), lined up; a part drawn darker or lighter to read says so in its note.",
        prefs: { style, theme: style },
        act: (page) => yours(page, (dialog) => dialog.getByRole("button", { name: "Choose a color for Accent" })),
        shoot: "dialog",
      },
    ];
  }),
  { id: "phone-dark-list", title: "Phone: a dark note list", look: "The list dark, its rows readable; the top of the screen not a light strip over it (a known gap, docs/limitations.md).", prefs: { darkPanes: "list" }, width: 390, height: 780, schemes: ["light"] },
  {
    id: "phone-typing",
    title: "Phone: typing practice",
    look: "The drill fits the width, its stats on one line or wrapped cleanly.",
    note: "```typing\nThe quick brown fox jumps over the lazy dog.\n```\n",
    width: 390,
    height: 780,
  },
  { id: "phone-backdrop", title: "Phone: a backdrop", look: "Room around the page, nothing scrolls sideways.", prefs: { paperBackdrop: "dawn" }, note: PROSE, width: 390, height: 780 },
  {
    id: "phone-settings-shortcuts",
    title: "Phone: Settings → Shortcuts, in French",
    look: "Every row inside its card, nothing scrolls sideways; keys that don't fit beside their action go onto more lines, each with its « ou ».",
    language: "fr",
    width: 390,
    height: 780,
    act: async (page) => {
      await page.keyboard.press("ControlOrMeta+/");
      await page.getByRole("dialog").locator('[id="shortcuts-shortcuts.group.sheets"]').scrollIntoViewIfNeeded();
    },
    shoot: "dialog",
  },
  {
    id: "phone-settings-theme",
    title: "Phone: Settings → Theme, in Spanish",
    look: "Dark panes' four choices on two lines inside the card, not past its edge; the other rows as they were.",
    language: "es",
    width: 390,
    height: 780,
    act: async (page) => {
      await page.keyboard.press("ControlOrMeta+/");
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "Todos los ajustes" }).click();
      await dialog.locator("#settings-nav-theme").click();
      await dialog.getByRole("radiogroup", { name: "Paneles oscuros" }).scrollIntoViewIfNeeded();
    },
    shoot: "dialog",
  },
  {
    id: "phone-note-info",
    title: "Phone: a note's info, in Spanish",
    look: "The panel inside the screen with room on both sides; the formats on two lines rather than past its edge.",
    language: "es",
    note: PROSE,
    width: 390,
    height: 780,
    act: (page) => page.getByRole("button", { name: "Información de la nota" }).click(),
  },
];

const scenes = SCENES.filter((scene) => !only.length || only.some((word) => scene.id.includes(word)));

if (!args.includes("--no-build")) await build({ root, mode: "test", logLevel: "error", build: { outDir, emptyOutDir: true } });
// A port of its own, as the browser tests' (tests/browser/setup.ts).
const server = await preview({ root, mode: "test", logLevel: "error", build: { outDir }, preview: { host: "127.0.0.1", port: 0, open: false } });
const url = server.resolvedUrls.local[0];
// Unheard (the test build mutes itself too: src/test/silence.ts); WebKit has no such switch.
const browser = engine === "webkit" ? await webkit.launch() : await chromium.launch({ args: ["--mute-audio"] });

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const shots = [];
for (const scene of scenes) {
  for (const scheme of scene.schemes ?? ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: scene.width ?? 1280, height: scene.height ?? 800 }, colorScheme: scheme, deviceScaleFactor: 2, reducedMotion: "reduce" });
    const { plugins: pluginChoices, ...prefs } = scene.prefs ?? {};
    await context.addInitScript(
      ([prefs, plugins, storage, language]) => {
        if (location.protocol !== "http:") return;
        localStorage.setItem("lines.seeded", "1");
        localStorage.setItem("lines.prefs", JSON.stringify(prefs));
        if (plugins) localStorage.setItem("lines.plugins", JSON.stringify(plugins));
        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, JSON.stringify(value));
        if (language) localStorage.setItem("lines.language", language);
      },
      [prefs, pluginChoices, scene.storage ?? {}, scene.language],
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => window.testing?.notes.ready);
    if (scene.note !== undefined) await page.evaluate(([body, format]) => window.testing.open(body, format), [scene.note, scene.format]);
    await scene.act?.(page);
    if (scene.settings) {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("dialog").getByRole("navigation").getByText(scene.settings, { exact: true }).first().click();
    }
    await page.waitForTimeout(scene.wait ?? 400);
    const file = `${scene.id}-${scheme}.png`;
    const target = scene.shoot === "dialog" ? page.getByRole("dialog") : scene.shoot ? page.locator(scene.shoot).first() : page;
    await target.screenshot({ path: out + file });
    shots.push({ scene, scheme, file, errors });
    if (errors.length) console.warn(`${scene.id} (${scheme}): ${errors.join("; ")}`);
    await context.close();
  }
  process.stdout.write(".");
}
await browser.close();
await server.close();

const esc = (text) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cards = scenes
  .map((scene) => {
    const pictures = shots
      .filter((shot) => shot.scene === scene)
      .map((shot) => `<figure><a href="${shot.file}"><img src="${shot.file}" alt="${esc(`${scene.title}, ${shot.scheme}`)}" loading="lazy"></a><figcaption>${shot.scheme}${shot.errors.length ? ` · <strong>errors: ${esc(shot.errors.join("; "))}</strong>` : ""}</figcaption></figure>`)
      .join("");
    return `<section id="${scene.id}"><h2>${esc(scene.title)}</h2><p>${esc(scene.look)}</p><div class="pictures">${pictures}</div></section>`;
  })
  .join("\n");
writeFileSync(
  `${out}index.html`,
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>lines · QA pictures</title>
<style>
  :root { color-scheme: light dark; font: 15px/1.5 system-ui, sans-serif; }
  body { max-width: 1400px; margin: 0 auto; padding: 24px; }
  section { margin: 0 0 40px; }
  h2 { margin: 0 0 4px; font-size: 18px; }
  p { margin: 0 0 12px; opacity: 0.8; }
  .pictures { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 520px), 1fr)); gap: 16px; }
  figure { margin: 0; }
  img { width: 100%; height: auto; border: 1px solid color-mix(in srgb, currentColor 15%, transparent); border-radius: 8px; }
  figcaption { font-size: 13px; opacity: 0.7; }
</style></head>
<body><h1>lines · QA pictures</h1><p>${esc(`${engine}, ${new Date().toISOString().slice(0, 16).replace("T", " ")}`)}. Look at each picture for what it says; anything else that looks wrong counts too. qa/README.md has more.</p>
${cards}
</body></html>
`,
);
console.log(`\n${shots.length} pictures in qa/shots/; open qa/shots/index.html.`);
