# Library

Books, movies, shows, videos, music, podcasts, articles and papers, kept in lines as notes. Each is an ordinary Markdown note with a `type` (`book`, `movie`…), so it's searched, mentioned, synced and exported like any other, and listed in the sidebar's **Library**, a row for each kind with something in it, its notes with their covers and where you've got to.

## A note that's just a link

Paste a link into a new note (after the `# ` it starts with, or on its own), and lines fills the note in with what the link is: its title, cover, details and a few sentences of what it's about.

```markdown
---
type: movie
director: Denis Villeneuve
year: 2023
runtime: 166 min
genre: Science fiction, Adventure
link: https://www.imdb.com/title/tt15239678/
status: to watch
---
# Dune: Part Two

![Dune: Part Two|240](../attachments/3f9c….jpg)

Dune: Part Two is a 2024 American epic space opera film directed by Denis Villeneuve…
```

- It's looked up when the note **becomes** just a link, or its link changes: at once when it's pasted or dropped in, or once it's stayed that link for a second while you type it, so a link half typed isn't. The link can be bare, in `<…>`, or a Markdown link (`[text](…)`), with nothing else in the note; or, in a note made just now, in what it was made with and nothing else: after its `# `, or under the properties a note started on a shelf has.
- Notes that are already just a link are never looked up as they open or sync, nor as you write on around the same link (a line under it, say). Only Markdown notes are looked up, and never a locked note, nor one locked while it's looked up.
- Meanwhile the note says "Looking up…" after the link, quietly, and screen readers hear it. Offline, or when the site couldn't be reached, it says so for a moment and stays a link.
- Filled in, it's one change: undo (<kbd>⌘Z</kbd>) puts the link back. If you change the note while it's looked up, what was found is dropped; nothing you write is ever written over. If you've moved to another note by then, the note is filled in all the same; <kbd>⌘Z</kbd> stays the note's you're in, and the link isn't put back.
- The note leaves the Inbox: it's filed, on its shelf in the Library.
- A site's page that isn't one of those but has a feed (a blog's front page, `https://vercel.com/blog`; a podcast's site, `https://adspthepodcast.com`) becomes a subscription to that feed, in the apps, as when subscribing to a site's link (Feeds, below). A blog's post stays an article: what a page says it is comes first.
- A link lines can't say what it is (a page that doesn't say it's a book, a movie, an article…, and has no feed) stays as it is. Nothing is guessed.
- The cover is downloaded and kept with the note as an attachment, at most 1,200 pixels across, so it shows offline and syncs; the note shows it at a width that leaves room for the rest (240 pixels, a video's 400), which you can change as any picture's. It's kept only once the note is written, so a lookup dropped leaves nothing behind. Where it can't be downloaded (on the web, from a site that doesn't let pages download its pictures), the note has none rather than one shown from the site, and a picture a page gives that isn't on the web at large (an address on your own network, or not over https) isn't asked for.
- What a source says is written as just that text: a `#` or `@` in a title, a value or a description is escaped (`\#`), so it makes no tag or mention, nor a heading, list, code block or picture; a value YAML would read as something else (`Star Wars: Episode IV`, `"Heroes"`, `*NSYNC`) is quoted. Each request gives up after 15 seconds (arXiv's 20).
- Settings → Library → Look up links turns it off; then nothing is contacted.

## Add to Library

The + on the Library's heading in the sidebar opens Add to Library (with feeds on, it's in the +'s menu, beside Subscribe to a Feed): choose what to search for (Books, Movies, Shows, Music, Podcasts, Papers, as the sources on can search), and type a title, or a name with it. The catalogs answer as you type, each result with its cover, who made it and when; ↓ moves into them, and ↵ or a click adds the one chosen. Paste a link there instead to look it up as a note that's just a link is. Something the Library has a note of already, by its link, opens that note rather than making another. **Blank** starts one of the kind chosen to fill in by hand. What's added is filed on its shelf, not in the Inbox.

What's chosen is a new note on its shelf, opened at once with what the search said of it, then filled in from its page (its cover, and what it's about) as one change, which ⌘Z takes back.

| Searching for | Searched in | On the web |
|---|---|---|
| Books | Open Library | Yes |
| Movies, Shows | Wikidata, with posters from Wikipedia | Yes |
| Music (songs and albums) | MusicBrainz, covers from the Cover Art Archive | Yes |
| Podcasts | Apple's iTunes Search | Yes |
| Papers | arXiv | No |

Only what's typed is sent to the catalog searched.

## A link in a note

Right-click a link to a web page in any Markdown note (or put the cursor on it and press the menu key, or ⇧F10) for Open Link, Copy Link and **Add to Library**: lines looks the link up, makes a library note of what it is, and puts a mention of it in the link's place, `@[Dune: Part Two]`, as one change, which ⌘Z takes back (the library note stays, in the Library). The mention is of the note's title as it reads. It's never done unasked. If the library has a note with that link already, that's the one mentioned. If the link changed while it was looked up (typed into, or deleted), nothing is made or changed; if nothing can say what it is, the note says so after the link for a moment. Leave the note meanwhile and it goes on: the link is mentioned where it is in the note as stored (not taken back with ⌘Z, which is the note you're in's), and coming back while it's looked up shows how it's getting on. It gives up after 30 seconds.

## Bookmarks

Settings → Library → **Import Bookmarks…** makes each bookmark in a file a browser exported a **resource**: a note in the Library, under Resources, that's its link and its name so far. Settings → Export and Import → Import Files… recognizes a bookmarks file too, and asks the same.

| From | The file |
|---|---|
| Chrome, Edge, Brave, Opera, Vivaldi, Arc | Bookmarks → Bookmark manager → ⋮ → Export bookmarks (an `.html` file) |
| Firefox | Bookmarks → Manage Bookmarks → Import and Backup → Export Bookmarks to HTML…, or Backup… (a `.json` file) |
| Safari | File → Export → Bookmarks… |
| Pinboard, Raindrop, Pocket | Their HTML export |

All but Firefox's backup are Netscape's bookmark file, a page of links every browser writes a little differently. lines reads it with the browser's own parser, in a document of its own, where nothing in it runs or loads; its icons are left out.

```markdown
---
type: resource
folder: Bookmarks bar / Dev / Rust
added: 2023-11-14
link: https://doc.rust-lang.org/book/
---
# The Rust Programming Language

#rust #programming
```

- **Before anything's written**, it says what will happen: how many bookmarks there are, how many are in the Library already (a note there has the same link: left out), repeated in the file (imported once) or not web pages (bookmarklets, the browser's own pages, Firefox's saved searches: left out). **Tag with their folders** (off) gives each its folders as a nested tag, `#bookmarks-bar/dev/rust`; either way its folders are kept, as its `folder`.
- **Then it imports them**, a few hundred at a time, showing how far it's got (Stop stops it, keeping what's imported); five thousand take a second or two. After, it says what it did ("Imported 1,234 resources; 56 were already there"), and **Undo Import** there deletes them all again, but any changed since. Closing Settings doesn't stop an import, and opening it again shows how it went, with Undo, until another is asked about.
- **Each is dated when it was bookmarked**, created and last changed then, so Resources lists the latest bookmarked first and they don't crowd the top of your notes; `added` is that day. A file that has no dates (Safari's) keeps its order, dated as it's imported. A bookmark's tags (Firefox's, Pinboard's, Raindrop's, Pocket's) are its `#tags`, as lines writes tags (`Web Browsers` is `#web-browsers`); what a bookmark says of itself (Firefox's and Safari's descriptions) is its text.
- **Nothing is looked up** as they come in: thousands of bookmarks would ask thousands of sites. Right-click one on its shelf → **Look Up Details**, and it's looked up as a note that's just a link is: what its link is (a book, a video, an article…), where a source knows it, keeping its `folder`, `added` and tags. Or right-click its link in another note → Add to Library, which mentions it as it is.
- Resources are filed, not in the Inbox. They're notes like any other, so with sync on, each is a file of its own in the synced folder or bucket: the first sync after importing thousands sends thousands of small files, which takes a while (a few minutes for 5,000 to a bucket), and every device then has them.

