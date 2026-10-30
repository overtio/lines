# Known limitations and future work: encryption, app lock, locked notes

What these features don't do (yet), and what hasn't been tried outside tests. The planned work is also on the [roadmap](../README.md#roadmap). How they work is in [sync.md](sync.md).

## Not tried on real devices yet

Each of these has only run in Chrome, through the end-to-end tests (two browser profiles and a stand-in S3 server):

- [ ] **Touch ID** in the Mac app, for the app lock and for locked notes. The development build is unsigned, so macOS may ask for the login password the first time lines reads its Keychain item ("lines app lock").
- [ ] **Floating notes** while lines is locked, and while locked notes are locked or open. The key is handed to them through the app's native side (app lock) or the window channel (locked notes).
- [ ] **End-to-end encryption with a cloud drive folder.** Only S3 was tested end to end with encryption on. Plain folder sync passes its test.
- [ ] **iPhone and Android.** None of the three features has been run there.
- [ ] **Saving to a folder on the web** with a folder picked in the real folder picker, and the "Allow access" prompt after restarting the browser. The tests used the browser's private storage, which has the same interface but never asks.

## Saving to a folder on the web

- Only Chrome, Edge and other Chromium browsers have the File System Access API. Safari and Firefox keep notes in the browser, and can export them.
- After the browser restarts, it asks again before lines may use the folder; until someone clicks Allow access in Settings → Data, sync shows an error.
- The browser blocks some folders (the home folder itself, system folders, Downloads on some systems).

## The web app's own storage

Where the web app keeps everything is in [storage.md](storage.md).

- Notes kept only in the browser can be lost: clearing site data deletes them, the browser may evict them when the disk is low (lines doesn't ask for persistent storage), and Safari deletes them after 7 days without a visit.
- The demo website shares its storage with every other site on `overtio.github.io`. It needs a domain of its own before people keep real notes there.

## Unsplash photos

- An Unsplash photo is kept as the link to its page, not as a file, so it needs the internet to show, and isn't in exports or sync as a picture.
- Other Markdown apps show these links as broken images, as the page isn't a picture.
- lines loads the photo through Unsplash's download link, which counts as a download each time it's shown.
- Unsplash+ photos don't show: Unsplash only hands them to subscribers. They say the image couldn't be shown.

## Math

- Math is drawn by KaTeX, which covers most of LaTeX's math mode but not all of it (no `\newcommand` shared between blocks, no TikZ or other packages), and not whole LaTeX documents.
- Other Markdown apps without math support show the LaTeX as written, dollar signs included.
- The note list shows a note's LaTeX as text, not drawn.

## LaTeX notes

- lines draws a common part of LaTeX ([latex.md](latex.md)), not what a TeX engine typesets: no packages, text macros (`\newcommand` only works in math), floats' placement or page layout. What it doesn't know stays as written, faint.
- In the editor, equation, section and theorem numbers aren't used for references: `\ref{sec:intro}` shows `sec:intro`, not "1", and equations aren't numbered at all. The PDF preview numbers them (see below).
- A paragraph hard-wrapped in the source shows on several lines, where LaTeX would join them.
- `\input` and `\include` don't pull in other files: a paper made of several files has to be pasted in as one.
- There's no format toolbar over selected text, no todos, and no drag handles in LaTeX notes. An attached file is a plain `\href` link, not a card with its size.
- A photo pasted from Unsplash, or any other `\includegraphics{https://…}`, shows in lines but doesn't compile: LaTeX can only include files.
- A synced LaTeX note's file still ends in `.md`, with `format: latex` in its front matter. Export writes `.tex` files.
- Switching a note's format doesn't convert its text.

## PDF

- lines' own pages are saved as a PDF through the print dialog (Save as PDF), not straight to a file. The print dialog isn't there on iPhone and iPad, so there lines' pages can be previewed but not printed or saved; a LaTeX note typeset by TeX saves as usual.
- Printing hasn't been tried in the Mac, Windows and Linux apps yet: whether their print dialogs keep the paper size the preview chose (A4 or Letter). Nor has showing TeX's PDF in the apps, whose web views draw PDFs themselves.
- lines' pages break between lines, never through one, but don't keep a paragraph's last line from starting a page alone, or a table's header with its rows. A block taller than a page (a very long code line wrapped many times, say) is cut where the page ends. Text isn't hyphenated.
- A printed LaTeX note follows LaTeX in what it can: lines join into paragraphs, sections, theorems, `equation`s, figures and tables are numbered and `\ref` shows their numbers. But footnotes are gathered at the end rather than at the foot of their page; an `align`'s lines aren't numbered; `\cite` shows its key, not a number; commands lines doesn't know print their last argument's text or nothing; and the layout is lines', not a document class's (`\documentclass[twocolumn]` is one column).
- TeX's PDF uses pdfLaTeX with TeX Live's basic packages only: a note needing others (TikZ, `enumitem`, `microtype`…) stops with "File … not found". `booktabs` stands in with plain rules. Fonts and scripts beyond pdfLaTeX's (no XeLaTeX or LuaLaTeX yet), BibTeX's `.bib` files (there's nowhere to keep one), and `\input`ed files aren't available.
- TeX downloads about 125 MB the first time, so that once needs the internet; the browser keeps it afterwards. It's only there when the build includes it (`pnpm tex-assets`, see the README); a build without it says so.
- When TeX stops at an error in a file other than the note (a package), the line it names is that file's, though the preview says it's the note's.
- PNG images are of lines' pages, not TeX's PDF. They're drawn by copying the pages into an SVG picture (modern-screenshot), so what the browser can't copy that way is missing: a web image from a site that doesn't allow it (CORS) shows blank. Images are drawn at twice the page's size, but no bigger than every browser can draw (16.7 million pixels, WebKit's limit on iPhone and iPad): a note longer than about five pages as One Image comes out smaller, and from about twenty pages its text is less sharp than on screen. One per Page keeps every page sharp.
- Saving PNGs hasn't been tried in the Mac app (WebKit) yet.

## Image sizes

- Only an image on a line of its own (in a note or a card) has a resize handle; one within text, a list or a quote takes a width written in its Markdown but can't be dragged. Images in LaTeX notes can't be resized yet (`\includegraphics[width=…]` is shown at the image's own size).
- A width is in pixels and a height is ignored, so an image always keeps its shape.

## Symbols

- Only Markdown notes show `->` as →; LaTeX notes show what's typed (LaTeX has `\to` and `\neq` for these).
- `\->` keeps the characters, but the backslash shows in the editor (as it does for any escape); the PDF leaves it out, as Markdown does.
- The note list's previews and search show the characters as typed.
- In code, a symbol is drawn in the code font, and some code fonts draw arrows small.

## Drawings

- Drawings are Excalidraw's: what it can draw is what there is. Its shape library (and its browser, libraries.excalidraw.com), its help, its links, its image tool (pictures go in the note instead), live collaboration and AI features aren't part of lines. Its ? key still opens its list of shortcuts.
- Its fonts come with lines, except Xiaolai, its 12 MB Chinese and Japanese hand: on the web Excalidraw fetches that from its CDN when it's needed, and in the apps (which don't allow that) such text is in a system font.
- In dark themes a drawing is drawn inverted, as Excalidraw does, so a photo inside a drawing shows inverted too.
- A Mermaid diagram copied into a drawing is a copy: changing the code afterwards doesn't change the drawing, nor the other way round. Flowcharts become shapes; sequence and class diagrams come out simpler than Mermaid draws them; other kinds (pie, Gantt, mindmap, timeline…) come in as one picture that can be moved and drawn around but not taken apart. The conversion uses its own Mermaid (11, inside Excalidraw's converter), which loads the first time a diagram is copied.
- Excalidraw takes the theme's colors for its toolbars, menus and canvas, but not for what's drawn: its pens are its own colors (black, red, green…), as they are in any other app that opens the drawing. Changing the theme while a drawing is open shows in Excalidraw once it's opened again.
- Only a drawing on a line of its own (in a note, or in a card) can be opened; one inside text, a list or a quote is an ordinary image, and in dark themes isn't inverted.
- LaTeX notes show drawings as images but can't open them, and pdfLaTeX can't include an SVG, so TeX's PDF stops at one.
- Excalidraw and React, which it needs, load the first time a drawing opens: about 1.45 MB (440 KB compressed), and its font tools another 1.8 MB (740 KB) the first time one is saved. Nothing of it loads until then.
- Not tried in the Mac app yet: Excalidraw's worker and fonts under the app's content security policy.

## Objects and mentions

- A mention finds a note by its title, and the note keeps the mention as written: renaming the mentioned note doesn't update mentions of it, so they stop finding it (and show grey). Two notes with the same title can't both be mentioned; the one with a type wins.
- There are no backlinks yet: a note doesn't list the notes that mention it.
- Wiki links are mentions by title only: a heading in one (`[[Note#Heading]]`) opens the note at its top, block references (`[[Note#^id]]`) likewise, and embeds (`![[…]]`) stay text. A title with `[`, `]`, `|` or `#` in it can't be written as a wiki link (the menu leaves those out); `@[…]` can mention it.
- Properties are read as flat `key: value` lines. Nested YAML (a map inside a map) is read as text, and values are always text: no dates, numbers or checkboxes, and no sorting or filtering the list by them.
- Types have no schema: a new note made under a type starts with only its `type`, not the keys other notes of that type use.
- Only Markdown notes have properties and mentions; in a LaTeX note `@` and `---` are text.
- A type table shows values; it can't edit them (open the note), filter its rows, or keep a sort. Its values are text, so sorting is by text (numbers within it compare as numbers: 9 before 10). It shows on screen only: in an export or another app it's the `@type.…` line.
- The icon chosen for a type is kept on the device, like a tag's, so other devices show the default.
- A locked note can be mentioned by its title, but its properties can't be read, even while it's open.
- A synced note's file has two front matter blocks: lines' own (id, dates…) and then the note's properties, as part of its text. Apps that read front matter see the first.

## Accessibility and languages

- With Contrast on Standard, faint text (dates, counts, the sidebar's headings, hints) is below WCAG AA's 4.5:1 in every theme but the three accessibility ones, and secondary text is too in a few light themes (Solarized, Everforest, Ayu). Contrast → Increased, or the system's Increase Contrast, meets AA (docs/accessibility.md).
- A callout's border and tint stay as subtle in High Contrast as elsewhere (the border is its color at 24%); the strong borders are the panes', cards' and fields'.
- The forced-colors rules (Windows' contrast themes) are written to the CSS spec and haven't been tried on Windows yet, nor with Chrome's forced-colors emulation.
- Not tried yet with VoiceOver on iPhone, TalkBack or NVDA; only with Chrome's audits and the keyboard.
- Icon names (in the icon picker's search and tooltips) are English in every language.
- Errors from the desktop app's own code (folders, the window) are English, inside a translated sentence.
- The welcome note, the feature tour and the examples are English. A note's text isn't translated, and the date `/date` writes is in the app's language.
- Changing the language starts lines again.

## End-to-end encryption (sync)

- Still visible to the storage provider: how many notes and attachments there are, their sizes, when they change, and note ids (random).
- If every device that has the key is lost and the passphrase is forgotten, the encrypted notes in the bucket can't be recovered.
- With encryption on, the bucket no longer holds Markdown that other apps can open. Export still makes plain Markdown.

## App lock

- Turning it on rewrites notes encrypted, but earlier plain copies can linger in the database's free pages or write-ahead log until they're overwritten. FileVault (or the phone's own encryption) covers this.
- Opening an attachment in the native apps writes a readable copy to the app's cache folder, and it stays there.
- Attachments are encrypted on the device, but their ids (content hashes) aren't.
- On the web, each tab unlocks on its own.
- There's no Face ID on iPhone yet; the passphrase works there.
- A forgotten passphrase means erasing the device. Synced notes come back from sync storage.

## Locked notes

- **Images and files in a locked note aren't encrypted by the lock.** Their names are listed, readable, in the note (so they're kept and synced while it's locked). Sync encryption does encrypt them. Planned.
- Readable even while locked: the title, dates, pin, icon, and the attachment names above.
- A locked note's tags, to-dos and text are left out of tags, Todo and search, even while it's open. Only its title is searchable.
- Locking a note replaces its plain copy in the bucket or drive. A bucket with versioning, or a drive's file history, may still hold the plain version from before.
- Old plain copies can linger on the device's disk, as with the app lock above.
- They lock again after a fixed 5 minutes without use. That's not a setting yet, and each window counts its own idle time (locking by hand locks every window).
- A forgotten password can't be recovered. "Forgot password" only sets a new one for notes locked from then on; notes already locked keep needing the old one.
- A password changed on one device reaches another device's notes when those notes sync from the first. A note locked only on the second device keeps the old wrapping, which the old password still opens, until it's locked or edited again there.
- There's no password hint.
- Notes locked with different passwords (after "Forgot password", or on two devices before they synced) stay separate. Typing a password opens every note it fits.
- Conflict copies of a locked note that isn't open get "(conflicted copy)" in their visible title only.
- Face ID on iPhone isn't done.

## Future work

- [ ] Convert a note between Markdown and LaTeX when switching
- [ ] Drawings in LaTeX notes, saved as a PDF beside the SVG for TeX
- [ ] Save lines' PDF straight to a file in the apps (the web view's own PDF output), and print on iPhone and iPad
- [ ] More of TeX Live for TeX's PDFs, fetched as a note needs it; XeLaTeX for other scripts and fonts
- [ ] Encrypt images and files in locked notes
- [ ] Face ID for the app lock and locked notes on iPhone
- [ ] A setting for how long locked notes stay open
- [ ] Optional password hint for locked notes
- [ ] Clear opened attachment copies from the cache when lines locks or quits
- [ ] Store sync credentials in the OS keychain on native platforms
- [ ] Remove attachments from sync storage once no note uses them
- [ ] Backlinks, and updating mentions when a note is renamed
- [ ] Types with a template: the keys a new note of the type starts with
- [ ] Sync the icons chosen for tags and types
