export const WELCOME_NOTE = `# Welcome to lines

lines is a calm place for your thoughts. Write in **Markdown** and watch it turn into formatted text as you go. Move your cursor onto any line to see its Markdown again.

:::i
Type \`/\` at the start of a line for headings, lists, tables, callouts, code, images and more.
:::

## The basics

- Make text **bold**, *italic*, ~~struck through~~, ==highlighted==, or \`code\`, or select it for a toolbar
- Start a line with \`#\`, \`##\` or \`###\` for headings
- Use \`-\` for lists and \`- [ ]\` for todos
  - Tab nests an item, Shift-Tab moves it back out
- Add a [link](https://github.com) and ⌘-click to open it
- Hover a line for the grip on its left, and drag it to move the line

## Todos

- [x] Open lines
- [ ] Write your first note
- [ ] Organize it with a tag

> Quotes look like this. Good for things worth remembering.

## Tags

Add a tag anywhere in a note, like #getting-started. Nested tags work too: #lines/tips. Tags show up in the sidebar.

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

## Code and diagrams

\`\`\`sql
select title from notes where pinned;
\`\`\`

\`\`\`mermaid
flowchart LR
  Idea --> Note --> Done
\`\`\`

Hover the value in a "Key: Value" line to copy it:

**Wi-Fi password:** correct-horse-battery

## Images and files

Paste or drop an image or any other file into a note, or type \`/image\` or \`/file\`.

## Private by design

Your notes are stored on this device. Sync them through your own cloud drive or S3 bucket, encrypted end to end if you like, from Settings. Lock a note with a password from its toolbar, or lock all of lines from Settings → Privacy.

---

Happy writing.
`;
