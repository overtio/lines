# QA · Release checklist

Go through this before every release, on each platform you ship: the Mac app, the web app (Chrome and Safari), and a phone width (or the phone apps). Tick items as you go. If something's wrong, note it under the item.

:::i
Platforms in brackets: **[Mac]** Mac app only, **[Desktop]** desktop apps, **[Web]** web only, **[Touch]** phones and tablets, **[Chromium]** Chrome and Edge. Everything else applies everywhere. ⌘ is Ctrl and ⌥ is Alt on Windows and Linux.
:::

#qa/checklist

## 0. Setup

- [ ] Start from a fresh profile (a new browser profile, or Settings → Data → erase in the app), so first-launch behaviour can be checked
- [ ] A fresh start shows one note, **Welcome to lines** (the demo website: the feature tour instead), and everything in it renders
- [ ] Settings → Data → **Add QA Notes**: the QA notes are added, tagged qa, and the list switches to that tag
- [ ] Settings → Data → **Add Feature Tour**: the tour notes are added, with the picture and the CSV file working
- [ ] Look through every QA note (qa tag in the sidebar) in light and dark, and at phone width; each says what to check at the top

## 1. Typing and live Markdown

- [ ] Bold, italic, code, strikethrough and highlight shortcuts (⌘B, ⌘I, ⌘E, ⌘⇧X, ⌘⇧H) wrap the selection; again unwraps it; with no selection they insert a pair with the cursor between
- [ ] The shortcuts on several lines format each line, skipping list markers, headings and fence lines
- [ ] ⌘↵ turns a line into a todo, replaces a bullet or number with a todo, and ticks or unticks a todo; works on every selected line
- [ ] Enter in a list, todo or quote continues it; Enter on an empty item ends it
- [ ] Markdown of a line shows when the cursor is on it and hides when it leaves; with the editor unfocused everything is rendered
- [ ] Headings, links, autolinks, tags, quotes, rules, bullets (dot, ring, square by depth) and numbers render correctly
- [ ] A tag shows its sidebar icon (a hash unless one was chosen) in place of its `#`, a little apart from its name, inside its pill; with the cursor on the tag the `#` shows. Choosing another icon for the tag in the sidebar changes it in the open note at once. A screen reader still reads "#"
- [ ] ⌘-click (Ctrl-click) on a tag lists its notes, as choosing it in the sidebar does, and selects it there; a plain click puts the cursor in it; ⌥↵ with the cursor on a tag does the same as ⌘-click; a tap on a phone while not editing opens it too; in a note's own window nothing happens
- [ ] Typing `#` at the start of a line leaves it as text, not a big heading; a space after it (`# `) makes the heading, and a letter (`#t`) a tag
- [ ] Clicking a checkbox ticks it; not in a trashed note
- [ ] ⌘-click a link opens it (system browser in the apps, new tab on the web); only http, https, mailto and tel open
- [ ] [Touch] Tapping a link while the editor isn't focused opens it
- [ ] Pasting a URL over selected text makes a link
- [ ] GitHub links show short with GitHub's mark (`owner/repo#12`, `owner/repo@1a2b3c4`), in text and in table cells; the URL shows while the cursor is on one; ⌘-click opens it; a named GitHub link keeps its text with the mark in front (see the QA note "GitHub links")
- [ ] Symbols (QA note "Symbols"): `->` `<-` `<->` `=>` `<=>` `<=` `>=` `!=` show as → ← ↔ ⇒ ⇔ ≤ ≥ ≠ in text, code spans, code blocks (as wide as the two or three characters, so columns line up) and table cells; `-->`, `!==`, `\->`, addresses, HTML comments and a quote's `>=` stay as typed; a code span or link with one inside stays one chip or one underline; the cursor touching one shows the characters; copying copies the characters
- [ ] Typing ``` or ::: at the end of a line adds the closing fence below; not when it closes a block above
- [ ] Selecting lines and typing ` makes a code block; within one line it makes inline code
- [ ] Selecting whole lines and typing : makes a card, with blank lines around
- [ ] [Mac] With Edit → Substitutions on, smart quotes and dashes stay straight inside code and curly outside
- [ ] "Start writing…" shows in an empty note
- [ ] The text cursor is the accent color, blinks, and never leaves a stray caret behind
- [ ] ⌘F opens find and replace; ⌘G and ⇧⌘G go to the next and previous match; Esc closes it
- [ ] ⌘Z and ⇧⌘Z undo and redo; switching notes and back keeps each note's undo history and scroll position
- [ ] ⌥↑ and ⌥↓ move lines; ⇧⌥↑ and ⇧⌥↓ copy them
- [ ] ⇧⌘\ with the cursor beside a bracket only toggles focus mode (it's also CodeMirror's "matching bracket")
- [ ] [Mac] Ctrl+N in the editor makes a new note and doesn't also move the cursor down

## 2. Format toolbar

- [ ] Selecting text with the mouse shows the toolbar above the selection once the button is released
- [ ] [Touch] The toolbar shows below the selection, clear of the system menu, with larger buttons
- [ ] Buttons show which styles the text already has; clicking toggles them and keeps the selection
- [ ] No toolbar in code blocks, on a selected image or file, in trashed notes, or over fence-only lines
- [ ] Esc hides it until the selection changes

