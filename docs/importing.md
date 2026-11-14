# Importing from other apps

Notes from another notes app come into lines from **Settings → Export and Import**, where each app has a group of its own saying what to export from it and how. Each is a [plugin](plugins.md), on to begin with; turned off, its group leaves Settings, and what it brought stays. Markdown, LaTeX, CSV and Excel files of your own are imported with **Import Files…** in the same place, and the Library's bookmarks and Readwise in Settings → Library ([library.md](library.md#bookmarks)).

## How an import goes

1. **Choose** what the app exported: a folder (an Obsidian vault, a Logseq graph, Bear's Markdown), or a file (Bear's backup, a ZIP). Nothing is written yet, and nothing in it is run: its notes are read as text.
2. **What it would do** comes first: how many notes, attachments and folders, and on lines of their own, what won't come across as it was, each kind with how many and a few examples (`^37066d (Plan)`): what's kept as text because lines has nothing like it, and what's left out. Notes imported from it before are left out too, and said so, with which ([below](#importing-again)).
3. **Import** (focused, so Enter imports) copies the pictures and files the notes show into lines' attachments, then makes the notes a few hundred at a time, with a bar showing how far it's got; Stop stops either, keeping what's made (stopped while copying, no note is made, and it says so). Ten thousand notes take a few seconds. Closing Settings doesn't stop it, and opening it again shows how it's going, or how it went.
4. **What it did**, with what didn't come across said again, and **Undo Import**, which moves every note it made to the Trash (but one you've changed since, which is yours now). Nothing an import made is ever deleted outright: empty the Trash for that. Choosing something else to import keeps the last import's Undo, under what the next would do; an import with nothing to bring can't be started, so it never takes that Undo's place.

What carries over, from any app:

