# Linedown

Linedown is the Markdown that lines reads and writes: [CommonMark](https://commonmark.org) with [GitHub's extensions](https://github.github.com/gfm/), plus a few additions of its own. This page describes the additions, and the places where lines reads standard Markdown in a particular way.

Everything here is plain text that other Markdown apps open without trouble. An app that doesn't know an addition shows its characters as they are (`==highlight==`, `#tag`), or, for cards and callouts, as a Pandoc fenced div.

The editor's parser is in `src/lib/editor/syntax.ts` (tags, highlights, underline, cards, math, mentions), on top of `@lezer/markdown` with GFM. What the editor draws for each construct is in `src/lib/editor/`. The QA notes in `qa/notes/` show every construct, alone and combined (see [qa/README.md](../qa/README.md)).

| Construct | Linedown | Standard? |
|---|---|---|
| Headings, emphasis, lists, quotes, code, links, images, rules | As in CommonMark | Yes |
| Tables, ~~strikethrough~~, `- [ ]` task lists, autolinks | As in GFM | GFM |
| Highlight | `==text==` | No (also in Obsidian, Bear, Pandoc's `mark`) |
| Underline | `<u>text</u>` | Yes (inline HTML, as GitHub, Obsidian and Typora show it) |
| Tag | `#tag`, `#nested/tag` | No (as in Bear) |
| Card | `::: card` … `:::` | Pandoc fenced div |
| Callout | `:::!` … `:::`, `:::info icon=flag` … `:::` | Pandoc fenced div |
| Diagram | ` ```mermaid ` code block | GitHub, GitLab, Obsidian |
| 3D model | ` ```openscad ` code block, ` ```stl ` code block | OpenSCAD (its code); GitHub (` ```stl `) |
| Spreadsheet | ` ```csv ` code block | Yes (a code block of CSV) |
| API requests | ` ```http ` code block | JetBrains IDEs, VS Code (REST Client, httpYac), Visual Studio |
| API tests | ` ```hurl ` code block | Hurl |
| Secret | `{{github}}` | No (shown as written; the value is in a locked note) |
| Math | `$x^2$`, `$$` … `$$`, ` ```math ` code block | GitHub, GitLab, Obsidian, Pandoc |
| Attachment | `![](../attachments/<hash>.png)`, `[Name.pdf](../attachments/<hash>.pdf)` | Yes (relative links) |
| Copyable value | `Key: Value` lines | Yes (plain text, read specially) |
| GitHub link | `https://github.com/owner/repo/issues/12` | Yes (an ordinary link, drawn short) |
| Terminal recording | `[![asciicast](https://asciinema.org/a/<id>.svg)](https://asciinema.org/a/<id>)`, `[demo.cast](../attachments/<hash>.cast)` | Yes (asciinema's embed code: a linked image; a link) |
| Properties | `key: value` lines between `---` lines at the top | YAML front matter (Obsidian, Jekyll, Pandoc) |
| Mention | `@Oleks`, `@[Two Words]`, `@Oleks.fullname`, `[[Two Words]]` | Wiki links: Obsidian, Logseq, Foam |
| Type table | `@type.recipe`, `@type.recipe(time, servings)` on a line of its own | No |
| Formula | A table cell starting with `=`: `=SUM(B2:B4)` | No (a formula as text elsewhere) |

## Title

A note has no separate title field: its title is its **first line with text on it**, with the Markdown taken off (`# Trip to Rome` → "Trip to Rome"). Card and callout fences (lines starting with `:::`) are skipped, and so are the note's [properties](#properties); a note with nothing after its properties takes its `title` or `name` property. The note list shows the following lines, without Markdown, as the excerpt.

## Highlight

`==highlighted text==` marks text with the highlighter color.

- Exactly two `=` on each side. `===` doesn't start one.
- Like emphasis: the opening `==` can't be followed by a space and the closing one can't follow a space, so `a == b` stays text.
- It nests with the other inline styles: `==**bold** and highlighted==`.

## Underline

`<u>underlined text</u>` underlines text. It's HTML's underline tag, which Markdown allows inline, so other apps underline it too; ⌘U writes it.

- The tags are lowercase or uppercase, with nothing inside them: `<u>`, not `<u class="x">`, which stays HTML.
- The two tags go around text in one paragraph, list item or table cell, as other styles do. A `<u>` without its `</u>` stays as typed.
- It nests with the other inline styles: `<u>**bold** and underlined</u>`, `**<u>underlined</u> and bold**`.
- In a LaTeX note, ⌘U writes `\underline{…}`.

## Tags

`#tag` anywhere in a note files it under that tag in the sidebar. `#work/meetings` is a nested tag: it shows under `work` there. A tag is drawn with its icon in the sidebar in place of its `#` (a hash, unless one was chosen there), and the `#` shows again with the cursor on the tag. ⌘-click a tag (or ⌥↵ with the cursor on it) to list its notes, as choosing it in the sidebar does.

- A tag starts at the beginning of a line, after a space, or after `(`. It doesn't start in the middle of a word (`C#`), and not as a link's URL (`[x](#anchor)`).
- It runs on while there are letters, digits, `_`, `-` or `/` (any script: `#café`, `#日本`). A trailing `/` isn't part of it.
- A run of only digits isn't a tag (`#1`, `#2024`), so numbered references stay as they are.
- Tags are matched without case: `#Work` and `#work` are the same tag, shown in lowercase in the sidebar.
- Tags inside code (inline or blocks) don't count.
- `# Heading` (with a space) is a heading, not a tag. A line of only `#` (up to six, with nothing after) is text, where a tag is being typed, rather than CommonMark's empty heading: `# ` with its space is the heading.

## Cards

A card groups any Markdown, drawn as a rounded panel:

```markdown
::: card
## Packing list

- Passport
- Charger
:::
```

- The opening fence is three or more colons followed by a name: `::: card`, `:::card`, `:::: section`. The name is free text without colons. lines doesn't use it, except for callouts (below).
- A fence with nothing after it, `:::` (three or more colons), closes the innermost open card. A `:::` line inside a code block is code, and closes nothing.
- Anything goes inside, other cards included. Inner cards nest inside outer ones.
- A card that's never closed runs to the end of the note.
- Leave a blank line before and after a card. lines doesn't need it, but Pandoc does, so other apps read it as a card too. lines adds these blank lines itself when it makes a card.
- Tables, diagrams, images and file attachments are drawn at the top level of a note and inside cards. Inside quotes and list items they stay as plain Markdown.

This is Pandoc's [fenced div](https://pandoc.org/MANUAL.html#divs-and-spans) syntax, so Pandoc and its tools read a card as `<div class="card">`.

## Callouts

A callout is a card for a particular kind of content, tinted in its own color with an icon in a column on its left:

```markdown
:::!
Back up the folder before you move it.
:::
```

| Kind | Long name | Short name | Default icon | Color |
|---|---|---|---|---|
| Info | `:::info` | `:::i` | info | blue |
| Question | `:::question` | `:::?` | question mark | purple |
| Warning | `:::warning` | `:::!` | warning triangle | amber |
| Error | `:::error` | `:::!!!` | ✕ octagon | red |
| Decision | `:::decision` | `:::^` | signpost | teal |

- Names are matched without case, and a space after the colons is allowed (`::: warning`).
- A name that isn't one of these makes a plain card (`:::tip`). So does `:::!!`.
- **Icon:** `icon=<name>` after the kind picks another icon from lines' icon set: `:::! icon=flag`. `icon=none` shows no icon, and the text then starts at the card's edge like a plain card's. An unknown icon name shows the kind's default. Clicking the icon in lines writes this for you, and leaves it out when you pick the kind's own icon.
- Anything else after the name is ignored.
- Callouts close, nest and mix with cards exactly as cards do.

Pandoc reads `::: warning` as a div with class `warning`. The short names (`:::!`) and `icon=` are lines' own. Other apps show them as fences, or as a div with an unusual class.

## Code blocks

Fenced code blocks (` ``` ` or `~~~`) are as in CommonMark. lines reads the info string like this:

- The first word names the language, for syntax highlighting: ` ```sql `, ` ```ts `, ` ```python `. Any language in CodeMirror's language data works, by name or alias.
- A block with no language whose text starts with `{` or `[` is treated as JSON, so it can be tidied.
- ` ```mermaid ` is a diagram, ` ```openscad ` (or ` ```scad `) and ` ```stl ` 3D models, ` ```csv ` a spreadsheet, and ` ```http ` (or ` ```rest `) requests to an API, and ` ```hurl ` requests with checks of their responses (below).

## Spreadsheets

A code block with the language `csv` is drawn as a spreadsheet's grid of cells, by the Spreadsheets [plugin](plugins.md) (with it off, it's a code block). Its text is CSV, row 1 on the block's first line, and a cell starting with `=` is a formula, worked out by the Formulas plugin (IronCalc). Changing a cell writes the block again as CSV. Spaces after commas (`Rent, 1200`) are left out of the cells. The text shows in place of the grid only while the cursor is in it, from the cells' Edit as CSV. Like diagrams, spreadsheets are drawn at the top level and in cards. A name after the language (` ```csv name=costs `, or `name="Q1 costs"`) lets formulas in other blocks and notes use its cells (`=costs!B2`, `='Trip/costs'!B2`). A width after a bar (`|400`), as diagrams take, is kept but not used: a grid is as wide as its columns. Empty rows and columns at the end of its CSV are kept: they're its size. Other apps show the CSV as a code block. More in [spreadsheets.md](spreadsheets.md#spreadsheets-in-markdown-notes).

## Diagrams

A code block with the language `mermaid` is drawn as its [Mermaid](https://mermaid.js.org) diagram, in the theme's colors, by the Diagrams [plugin](plugins.md): [Pele](https://pele.run), or Mermaid itself if it's turned on instead (with both off, it's a code block). With the cursor in it, the code shows with the diagram below. Diagrams are drawn at the top level and in cards; in quotes and lists they stay code. This is the same syntax GitHub, GitLab and Obsidian use.

- A width after a bar, following the language, sets the size a diagram is shown at, in pixels, as an image's does: ` ```mermaid |400 `. The diagram keeps its shape and is never wider than the note. Dragging the handle on its corner writes this width; double-clicking the handle takes it out. Printed notes and PNGs use it too. Other apps read only the first word as the language, so they still draw the diagram, at their own size.

## 3D models

A code block with the language `openscad` (or `scad`) is [OpenSCAD](https://openscad.org) code, drawn as the model it makes, by the 3D Models [plugin](plugins.md) (with it off, it's a code block). It's drawn as diagrams are: at the top level and in cards, and with the cursor in it, the code shows with the model below, made again as you type. What OpenSCAD can't make shows as it says it, with the line (`Parser error: syntax error, line 2`), and its warnings and `echo()`s show below the model. A flat model (`square()`, `circle()`, `polygon()`) is drawn as a drawing. Parts given a color (`color("tomato")`) keep it; the rest are in the theme's colors. Its button downloads the model as an STL file, for 3D printing, or a flat one as SVG. Other apps show the code; OpenSCAD opens it as it is.

A code block with the language `stl` holds an STL model in its text form (`solid … endsolid`), drawn the same way, as GitHub draws them.

A model can be turned around (drag it), moved (drag with the right button, or with ⇧, or with two fingers) and zoomed (pinch, or ⌘ or Ctrl with the scroll wheel; the wheel alone still scrolls the note). Its size along its X, Y and Z axes shows in a corner, in its own units (OpenSCAD's and STL's are usually millimeters). Clicking it, rather than dragging, shows its code, as with a diagram. Printed notes show a picture of each model, from where it's first seen.

## API requests

A code block with the language `http` (or `rest`) holds requests in the `.http` format, highlighted, with Send and Copy as curl in its top right corner, beside Copy, by the API Requests [plugin](plugins.md) (with it off, it's a code block). Requests are separated by `###` lines; `@name = value` lines are variables, used as `{{name}}` in any `http` block of the note. A response shows under its block while the note's open, and isn't written into the note. A code block with the language `hurl` holds [Hurl](https://hurl.dev) entries, each a request and checks of its response, the same way. The formats, variables and sending are in [requests.md](requests.md). Other apps show the block as code; editors that read `.http` files read its text as requests too.

## Secrets

`{{name}}` outside code, a name being a letter or `_` and then letters, digits, `_`, `.` or `-`, is a secret kept in a locked note of type `secrets`, by the Secrets [plugin](plugins.md) (with it off, it's text). It's drawn as a key, the name and dots, with buttons to show it for a moment and to copy it; with the cursor in it, as written. The note keeps only the name, so other apps, exports and copies show `{{name}}`, and printing shows the name and dots. In ` ```http ` blocks, `{{name}}` is a variable or a secret (as above). More in [secrets.md](secrets.md).

## Math

LaTeX math is drawn with [KaTeX](https://katex.org), the way GitHub, GitLab, Obsidian and Pandoc read it:

```markdown
The area of a circle is $\pi r^2$.

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$
```

- **Within text:** `$…$`. The opening `$` can't be followed by a space, and the closing one can't follow a space or be followed by a digit, so prices stay text: `$5 and $10`. `\$` is a dollar sign.
- **Displayed:** `$$…$$` within a paragraph is centered on a line of its own.
- **Blocks:** `$$` on a line of its own opens a block and the next `$$` line closes it. A block that's never closed runs to the end of the note, as a code block does. Typing Enter after an opening `$$` adds the closing one. A ` ```math ` code block is a block too.
- Nothing inside is read as Markdown: `$a_1 * b_2$` is math, not italics.
- With the cursor in it, the LaTeX shows; a block shows its LaTeX with the math below, as diagrams do.
- Inside math, typing `\` opens a menu of math commands (`\frac`, `\sqrt`, `\sum`, Greek letters…) with the symbol each makes. Picking one writes its braces, and Tab moves from one pair to the next, then past it. Outside math a backslash is just a backslash (a Markdown escape).
- LaTeX that KaTeX can't read shows as written, in red, with the reason on hover.
- Math in table cells is drawn too. Blocks are drawn at the top level and in cards; in quotes and lists they stay LaTeX.

KaTeX covers most of LaTeX's math mode (the [list of functions](https://katex.org/docs/supported)), not whole LaTeX documents or packages.

## Attachments

Images and other files added to a note are stored by lines and linked with ordinary relative links into an `attachments` folder next to the notes:

```markdown
![Lake at dawn](../attachments/3f2a9c0d1e8b4a7f6c5d2e1f0a9b8c7d.jpg)

[Budget 2026.csv](../attachments/9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e.csv)
```

- The file name is the first 16 bytes of the file's SHA-256 in lowercase hex (32 characters), a dot, and its extension. The same file added twice is stored once.
- `../attachments/` is relative to the note file, so an export (`notes/` and `attachments/` side by side) and the sync folder both keep working links.
- An image or attachment link **on a line of its own** is drawn as a block: the picture, or a card with the file's name, kind and size. One within a line of text is drawn inline (images) or stays a link (files).
- The link text of a file is the name shown on its card. An image's alt text is its description.
- A CSV or TSV file's card has a button (with the Spreadsheets plugin) that puts its cells in its place as a ` ```csv ` block named after the file: `[Budget 2026.csv](../attachments/….csv)` becomes ` ```csv name="Budget 2026" ` and its rows.
- A width after a bar in the alt text sets the size an image is shown at, in pixels, as in Obsidian: `![Lake at dawn|400](../attachments/….jpg)`. The image keeps its shape (a height, `|400x300`, is read but not used) and is never wider than the note. Dragging the handle on the corner of an image on a line of its own writes this width; double-clicking the handle takes it out. Printed notes and PNGs use it too. Other Markdown apps that don't know it show the image at its own size, with the bar in its description.
- A **3D model** attached on a line of its own (STL, OBJ, PLY, OFF, 3MF, glTF as `.glb`, and the CAD formats STEP and IGES) is drawn above its card as a model to turn around, as ` ```openscad ` blocks are (above): `[Bracket.step](../attachments/….step)`. So is an OpenSCAD file (`.scad`), as the model its code makes, or its drawing if it's flat. Clicking it, rather than dragging, selects its line. STL, 3MF, OFF, STEP and IGES files have Z up, as CAD and 3D printing do; the rest have Y up. A part a CAD file gives no color (or black, which is how many say so) is in the theme's colors. On paper, it's a picture of the model above the file's name.
- An SVG image that holds its [Excalidraw](https://excalidraw.com) scene is a **drawing**: `/drawing` makes one, and excalidraw.com's exports with *Embed scene* are too. It's drawn like any image (clear behind it, and light on dark in dark themes), with a button that opens it in Excalidraw; so do double-clicking it and Enter while it's selected. Save puts the drawing in as a new SVG attachment and changes the link to it, so undo brings back the one before. Other Markdown apps show it as the picture it is.
- Images from the web (`![](https://…)`) show too. Links to anything else are ordinary links.
- An image whose address is a photo's page on [Unsplash](https://unsplash.com) shows that photo: `![Snow-covered mountain peak illuminated by sunset light](https://unsplash.com/photos/snow-covered-mountain-peak-illuminated-by-sunset-light-mevyYnC5xCo)`. Pasting such a link (or the picture's own address) on an empty line adds it this way, described by the words in the link, and so does choosing a photo with `/unsplash`. Other Markdown apps don't know these links and show a broken image.
- `/giphy` adds a GIF from [GIPHY](https://giphy.com) as an image from the web: `![Happy dance](https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif)`, which any Markdown app shows. With reduced motion, lines shows GIPHY's GIFs still.

## Terminal recordings

A recording of a terminal from [asciinema](https://asciinema.org) plays in the note, by the asciinema [plugin](plugins.md): asciinema's embed code on a line of its own is drawn as the recording's player, and an attached `.cast` file shows its player above the card naming it, as a 3D model does. With the plugin off, they're the picture and the file card they're written as.

```markdown
[![asciicast](https://asciinema.org/a/1271559.svg)](https://asciinema.org/a/1271559)

[demo.cast](../attachments/9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e.cast)
```

- **On asciinema.org:** asciinema's own embed code, its preview of the recording linked to the recording's page, as its Share button gives it. Other Markdown apps (GitHub among them) show the preview, which opens the recording. The preview alone, `![asciicast](https://asciinema.org/a/1271559.svg)` (or `.png`), plays too. Pasting the link to a recording on an empty line writes its embed code; undo turns it back into the link. The recording loads from asciinema.org.
- **A .cast file:** an asciicast file (`.cast`, as `asciinema rec` writes) attached to the note, dropped or pasted in or added with `/file`, plays above its card, and without the internet. Double-clicking the card opens the file, as any file's does.
- The page's address can say where to start and how fast, as asciinema.org's do: `https://asciinema.org/a/1271559?t=1:23&speed=2`. Before it plays, a recording shows its middle, as asciinema.org does (or where it starts).
- It's drawn in the theme's colors, with the note's code font, and is never bigger than the note's code: a narrow terminal is drawn narrower than the note. Programs' colors are the theme's (red is its red); 256 colors and true color work too.
- Clicking it plays it, and it's selected, moved and deleted as an image is: ↑ and ↓ stop on it, and Backspace after it selects it. With it selected, Enter plays it. In the player Space pauses, ← and → skip 5 seconds, a number jumps to that tenth of it, F is full screen, and Esc goes back to the note's text with it selected.
- Like images, recordings are drawn at the top level and in cards. Within a line of text, in a list or in a quote, they're the picture or link they're written as. A link to an asciinema.org page is a link: only the embed code plays.
- Printed, a recording from asciinema.org is its preview, linked to it; a `.cast` file is its name.

## GitHub links

A link to GitHub is drawn short, the way GitHub writes references, with GitHub's mark in front. The note keeps the full URL, which shows again while the cursor is on the link.

| URL | Drawn as |
|---|---|
| `https://github.com/overtio` | `@overtio` |
| `https://github.com/overtio/lines` | `overtio/lines` |
| `…/issues/12`, `…/pull/34`, `…/discussions/5` | `overtio/lines#12` |
| `…/commit/6781dd7f00ba`, `…/pull/34/commits/6781dd7f00ba` | `overtio/lines@6781dd7` |
| `…/tree/main`, `…/releases/tag/v1.0`, `…/compare/v1.0...main` | `overtio/lines@main`, `@v1.0`, `@v1.0...main` |
| `…/blob/main/src/app.ts#L10-L20` | `overtio/lines › app.ts:10-20` |
| Anything else in a repository, like `…/actions` | `overtio/lines › actions` |

- This applies to bare URLs, `<https://…>` autolinks, and `[…](…)` links whose text is the URL. A link with text of its own, `[the parser bug](https://github.com/…)`, keeps its text with the mark in front.
- Only `github.com` (and `www.github.com`). GitHub's own pages (`github.com/settings`, `/orgs`, `/marketplace`…), `gist.github.com` and links inside code stay as they are.
- Tables draw them the same way.

This changes nothing about the Markdown; it's only how lines draws the link.

## Key: Value lines

A line that reads like a label and a value gets a copy button for the value:

```markdown
**Wi-Fi password:** correct-horse-battery
Plate: 3WBZ56
```

- The key is up to 40 characters, starting with a letter or digit, optionally in bold, followed by `:` and a space or tab.
- The space after the colon keeps out times (`10:30`) and URLs (`https://…`).
- Only the value is copied, without its Markdown.

This changes nothing about the Markdown; it's only how lines draws the line.

## Properties

A note can start with properties: `key: value` lines between two `---` lines, as YAML front matter is written. A `type` makes the note an object of that type:

```markdown
---
type: person
fullname: Oleksandr Litus
email: oleks@example.com
company: @Overtio
---
# Oleks
```

- The first line of the note has to be `---`, and the properties end at the next `---` (or `...`). Between them each line is `key: value` (or `key:` with its value on the lines after it), a YAML list item (`  - French`), an indented line that carries on the value above, a `#` comment or blank. Anything else, or no closing line, and the `---` is a divider like any other.
- A key starts with a letter, digit or `_` and can have spaces (`Born on: 1815`). Quotes around a value are taken off; a list's items are read as one value, `English, French`. Nested YAML (maps in maps) is read as text.
- They're drawn as a column of keys and their values, with a line under them. The `---` lines show only while the cursor is in the properties. Values can hold Markdown and mentions, and hovering one shows a copy button, as on a `Key: Value` line.
- `type: person` puts the note under **Types → Person** in the sidebar. Types are matched without case, like tags. A type can have an icon (right-click it in the sidebar); notes of that type show it in the list unless they have their own, and so do mentions of them. Right-click → Rename… renames a type everywhere: the `type` of each of its notes and each `@type.…` of it (not in code, and not in locked notes). Notes keep their dates; renamed onto a type there already is, the two become one. Common types start with a fitting one (`person`, `company`, `project`, `meeting`, `book`, `place`…).
- The note's title, excerpt, word count and plain text leave its properties out; search finds them.
- Only Markdown notes have properties. Other apps that read front matter (Obsidian, Jekyll, Pandoc, static site generators) read these the same way.

## Mentions

`@Name` mentions another note: it's drawn as that note's title, with its icon, and ⌘-click opens it, as it does a link. So does ⌥↵ with the cursor on it, and on a link or an attached file. Settings → Editing → Links sets what a click, ⌘-click and ⇧⌘-click do on links, tags and mentions: edit, open, copy a link's address, or open a mentioned note in a new tab, a background tab or a floating window. `@Name.key` is the value of one of its properties.

```markdown
Call @Oleks about the contract; @Oleks.fullname signs for @Overtio.
Ask @[Ada Lovelace] for her @[Ada Lovelace].email.
```

- A mention finds the note by its [title](#title), ignoring case and treating spaces, `_` and `-` alike: `@oleks_litus` and `@[Oleks Litus]` both find "Oleks Litus". A title with spaces or punctuation is written in brackets, `@[Ada Lovelace]`. If two notes share a title, the one with a type wins, then the one edited last. Notes in the trash aren't found.
- Keys are matched ignoring case, spaces, `_` and `-`: `@Ada.born_on` and `@Ada.bornOn` both find `Born on`. A key starts with a letter, so `@Oleks.` at the end of a sentence is a mention and a full stop.
- `[[Ada Lovelace]]`, a wiki link as Obsidian writes them, is a mention too: drawn, opened and created the same way, with any title between the brackets (but `[`, `]`, `|` and `#`). `[[Ada Lovelace|Ada]]` shows "Ada" in place of the title. A heading after a `#` (`[[Ada Lovelace#Life]]`) is read past: it opens the note at its top. A wiki link can't show a property: that's `@[Ada Lovelace].email`. `![[…]]`, an embed, and `\[[…]]` stay text.
- `@type.…` is always a type ([below](#type-tables)), never a note called "type".
- A mention starts at the beginning of a line, after a space or after punctuation; not after a letter, digit, `.`, `/` or `\`. So `oleks@example.com`, `owner/repo@main` and `\@Oleks` stay text, and so do mentions in code.
- A note or property that isn't there stays as written, grey with a dashed underline. Hovering a mention of a note there isn't (or ⌥↵ on it) offers to create it: **Create** adds a note with the mention's name as its title (`@Grace_Hopper` makes "Grace Hopper"), and the property mentioned as an empty one, without leaving the note you're in; the mention turns into a chip. Hovering a property there isn't says why. A locked note can be mentioned, but its properties can't be read.
- Typing `@` and a letter opens a menu of notes (the ones with a type first); Enter or Tab writes the mention, in brackets if it needs them. Typing `[[` opens the same menu at once, and writes a wiki link, over its `]]` if they're there already. A `.` after a mention opens a menu of its properties, with their values. Since that `.` may end a sentence, Enter right after it starts a new line; Tab, a click, a letter or ↓ picks a property.
- The note keeps what you wrote: renaming the note it mentions doesn't change it, so the mention stops finding it.

## Type tables

`@type.recipe` on a line of its own is drawn as a table of every note of the type `recipe`: a row for each, its title first (click it to open the note), then a column for each property.

```markdown
@type.recipe
@type.recipe(time, servings)
```

- Without a list, the columns are every property the type's notes have (but `type`), the most used first. A list in brackets picks them, in that order, by key (matched as mentions match keys).
- The header changes the columns: hover one for **×** to remove it, or click **+** at the end for the type's other properties. Either rewrites the line, which lists the columns from then on.
- Clicking a header sorts the rows by it, then the other way, then back by title. The sort isn't saved.
- **New Recipe** under the table makes a note of the type, with the table's columns as empty properties, and opens it.
- Clicking anywhere else in the table shows its line, with the table under it, as a diagram's code does. With the cursor on the line, `@type.` offers the types there are.
- Within text, `@type.recipe` is a chip for the type, with its icon and how many notes it has; ⌘-click shows them in the list.
- The type is matched as the sidebar matches it, without case, `_` standing for a space: `@type.book_club` is the type `book club`. A table for a type with no notes says so.
- `/type table` writes `@type.` on a line of its own and opens the menu of types.

## Formulas in tables

A table cell starting with `=` is a formula, as in a spreadsheet: drawn, the table shows what it works out to (`src/lib/editor/tables.ts`, worked out by the Formulas plugin, IronCalc). More in [spreadsheets.md](spreadsheets.md#formulas-in-tables).

- Cells are named A1 style, columns from the left and rows from the header, which is row 1: in a table of items and costs, `=SUM(B2:B4)` adds the costs of the first three items.
- The cursor in the table shows the formulas, as the table's Markdown always does.
- `\=` at the start of a cell is a plain `=`.
- Formulas are worked out where tables are drawn: at the top level and in cards. In quotes and lists, a table stays Markdown.
- Another Markdown app shows the formula as written.

## Lists and todos

As in GFM. Some details:

- `- [ ]` and `- [x]` (or `[X]`) are todos. A note with any open todo shows in the Todo view.
- Nested items are indented under their parent's text. Bullets cycle through a dot, a ring and a square as they nest deeper.

## Symbols

lines shows some pairs of characters as the symbol they stand for, without changing the note. The note still holds what was typed, and that's what's copied, exported and synced.

| Typed | Shown | Typed | Shown |
| --- | --- | --- | --- |
| `->` | → | `<=>` | ⇔ |
| `<-` | ← | `<=` | ≤ |
| `<->` | ↔ | `>=` | ≥ |
| `=>` | ⇒ | `!=` | ≠ |

- Code blocks and code spans show them too. In code, each symbol takes the width of the characters it replaces, so columns still line up. Settings → Editing turns them off in text and in code separately.
- A pair inside a longer run of these characters stays as typed: `-->`, `<!--`, `!==`, `>>=`, `==>`. So does a pair after a backslash: `\->`.
- Links' addresses, HTML, math, tags, mentions, Markdown's own marks (a quote's `>`, say) and properties keep their characters.
- With the cursor touching one, the characters show, ready to edit.
- The PDF and the PNG pictures show them as the editor does.

## Files on disk

When lines saves notes to a folder or a bucket, each note is a Markdown file named after its id, with a small front matter block (id, dates, pin, trash, icon, format) ahead of its Linedown; a note's own properties come after it, as part of its text. Locked notes and end-to-end encryption change what's stored. See [sync.md](sync.md). An export (Settings → Data) writes plain Linedown files named after their titles, without front matter.

## Other formats

A note can be written in LaTeX instead ([latex.md](latex.md)), or be a spreadsheet ([spreadsheets.md](spreadsheets.md#spreadsheet-notes)).

## Changing Linedown

When a feature adds or changes syntax, or changes how lines reads existing Markdown, update this page, the QA notes (`scripts/qa-notes.mjs`), and the QA checklist (`qa/checklist.md`), as described in [qa/README.md](../qa/README.md).
