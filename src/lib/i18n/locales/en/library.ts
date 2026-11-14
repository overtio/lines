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
  // Ratings (Settings → Library → Ratings): a note's are properties, `rating: 4/5`, on its kind's scale.
  // An item's menu on its shelf (Rate ▸), and the rating every kind has beside any it names.
  "library.rating.rate": "Rate",
  "library.rating.overall": "Overall",
  "library.rating.clear": "Remove Rating",
  // Said to screen readers once one's set from a menu or a click on its marks ({score}: "4 out of 5", "A"), taken out, or put back with ⌘Z.
  "library.rating.rated": "Rated {score}",
  "library.rating.cleared": "Rating removed",
  "library.rating.didUndo": "Rating put back",
  // lines' own scales, by name; the thumbs' words as they show (the note keeps "thumbs up" in English).
  "library.rating.scale.5": "Out of 5",
  "library.rating.scale.10": "Out of 10",
  "library.rating.scale.100": "Out of 100",
  "library.rating.scale.thumbs": "Thumbs Up or Down",
  "library.rating.scale.grades": "Grades, S to F",
  "library.rating.thumbsUp": "Thumbs Up",
  "library.rating.thumbsDown": "Thumbs Down",
  // Settings → Library → Ratings: each kind's scale, and the ratings it names (Story, Music…).
  "library.rating.title": "Ratings",
  "library.rating.note": "A rating is a property of a note, like rating: 4/5. Set it from an item’s menu (Rate), with a click on its marks, or by writing it. A note whose rating doesn’t fit its kind’s scale keeps it as written.",
  "library.rating.scaleOf": "{kind} scale",
  "library.rating.alsoFor": "Also rated for {names}.",
  "library.rating.unfit": "{count, plural, one {# note’s rating doesn’t fit this scale, and shows as written.} other {# notes’ ratings don’t fit this scale, and show as written.}}",
  "library.rating.editNamed": "{kind} ratings",
  "library.rating.namedOf": "{kind} ratings besides the overall one",
  "library.rating.nameOf": "Rating {place}",
  "library.rating.moveUp": "Move {name} up",
  "library.rating.moveDown": "Move {name} down",
  "library.rating.remove": "Remove {name}",
  "library.rating.newName": "New rating",
  "library.rating.namePlaceholder": "Name another, like Story",
  "library.rating.add": "Add",
  "library.rating.namedNote": "Each is a property of its notes too, like story: 4/5, on the same scale. Renaming one renames it in them; removing one leaves them as they are.",
  "library.rating.nameInvalid": "A rating’s name is letters, numbers, spaces, _ and -, up to 40 of them.",
  "library.rating.nameTaken": "“{name}” is a property these notes have already.",
  "library.rating.added": "Added {name}",
  "library.rating.renamed": "Renamed {from} to {to}",
  "library.rating.moved": "{name}, {place} of {count}",
  "library.rating.removed": "Removed {name}",
  // Your own scales: marks in an icon, points, or words, the best first.
  "library.rating.scales": "Scales",
  "library.rating.scalesNote": "Besides lines’ own, scales of your own: marks out of up to 10, points, or words from the best to the worst.",
  "library.rating.newScale": "New Scale",
  "library.rating.noScales": "None yet.",
  "library.rating.editScale": "Change {name}",
  "library.rating.removeScale": "Remove {name}",
  "library.rating.scaleInUse": "{kinds} rated on it: choose another scale for them first",
  "library.rating.scaleRemoved": "Removed {name}",
  "library.rating.scaleSaved": "Saved {name}",
  "library.rating.describeMarks": "Marks out of {of}",
  "library.rating.describePoints": "Points out of {of}",
  "library.rating.describeWords": "Words: {words}",
  "library.rating.scaleName": "Scale’s name",
  "library.rating.scaleNamePlaceholder": "Name it, like Vibes",
  "library.rating.scaleNameEmpty": "Give the scale a name.",
  "library.rating.scaleKind": "What it’s in",
  "library.rating.marks": "Marks",
  "library.rating.points": "Points",
  "library.rating.words": "Words",
  "library.rating.outOf": "Out of",
  "library.rating.outOfInvalid": "Out of a whole number from 2 to {most}.",
  "library.rating.markIcon": "Marks drawn as",
  "library.rating.icon.star": "Stars",
  "library.rating.icon.heart": "Hearts",
  "library.rating.icon.circle": "Circles",
  "library.rating.icon.flame": "Flames",
  "library.rating.icon.sparkles": "Sparkles",
  "library.rating.icon.trophy": "Trophies",
  "library.rating.icon.thumbs-up": "Thumbs",
  "library.rating.icon.smile": "Smiles",
  "library.rating.wordsPlaceholder": "Masterpiece, Great, Fine, Meh",
  "library.rating.wordsNote": "The best first, with commas between.",
  "library.rating.wordsInvalid": "From 2 to {most} words, each different, up to 40 letters long.",
  "library.rating.saveScale": "Save",
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
  // Said, faintly at the end of its note and to screen readers, when what's added is in the Library already.
  "library.already": "Already in your Library",
  // Its button, opening the note the Library has.
  "library.openIt": "Open",
  // Its name to screen readers.
  "library.openItLabel": "Open it in your Library",
  // Its button moving what was typed into a note made for something the Library has into that one's note, and its name to screen readers.
  "library.merge": "Merge",
  "library.mergeLabel": "Move what you wrote to the note in your Library",
  // Said to screen readers once it's merged.
  "library.merged": "What you wrote is now in {title}",
  // Said to screen readers once a note that was a link is filled in.
  "library.filled": "Added {title} to the Library",
  // Bookmarks from a browser, each a resource: a note in the Library that's a link so far.
  "library.resource": "Resource",
  "library.resources": "Resources",
  // A resource's menu on its shelf: makes it what its link is (a book, a video…) where a source knows it.
  "library.lookUpDetails": "Look Up Details",
  // Settings → Library → Bookmarks, and Settings → Export and Import when a bookmarks file is chosen.
  // Any import into the Library (ImportStep.svelte): how it's going, stopping it, and taking it back.
  "library.import.progress": "Importing… {done} of {count}",
  "library.import.stop": "Stop",
  "library.import.stopped": "Stopped: what was imported before is kept, and Undo takes it back.",
  "library.import.failed": "Something went wrong partway, and it stopped. What was imported before is kept, and Undo takes it back.",
  "library.import.undo": "Undo Import",
  "library.import.kept": "{count, plural, one {# you’ve changed since is kept.} other {# you’ve changed since are kept.}}",
  "library.import.unavailable": "This couldn’t be loaded. Try again after restarting lines.",
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
  "library.bookmarks.undone": "{count, plural, one {Import undone: # resource removed} other {Import undone: # resources removed}}",
  "library.bookmarks.unreadable": "{name} isn’t a file of bookmarks lines can read.",
  "library.settings.links": "Links",
  "library.settings.countAgain": "Count adding again",
  "library.settings.countAgainNote":
    "Adding something the Library has already opens its note. This also counts it there, as times added, so you can tell what keeps coming up.",
  "library.settings.lookUp": "Look up links",
  "library.settings.lookUpNote":
    "A new note that’s just a link is filled in with what it is: a book, a movie, a song, an article… with its cover and details, from the site and open catalogs. Only the link is sent, and undoing puts it back.",
  // {names}: the sources a web page can ask, listed ("Open Library, Wikidata and YouTube").
  "library.settings.web":
    "In the browser, only {names} can be asked: other sites don’t let web pages read them. The lines app reads any page.",
  "library.settings.sources": "Each place links are looked up can be turned off in Settings → Plugins.",
};