## Kinds of things

| Type | In the Library | Properties, in this order | Status |
|---|---|---|---|
| `book` | Books | author, year, pages, publisher, isbn | to read, reading, read |
| `movie` | Movies | director, year, runtime, genre | to watch, watching, watched |
| `show` | Shows | creator, year, seasons, genre | to watch, watching, watched |
| `video` | Videos | channel, published, duration | to watch, watching, watched |
| `song` | Music | artist, album, year, duration | to listen, listening, listened |
| `album` | Music | artist, year, tracks | to listen, listening, listened |
| `podcast` | Podcasts | author, feed | |
| `episode` | Episodes | podcast (a mention of the podcast's note), published, duration, audio | to listen, listening, listened |
| `article` | Articles | author, site, published | to read, reading, read |
| `paper` | Papers | authors, year, arxiv | to read, reading, read |
| `feed` | Feeds (by its posts) | author, feed | |
| `resource` | Resources | folder, added | |

Each has `link` (where it's from) and `status` after its own properties, and only the properties a source found. The keys and the `status` values are written in English, like `type`, so tables (`@type.book`), mentions (`@[Dune].author`) and the Library read them alike on every device; lines shows the status in its own language. A note's status is set from its row's menu on its shelf (or by writing it), and it keeps its date, so the list stays as it is. A status of your own (`status: abandoned`) is shown as written.

A new note made while a shelf is shown starts as its kind, at its first status, as Blank in Add to Library does.

## In the sidebar

The Library comes after the places and before Types, which no longer lists its kinds. It's there even while it's empty, to be found, and like any section it can be folded, hidden, its rows made small or tiles, hidden one by one (Show Hidden brings them back) and dragged into the order you like. Songs and albums share Music. [Feeds](#feeds) is at its top.

On a shelf, each row shows the cover small at its side (in the shape the kind's covers come in: a book's or poster's tall, an album's square, a video's wide), the title, what it's by (author and year, director and year, artist and album, channel and length…) and its status. A row without a cover shows its kind's icon.

## Where lines looks

Each source is a plugin, which can be turned off in Settings → Plugins, and others can add theirs ([plugins.md](plugins.md#what-a-plugin-can-add)). They're asked in turn, each site's first and then Web Pages, and the first that recognizes the link and finds what it is fills the note in.

| Source | Links it knows | What it's sent | On the web |
|---|---|---|---|
| YouTube | youtube.com and youtu.be videos, Shorts | the video's link, to YouTube's oEmbed; in the apps, the video's page | Yes: title, channel and picture. When it came out, how long it is and what it's about only in the apps |
| Open Library | openlibrary.org books, and an ISBN in a link (a bookshop's, or Amazon's, whose number for a book is its ISBN-10) | the book's id or ISBN | Yes |
| Wikidata | IMDb, The Movie Database, Letterboxd, Wikipedia and Wikidata links to films, series and books | the id in the link (or the page's title) to Wikidata, and the item's page title to Wikipedia, for its summary and poster | Yes |
| MusicBrainz | musicbrainz.org songs and albums, and Spotify, Apple Music, Bandcamp, Deezer and Tidal links it knows (most albums, fewer songs); covers from the Cover Art Archive | the id in the link, or the link | Yes |
| SoundCloud | soundcloud.com tracks, and someone's sounds when they're a podcast (SoundCloud's feed of them has any) | the link, to SoundCloud's oEmbed; in the apps the track's page, for its length, and the person's feed | Tracks: title, artist, cover, what it's about. Someone's podcast only in the apps: SoundCloud doesn't let web pages read their feed. A set (an album or a playlist, which SoundCloud doesn't say) isn't looked up |
| Apple Podcasts | podcasts.apple.com podcasts, and their latest 200 episodes | the podcast's and episode's ids, to Apple's iTunes Search API; the podcast's feed, for what it's about | Yes; what a podcast is about only where its feed lets web pages read it (few do) |
| Feeds | links that look like a feed's (`….xml`, `….rss`, `/feed`, `/rss`, `feeds.…`), made [subscriptions](#feeds) | the link, to its site | Only feeds whose sites let web pages read them |
| arXiv | arxiv.org papers | the paper's id | No: arXiv's API doesn't answer web pages |
| Web Pages | any page | the link, to its own site | No: sites don't let web pages read them |

Web Pages reads what a page says about itself for search engines and for links shared elsewhere: its JSON-LD (schema.org's Book, Movie, TVSeries, VideoObject, MusicRecording, MusicAlbum, PodcastSeries, PodcastEpisode, Article, BlogPosting, NewsArticle, ScholarlyArticle…), its Open Graph tags (`og:type` of `video.movie`, `music.song`, `book`, `article`…), and an oEmbed it points to. That covers most sites: Letterboxd, Goodreads, Spotify, Bandcamp, Substack, blogs and news. The page is only read, never run or shown. IMDb doesn't answer apps, so its links are looked up through Wikidata.

Only what's needed is sent: the link, or an id read from it. Nothing from your notes. In the apps, lines says it's `lines/<version> (https://github.com/overtio/lines)` to the services it asks, as MusicBrainz and Wikimedia ask apps to; nothing about you. MusicBrainz is asked once a second at most, and arXiv every three seconds, as they ask.

## Feeds

Subscribe to blogs, sites and podcasts, and read their posts in lines.

- **A subscription is a note** with a `feed:` property: a podcast's (`type: podcast`, on the Podcasts shelf too) or a site's (`type: feed`), with its title, artwork, author, `feed` and `link`, made as any library note is. It syncs as notes do. Trashing or deleting the note, or taking out its `feed:`, unsubscribes; restoring it subscribes again, with its posts as they were. Unsubscribe, in a feed's menu, puts every note subscribing to it in the Trash.
- **Subscribe** from the Library heading's + (Subscribe to a Feed), or the + over the Feeds: paste a feed's link, a site's (lines finds the feed its page names, `<link rel="alternate">`, or, for a page that names none, one where sites usually keep theirs: `feed`, `rss`, `rss.xml`, `feed.xml`, `atom.xml`, `index.xml` or `atom` beside the page, then at the site's root, asked one at a time and given up on when the site asks to be left alone; a podcast's site whose own feed has no sound, or that has none, is subscribed to for its podcast, which it links to by its feed or its page on Apple Podcasts, if that feed says this is its site: one the page only mentions isn't taken for it), or a podcast's page on Apple Podcasts (Apple's lookup, the Apple Podcasts plugin's, gives its feed), or, in the apps, someone's on SoundCloud whose sounds are a podcast (SoundCloud's feed of them). A new note that's just a feed's link, or a site's page with a feed, becomes a subscription too, as any link becomes what it is. Settings → Library imports and exports OPML, the file other feed readers and podcast apps use.
- **RSS Feeds, Atom Feeds and Podcast Feeds**, at the top of the Library, each list their feeds' posts, newest first, unread ones marked; under each, its feeds, with their artwork and how many posts are unread, and a quiet mark, saying why when pointed at, if one couldn't be fetched. A podcast's feed is in Podcast Feeds whatever it's written in, and RSS 1.0 is with RSS; a kind with no feeds has no row. Each row is moved, sized, hidden and folded as the Library's other rows are. Settings → Library → Feeds in the sidebar puts them together instead, By Kind or Together: one **Feeds** row of every feed's posts. A feed's format is learned each time it's fetched (at start, and every refresh); until then, one subscribed to before lines knew it is with RSS, or, if its note is a podcast's, with Podcast Feeds. A post opens in the note's place, read-only, drawn as a note: its HTML made into Markdown (paragraphs, headings, links, emphasis, lists, quotes, code, pictures, simple tables), never shown as it came. Nothing in a post is more than text there: its code has no language, so nothing draws or runs it (a diagram, a request), its links go only to the web or to mail, and what would read as a tag, a mention, math or a link to a note stays words. Its title links to it, and the line under it says where it's from, the site it's of when that's another (an aggregator's, as Hacker News' are), by whom, when, and links to its comments where the feed has them (RSS's `<comments>`, Atom's replies page), which go to its discussion below where lines reads it (next); a click on a link in a post opens it. A post that says nothing of its own but those links (Hacker News' say only "Comments") shows what the page it links to says of itself, its description and picture, in the apps while Look Up Links is on and Web Pages reads pages. Opening it marks it read; over it, Mark as Unread and Open in Browser. A feed's menu, and each row's, marks all its posts read.
- **A post's discussion**, where a plugin reads its comments link (Hacker News', [plugins.md](plugins.md#lines-own-plugins)), is under the post, loaded as it opens, the two scrolled as one and on one page (over a backdrop, one card for both; on ruled paper, the comments' text ruled too). How many comments there are, and Open on Hacker News; each comment's header, its author (the poster's in the accent) and how long ago, folds it with its replies, saying how many; replies drawn in under what they answer, four levels deep on a phone and seven where it's wider, and deeper ones saying whom they answer. A comment's text is only text, made from its HTML (paragraphs, quotes, code, lists, emphasis), and its links are opened by lines in the browser. The byline's Comments goes to it. By keyboard it's one stop for Tab, and the arrow keys go from comment to comment ([accessibility.md](accessibility.md)). A big thread is drawn a few dozen comments a frame, each laid out only near the view, so thousands of comments scroll as a few do. Hacker News' come from Algolia's copy of the thread, in one request, with the official API's story for the order of its first comments (replies are oldest first) and how many there are; where it counts more than Algolia gave, the thread ends with how many more there are on Hacker News. Each is sent only the story's id; the official API is waited for two seconds at most. A discussion read is kept while lines runs, so a post opened again shows it at once. Only to read: voting and replying need a Hacker News account, and it has no API for either.
- **Save to Library** (over an open post, or in its menu) keeps a post as a note of its own: an `article`, or an `episode` whose `podcast` mentions its subscription's note.
- Feeds are read as RSS 2.0, Atom and RSS 1.0, with iTunes' podcast tags (artwork, author, duration, season and episode) and Podcasting 2.0's season and episode. A feed that isn't quite XML (a bare `&`, an HTML entity, a stray character, a namespace never declared) is mended, and one cut short is read as far as it goes.
- **Refreshing**, in the main window: when lines starts and then every 30 minutes while it's open (Settings → Library → Refresh feeds: 15 minutes, 30, an hour, 4 hours, or only when asked), and with ⟳ over the list. Each feed is asked whether it changed since last time (its ETag and Last-Modified), a few at a time and never two from one site at once, feeds imported from OPML too. One that fails is asked again later each time it fails in a row (after the refresh interval, then twice that, and so on), and one that says to wait (429, 503) no sooner than it said; either way, a day at most. One that says it's gone for good (410) isn't asked again. ⟳ asks any of them anyway. The apps call themselves `lines/<version> (+https://github.com/overtio/lines)`, and say nothing of who's using them.
- **What's kept**: the newest 200 posts of each feed and which were read, in this device's `lines-feeds` database ([storage.md](storage.md)), each under a random id, and encrypted while the app lock is on. None of it syncs: each device fetches the posts itself, and has its own read and unread.
- **On the web** only feeds whose sites let web pages read them can be (CORS): most blogs' don't, and many podcast hosts' do. The Feeds and the box to subscribe say so. Apple Podcasts' lookup finds a podcast's feed on the web too, but subscribing still needs the feed itself to be readable. Nor can a site's answer be read when it doesn't allow it: a feed that says to wait, or that it's gone, looks like one that couldn't be reached, and is asked again as one that failed.

## The podcast player

- An episode plays in lines: the play button on an episode's row in the Feeds, or over an open one; on an `episode` note, the button before its `audio` link, or Play Episode in its row's menu. The mini player sits at the bottom of the sidebar (or of the note list, where the sidebar's a drawer or hidden): the episode's artwork, title and show, which open it; where it's got to, with the time played and left; back 15 seconds, play or pause, forward 30, and the speed (0.75× to 2×, kept for the next).
- It plays on across notes, tabs and views: there's one player for all of lines, in the main window (a floating note's Play asks it to play there). Playing an episode pauses audio or video playing in a note, and the other way round. The slider's arrow keys go 5 seconds.
- Where each episode was stopped is kept on this device, a feed's episode by its post, a note's by the note, and it starts there next time; an episode's row says how much is left. Locked or quit while it plays, it's back in the player afterwards, paused where it was. Played to the end, or stopped in its last 20 seconds, it's Played (its row's menu marks it played or not; Mark as Played on the one playing puts the player away), and an `episode` note's `status` becomes `listened`: done by lines, not by you, so ⌘Z doesn't undo it. One that couldn't be played plays when Play is pressed again.
- The system's media controls (media keys, the Mac's Now Playing) show what's playing and play, pause and skip it; previous and next go back 15 seconds and forward 30.
- Episodes play from their feeds' addresses, over https (an `http:` one is asked for over https), as the apps' web views allow; nothing is downloaded to listen to offline yet.

## From Readwise

Settings → Library → Readwise brings what [Readwise](https://readwise.io) and its Reader keep into the Library: each book, article, podcast's episode and tweet you highlighted, with the highlights, and what you saved in Reader, read or not. It's [the Readwise plugin](plugins.md#lines-own-plugins)'s, and was made from Readwise's documented API, not tried against a real account yet ([limitations.md](limitations.md#library)).

```markdown
---
type: book
author: Herman Melville
readwise: 1001
---
# Moby-Dick

![Moby-Dick|240](../attachments/3f9c….jpg)

#classics

Read on the train, a chapter a day.

## Highlights

> Call me Ishmael.
> — Location 12 · 2024-03-01 #openings

The best first line there is.
```

- **The token.** Readwise gives you an access token to copy at [readwise.io/access_token](https://readwise.io/access_token). Paste it and Find: it's sent to readwise.io and nowhere else, used for this import, and not kept. The field empties once Readwise has answered, and Settings closing takes it. If Readwise doesn't take it, it says so, and the field has it to correct.
- **Before anything's written** it says what it found: how many books, articles, episodes, videos and papers are new, with how many highlights; which notes there already get highlights they haven't got (by title); and what's left out (Readwise's supplemental books, its suggestions rather than your highlights). Import, or Cancel. With nothing new, it says so.
- **Importing** shows how far it's got, and Stop stops it, keeping what it wrote. Closing Settings doesn't stop it, and opening it again shows where it's got to. Then it says what it did, with **Undo Import**: the notes it made are removed, but those you've changed since; the notes it added highlights to are as they were, but those you've changed since. If something goes wrong partway, it says so, and Undo Import takes back what it wrote.
- **Each thing is a library note** of its kind, made as a link's is (its cover downloaded and kept with it, but Readwise's own picture for something without one), with nothing looked up: Readwise has said what it is. A book is a `book` (its author, and the link Readwise gives, which a Kindle book hasn't got), an article (a newsletter, a post saved from a feed, or a tweet) an `article` (author, site, published), a podcast's highlights an `episode` (its `podcast`), a PDF saved in Reader a `paper` (the file isn't downloaded), a video a `video`. Where Reader says how far you've got, that's its `status`: Archive is read (watched), opened is reading, the rest is to read. A book only in Readwise has no status: Readwise doesn't know. Readwise's id of it is kept as `readwise:`, Reader's as `reader:`. It's dated when it was saved, or first highlighted.
- **Its highlights** are under `## Highlights` (in English in every language, as property keys are), after its tags and what you wrote about it, each a quote with where it is (a page, a Kindle location, a time into an episode) and the day it was made, linked to its own page if it has one (a tweet, a podcast's clip), its tags after; your note on it is under the quote. Tags are written as lines writes tags (`continental philosophy` is `#continental-philosophy`), as a bookmark's are. What came from Readwise is written as just that text, as everything the Library writes is: nothing in a highlight or a note on it is a heading, a list, a table, a link or a tag.
- **Importing again** adds only what's new. Something lines has already isn't made again: it's found by its `readwise:` or `reader:` id, its link, or its kind, title and who it's by (both saying who, and not linking to different pages), so a book you added yourself is found too, and two copies of one book in Readwise (Kindle's and Apple Books') are one note. It gets the highlights it hasn't got, at its end, under `## Highlights` (added if it hasn't got it), and nothing else of it changes, not even its date. A highlight is there if a quote in the note has its words, a long one anywhere in the note, however it's been laid out since.
- **Reader's feeds** come as OPML: in Reader, Export Feeds as OPML on your account's page, then Import OPML under [Feeds](#feeds). What's in Reader's Feed (posts not saved) isn't brought.
- On the web too: Readwise lets web pages ask it. Reader's list is asked no more than 20 times a minute, as Readwise asks; when Readwise says to wait, it waits, and a page that fails or doesn't come is asked again a few times, a while later each time.

## Not yet

See [limitations.md](limitations.md#library) for what's missing, and the README's roadmap for what's planned: a grid of covers, and read and played synced between devices.
