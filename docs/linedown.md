# Linedown

Linedown is the Markdown that lines reads and writes: [CommonMark](https://commonmark.org) with [GitHub's extensions](https://github.github.com/gfm/), plus a few additions of its own. This page describes the additions, and the places where lines reads standard Markdown in a particular way.

Everything here is plain text that other Markdown apps open without trouble. An app that doesn't know an addition shows its characters as they are (`==highlight==`, `#tag`), or, for cards and callouts, as a Pandoc fenced div.

The editor's parser is in `src/lib/editor/syntax.ts` (tags, highlights, cards, math, mentions), on top of `@lezer/markdown` with GFM. What the editor draws for each construct is in `src/lib/editor/`. The QA notes in `qa/notes/` show every construct, alone and combined (see [qa/README.md](../qa/README.md)).

| Construct | Linedown | Standard? |
|---|---|---|
| Headings, emphasis, lists, quotes, code, links, images, rules | As in CommonMark | Yes |
| Tables, ~~strikethrough~~, `- [ ]` task lists, autolinks | As in GFM | GFM |
| Highlight | `==text==` | No (also in Obsidian, Bear, Pandoc's `mark`) |
| Tag | `#tag`, `#nested/tag` | No (as in Bear) |
| Card | `::: card` … `:::` | Pandoc fenced div |
| Callout | `:::!` … `:::`, `:::info icon=flag` … `:::` | Pandoc fenced div |
| Diagram | ` ```mermaid ` code block | GitHub, GitLab, Obsidian |
| Math | `$x^2$`, `$$` … `$$`, ` ```math ` code block | GitHub, GitLab, Obsidian, Pandoc |
| Attachment | `![](../attachments/<hash>.png)`, `[Name.pdf](../attachments/<hash>.pdf)` | Yes (relative links) |
| Copyable value | `Key: Value` lines | Yes (plain text, read specially) |
| GitHub link | `https://github.com/owner/repo/issues/12` | Yes (an ordinary link, drawn short) |
| Properties | `key: value` lines between `---` lines at the top | YAML front matter (Obsidian, Jekyll, Pandoc) |
| Mention | `@Oleks`, `@[Two Words]`, `@Oleks.fullname`, `[[Two Words]]` | Wiki links: Obsidian, Logseq, Foam |
| Type table | `@type.recipe`, `@type.recipe(time, servings)` on a line of its own | No |

## Title

A note has no separate title field: its title is its **first line with text on it**, with the Markdown taken off (`# Trip to Rome` → "Trip to Rome"). Card and callout fences (lines starting with `:::`) are skipped, and so are the note's [properties](#properties); a note with nothing after its properties takes its `title` or `name` property. The note list shows the following lines, without Markdown, as the excerpt.

## Highlight

`==highlighted text==` marks text with the highlighter color.

- Exactly two `=` on each side. `===` doesn't start one.
- Like emphasis: the opening `==` can't be followed by a space and the closing one can't follow a space, so `a == b` stays text.
- It nests with the other inline styles: `==**bold** and highlighted==`.

## Tags

`#tag` anywhere in a note files it under that tag in the sidebar. `#work/meetings` is a nested tag: it shows under `work` there. A tag is drawn with a hash icon in place of its `#`, which shows again with the cursor on the tag.

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
- ` ```mermaid ` is a diagram (below).

## Diagrams

A code block with the language `mermaid` is drawn as its [Mermaid](https://mermaid.js.org) diagram, in the theme's colors. With the cursor in it, the code shows with the diagram below. Diagrams are drawn at the top level and in cards; in quotes and lists they stay code. This is the same syntax GitHub, GitLab and Obsidian use.

- A width after a bar, following the language, sets the size a diagram is shown at, in pixels, as an image's does: ` ```mermaid |400 `. The diagram keeps its shape and is never wider than the note. Dragging the handle on its corner writes this width; double-clicking the handle takes it out. Printed notes and PNGs use it too. Other apps read only the first word as the language, so they still draw the diagram, at their own size.

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
- A width after a bar in the alt text sets the size an image is shown at, in pixels, as in Obsidian: `![Lake at dawn|400](../attachments/….jpg)`. The image keeps its shape (a height, `|400x300`, is read but not used) and is never wider than the note. Dragging the handle on the corner of an image on a line of its own writes this width; double-clicking the handle takes it out. Printed notes and PNGs use it too. Other Markdown apps that don't know it show the image at its own size, with the bar in its description.
- An SVG image that holds its [Excalidraw](https://excalidraw.com) scene is a **drawing**: `/drawing` makes one, and excalidraw.com's exports with *Embed scene* are too. It's drawn like any image (clear behind it, and light on dark in dark themes), with a button that opens it in Excalidraw; so do double-clicking it and Enter while it's selected. Save puts the drawing in as a new SVG attachment and changes the link to it, so undo brings back the one before. Other Markdown apps show it as the picture it is.
- Images from the web (`![](https://…)`) show too. Links to anything else are ordinary links.
- An image whose address is a photo's page on [Unsplash](https://unsplash.com) shows that photo: `![Snow-covered mountain peak illuminated by sunset light](https://unsplash.com/photos/snow-covered-mountain-peak-illuminated-by-sunset-light-mevyYnC5xCo)`. Pasting such a link (or the picture's own address) on an empty line adds it this way, described by the words in the link. Other Markdown apps don't know these links and show a broken image.

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

`@Name` mentions another note: it's drawn as that note's title, with its icon, and ⌘-click opens it, as it does a link. So does ⌥↵ with the cursor on it, and on a link or an attached file. `@Name.key` is the value of one of its properties.

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

- Code blocks and code spans show them too. In code, each symbol takes the width of the characters it replaces, so columns still line up. Settings → Text turns them off in text and in code separately.
- A pair inside a longer run of these characters stays as typed: `-->`, `<!--`, `!==`, `>>=`, `==>`. So does a pair after a backslash: `\->`.
- Links' addresses, HTML, math, tags, mentions, Markdown's own marks (a quote's `>`, say) and properties keep their characters.
- With the cursor touching one, the characters show, ready to edit.
- The PDF and the PNG pictures show them as the editor does.

## Files on disk

When lines saves notes to a folder or a bucket, each note is a Markdown file named after its id, with a small front matter block (id, dates, pin, trash, icon, format) ahead of its Linedown; a note's own properties come after it, as part of its text. Locked notes and end-to-end encryption change what's stored. See [sync.md](sync.md). An export (Settings → Sync & Data) writes plain Linedown files named after their titles, without front matter.

## LaTeX notes

A note can be written in LaTeX instead: see [latex.md](latex.md).

## Changing Linedown

When a feature adds or changes syntax, or changes how lines reads existing Markdown, update this page, the QA notes (`scripts/qa-notes.mjs`), and the QA checklist (`qa/checklist.md`), as described in [qa/README.md](../qa/README.md).