## 3. Key: Value lines

- [ ] Hovering the value of a line like **Plate:** 3WBZ56 shows a copy button; it copies just the value and shows a check
- [ ] [Touch] The copy button is always faintly visible
- [ ] Times like 10:30 and URLs don't get a copy button

## 4. Tables

- [ ] Tables render with alignment, styled text and links in cells; selecting across one keeps it rendered
- [ ] Clicking a cell shows the Markdown with the cursor in that cell
- [ ] ⌘-click a link in a rendered cell opens it
- [ ] Hovering a cell shows a copy button that copies the cell's text; empty cells have none
- [ ] Tab and ⇧Tab move between cells and re-align the table; Tab after the last cell adds a row
- [ ] Enter adds a row below; Enter on an empty last row leaves the table
- [ ] `/table` inserts a table with the cursor in the first header cell
- [ ] Pasting rows from a spreadsheet makes a table, numbers right-aligned; one ⌘Z gives the pasted text instead
- [ ] Pasting a table from a web page or Google Docs makes a table
- [ ] Pasting text that isn't a table pastes it as text; pasting in code pastes plain text
- [ ] Tables in quotes and list items stay Markdown

## 5. Cards and callouts

- [ ] Cards draw behind their text, nest, and keep a gap between cards that touch and after a code block
- [ ] Enter on a second empty line at the end of a card leaves the card
- [ ] `/card` makes a card from the line, with blank lines around
- [ ] Each callout kind (`:::i`, `:::?`, `:::!`, `:::!!!`, `:::^`) has its color and icon, with the icon level with the first line
- [ ] Moving or deleting all the text out of a callout leaves its icon in the middle of the empty card, not on the closing fence
- [ ] `/info`, `/question`, `/warning`, `/error` and `/decision` insert callouts
- [ ] Clicking a callout's icon opens the picker; choosing an icon writes `icon=…` on the fence; No Icon writes `icon=none`; Reset removes it
- [ ] Choosing a kind's own icon leaves the fence without `icon=`
- [ ] A callout with no icon shows a faint + to add one while its fence is hovered or has the cursor
- [ ] The cursor and focus stay put when the icon is clicked; trashed notes don't open the picker

## 6. Code blocks, diagrams and math

- [ ] Languages highlight in the theme's colors, loading the first time they're used; unknown languages show plain
- [ ] The copy button copies the code without its fences
- [ ] The wand tidies JSON (long numbers keep every digit), SQL and Prettier languages, in one undo step
- [ ] A bad block shows "Couldn't format: …" for a few seconds; editing while it formats doesn't get overwritten
- [ ] A mermaid block draws as a diagram in the theme's colors; clicking it shows the code with the diagram below, redrawn as you type
- [ ] Hovering a diagram (or its preview while editing) shows a shapes button, Copy and Edit as Drawing: it opens the diagram in Excalidraw, a flowchart as boxes and arrows to move, a pie or Gantt chart as a picture of it; Save puts the drawing on its own line below the code block, which stays, with the cursor where it was; Cancel adds nothing; ⌘Z takes the drawing out. No button on a broken or empty diagram, nor in the Trash
- [ ] Hovering a diagram shows a handle on its bottom right corner (always on touch): dragging it resizes the diagram, keeping its shape and no wider than the note, and writes the width after the language (` ```mermaid |300 `); double-clicking it takes the width out. A width typed by hand works the same; the PDF preview and PNGs use it. No handle on a broken or empty diagram, nor in the Trash
- [ ] A broken diagram shows a short error; an empty one shows "Empty diagram"
- [ ] Changing theme, light/dark or font redraws diagrams
- [ ] `/code` and `/diagram` insert their templates
- [ ] `$x^2$` draws as math, and shows its LaTeX while the cursor is on it; `$5 and $10` stays text
- [ ] A `$$` block (or ```` ```math ````) draws centered; clicking it shows the LaTeX with the math below, redrawn as you type
- [ ] Enter after a new `$$` adds the closing `$$` with the cursor between; Enter on a block's closing `$$` just starts a new line
- [ ] LaTeX KaTeX can't read shows red, as written, with the reason on hover; an empty block shows "Empty math"
- [ ] Math in a table cell draws; `/math` inserts a block
- [ ] `\` inside `$…$`, a `$$` block or ```` ```math ```` opens the math menu (`\fr` → `\frac`, with symbols on the right); outside math, `\*` and other escapes don't open it
- [ ] Picking `\frac` writes `\frac{}{}` with the cursor in the first braces; Tab goes to the second, then past it; Tab in the menu completes (`\al` → `\alpha`)
- [ ] Smart quotes stay straight in math (`f'(x)`)

## 7. Images and files

