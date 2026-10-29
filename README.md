# lines

Beautiful, simple, local-first notes. Write in Markdown and see formatted text as you type.

lines is inspired by [Bear](https://bear.app): a calm, focused writing space with tags instead of folders. It runs on the web, macOS, Windows, Linux, iOS and Android from one codebase.

## Features

- **Live Markdown.** Type `**bold**`, `# Heading` or `- [ ] todo` and see it formatted. Move the cursor onto a line to see its Markdown again.
- **Your notes are plain Markdown.** The text you type is exactly what's stored. Nothing is converted into a proprietary format. The few additions lines makes to Markdown (callouts, highlights, tags…) are described in [docs/linedown.md](docs/linedown.md), "Linedown".
- **Note icons.** Right-click a note (or long-press it) → Add Icon… to show an icon before its title in the list. Icons sync with the note.
- **Tags, not folders.** Add `#tag` or `#nested/tag` anywhere in a note and it shows up in the sidebar. Right-click a tag (or long-press it) to rename it everywhere or give it an icon.
- **Tables.** GFM tables show as real tables. Click a cell to edit its Markdown, which stays neatly aligned: <kbd>Tab</kbd> moves between cells, <kbd>↵</kbd> adds a row, and <kbd>↵</kbd> on an empty last row leaves the table. Hover a cell for a button that copies its text. Paste rows copied from a spreadsheet, pgAdmin or a web page to get a table (undo once for the text as copied).
- **Cards.** Group a section into a card: type `/card`, or put Markdown between `::: card` and `:::` (Pandoc's fenced divs, so other apps keep it). Anything goes inside: headings, lists, code, tables, even other cards. <kbd>↵</kbd> on a second empty line at the end of a card leaves it.
- **Callouts.** Cards tinted by kind, with an icon on the left: `:::info` (or `:::i`), `:::question` (`:::?`), `:::warning` (`:::!`), `:::error` (`:::!!!`) and `:::decision` (`:::^`), closed with `:::`. Click the icon to pick any other, or none; it's written on the fence (`:::! icon=flag`, `:::! icon=none`). Or type `/info`, `/warning` and so on.
- **Copy values.** In a `Key: Value` line (like `**Plate:** 3WBZ56`), hover the value for a button that copies it.
- **Nested lists.** <kbd>Tab</kbd> / <kbd>⇧Tab</kbd> on a list item nests it under the item above or moves it back out, sub-items included. Each level steps in further and gets its own bullet: dot, ring, square.
- **Drag to move.** Hover a line or block for a grip on its left; drag it to move the line, a list item with its sub-items, a heading, code block, table, quote or card (by its `:::` line). Click the grip to select it. <kbd>⌥↑</kbd> / <kbd>⌥↓</kbd> move lines from the keyboard.
- **Todos.** Click checkboxes to toggle them. The Todo view collects every note with open tasks.
- **Format toolbar.** Select text for a small toolbar to make it bold, italic, struck through, code or highlighted. It shows which ones the text already has; click again to remove.
- **Code blocks.** Write the language after the fence (` ```sql `, ` ```ts `, ` ```python `…) for syntax highlighting in your theme's colors; each language loads the first time a note uses it. A copy button in the top right corner copies the code, and the wand next to it tidies it: one-line JSON becomes indented JSON (long numbers keep every digit), SQL gets laid out by clause, and JavaScript, TypeScript, CSS, HTML, YAML, GraphQL and Markdown go through Prettier. A block with no language that starts with `{` or `[` is treated as JSON. Typing ` ``` ` or `:::` adds the closing fence, and typing <kbd>`</kbd> or <kbd>:</kbd> with text selected puts it in a code block (inline code within a line) or a card.
- **Diagrams.** A ` ```mermaid ` code block is drawn as its [Mermaid](https://mermaid.js.org) diagram (flowcharts, sequence, class, state, Gantt, ER, pie…) in your theme's colors. Click it to edit the code, with the diagram redrawn below as you type. `/diagram` starts one. Mermaid loads the first time a note has a diagram.
- **Images.** Paste an image, drop one onto a note, or type `/image` to choose some. Each goes on a line of its own as ordinary Markdown (`![](../attachments/….png)`) and is kept on the device; sync carries it to your other devices, and export puts it in the .zip. Click an image (or arrow up or down to it) to select it, then <kbd>⌫</kbd> deletes it. Images from the web (`![](https://…)`) show too.
- **Files.** Attach any other file the same way, or with `/file`. It shows as a card with its name and size and is linked as `[Report.pdf](../attachments/….pdf)`; double-click it to open it in its app (on the web, PDFs, pictures and media open in a tab and other files download). Files sync and export like images.
- **Slash commands.** Type `/` at the start of a line for headings, todos, lists, quotes, cards, callouts, tables, code blocks, diagrams, images, files, dividers, links and today's date. Keep typing to filter (`/to` → Todo).
- **Note info.** Words, characters, sentences, paragraphs, reading time and dates, from the ⓘ button.
- **Export everything.** Settings → Sync & Data saves all notes as Markdown files in a .zip, named after their titles, with their images and files.
- **Sample notes.** Settings → Sync & Data adds the feature tour (a note per feature) or the QA notes (see [qa/README.md](qa/README.md)).
- **Share.** The system share sheet where available, copy as Markdown or plain text, or download a `.md` file on the web.
- **Fast search** across all your notes.
- **Pin, trash, restore.** Right-click a note (or long-press on a phone) for a menu, or swipe it: right to pin, left to trash. Swipes work with touch and with two fingers on a trackpad.
- **Themes.** Thirteen themes (Lines, Graphite, Sepia, Forest, Ocean, Solarized, Nord, Dracula, Catppuccin, Tokyo Night, Gruvbox, Everforest, Ayu), each with light and dark variants that follow your system or a setting you choose.
- **Fonts and text size.** System (San Francisco on Apple devices), Serif, Rounded or Mono, with an adjustable text size.
- **Adjustable spacing.** Line height, paragraph and heading spacing, space below the title, text width and margins. Start from Compact, Default or Relaxed and fine-tune with a live preview.
- **SF Symbols** in the Mac and iPhone apps, as an alternative to Lucide icons. They're drawn by macOS / iOS at runtime and never bundled, as Apple's license requires.
- **Floating notes** (desktop apps). Pop any note into its own small window that can stay above everything else. Open as many as you like; they come back when you relaunch, and edits show up everywhere at once.
- **Focus mode.** Hide the sidebar and note list to see just the note (<kbd>⇧⌘\\</kbd>).
- **See-through windows** (Mac app). Adjustable opacity and background blur for the main window and floating notes.
- **Responsive.** Three columns on desktop, a drawer on tablets, a navigation stack on phones.
- **Local-first.** Notes live on your device and work offline. No account, no server.
- **Save to a folder** (web, in Chrome and Edge). Settings → Sync & Data → Folder: pick a folder, and lines writes your notes there as `.md` files and keeps them up to date, both ways.
- **Sync through your cloud drive** (desktop apps). iCloud Drive, Google Drive, Proton Drive, Dropbox, OneDrive or any folder: lines writes your notes there as `.md` files and the drive's own app syncs them.
- **Sync with your own storage.** Bring any S3-compatible bucket (Cloudflare R2, Backblaze B2, Amazon S3, MinIO, …). Notes are stored there as plain `.md` files, and conflicts never lose an edit. See [docs/sync.md](docs/sync.md).
- **End-to-end encryption** (optional). Settings → Sync & Data → Set up encryption: notes and attachments are encrypted on your device (AES-256-GCM, key from your passphrase) before they reach the bucket or drive, which only ever sees unreadable files. Your other devices ask for the passphrase once.
- **Locked notes.** Lock a note from its toolbar or menu (Lock Note), like in Apple Notes: one password (or Touch ID on the Mac) opens them all, until you lock them again or after 5 minutes without use. A locked note is encrypted on the device and wherever it syncs, with or without end-to-end encryption; its title stays readable so the list can show it.
- **App lock** (optional). Settings → Privacy: notes, attachments and sync settings on the device are encrypted, and lines asks for your passphrase (or Touch ID on the Mac) when it opens and after a while without use. Lock it any time with the lock button or <kbd>⌃⌘L</kbd>.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| <kbd>⌘N</kbd> | New note in the apps. On the web it's <kbd>⌥N</kbd> (<kbd>Alt+N</kbd> on Windows and Linux), since browsers keep <kbd>⌘N</kbd> for a new window |
| <kbd>⌘⇧F</kbd> | Search notes |
| <kbd>⌘\\</kbd> | Toggle sidebar |
| <kbd>⇧⌘\\</kbd> | Focus mode: just the note |
| <kbd>⌘B</kbd> / <kbd>⌘I</kbd> / <kbd>⌘E</kbd> | Bold / italic / inline code |
| <kbd>⌘⇧X</kbd> / <kbd>⌘⇧H</kbd> | Strikethrough / highlight |
| <kbd>⌘↵</kbd> | Make a todo, or toggle it |
| <kbd>Tab</kbd> / <kbd>⇧Tab</kbd> | In a list: nest / un-nest the item. In a table: next / previous cell |
| <kbd>⌘F</kbd> | Find in note |
| <kbd>⌘-click</kbd> | Open link |
| <kbd>⌃⌘L</kbd> | Lock lines, when the app lock is on (<kbd>Ctrl+Alt+L</kbd> on Windows and Linux) |

On Windows and Linux, use <kbd>Ctrl</kbd> instead of <kbd>⌘</kbd>.

## Tech stack

| | |
| --- | --- |
| UI | [Svelte 5](https://svelte.dev): compiled, no virtual DOM, very small runtime |
| Editor | [CodeMirror 6](https://codemirror.net) with a custom live-preview layer |
| Icons | [Lucide](https://lucide.dev), or SF Symbols on Apple platforms |
| Native apps | [Tauri 2](https://v2.tauri.app): macOS, Windows, Linux, iOS, Android |
| Build | [Vite](https://vite.dev) + TypeScript |

### Why this editor approach?

Block-based editors such as Notion and many ProseMirror/contenteditable setups keep a rich document model and translate between it and what's on screen. That translation is where most cursor jumps, lost characters and odd IME behavior come from.

lines keeps the document as **plain Markdown text** in CodeMirror, which is built for fast, correct text input on desktop and mobile (including IME, spellcheck and accessibility). Formatting is a *decoration* drawn over the text: the markup is hidden when the cursor isn't on it. Only the visible part of a note is decorated, so very long notes stay fast.

The editor is also *uncontrolled*: the note list gets a copy of the text shortly after you type, but nothing pushes content back into the editor while you're writing.

## Getting started

Requirements: [Node.js](https://nodejs.org) 22+ and [pnpm](https://pnpm.io). The native apps also need [Rust](https://rustup.rs) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
pnpm install

# Web app at http://localhost:1420
pnpm dev

# Desktop app (macOS / Windows / Linux)
pnpm tauri dev
pnpm tauri build
```

### Demo website

The web app with the feature tour instead of the welcome note, saving only to a folder on the visitor's computer (or the browser). It's published to GitHub Pages by `.github/workflows/website.yml` on every push to main.

```sh
pnpm build:site   # to dist-site/, works from any subfolder
pnpm exec vite preview --outDir dist-site
```

In a debug build of the desktop app, press <kbd>F12</kbd> (or View → Developer Tools on a Mac) for the Web Inspector. Release builds don't include it.

### Mobile

Set up the native projects once, then run on a simulator or device:

```sh
# iOS (needs Xcode)
pnpm tauri ios init
pnpm tauri ios dev

# Android (needs Android Studio, the SDK and NDK)
pnpm tauri android init
pnpm tauri android dev
```

## Project structure

```
src/
  App.svelte                 App shell and responsive layout
  app.css                    Design tokens (colors, type), light and dark
  lib/
    editor/
      Editor.svelte          CodeMirror host; per-note undo history
      livePreview.ts         Hides Markdown and renders bullets, checkboxes, rules, images
      tables.ts              Rendered tables, cell navigation, column alignment, pasting tables
      cards.ts               Draws ::: card blocks and callouts behind their text; /card, leaving a card
      formatCode.ts          Tidies code blocks (JSON, SQL, Prettier languages)
      formatting.ts          Bold, italic, code… toggles and the toolbar over selected text
      dragBlocks.ts          Grips for dragging lines and blocks to move them
      cursor.ts              Draws the text cursor (WebKit can leave a stray native caret behind)
      mermaid.ts             Draws ```mermaid code blocks as diagrams
      attachments.ts         Image and file blocks; pasting, dropping, /image and /file
      fences.ts              Closes ``` and ::: fences as you type them; ` or : wraps a selection
      lists.ts               Tab / Shift-Tab nesting for list items; Backspace after a marker
      keyValue.ts            Copy buttons for Key: Value lines
      syntax.ts              #tag, ==highlight== and ::: card parser extensions
      setup.ts               Extensions, keymaps, formatting commands
      editor.css             Styles for the rendered Markdown
    icons/                   Icon component: Lucide or SF Symbols
    prefs.svelte.ts          Theme, appearance, font, text size, spacing, icon set
    crypto.ts                AES-256-GCM and passphrase keys (WebCrypto), for sync and the app lock
    lock/
      lock.svelte.ts         The app lock: unlocking, turning it on and off, locking when idle
      vault.ts               Encrypts what's stored on the device while the lock is on
    sync/
      engine.svelte.ts       Two-way sync: upload, download, conflicts, deletions; turning encryption on and off
      sealed.ts              End-to-end encryption: the key file, and a remote that encrypts everything
      s3.ts                  Minimal S3 client (SigV4 via aws4fetch)
      format.ts              Note ⇄ Markdown-with-front-matter
      providers.ts           R2 / B2 / S3 presets
      folder.ts              Cloud drive folders in the desktop apps
      browserFolder.ts       A folder on the web, through the File System Access API
    notes/
      store.svelte.ts        Reactive note state: filtering, search, tags, saving
      storage.ts             Storage interface + IndexedDB implementation
      attachments.ts         Images and files: saved by content hash, opened, cleaned up when unused
      noteKeys.svelte.ts     Locked notes' keys: encrypting a note, opening it with the password
      locked.svelte.ts       Locking and opening locked notes, their password, closing them when idle
      parse.ts               Title, excerpt and tag extraction
      samples.ts             Adds the feature tour (tour/) or the QA notes (qa/)
      tour/                  The feature tour: the demo website's first notes
    components/              Sidebar, tag tree, note list, settings
  themes.css                 Theme colors (light and dark for each)
src-tauri/                   Native shell (Rust); sf_symbols.rs draws SF Symbols, lock.rs shares the
                             unlocked key with floating notes and does Touch ID
src-tauri/icons/source/      App icon artwork (SVG): Mac layout and full-bleed for iOS/Android
docs/linedown.md             Linedown: the Markdown lines reads and writes
qa/                          Release checklist and QA notes (generated by scripts/qa-notes.mjs)
```

## Roadmap

Known limitations of encryption, the app lock and locked notes, and what hasn't been tried on real devices yet, are in [docs/limitations.md](docs/limitations.md).

- [x] Sync through any S3-compatible storage
- [x] Sync through a cloud drive folder on the desktop (iCloud Drive, Google Drive, Proton Drive, Dropbox, OneDrive)
- [x] Save to a folder on the web (Chrome and Edge)
- [ ] iCloud on the iPhone app (an iCloud container, which needs the app signed with iCloud entitlements)
- [ ] iCloud on the web: sign in with your Apple Account (CloudKit JS)
- [ ] Google Drive on the web and phones: sign in with Google (Drive API; needs an OAuth client ID)
- [ ] Proton Drive on the web and phones, once Proton opens its Drive SDK to third-party apps
- [ ] Show notes by title in synced folders, for browsing them in Finder
- [x] End-to-end encryption for synced notes
- [x] App lock: encrypted on the device, with a passphrase or Touch ID
- [x] Locked notes, with a password or Touch ID
- [ ] Encrypt images and files in locked notes
- [ ] Face ID for the app lock and locked notes on iPhone
- [ ] Store sync credentials (the S3 secret key) in the OS keychain on native platforms instead of local storage
- [ ] Conditional S3 writes (`If-Match`), so an upload fails instead of overwriting a note another device changed in between
- [ ] Narrow the app's native permissions: limit network access to the configured endpoint and file access to the chosen sync folder
- [x] Syntax highlighting inside code blocks
- [x] Rendered tables
- [x] Image attachments (paste and drag-and-drop)
- [x] Any file as an attachment
- [ ] Remove attachments from sync storage once no note uses them (they're only cleaned up on the device for now)
- [ ] Note links (`[[Another note]]`) and backlinks
- [ ] Export to Markdown, HTML and PDF
- [ ] Offline support for the web app (service worker)
- [ ] A "System" theme that follows your desktop, generated from one seed color for light and dark, and updating live:
  - Mac: colors picked from the wallpaper (dynamic and per-display wallpapers, re-checked when the app comes to the front)
  - Windows: the wallpaper, or the accent color Windows picks from it
  - Linux: a full palette from pywal / wallust / matugen (`~/.cache/wal/colors.json`) or a KDE color scheme; otherwise the XDG desktop portal's accent color
  - Android: Material You colors
  - iPhone and web: the system accent color (CSS `AccentColor`, real in Safari and Firefox; Chrome reports a default blue, so fall back to a neutral theme)

## Contributing

Issues and pull requests are welcome. A change users can see also updates the Linedown spec, the QA notes and checklist, and the feature tour where they're affected (see [qa/README.md](qa/README.md)). Before opening a PR, please run:

```sh
pnpm check
pnpm build
```

## License

lines is free software, licensed under the [GNU Affero General Public License v3.0](LICENSE).

You can use, study, change and share it. If you distribute a modified version, or run one as a network service that other people use, you must make your source code available to those users under the same license.
