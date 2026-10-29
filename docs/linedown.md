# Linedown

Linedown is the Markdown that lines reads and writes: [CommonMark](https://commonmark.org) with [GitHub's extensions](https://github.github.com/gfm/), plus a few additions of its own. This page describes the additions, and the places where lines reads standard Markdown in a particular way.

Everything here is plain text that other Markdown apps open without trouble. An app that doesn't know an addition shows its characters as they are (`==highlight==`, `#tag`), or, for cards and callouts, as a Pandoc fenced div.

The editor's parser is in `src/lib/editor/syntax.ts` (tags, highlights, cards), on top of `@lezer/markdown` with GFM. What the editor draws for each construct is in `src/lib/editor/`. The QA notes in `qa/notes/` show every construct, alone and combined (see [qa/README.md](../qa/README.md)).

| Construct | Linedown | Standard? |
|---|---|---|
| Headings, emphasis, lists, quotes, code, links, images, rules | As in CommonMark | Yes |
| Tables, ~~strikethrough~~, `- [ ]` task lists, autolinks | As in GFM | GFM |
| Highlight | `==text==` | No (also in Obsidian, Bear, Pandoc's `mark`) |
| Tag | `#tag`, `#nested/tag` | No (as in Bear) |
| Card | `::: card` … `:::` | Pandoc fenced div |
| Callout | `:::!` … `:::`, `:::info icon=flag` … `:::` | Pandoc fenced div |
| Diagram | ` ```mermaid ` code block | GitHub, GitLab, Obsidian |
| Attachment | `![](../attachments/<hash>.png)`, `[Name.pdf](../attachments/<hash>.pdf)` | Yes (relative links) |
| Copyable value | `Key: Value` lines | Yes (plain text, read specially) |

## Title

A note has no separate title field: its title is its **first line with text on it**, with the Markdown taken off (`# Trip to Rome` → "Trip to Rome"). Card and callout fences (lines starting with `:::`) are skipped. The note list shows the following lines, without Markdown, as the excerpt.

## Highlight

`==highlighted text==` marks text with the highlighter color.

- Exactly two `=` on each side. `===` doesn't start one.
- Like emphasis: the opening `==` can't be followed by a space and the closing one can't follow a space, so `a == b` stays text.
- It nests with the other inline styles: `==**bold** and highlighted==`.

## Tags

`#tag` anywhere in a note files it under that tag in the sidebar. `#work/meetings` is a nested tag: it shows under `work` there.

- A tag starts at the beginning of a line, after a space, or after `(`. It doesn't start in the middle of a word (`C#`), and not as a link's URL (`[x](#anchor)`).
- It runs on while there are letters, digits, `_`, `-` or `/` (any script: `#café`, `#日本`). A trailing `/` isn't part of it.
- A run of only digits isn't a tag (`#1`, `#2024`), so numbered references stay as they are.
- Tags are matched without case: `#Work` and `#work` are the same tag, shown in lowercase in the sidebar.
- Tags inside code (inline or blocks) don't count.
- `# Heading` (with a space) is a heading, not a tag.

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
- Images from the web (`![](https://…)`) show too. Links to anything else are ordinary links.

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

## Lists and todos

As in GFM. Some details:

- `- [ ]` and `- [x]` (or `[X]`) are todos. A note with any open todo shows in the Todo view.
- Nested items are indented under their parent's text. Bullets cycle through a dot, a ring and a square as they nest deeper.

## Files on disk

When lines saves notes to a folder or a bucket, each note is a Markdown file named after its id, with a small front matter block (id, dates, pin, trash, icon) ahead of its Linedown. Locked notes and end-to-end encryption change what's stored. See [sync.md](sync.md). An export (Settings → Data) writes plain Linedown files named after their titles, without front matter.

## Changing Linedown

When a feature adds or changes syntax, or changes how lines reads existing Markdown, update this page, the QA notes (`scripts/qa-notes.mjs`), and the QA checklist (`qa/checklist.md`), as described in [qa/README.md](../qa/README.md).
