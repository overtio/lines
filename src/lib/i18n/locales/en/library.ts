/** The library: its kinds of things and where each has got to, its rows in the sidebar, and links looked up. */
export default {
  "library.book": "Book",
  "library.books": "Books",
  "library.movie": "Movie",
  "library.movies": "Movies",
  "library.show": "Show",
  "library.shows": "Shows",
  "library.video": "Video",
  "library.videos": "Videos",
  "library.song": "Song",
  "library.album": "Album",
  // Songs and albums, listed together in the sidebar.
  "library.music": "Music",
  "library.podcast": "Podcast",
  "library.podcasts": "Podcasts",
  "library.episode": "Episode",
  "library.episodes": "Episodes",
  "library.article": "Article",
  "library.articles": "Articles",
  "library.paper": "Paper",
  "library.papers": "Papers",
  // Where something is got to, shown in its row and chosen from its menu. The note keeps them in English.
  "library.status.toRead": "To Read",
  "library.status.reading": "Reading",
  "library.status.read": "Read",
  "library.status.toWatch": "To Watch",
  "library.status.watching": "Watching",
  "library.status.watched": "Watched",
  "library.status.toListen": "To Listen",
  "library.status.listening": "Listening",
  "library.status.listened": "Listened",
  // Said to screen readers as one is chosen from an item's menu, and when ⌘Z puts back the one before.
  "library.status": "Status: {status}",
  "library.didUndoStatus": "Status put back",
  // Add to Library: the Library's + in the sidebar, and a link's menu in a note.
  "library.add.title": "Add to Library",
  // What to search for (Books, Movies…), for screen readers.
  "library.add.kind": "What to search for",
  // Shown while nothing's typed. {names} is the catalogs searched: "Open Library", "MusicBrainz".
  "library.add.hint": "Type a title to search {names}, or paste a link.",
  "library.add.hintLink": "Paste a link to look it up.",
  // A new one, of the kind chosen, to fill in by hand.
  "library.add.blank": "Blank",
  // In the Library, while nothing is in it: the + is its heading's button.
  "library.empty": "Press + to add something, or paste a link into a new note",
  // In a note, after a link, while what it is is looked up, when it couldn't be, and when nothing was found (asked from its menu).
  "library.lookingUp": "Looking up…",
  "library.failed": "Couldn’t look this link up",
  "library.nothing": "Nothing found for this link",
  // Said to screen readers once a note that was a link is filled in.
  "library.filled": "Added {title} to the Library",
  // Bookmarks from a browser, each a resource: a note in the Library that's a link so far.
  "library.resource": "Resource",
  "library.resources": "Resources",
  // A resource's menu on its shelf: makes it what its link is (a book, a video…) where a source knows it.
  "library.lookUpDetails": "Look Up Details",
  // Settings → Library → Bookmarks, and Settings → Export and Import when a bookmarks file is chosen.
  "library.bookmarks.title": "Bookmarks",
  "library.bookmarks.note":
    "Bookmarks exported from a browser (Chrome, Edge, Firefox, Safari, Brave, Arc…) or from Pocket, Pinboard or Raindrop become resources in the Library, a note each. Nothing is looked up as they come in; each can be later, from its menu.",
  "library.bookmarks.import": "Import Bookmarks…",
  "library.bookmarks.reading": "Reading…",
  // {name}: the file's name (or the files', listed).
  "library.bookmarks.found": "{count, plural, one {# bookmark} other {# bookmarks}} in {name}",
  "library.bookmarks.there": "{count, plural, one {# is in the Library already, with the same link: left out} other {# are in the Library already, with the same link: left out}}",
  "library.bookmarks.repeated": "{count, plural, one {# repeat in the file: left out} other {# repeats in the file: left out}}",
  "library.bookmarks.other":
    "{count, plural, one {# isn’t a web page (a bookmarklet, a browser’s own page): left out} other {# aren’t web pages (bookmarklets, a browser’s own pages): left out}}",
  "library.bookmarks.folderTags": "Tag with their folders",
  "library.bookmarks.folderTagsNote": "Each gets its folders as a tag, like #dev/rust. Either way they’re kept, as its folder property.",
  "library.bookmarks.start": "{count, plural, one {Import # Resource} other {Import # Resources}}",
  // {done} and {count}: numbers, written the language's way.
  "library.bookmarks.imported":
    "{count, plural, =0 {Nothing new to import} one {Imported # resource} other {Imported # resources}}{there, plural, =0 {} one {; # was already there} other {; # were already there}}",
  "library.bookmarks.undone": "{count, plural, one {Import undone: # resource moved to the Trash} other {Import undone: # resources moved to the Trash}}",
  "library.bookmarks.unreadable": "{name} isn’t a file of bookmarks lines can read.",
  "library.settings.links": "Links",
  "library.settings.lookUp": "Look up links",
  "library.settings.lookUpNote":
    "A new note that’s just a link is filled in with what it is: a book, a movie, a song, an article… with its cover and details, from the site and open catalogs. Only the link is sent, and undoing puts it back.",
  // {names}: the sources a web page can ask, listed ("Open Library, Wikidata and YouTube").
  "library.settings.web":
    "In the browser, only {names} can be asked: other sites don’t let web pages read them. The lines app reads any page.",
  "library.settings.sources": "Each place links are looked up can be turned off in Settings → Plugins.",
};
