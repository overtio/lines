# Accessibility

lines aims to work for everyone: with a keyboard alone, with a screen reader (VoiceOver, NVDA, TalkBack), at large text sizes, with reduced motion, and in high contrast. The target is [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA.

## What every part of the app does

- **Keyboard.** Everything that can be clicked can be reached with Tab and used with Enter or Space. F6 and ⇧F6 move between the sidebar, the note list and the note, each taking focus where it was left (the chosen list, the open note's row, the note's text). Enter on a note in the list opens it and moves into its text; a click leaves focus in the list. Lists and groups move with the arrow keys (the note list, the icon and picture pickers, segmented controls, menus). Esc closes what's open and puts focus back where it was.
- **Focus.** Focus is always visible: `:focus-visible` draws the accent outline (`app.css`). Nothing hides it.
- **Names.** Every control has a name a screen reader says: its text, or `aria-label` for a button that's only an icon (with the same text as its `title`, the tooltip). Icons beside text are `aria-hidden`.
- **Roles and states.** Built from real elements first (`button`, `input`, `ul`/`li`, `nav`, `main`, headings). Where a pattern needs more: menus are `role="menu"` with `menuitem`s; dialogs are `role="dialog"` with `aria-modal`, a label, focus kept inside while open and given back when closed; segmented controls are radio groups; toggles say `aria-pressed` or `aria-checked`; disclosures `aria-expanded`; the open item `aria-current`.
- **Announcements.** Changes that happen out of sight are announced: a sync problem, "Copied", a note moved to the trash, how many pictures a picture picker loaded. `speak()` in `src/lib/a11y.ts` says a message through a polite live region.
- **Motion.** With reduced motion turned on in the system, slides and swipes don't animate, nor do a dragged block's drop line and its lines sliding into place.
- **Size.** Targets are at least 24 × 24 px (WCAG 2.2's minimum), 44 × 44 on touch screens. Text sizes are relative, so the system's text size and zoom work; nothing is cut off at 200% zoom.
- **Contrast.** Settings → Theme → Contrast → **Increased** (or the system's Increase Contrast, which **System** follows) darkens each theme's grey text, accent and borders: text at least 9:1 against its background, secondary text 7:1 (AAA), faint text (dates, counts, hints), links and tags 4.5:1 (AA), borders 3:1. The colors are worked out for each theme in light and dark (each theme's `moreContrast`, in `src/plugins/themes/themes.ts`). The standard look keeps its lighter greys, which are below AA for faint text (see [limitations.md](limitations.md)), except in the accessibility themes below. Nothing is told by color alone (a sync problem has its icon and its words, not only red).
- **Themes for low vision and color blindness.** Settings → Theme has a group of its own, Accessibility:
  - **High Contrast**: black on white or white on black. Every tier of text (secondary and faint too) is at least 7:1 (AAA) on every surface it sits on: the panes, a hovered or selected row, chips, code, callouts, highlights, selected text. The accent (deep blue in light, cyan in dark) is 7:1 too; borders are 6:1 or more; a chosen segment is ringed rather than shaded. Callout, danger, success and code colors are 4.5:1 or more.
  - **Red-Green Friendly**, for protanopia and deuteranopia (after GitHub's theme for them): built from the Okabe–Ito palette. Nothing relies on red against green: the accent and success are blue, danger is vermillion, and the five callout kinds and the code colors differ in lightness as well as hue.
  - **Blue-Yellow Friendly**, for tritanopia: nothing relies on blue against green or yellow against violet. The accent and danger are red, success is blue.
  - In both color-blind themes all text, faint text included, is at least 4.5:1 (AA) on every surface. Simulated with Machado et al.'s matrices, the callout kinds, danger/success/pin and the code colors stay at least 7 apart (CIEDE2000) for the color blindness each is for, where the Lines theme's callouts drop below 1 for deuteranopia.
- **Forced colors.** In Windows' contrast themes (forced colors) the system replaces lines' colors and drops backgrounds and shadows, so `app.css` and `editor.css` mark what those showed with system colors instead: the open note's row, the current sidebar item, chosen options and tabs, menu items, and ticked checkboxes in `Highlight`; focus rings in `Highlight`; mentions and links in `LinkText`; chips, inline code and code blocks outlined; highlights in `Mark`. Markdown hidden by making it transparent stays hidden (`forced-color-adjust: none`), as do the theme picker's swatches, which show each theme's own colors.
- **Language.** The page's `lang` is the app's language, so screen readers read it right; notes are read as written.

## The editor

The editor is CodeMirror, whose text is real text a screen reader reads, with its own keyboard handling. What lines draws over it:

- The note is a text box named "Note", marked as language-unknown (`lang=""`), so it's read in the device's languages rather than the app's. Drawn Markdown reads as its text.
- Headings are headings (`role="heading"` with their level), so a screen reader's heading navigation (VoiceOver's rotor, NVDA's H) moves through a note's sections. Quotes are quotes. Bullets say "bullet"; numbers read as written.
- Markup that's hidden from sight but still in the text is said in words instead: a callout's `:::!` lines read "Warning callout" … "End of warning callout" (a card's, "Card" … "End of card"), the properties' `---` lines "Properties" … "End of properties", a code block's fences "Code" … "End of code". With the cursor on the line, its Markdown is there as usual.
- Checkboxes are `role="checkbox"` with `aria-checked`, named by their task; ⌘↵ on the line ticks them.
- Chips (mentions, GitHub links), copy buttons, tables, images and files have names; images use their alt text (without a width written after a bar, `|400`).
- An image's resize handle is for a pointer only; from the keyboard, the width is the number after the bar in its Markdown (`![Lake|400](…)`), shown while the cursor is on its line. A diagram's is the same, with its width after the language on its first line (` ```mermaid |400 `).
- Symbols shown for typed characters (`->` as →, `!=` as ≠) are read as the symbol ("right arrow", "not equal to"), as they look. With the cursor touching one, the typed characters are there to read and edit; Settings → Text turns symbols off for anyone who'd rather hear the characters.
- Menus (`/`, `\`, `@`) are CodeMirror's autocomplete, a listbox the screen reader follows.
- Everything a click opens in a note, ⌥↵ opens from the cursor: a link, an attached file, a mention's note (made if it isn't there yet), a tag's notes. Buttons drawn in a note (copy, format, a table's controls) are reached with Esc, then Tab, as CodeMirror leaves the editor.
- The format toolbar over selected text is a toolbar: Tab into it, ← and → between its buttons, Esc back to the text.

## Pane edges

- Several notes are picked from the keyboard too: ⇧↑ and ⇧↓ pick the way, ⌘A (Ctrl+A) picks every note, Esc lets them go, ⌫ moves them to the Trash. A picked row says "Selected" after its title, the count is announced as it changes ("3 notes selected"), and so is what's done to them ("Added #work to 3 notes"). The bar above the list is a toolbar of named icon buttons; the Add Tag box is a dialog whose field is a combobox, with its suggestions as a listbox (↑ ↓ to choose, Enter to add).
- The sidebar's and the note list's right edges are window splitters (`role="separator"` with their width as `aria-valuenow`, named "Sidebar width" and "Note list width"), and Tab stops: ← and → resize by 10 px (⇧ by 50), Home and End go to the narrowest and widest, Enter back to the usual width. Focused or pointed at, the edge shows an accent line (`Highlight` in forced colors).

## Settings

- On the web and on phones and tablets, a modal dialog: Tab stays inside, Esc (or a click outside it) closes it, and focus goes back to what opened it. In the desktop apps, a window of its own: Esc or ⌘W closes it, and the window's own buttons work as in any app.
- Its tabs are a tablist: ← and → move between them, Home and End go to the first and last. Only the panel scrolls, so the tabs stay in view. The Data tab's "Go to Sync" scrolls up to Sync and moves focus to its heading.

## Drawings

- A drawing in a note is an image named by its alt text ("Drawing" until it's changed). With it selected (↑ or ↓ stop on it), Enter opens it; its pencil button and double-clicking do the same with a pointer.
- A Mermaid diagram's Copy and Edit as Drawing is a named button in the diagram, reached like the note's other buttons (Esc, then Tab), and shown when focused. If the diagram can't be converted, the drawing window says why, and it's announced.
- The drawing window is a modal dialog: Cancel and Save at the canvas's top right, icon buttons (× and ✓) named by `aria-label`, Save's ⌘S in its `aria-keyshortcuts` (in a row above it on narrow windows), with Tab kept inside and focus back in the note after. Esc in the canvas belongs to Excalidraw; on Save or Cancel it asks before discarding changes, and the question is announced.
- Excalidraw's own toolbar and menus are labelled buttons and radio groups that work from the keyboard (its letters and numbers pick tools), but the canvas itself isn't readable by a screen reader: shapes and their text aren't in the accessibility tree. That's Excalidraw's, and lines can't change it; a drawing's alt text is what a screen reader has.

## The PDF preview

- A modal dialog (⌘P): Tab stays inside, Esc closes it and focus goes back. Paper and Typeset with are radio groups.
- Its pages are real text, so a screen reader reads the note in them, page by page ("Page 1 of 2" is each page's name); a paragraph that runs onto the next page is read once, on the page it starts on. Todo boxes say "Done" or "Not done", and math reads from KaTeX's MathML.
- "Laying out pages…", "2 pages, ready", the TeX download's progress and its errors are announced, as is where a PNG or PDF was saved.
- Save PNG opens a small popover with two buttons (One Image, One per Page), reached with Tab after the button; Esc closes it.
- TeX's PDF shows in the web view's own PDF viewer, whose accessibility is the browser's (a PDF from pdfLaTeX isn't tagged).

## Checking

The release checklist (`qa/checklist.md`) has a section for this: Lighthouse's accessibility audit, a pass with the keyboard alone, and one with VoiceOver.

When a theme's colors change, its Increased-contrast colors (`moreContrast` in `src/plugins/themes/themes.ts`) need working out again: each one is the theme's own color mixed toward its text (then toward black, or white in dark) until it reaches its ratio against the note's, the list's and the sidebar's backgrounds.

The accessibility themes are checked more widely, since they promise more: each text color against every surface it can sit on, composited as the browser draws it (rows, chips, code, callout tints, highlights, selections), and their callout, status and code colors against each other under simulated color blindness (Machado et al. 2009, compared with CIEDE2000). A color changed in one of them needs both checks again.