- **Titles.** A note's title is its first line ([linedown.md](linedown.md#title)), so a note whose text doesn't start with its title as a heading gets one: `# Plan`.
- **Text**, in [Linedown](linedown.md): what the app writes that lines has too is translated into lines' way of writing it; what lines has nothing for stays as readable text, and is counted.
- **Folders.** lines has tags rather than folders, so with **Tag notes with their folders** on (as it is to begin with), a note in `Projects › 2026` is tagged `#projects/2026`, a tag in a tag in the sidebar. The tag goes on the note's last line, with its other tags.
- **Tags**, nested ones too, as `#tags` in the note's text.
- **Pins, and the trash.** A note pinned or bookmarked there is pinned here; one in the app's trash is in lines' Trash.
- **Dates.** When each note was made and last changed, from what the app keeps (a note's properties, or its file's date).
- **Attachments.** Pictures and files the notes show are kept as lines keeps any ([linedown.md](linedown.md#attachments)), by their content: a file shown by several notes, or imported before, is kept once. A file no note shows is left out, and said so.
- **Links between notes** become wiki links (`[[Plan]]`, `[[Plan#Goals|the goals]]`), which lines draws as mentions. A link to a note that isn't there stays one, which lines offers to create.

### Importing again

Importing the same export again adds only the notes that aren't here yet, and says which are (a few by name): lines keeps, with each note it imports, where it came from (the app, the note's id there and its name there), in the note's own record rather than its text. It's written in the header lines keeps above a synced note's text ([sync.md](sync.md)) as `source: {"app":"obsidian","collection":{"id":"9c2e…","name":"Vault"},"id":"Projects/Plan.md","name":"Plan"}`, so it goes to your other devices too, and isn't in an export. A note you've changed since isn't changed again, nor brought back as a second copy. One in the Trash counts as not here (an import undone, say), unless it was in the other app's trash too. A conflicted copy sync makes of an imported note doesn't say where it came from: only the note does.

Some apps' notes have ids of their own everywhere (Bear's). An Obsidian vault's are only its notes' paths, which another vault can have too, and a vault has no id lines can read. So each vault gets an id of lines' own when it's first imported (`collection` above), and when one is chosen that may be a vault imported before (the same name, or notes with the same paths, as when it's been renamed or moved) lines asks: **The same as "Vault", imported before** is on to begin with, and says how many of its notes have the same paths. On, what's here already is left out; off, it's another vault, and all of it is imported.

### Links, once a note's renamed

A mention finds a note by its title ([linedown.md](linedown.md#mentions)), and renaming a note doesn't change the mentions of it. Links brought from another app still find a note renamed in lines by the name it had there: in a note imported with it (from the same vault), `[[Plan]]` finds the note imported as Plan after it's retitled "Q3 plan", as long as no note is titled Plan; of two once called Plan, the one edited last. In a note of lines' own, `[[Plan]]` finds only a note titled Plan, or offers to create one.

## Obsidian

**What to choose:** a vault is a folder of Markdown files, so there's nothing to export: choose the vault's folder with **Choose Vault Folder…**. To find it, open Obsidian's vault switcher (the vault's name, at the bottom of the left sidebar) → **Manage Vaults**, or right-click a note → **Reveal in Finder** (Show in system explorer on Windows and Linux).

**What comes across:**

| In Obsidian | In lines |
| --- | --- |
| A note, `Projects/Plan.md` | A note titled Plan, tagged `#projects` |
| Properties (front matter) | Properties, as they were, but `tags:`, which become `#tags` in the text. `aliases:` and the rest stay properties; lines reads them the same way |
| `[[Plan]]`, `[[Projects/Plan]]`, `[[Plan#Goals]]`, `[[Plan\|the plan]]` | `[[Plan]]`, `[[Plan#Goals]]`, `[[Plan\|the plan]]`, to the note Obsidian would open: by its path in the vault, from the note's folder, or the shortest path ending in it |
| Markdown links to notes, `[the plan](Projects/Plan.md)` | `[[Plan\|the plan]]` |
| `![[photo.png]]`, `![[photo.png\|300]]`, `![](photo.png)` | `![](../attachments/….png)`, `![\|300](../attachments/….png)`: the picture, kept in lines, at its width |
| `![[Report.pdf]]`, `![[talk.mp3]]`, `[[Report.pdf]]` | `[Report.pdf](../attachments/….pdf)`: a file's card, or a player for audio and video |
| Pictures and files wherever the vault keeps them (its attachment folder setting, a folder of each note's) | Found as Obsidian finds them, by their name |
| `> [!tip] Title` callouts | lines' callouts (`:::info icon=lightbulb`), the title in bold on their first line; note, info, tip, success, example and the like as info, with Obsidian's icon; question; warning; danger, bug and failure as error. Nested ones nest. One of a kind lines doesn't know is a card of its name. Folding ones are open |
| `==highlight==`, `#tag`, `#nested/tag`, `$math$`, ` ```mermaid `, tables, tasks | The same: lines writes them alike |
| `%%comment%%` | `<!--comment-->`, Markdown's own: faint in lines, and not shown by other Markdown apps. One that runs past a code block, or holds what would end an HTML comment (`-->`), is kept as written, and said so |
| `[[Plan\|the plan]]` and `![[photo.png\|300]]` in a table, the bar escaped | The same, the bar still escaped, so the table keeps its columns |
| Bookmarked notes (and starred, in older vaults) | Pinned |
| Daily notes, named as Daily notes' settings say (`2026-11-14`) in their folder, or any note named like a day | `date: 2026-11-14`, so it's on the Calendar on that day |
| Notes in the vault's `.trash` | In the Trash |
| `created:` and `updated:` properties (or `date created`, `modified`…) | When the note was made and changed; otherwise its file's date |

**Code is left as it is**, read as lines reads Markdown: fenced and indented code blocks, in lists and quotes too, inline code, math and HTML. A link, an embed or a `%%` in them stays as written.

**Links never lead into the vault's trash** (`.trash`), as in Obsidian: only its notes are imported, into the Trash; its pictures and files aren't.

**Kept as text, and said so:** block ids (`^37066d`; lines doesn't link to a line), links to a heading in their own note (`[[#Goals]]`), tasks with a status lines doesn't have (`- [/]`, `- [-]`), [Dataview](https://blacksmithgu.github.io/obsidian-dataview/) queries (kept as their code), `cssclasses` (kept as a property, which lines doesn't use), properties lines can't read (a key in quotes, say: kept as a YAML code block at the note's top), and links to files that aren't in the vault (kept as written).

**Made something else, and said so:** a note shown in another (`![[Recipe]]`) is a link to it, as lines doesn't show one note in another.

**Left out, and said so:** files no note shows (a canvas, a picture nothing uses), and Obsidian's settings, workspace and plugins (`.obsidian`).

**Notes with the same name** in different folders are both imported, and said so: Obsidian tells them apart by their paths, but lines finds a note by its title, so a link to that name finds the one with a type, then the one edited last ([linedown.md](linedown.md#mentions)).

**Where it's read:** in a browser (and the apps), with the folder's files read only as text, never run, and nothing sent anywhere. The code is in `src/plugins/obsidian/`: `vault.ts` reads the vault, `markdown.ts` its notes.

## Bear

**What to choose:** in Bear (on the Mac), **File → Backup Notes…** saves a `.bear2bk` file: choose it with **Choose Backup…**. A backup has everything, and keeps which notes are pinned, archived or in Bear's trash, and when each was made and changed. Or export notes with **File → Export Notes…** as **Markdown** or **TextBundle**, with **Export attachments** on, into a folder, and choose that folder with **Choose Export Folder…**: notes exported that way are dated by their files, and have no pins. TextPacks (`.textpack`) and ZIPs of either can be chosen as a backup.

**What comes across:**

| In Bear | In lines |
| --- | --- |
| A note, its first line its title | A note, titled the same |
| `#tag`, `#nested/tag` | The same |
| `#tag of several words#`, `#work/next steps#` | `#tag-of-several-words`, `#work/next-steps`: lines' tags have no spaces (said so) |
| `#tag#` | `#tag` |
| `==highlight==`, `~~strikethrough~~`, tasks, tables, code, `$math$` | The same; a table right under a line of text gets a blank line before it, which Markdown needs |
| `~underline~` | `<u>underline</u>` |
| `[[Note]]`, `[[Note/Heading]]`, `[[Note\|text]]` | `[[Note]]`, `[[Note#Heading]]`, `[[Note\|text]]` |
| A link to a note, `bear://x-callback-url/open-note?id=…` | `[[Note\|text]]`, by Bear's id of the note |
| Pictures and files (`assets/`, or a folder beside an exported note), with a size: `![](photo.png)<!-- {"width":320} -->` | Kept in lines, `![\|320](../attachments/….png)`, the size its width |
| Pinned | Pinned |
| Archived | Tagged `#archived`, as lines has no archive (said so) |
| In Bear's trash | In the Trash |
| When it was made and changed | The same |

**Left out, and said so:** locked notes, which can't be read without Bear (unlock them there, and back up again), and files no note shows.

**Kept as they are, and said so:** links Bear shows as previews (`<!-- {"preview":"true"} -->`) are links, and links to pictures or files that aren't in the backup are kept as written.

Bear's older markup (Bear 1's "Polar Bear" `::highlight::`, `*bold*`, `/italic/`) isn't translated: Bear 2 writes Markdown. The code is in `src/plugins/bear/`: `backup.ts` reads the backup or export, `markdown.ts` its notes.

## Logseq

**What to choose:** a graph is a folder of Markdown files, so there's nothing to export: choose the graph's folder (the one with `pages`, `journals` and `assets` in it) with **Choose Graph Folder…**. Logseq shows where it is in its left sidebar's graph menu → **All graphs**.

**What comes across:**

| In Logseq | In lines |
| --- | --- |
| A page, `pages/Plan.md` | A note titled Plan (or as its `title::` says) |
| A namespace's page, `Projects/Acme` (`Projects___Acme.md`, or `Projects%2FAcme.md` as older versions wrote it) | A note titled `Projects/Acme`, as links name it, tagged `#projects` |
| A day's journal, `journals/2026_11_14.md` | A note titled as Logseq titles it ("Nov 14th, 2026", or as `:journal/page-title-format` says), with `date: 2026-11-14`, so it's on the Calendar, tagged `#journals` |
| Page properties, `type:: book` | Properties, `type: book`; `tags::` become `#tags` in the text, `title::` is the title |
| The outline | A list, nested as it was: an outline stays one. A page that's clearly prose (below) is paragraphs |
| `- # Heading` blocks | Headings, what's under them after them |
| `TODO`, `LATER`; `DONE` | `- [ ]`; `- [x]` |
| `DOING`, `NOW`, `WAITING` | `- [ ] DOING …`: open, the state kept as a word (said so) |
| `CANCELED` | `- [x] ~~…~~` (said so) |
| `[[Page]]`, `[text]([[Page]])`, `#[[two words]]` | `[[Page]]`, `[[Page\|text]]`, `#two-words` (said so) |
| `((block reference))`, `{{embed ((…))}}` | The block's text, and a link to its page if it's another's (said so): lines doesn't link to a block |
| `{{embed [[Page]]}}` | `[[Page]]` (said so) |
| `{{video …}}`, `{{youtube …}}`, `{{tweet …}}` | The link |
| `^^highlight^^` | `==highlight==` |
| `![photo](../assets/photo.png){:width 320}` | Kept in lines, at its width |
| Favorites (`:favorites` in config.edn) | Pinned |

**Prose or a list:** Logseq writes every line as a block, so a page of paragraphs reads as a list of them. A run of blocks at a page's top (between headings) becomes paragraphs only when it's clearly prose: each block a sentence or more (40 characters or longer, ending as a sentence does), with nothing under it, no task, no properties lines would keep; or a page of one such block alone. Anything else, a block with blocks under it, a short item, a task, stays the list it was, so nothing that was an outline is flattened.

**Kept as text, and said so:** a block's own properties (`owner:: Ada`, as lines' properties are a note's; but its `id::`, which references used, and `collapsed::`, which is Logseq's), task priorities (`[#A]`), `SCHEDULED:` and `DEADLINE:` dates, and queries and other macros (`{{query …}}`).

**Left out, and said so:** empty pages (Logseq makes some itself, as Contents, and a journal for each day opened), pages written in Org mode, and files no page shows (an unused asset, a drawing, a whiteboard). Logseq's own folder (`logseq/`: its settings, backups and versions) isn't read but for config.edn.

The code is in `src/plugins/logseq/`: `graph.ts` reads the graph, `outline.ts` its pages' outlines, `dates.ts` its journals' names.