- [ ] Pasting an image, or dropping one onto a note, adds it on its own line; the cursor moves past it
- [ ] Dropping files puts them above or below the line under the pointer
- [ ] Pasting text that also carries a file (a document paragraph) pastes the text
- [ ] TIFF and BMP images become PNG; unreadable images become files
- [ ] `/image` and `/file` open the file picker
- [ ] Nothing can be attached in code, tables or trashed notes
- [ ] Files show as a card with an icon, name and kind · size
- [ ] An image or file that hasn't synced yet says so, and appears when it arrives
- [ ] Clicking an image or file selects it; Delete removes it; ↑ and ↓ stop on it first
- [ ] An image or drawing on its own line shows a round handle on its bottom right corner on hover (always on touch); dragging it resizes the image, keeping its shape, between 48 px and the note's width, and writes the width into its Markdown (`![Lake|400](…)`); ⌘Z undoes it; double-clicking the handle goes back to the image's own size. No handle in the Trash
- [ ] Typing `|300` after an image's alt text shows it 300 px wide, inline images too; the description read aloud leaves out the `|300`; the PDF preview and PNGs use the width
- [ ] Double-click (or ⌘-click) opens a file: in its app [Desktop], a new tab or download [Web], saved to Downloads or Documents [Touch]
- [ ] [Desktop] Scripts and apps attached as files are shown in Finder, not run
- [ ] Pictures from the web show; a broken one says it couldn't be shown
- [ ] `/drawing` opens Excalidraw full-window in the app's language and light or dark, with Cancel (×) and Save (✓, in the accent) as icons at the canvas's top right, the size of Excalidraw's undo and redo, each with a tooltip (in a row above the canvas on a phone or a window narrower than 820 px, Cancel at the left); Save (⌘S) puts the drawing on a line of its own, as `![Drawing](../attachments/….svg)`; a blank drawing adds nothing
- [ ] Excalidraw has no image tool, no Library or help button, and its menu has only Find on canvas, Reset the canvas and Canvas background (no GitHub, X or Discord links)
- [ ] Excalidraw takes the theme's colors (try a few themes, light and dark): its toolbars and menus in the theme's surfaces, text and font, the chosen tool, sliders and the selection box in the accent, and the canvas the note's own background. A drawing given a canvas background in Excalidraw keeps it, in Excalidraw and in the note
- [ ] A drawing has no edge, shows light on dark in dark themes, and has a pencil button on hover (always on touch); the button, a double-click, or Enter with it selected opens it with its shapes editable
- [ ] Changing a drawing and pressing Save replaces its link with a new one; ⌘Z in the note brings the old drawing back. Save with nothing changed leaves the note alone
- [ ] Cancel, or Esc outside the canvas (on Cancel or Save, say), closes at once when nothing changed; with changes it asks "Discard your changes to this drawing?" (Keep Editing goes back to the canvas). Esc in the canvas is Excalidraw's (stops editing text, deselects) and never closes it
- [ ] Excalidraw's keys work while it's open (letters pick tools, ⌘Z undoes a stroke, ⌘A selects all) and don't reach the app (⌘/ doesn't open Settings, ⌘Z doesn't restore a trashed note)
- [ ] Excalidraw's hand-drawn font shows offline [Web] and in the apps; dropping an `.excalidraw.svg` exported from excalidraw.com with "Embed scene" makes a drawing lines can edit
- [ ] A drawing prints and shows in the PDF preview, dark on white
- [ ] Pasting an Unsplash photo's link (its page, or the picture) on an empty line adds the photo, described by the words in the link; ⌘Z turns it back into the link. Pasted within text, or over selected text, it stays a link. An Unsplash+ photo says it couldn't be shown

## 8. Lists, todos and moving

- [ ] Tab nests a list item with its sub-items under the one above; Tab on the first item does nothing
- [ ] ⇧Tab moves it back out; Backspace right after a marker moves it out, or turns it into text at the top level
- [ ] The Todo section lists notes with open todos; ticking the last one removes the note from it
- [ ] Hovering a line shows a grip on its left; it covers the line, a list item with its sub-items, or a whole heading, table, code block, quote or card
- [ ] In a callout the grip sits left of the icon column, not over the icon
- [ ] Clicking the grip selects the block; dragging it shows a drop line that glides from place to place (fading out where dropping would leave the note as it is, such as anywhere between a paragraph and the cards right around it, and never two lines in one gap that would do the same), scrolls near the edges, and moves the block: it and the lines it passes slide into their new places rather than jumping. With reduced motion turned on in the system, nothing slides
- [ ] Moved list items take the indent of where they land; tables and cards get blank lines around them
- [ ] [Touch] No grips

## 9. Slash commands

- [ ] `/` at the start of a line or after a space opens the menu, with Format and Insert sections; not in code or links
- [ ] Typing filters it (`/to` → Todo, `/checkbox` → Todo); no match closes it
- [ ] ↑, ↓, Enter and clicking choose; Esc closes
- [ ] Tab completes like a shell: `/to` + Tab makes a todo (one name left); `/he` + Tab becomes `/heading`; Tab again moves to the next heading and ⇧Tab back; Tab never indents the line while the menu is open
- [ ] Each command does what it says: Text, Heading 1–3, Todo, Bullet list, Numbered list, Quote, Code block, Diagram, Math, Card, the five callouts, Table, Image, File, Divider, Link, Tag, Mention, Type table, Properties, Date
- [ ] `/properties` in a note without properties adds `---`, `type: ` and `---` at the top with the cursor after `type: `; in a note with them, it adds a line at their end
- [ ] Block commands replace a line's existing prefix rather than stacking; Divider under text adds a blank line so the text doesn't become a heading

