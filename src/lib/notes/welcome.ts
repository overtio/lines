export const WELCOME_NOTE = `# Welcome to lines

lines is a calm place for your thoughts. Write in **Markdown** and watch it turn into formatted text as you go. Move your cursor onto any line to see its Markdown again.

:::i
Type \`/\` at the start of a line for headings, lists, tables, callouts, code, images and more.
:::

## The basics

- Make text **bold**, *italic*, <u>underlined</u>, ~~struck through~~, ==highlighted==, or \`code\`, or select it for a toolbar
- Start a line with \`#\`, \`##\` or \`###\` for headings
- Use \`-\` for lists and \`- [ ]\` for todos
  - Tab nests an item, Shift-Tab moves it back out
- Add a [link](https://example.com) and ⌘-click to open it. GitHub and arXiv links read short: https://github.com/overtio/lines, https://arxiv.org/abs/1706.03762
- Hover a line for the grip on its left, and drag it to move the line
- Type \`-\` and then \`>\` for an arrow: Home -> cabin. \`!\` and \`=\` make ≠

## Todos

- [x] Open lines
- [ ] Write your first note
- [ ] Organize it with a tag

> Quotes look like this. Good for things worth remembering.

## Tags

Add a tag anywhere in a note, like #getting-started. Nested tags work too: #lines/tips. Tags show up in the sidebar.

## People, projects and other objects

Start a note with \`/properties\` to give it a type, like \`type: person\`, and other properties. It shows under Types in the sidebar. Mention any note with \`@\` and its title (or \`[[\` for a wiki link), and show its properties with \`@Name.key\`. \`@type.person\` on a line of its own is a table of every person.

## Callouts and cards

:::?
Which kind fits? \`:::i\` for info, \`:::?\` for a question, \`:::!\` for a warning, \`:::!!!\` for an error and \`:::^\` for a decision. End it with \`:::\`.
:::

:::^ icon=sparkles
Click a callout's icon to choose another one, or none.
:::

::: card
A card groups anything: text, lists, tables, even other cards.
:::

## Tables

| Shortcut | What it does |
| -------- | ------------ |
| ⌘B | Bold |
| ⌘I | Italic |
| ⌘↵ | Todo |

A cell like \`=SUM(B2:B4)\` shows what it works out to. For a spreadsheet in a note, type \`/spreadsheet\`; for a whole one, switch a note to Spreadsheet in its ⓘ panel.

## Code, diagrams and math

\`\`\`sql
select title from notes where pinned;
\`\`\`

\`\`\`mermaid
flowchart LR
  Idea --> Note --> Done
\`\`\`

For electronics, a \`wavedrom\` block draws signals over time: type \`/timing\`.

Math is LaTeX between dollar signs: $e^{i\\pi} + 1 = 0$. To write a whole note in LaTeX, switch it in the ⓘ panel.

An \`openscad\` code block is a 3D model, made from its code as you type, to turn around and print: type \`/model\`.

An \`http\` code block holds requests to an API, with a Send button in its corner: type \`/request\`.

Press ⌘P to see a note on pages, ready to print or save as a PDF.

Hover the value in a "Key: Value" line to copy it:

**Wi-Fi password:** correct-horse-battery

## Images and files

Paste or drop an image or any other file into a note, or type \`/image\` or \`/file\`. Audio and video play right in the note. Type \`/unsplash\` for a photo from Unsplash, or \`/giphy\` for a GIF. Type \`/drawing\` to sketch in Excalidraw; double-click a drawing to change it. Paste the link to a terminal recording on asciinema.org, or drop in a \`.cast\` file, and it plays in the note.

## Private by design

Your notes are stored on this device. Sync them through your own cloud drive or S3 bucket, encrypted end to end if you like, from Settings. Lock a note with a password from its toolbar, or lock all of lines from Settings → Privacy.

---

Happy writing.
`;
