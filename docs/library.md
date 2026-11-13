# Library

Books, movies, shows, videos, music, podcasts, articles and papers, kept in lines as notes. Each is an ordinary Markdown note with a `type` (`book`, `movie`…), so it's searched, mentioned, synced and exported like any other, and listed in the sidebar's **Library**, a row for each kind with something in it, its notes with their covers and where you've got to.

## A note that's just a link

Paste a link into a new note, and lines fills the note in with what the link is: its title, cover, details and a few sentences of what it's about.

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

![Dune: Part Two](../attachments/3f9c….jpg)

Dune: Part Two is a 2024 American epic space opera film directed by Denis Villeneuve…
```

- It's looked up when the note **becomes** just a link: at once when it's pasted or dropped in, or once it's stayed that link for a second while you type it, so a link half typed isn't. The link can be bare, in `<…>`, or a Markdown link (`[text](…)`), with nothing else in the note.
- Notes that are already just a link are never looked up as they open or sync. Only Markdown notes are looked up, and never a locked note.
- Meanwhile the note says "Looking up…" after the link, quietly, and screen readers hear it. Offline, or when the site couldn't be reached, it says so for a moment and stays a link.
- Filled in, it's one change: undo (<kbd>⌘Z</kbd>) puts the link back. If you change the note while it's looked up, what was found is dropped; nothing you write is ever written over. If you've moved to another note by then, the note is filled in all the same, and <kbd>⌘Z</kbd> puts it back until you type.
- The note leaves the Inbox: it's filed, on its shelf in the Library.
- A link lines can't say what it is (a page that doesn't say it's a book, a movie, an article…) stays as it is. Nothing is guessed.
- The cover is downloaded and kept with the note as an attachment, at most 1,200 pixels across, so it shows offline and syncs. Where it can't be downloaded (on the web, from a site that doesn't let pages download its pictures), the note has none rather than one shown from the site.
- Settings → Library → Look up links turns it off; then nothing is contacted.

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

Each has `link` (where it's from) and `status` after its own properties, and only the properties a source found. The keys and the `status` values are written in English, like `type`, so tables (`@type.book`), mentions (`@[Dune].author`) and the Library read them alike on every device; lines shows the status in its own language. A note's status is set from its row's menu on its shelf (or by writing it), and it keeps its date, so the list stays as it is. A status of your own (`status: abandoned`) is shown as written.

A new note made while a shelf is shown starts as its kind, at its first status; the + on the Library's heading asks which kind.

## In the sidebar

The Library comes after the places and before Types, which no longer lists its kinds. It's there even while it's empty, to be found, and like any section it can be folded, hidden, its rows made small or tiles, hidden one by one (Show Hidden brings them back) and dragged into the order you like. Songs and albums share Music.

On a shelf, each row shows the cover small at its side (in the shape the kind's covers come in: a book's or poster's tall, an album's square, a video's wide), the title, what it's by (author and year, director and year, artist and album, channel and length…) and its status. A row without a cover shows its kind's icon.

## Where lines looks

Each source is a plugin, which can be turned off in Settings → Plugins, and others can add theirs ([plugins.md](plugins.md#what-a-plugin-can-add)). They're asked in turn, each site's first and then Web Pages, and the first that recognizes the link and finds what it is fills the note in.

| Source | Links it knows | What it's sent | On the web |
|---|---|---|---|
| YouTube | youtube.com and youtu.be videos, Shorts | the video's link, to YouTube's oEmbed; in the apps, the video's page | Yes: title, channel and picture. When it came out, how long it is and what it's about only in the apps |
| Open Library | openlibrary.org books, and an ISBN in a link (a bookshop's, or Amazon's, whose number for a book is its ISBN-10) | the book's id or ISBN | Yes |
| Wikidata | IMDb, The Movie Database, Letterboxd, Wikipedia and Wikidata links to films, series and books | the id in the link (or the page's title) to Wikidata, and the item's page title to Wikipedia, for its summary and poster | Yes |
| MusicBrainz | musicbrainz.org songs and albums, and Spotify, Apple Music, Bandcamp, Deezer and Tidal links it knows (most albums, fewer songs); covers from the Cover Art Archive | the id in the link, or the link | Yes |
| Apple Podcasts | podcasts.apple.com podcasts, and their latest 200 episodes | the podcast's and episode's ids, to Apple's iTunes Search API; the podcast's feed, for what it's about | Yes; what a podcast is about only where its feed lets web pages read it (few do) |
| arXiv | arxiv.org papers | the paper's id | No: arXiv's API doesn't answer web pages |
| Web Pages | any page | the link, to its own site | No: sites don't let web pages read them |

Web Pages reads what a page says about itself for search engines and for links shared elsewhere: its JSON-LD (schema.org's Book, Movie, TVSeries, VideoObject, MusicRecording, MusicAlbum, PodcastSeries, PodcastEpisode, Article, BlogPosting, NewsArticle, ScholarlyArticle…), its Open Graph tags (`og:type` of `video.movie`, `music.song`, `book`, `article`…), and an oEmbed it points to. That covers most sites: Letterboxd, Goodreads, Spotify, Bandcamp, Substack, blogs and news. The page is only read, never run or shown. IMDb doesn't answer apps, so its links are looked up through Wikidata.

Only what's needed is sent: the link, or an id read from it. Nothing from your notes. In the apps, lines says it's `lines/<version> (https://github.com/overtio/lines)` to the services it asks, as MusicBrainz and Wikimedia ask apps to; nothing about you. MusicBrainz is asked once a second at most, and arXiv every three seconds, as they ask.

## Not yet

See [limitations.md](limitations.md#library) for what's missing, and the README's roadmap for what's planned: feeds and podcasts, a grid of covers, searching the catalogs to add something.