## 10. Note list

- [ ] New note (⌘N in the apps, ⌥N on the web) starts with `# ` and the cursor in it; in a tag view the tag is added; in a type view it starts with `type:` properties and the cursor on the title; from Trash it switches to Notes
- [ ] Leaving a new note untouched deletes it
- [ ] Rows show icon (the note's own, or else its type's), title or "Untitled", excerpt, pin, lock and date; pinned first, then newest
- [ ] A note with properties shows the line after them as its title, and an excerpt without them
- [ ] ↑ and ↓ move between notes when the list has focus
- [ ] [Touch] Swiping right pins (restores in Trash), left trashes (in Trash, needs a tap to delete); a long swipe does the action; one row open at a time
- [ ] [Desktop] Two-finger trackpad swipes do the same; Settings → Theme → Trackpad reverses them
- [ ] Right-click (long-press [Touch], context-menu key, ⇧F10) opens the menu: Pin, Floating Window [Desktop], Icon, Lock items, Copy Text, Move to Trash / Delete Forever
- [ ] ⌘Z right after trashing a note brings it back
- [ ] ⌘-click (Ctrl-click on Windows and Linux) picks a note along with the open one, and again takes it out; ⇧-click picks every note from the last one clicked; ⌘A with a row focused picks every note in the list; ⇧↑ and ⇧↓ pick the way from the keyboard; a plain click, or Esc, picks just the one again
- [ ] With two or more picked, they're highlighted and the bar above the list says how many ("3 notes selected"), with Add Tag, Pin to Top (Unpin when they all are), Move to Trash and × (in Trash: Restore and Delete Forever); right-clicking a picked note opens the same as a menu named "3 notes"; right-clicking another note lets the others go
- [ ] Add Tag… opens a box with the tags in use as suggestions (↑ ↓ and Enter choose one, Tab fills it in to nest under it); Add puts the tag on the last line if that's a line of tags, else on a line of its own at the end, in a LaTeX note as `% #tag`; notes that have it already, and locked notes, are left as they are; the notes keep their dates; a screen reader hears "Added #tag to 3 notes"
- [ ] ⌫ (Delete) with a row focused moves the picked notes, or the open one, to the Trash, and focus stays in the list; ⌘Z brings them all back at once, pinned as they were
- [ ] Changing the filter (a tag, Trash) or the search lets the picked notes go
- [ ] Trash shows "Notes in the trash can be restored." and Empty Trash; empty states read right

## 11. Sidebar, tags and search

- [ ] Above the sync button: "Alpha 0.1.0" (the version in package.json), with a tooltip saying it's an early version; the GitHub mark opens github.com/overtio/lines (in the browser, from the apps); screen readers hear the explanation and "Source on GitHub"
- [ ] Notes, Todo, Untagged and Trash filter the list, with counts
- [ ] Tags show as a tree with counts; the chevron expands nested tags; clicking filters to the tag and those under it
- [ ] Rename… renames a tag in every note (not inside code, not in locked notes), keeps its icon, and the filter follows
- [ ] Change Icon… works for tags, and Reset in its picker goes back to the hash; the menu has no separate Reset Icon
- [ ] Types list each `type:` with a count and icon (`person` starts as a person, an unknown type as shapes); clicking filters to its notes, and the list's title is the type
- [ ] Right-click a type → Rename… edits its name in place (Enter keeps it, Esc doesn't): every note of it gets the new `type`, every `@type.…` of it the new name (keeping its columns; not in code), the icon and the list's filter follow, and notes keep their dates; renaming onto another type merges them
- [ ] Right-click (long-press [Touch]) a type: Change Icon… (Reset in its picker goes back to the usual icon); the icon changes in the sidebar, on the type's notes in the list, and on mentions of them in an open note
- [ ] Search finds notes by their property values
- [ ] ⌘⇧F focuses search (leaving focus mode, or going back to the list on a phone); every word must match; Esc clears
- [ ] Locked notes are found only by their title

## 12. Menus, pickers and note info

- [ ] Menus open at the pointer, stay inside the window, move with ↑ ↓, and close on Esc, a click outside, scroll or resize
- [ ] The icon picker searches by name, Enter picks the first match, arrow keys move around the grid, and focus starts on the current icon
- [ ] Share: Share… where the system has it, Copy Markdown, Copy Plain Text, Download Markdown [Web]
- [ ] Note info shows words, characters, sentences, paragraphs, reading time and dates

## 13. Settings

- [ ] The tabs are Theme, Text, Plugins, Data, Shortcuts and About; Data has Sync, App lock, Locked notes, Synced notes (its Go to Sync button scrolls up to Sync and focuses it), Export and Sample notes
- [ ] ← and → move between tabs; Esc closes; every change applies at once, in every window
- [ ] Only the panel scrolls, with one scrollbar, in every tab (Shortcuts too, all the way to the end); the tabs stay put
- [ ] [Web] A click outside Settings closes it; a click inside, or selecting text and letting go outside, doesn't
- [ ] [Desktop] Settings opens in its own window (the sidebar's gear, the sync button, ⌘/): one at a time, brought forward if it's open, on the tab asked for; it can be moved (by the row of tabs on the Mac), resized and minimized; Esc, ⌘W or the window's close button closes it; closing the main window closes it too
- [ ] [Desktop] In the Settings window: themes and text settings change the main window and floating notes at once; connecting sync, setting up encryption, Sync Now and the sync status work as in the main window; the app lock turns on and off (Settings stays open, unlocked), Lock Now locks lines and closes Settings; locked notes' password, Touch ID and reset work; Add Feature Tour adds the notes to the main window's list and shows them there; Export saves every note
- [ ] [Desktop] With the app lock on, lines locking for being idle closes Settings; using Settings counts as using lines
- [ ] Shortcuts (also ⌘/ or Ctrl+/, even with the cursor in a note): every shortcut, grouped; shown the Mac way on a Mac (⌘⇧F, ⌃⌘L) and as Ctrl+Shift+F, Ctrl+Alt+L elsewhere, with the switch showing the other system's; new note is ⌘N (Ctrl+N) in the apps and ⌥N (Alt+N) on the web; Close a floating note only in the desktop apps; each shortcut listed does what it says; VoiceOver reads the keys in words ("Shift Command F")
- [ ] The tabs fit on one row in English, and wrap rather than being cut off in French and Spanish
- [ ] Theme → Language: English, Español, Français and System; choosing one saves what's being typed and starts lines again in it, in every window (floating notes too); System follows the device (English when lines doesn't speak it); dates follow it (24-hour clock in French)
- [ ] Theme: each of the 16 themes in light and dark; System follows the OS live
- [ ] Theme: the Accessibility group (High Contrast, Red-Green Friendly, Blue-Yellow Friendly) sits below the other themes with its heading and note; Tab stops once on the theme picker and the arrow keys move through every theme, across both groups
- [ ] High Contrast, light and dark: pure white or black, text black or white, borders clearly visible, the chosen segment ringed; a note with a callout of each kind, code, a tag, a mention, a highlight and a done todo reads clearly; the selected row's date stays readable
- [ ] Red-Green Friendly and Blue-Yellow Friendly, light and dark: the same note; callout kinds, danger (Delete, errors) and success are told apart, and look apart in Chrome DevTools → Rendering → Emulate vision deficiencies (protanopia and deuteranopia for Red-Green, tritanopia for Blue-Yellow)
- [ ] Icons: Lucide and SF Symbols [Mac]; on the web SF Symbols is disabled with a note
- [ ] [Mac] Main window opacity and blur
- [ ] [Desktop] Floating notes: theme, appearance, opacity, blur and border [Mac], window buttons, over full-screen apps [Mac]
- [ ] Text: the preview follows font, size, spacing presets and every slider; Reset to default
- [ ] Text → Symbols: turning off "in text" or "in code" shows the characters there at once (tables too), in every window, and is remembered; the other keeps its symbols
- [ ] About: version, Source on GitHub, Report an issue, license, credits, third-party licenses load

## 13a. Plugins

- [ ] Settings → Plugins lists Formats (Markdown, LaTeX), Drawing and Typesetting (Math, Diagrams, TeX Typesetting) and Look (Themes, Lucide, SF Symbols [Apple]), each with its icon and what it does; Markdown, Themes and Lucide say Always on; on the web SF Symbols has no checkbox, and says it's in the Mac and iPhone apps
- [ ] Clicking a plugin's row (not just its checkbox) turns it on or off; VoiceOver reads its name, whether it's on, and what it does
- [ ] LaTeX off: LaTeX notes show as plain text at once (the open one too), their titles in the list become their first line, TeX Typesetting dims and says it needs LaTeX, and a LaTeX note's ⓘ panel says its plugin is off, with Turn On (no format switch, with Markdown the only format left); Turn On draws it as LaTeX again at once
- [ ] With LaTeX off, Share → Copy LaTeX, Download LaTeX and Settings → Data → Export still write LaTeX notes as LaTeX (a .tex document that compiles)
- [ ] Turning TeX Typesetting on while LaTeX is off turns LaTeX on too
- [ ] Diagrams off: ```mermaid blocks show as code, `/diagram` is gone from the "/" menu, and the PDF prints them as code; on again, they're drawn again, and Diagram is right after Code block in the menu
- [ ] Math off: `$…$`, `$$` blocks and LaTeX notes' math show as written, on screen and in the PDF; on again, drawn
- [ ] TeX Typesetting off: a LaTeX note's PDF preview has no "Typeset with" switch
- [ ] Choices are remembered after reloading, and turning a plugin on or off in one window changes every window at once (the Settings window, floating notes [Desktop], other browser tabs [Web])

## 14. Sync

- [ ] [Desktop] Cloud drive: the drives on the machine are listed; Choose another folder…; Connect, Switch, Disconnect, Show in Finder
- [ ] [Web] [Chromium] Folder: Choose a Folder… saves notes there as Markdown files and keeps them up to date; after a browser restart, Allow access asks once and sync carries on
- [ ] [Web] Safari and Firefox explain that saving to a folder needs Chrome or Edge
- [ ] S3 bucket (not on the demo website): every provider's help, Test connection, Connect, Disconnect, the CORS rule [Web]
- [ ] Sync runs after edits, every minute, on focus and when back online; the sidebar shows its status
- [ ] An edit on two devices keeps the newer and adds a "(conflicted copy)"; a delete on one side deletes on the other
- [ ] Images and files sync both ways
- [ ] Folder sync keeps working offline; a bucket says Offline and catches up

## 15. Encryption

- [ ] Set up encryption: 8 characters minimum, matching passphrases; notes upload again encrypted
- [ ] Another device asks for the passphrase once, then syncs
- [ ] Change passphrase; turn off (and "Turn off here too" on the other device)

## 16. App lock

- [ ] Turn on with a passphrase; every window reloads encrypted
- [ ] Lock after 1, 5, 15 minutes, 1 hour, Never; locks after sleep too
- [ ] ⌃⌘L [Mac] (Ctrl+Alt+L elsewhere) and the sidebar lock button lock at once
- [ ] Lock screen: wrong passphrase shakes and clears; right one unlocks
- [ ] [Mac] Touch ID prompts on its own; cancelling falls back to the passphrase
- [ ] Forgot your passphrase? → Erase this device asks first, in the lock screen itself, then starts over (synced notes come back); Cancel backs out. [Mac] it works in the app too
- [ ] Change passphrase; turn off with the current one
- [ ] [Desktop] Floating notes show "lines is locked" and reopen after unlocking

## 17. Locked notes

- [ ] Lock Note the first time asks for a new password; after that for the password, or Touch ID [Mac]
- [ ] A locked note shows its title and a password field; a wrong password shakes; the right one opens every note locked with it, in every window
- [ ] A note locked with an older password says so
- [ ] Lock Now locks them everywhere; they lock again after 5 minutes idle
- [ ] Remove Lock; Change password (works on other devices once synced); Forgot password
- [ ] Locked notes stay out of tags, Todo, search (except titles) and export

## 18. Export and share

- [ ] Export makes a .zip of Markdown files named by title, attachments in their folder, Trash in its folder when included
- [ ] A LaTeX note exports as a .tex file wrapped in \documentclass … \end{document}, and compiles with pdflatex; [Web] the share menu says Copy LaTeX and Download LaTeX
- [ ] Closed locked notes are left out, and the panel says how many
- [ ] [Web] It downloads; [Desktop] it saves to Downloads and Show in Finder works

## 18a. PDF

- [ ] ⌘P (Ctrl+P), or Share → Preview as PDF, opens the PDF preview of the open note; ⌘P with no note open does nothing (the browser doesn't print the window)
- [ ] The pages are white with black text in every theme, light and dark; Paper switches between A4 and Letter and lays the pages out again, and the choice is remembered (Letter by default in the US and Canada)
- [ ] Markdown: headings, lists, todos (ticked ones greyed), quotes, tables (with alignment), callouts with their colors and icons, cards, highlighted code, Mermaid diagrams, math, images, files, tags, mentions (as their text), properties at the top, type tables; symbols (→, ≠) as the editor shows them, following Settings → Text
- [ ] No page cuts through a line of text, an image, math, a diagram or a table row; a heading isn't left alone at the bottom of a page; page numbers at the bottom
- [ ] LaTeX (lines): the paper example has its title block, abstract, numbered sections, theorems and equations, "Section 2" and "(1)" where it \ref's them, a numbered table, references and its footnote at the end; lines join into paragraphs
- [ ] Print… opens the print dialog showing the same pages, one per sheet, with nothing of the app; Save as PDF there names the file after the note
- [ ] [iOS] There's no Print… button
- [ ] Export as PDF… opens the preview and goes straight on to print (lines) or save (TeX)
- [ ] Save PNG (lines' pages) offers One Image (the whole note as one tall picture, no page numbers) and One per Page ("3 images, in a ZIP"; a one-page note saves a single PNG). [Web] It downloads "<title>.png" or "<title>.zip"; [Desktop] it saves to Downloads with Show in Finder. The images are twice the page's size, with bullets, numbers, callout icons, code colors, diagrams, math and images as on the pages
- [ ] Share → Export as PNG… opens the preview on lines' pages (a LaTeX note too, even with TeX chosen) with the PNG choices showing
- [ ] LaTeX (TeX): Typeset with → TeX downloads TeX the first time with a progress bar ("Downloading TeX… 40%"), then shows the PDF; the next note typesets in a second or two, offline too
- [ ] The paper example (booktabs), the lecture notes and the problem set all typeset with TeX
- [ ] A note with an error (`\undefined`) says "TeX stopped at line N of the note", with the error and TeX's log; Try Again typesets again
- [ ] Save PDF: [Web] downloads "<title>.pdf"; [Desktop] saves to Downloads, with Show in Finder
- [ ] A build without `pnpm tex-assets` says TeX isn't included in this version
- [ ] Esc or × closes the preview and focus goes back where it was; Tab stays inside it; a screen reader hears "2 pages, ready" and each page as "Page 1 of 2"

## 19. Floating notes [Desktop]

- [ ] Open in Floating Window from the toolbar or menu; it stays on top, shows the note's title, and edits appear everywhere at once
- [ ] Moving and resizing is remembered; open floating notes come back after relaunch
- [ ] ⌘W closes it; trashing the note closes it
- [ ] [Mac] Window buttons on hover or always, as set

## 20. Layout

- [ ] Wide (1000 px and up): three columns; ⌘\ hides and shows the sidebar
- [ ] Dragging the sidebar's right edge, or the note list's, makes it wider or narrower (an accent line shows on the edge); it stops at its narrowest and widest, leaves the note at least 360 px, and double-clicking the edge puts it back. The widths are remembered after a reload. Medium windows have just the list's edge; focus mode and phones have none
- [ ] Tab reaches each edge (named "Sidebar width" / "Note list width" with its width): ← and → resize by 10 px, ⇧ by 50, Home and End go to the narrowest and widest, Enter back to the usual width
- [ ] Medium (700–999 px): the sidebar is a drawer over the list
- [ ] Narrow (under 700 px): one pane at a time; Back returns to the list
- [ ] Focus mode (⇧⌘\ or the toolbar button) shows just the note; not on phones
- [ ] Trashed notes show Restore and Delete Forever instead of the toolbar
- [ ] [Mac] The window drags by its toolbars and starts without a flash
- [ ] Reduced motion in the OS settings stops the slides

## 21. Demo website

- [ ] A first visit opens the feature tour, with the picture and the file working
- [ ] Save to a folder at the bottom of the sidebar opens Sync with only the folder option
- [ ] Reloading keeps every change
- [ ] It works when served from a subfolder (GitHub Pages): icons, the manifest and third-party notices load

## 22. LaTeX notes

- [ ] The ⓘ panel switches a note between Markdown and LaTeX; the panel stays open, and the note redraws at once
- [ ] A new note switched to LaTeX loses its "# "; one made under a tag keeps it as `% #tag`
- [ ] In **QA · LaTeX note**, each construct draws as its heading says, and its LaTeX shows while the cursor is on it
- [ ] Clicking drawn math or a table shows its LaTeX; displayed math is redrawn below as you type
- [ ] Enter after `\item text` adds an `\item`; Enter on an empty item ends the list; Enter after an unclosed `\begin{itemize}` (or `\[`) adds its end
- [ ] ⌘B, ⌘I and ⌘E wrap the selection in `\textbf{}`, `\emph{}` and `\texttt{}`, and again take it out
- [ ] In a LaTeX note, pasting rows from a spreadsheet or pgAdmin makes a `tabular` (underscores escaped, numbers right-aligned, header over `\hline`); ⌘Z once gives the rows as copied
- [ ] In a LaTeX note, pasting or dropping an image adds `\includegraphics{../attachments/…}` and shows it; a PDF adds an `\href` link; `/image` and `/file` do the same; an Unsplash link on an empty line shows the photo; a URL over selected text becomes `\href{url}{text}`; none of these happen in verbatim or math
- [ ] `/` shows the LaTeX commands (Section, Bullet list, Math, Table…), and each inserts its LaTeX
- [ ] `\` opens the command menu in sections (Text, Environments); inside math, or after an unclosed `$`, it shows math commands instead; after `\\` and in verbatim it doesn't open
- [ ] An environment picked after text starts on a new line; Tab moves through `\begin{tabular}{ll}`'s places
- [ ] The list shows the title and excerpt without commands; `% #tag` tags the note; note info counts the words as they read
- [ ] A LaTeX note syncs to another device as LaTeX (`format: latex` in its file)
- [ ] Each of the LaTeX examples (Settings → Add LaTeX Examples) draws with no red math: the paper's preamble folds into its title and authors, clicking it shows the LaTeX; theorems are numbered (Lemma 1, Theorem 2), the proof ends with ∎, citations and references are chips, the bibliography is headed References
- [ ] [Dev] Settings → Data → Reset Notes to Defaults… asks in the panel (Delete and Reset, or Cancel), then leaves only the welcome note, the tour and the examples; it works in the Mac app; it's disabled while sync is on, and missing from release builds
- [ ] [Web] On the demo website (`pnpm build:site`), Data → Start Again → Reset Notes to Defaults… asks in the panel, then leaves only the tour and the examples (no separate welcome note) and opens the tour's first note; it's disabled while saving to a folder, saying to stop that first

## 23. Properties and mentions

- [ ] In **QA · Ada**, the properties are a column of keys and values with a line under them: the type with its icon, the list items under their key's value, the comment faint, the employer a chip; the `---` lines show only while the cursor is in the properties, and the values don't move when they do
- [ ] Hovering a value shows its copy button, which copies the value as it reads (a mention as its note's title)
- [ ] In **QA · Mentions**, each line reads as it says: chips for notes, values for `.key`, grey dashed text for what isn't found (with the reason on hover), and text for emails, `owner/repo@main`, `\@` and code; wiki links (`[[…]]`) as chips too, `[[…|her]]` reading "her", a missing one grey and dashed with Create on hover, and embeds (`![[…]]`) as text
- [ ] ⌘-click on a chip or a value opens its note (also in a floating note [Desktop], where it opens in the main window); a plain click puts the cursor in and shows the mention as written
- [ ] `@` and a letter opens a menu of notes, with icons and types; it filters as you type; Enter or Tab writes `@Name`, or `@[Two Words]` for a title with spaces
- [ ] After a mention, `.` opens a menu of its properties with their values (long ones end in …), and typing filters it; Enter right after the `.` closes it and starts a new line, while Tab, a click, or ↓ then Enter picks one
- [ ] `[[` opens the same menu at once; Enter or Tab writes `[[Title]]`, taking in a `]]` after the cursor rather than doubling it. `[[` in code, and `![[`, open nothing
- [ ] A lone `@` after text, and `@` in code, open nothing
- [ ] Hovering a mention of a note there isn't shows "No note called …" and Create; Create adds that note (with the property mentioned, empty) without leaving this one, the mention becomes a chip with no underline left behind, and the new note is first in the list
- [ ] Changing a mentioned note's title, icon, type or properties (in another window, or after switching notes) redraws the mention; renaming its title makes the mention grey
- [ ] A note mentioned by two titles that match: the one with a type wins; a trashed note isn't found
- [ ] In **QA · Mentions**, `@type.qa-person` on its own line is a table: a row per note of the type (titles as chips that open the note), columns for every property, the most used first; `@type.qa-person(fullname, email)` has just those two
- [ ] In a type table, hovering a header shows ×, which removes the column and rewrites the line; + at the end lists the type's other properties and adds one; clicking a header sorts by it, again the other way, again back by title
- [ ] New … under a type table makes a note of the type with the table's columns as empty properties and opens it, with the cursor on its title
- [ ] Clicking a type table's cells shows its line with the table below; editing the line redraws it; a table for a type with no notes says so
- [ ] `/type table` writes `@type.` and opens the menu of types (icons, counts); Enter or Tab picks one; within text `@type.qa-person` is a chip that ⌘-click turns into that type's list
- [ ] Changing a property of a note in a type table (in another window, or after switching notes) updates the table

## 24. Accessibility and languages

- [ ] With Contrast → Increased, Lighthouse's accessibility audit (Chrome DevTools) scores 100 on the main window, with Settings open, and in a note with a table, math and a callout, in a few themes light and dark (Lines, Solarized, Ayu, Everforest); on Standard, only contrast fails
- [ ] Contrast: System follows the device's Increase Contrast live; Increased darkens grey text, links, tags and borders in every theme, light and dark, and a selected row's date and count stay readable
- [ ] Keyboard only, from launch: reach the sidebar, list, note, toolbar, menus, Settings and every control in it with Tab; use each with Enter or Space; arrows move in lists, menus, tabs, segmented controls and the icon picker; Esc closes what's open and focus returns to what opened it; focus is always visible
- [ ] [Mac] VoiceOver (⌘F5): every button says what it does; the note list reads each note's title, pinned or locked, and date, then its excerpt after a pause; a note reads as its text; the rotor's Headings list a note's headings; list items say "bullet"; checkboxes say checked or not; a callout reads "Warning callout" … "End of warning callout" and properties "Properties" … "End of properties" (not colons and dashes); menus and dialogs are announced; "Copied" or a sync problem is spoken
- [ ] F6 and ⇧F6 move between the sidebar, the note list and the note; Enter on a note in the list opens it with the cursor in its text
- [ ] System text size or browser zoom at 200%: nothing overlaps or is cut off, and the note list and sidebar still work
- [ ] Reduced motion on (System Settings → Accessibility → Display): nothing slides or bounces
- [ ] [Windows] A contrast theme on (Settings → Accessibility → Contrast themes), or Chrome DevTools → Rendering → Emulate CSS media feature forced-colors: focus rings show; the open note's row, the current sidebar item, the chosen segment, theme and tab, and a focused menu item are marked in the system's highlight color; mentions and links are link-colored; tags, mentions and code are outlined; a ticked checkbox is filled; highlights show; a callout's or card's hidden `:::` lines stay hidden; the theme swatches keep their colors
- [ ] In Spanish and in French: every screen reads in that language, nothing is cut off (the sidebar's sync button, Settings' tabs, menu items), and plurals read right ("1 nota", "0 note")
- [ ] ⌥↵ with the cursor on a link opens it; on an attached file, opens the file; on a mention, its note (the main window shows it); on `@type.…`, that type's list; on a tag, its notes; on a mention of a note that isn't there, makes the note and says so
- [ ] Format toolbar: with text selected, Tab reaches the toolbar, ← → move between its buttons, Enter applies one, Esc goes back to the text
- [ ] A type table's column names sort from the keyboard (Enter), say which way they sort, and a row's title opens its note with Enter
- [ ] `pnpm i18n` reports every message translated in Spanish and French
