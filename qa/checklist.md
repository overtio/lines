# QA · Release checklist

Go through this before every release, on each platform you ship: the Mac app, the web app (Chrome and Safari), and a phone width (or the phone apps). Tick items as you go. If something's wrong, note it under the item.

:::i
Platforms in brackets: **[Mac]** Mac app only, **[Desktop]** desktop apps, **[Web]** web only, **[Touch]** phones and tablets, **[Chromium]** Chrome and Edge. Everything else applies everywhere. ⌘ is Ctrl and ⌥ is Alt on Windows and Linux.
:::

#qa/checklist

## 0. Setup

- [ ] Start from a fresh profile (a new browser profile, or Settings → Privacy → erase in the app), so first-launch behaviour can be checked
- [ ] A fresh start shows one note, **Welcome to lines** (the demo website: the feature tour instead), and everything in it renders
- [ ] Settings → Sync & Data → **Add QA Notes**: the QA notes are added, tagged qa, and the list switches to that tag
- [ ] Settings → Sync & Data → **Add Feature Tour**: the tour notes are added, with the picture and the CSV file working
- [ ] Look through every QA note (qa tag in the sidebar) in light and dark, and at phone width; each says what to check at the top

## 1. Typing and live Markdown

- [ ] Bold, italic, code, strikethrough and highlight shortcuts (⌘B, ⌘I, ⌘E, ⌘⇧X, ⌘⇧H) wrap the selection; again unwraps it; with no selection they insert a pair with the cursor between
- [ ] The shortcuts on several lines format each line, skipping list markers, headings and fence lines
- [ ] ⌘↵ turns a line into a todo, replaces a bullet or number with a todo, and ticks or unticks a todo; works on every selected line
- [ ] Enter in a list, todo or quote continues it; Enter on an empty item ends it
- [ ] Markdown of a line shows when the cursor is on it and hides when it leaves; with the editor unfocused everything is rendered
- [ ] Headings, links, autolinks, tags, quotes, rules, bullets (dot, ring, square by depth) and numbers render correctly
- [ ] Clicking a checkbox ticks it; not in a trashed note
- [ ] ⌘-click a link opens it (system browser in the apps, new tab on the web); only http, https, mailto and tel open
- [ ] [Touch] Tapping a link while the editor isn't focused opens it
- [ ] Pasting a URL over selected text makes a link
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
- [ ] `/info`, `/question`, `/warning`, `/error` and `/decision` insert callouts
- [ ] Clicking a callout's icon opens the picker; choosing an icon writes `icon=…` on the fence; No Icon writes `icon=none`; Reset removes it
- [ ] Choosing a kind's own icon leaves the fence without `icon=`
- [ ] A callout with no icon shows a faint + to add one while its fence is hovered or has the cursor
- [ ] The cursor and focus stay put when the icon is clicked; trashed notes don't open the picker

## 6. Code blocks and diagrams

- [ ] Languages highlight in the theme's colors, loading the first time they're used; unknown languages show plain
- [ ] The copy button copies the code without its fences
- [ ] The wand tidies JSON (long numbers keep every digit), SQL and Prettier languages, in one undo step
- [ ] A bad block shows "Couldn't format: …" for a few seconds; editing while it formats doesn't get overwritten
- [ ] A mermaid block draws as a diagram in the theme's colors; clicking it shows the code with the diagram below, redrawn as you type
- [ ] A broken diagram shows a short error; an empty one shows "Empty diagram"
- [ ] Changing theme, light/dark or font redraws diagrams
- [ ] `/code` and `/diagram` insert their templates

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
- [ ] Double-click (or ⌘-click) opens a file: in its app [Desktop], a new tab or download [Web], saved to Downloads or Documents [Touch]
- [ ] [Desktop] Scripts and apps attached as files are shown in Finder, not run
- [ ] Pictures from the web show; a broken one says it couldn't be shown

## 8. Lists, todos and moving

- [ ] Tab nests a list item with its sub-items under the one above; Tab on the first item does nothing
- [ ] ⇧Tab moves it back out; Backspace right after a marker moves it out, or turns it into text at the top level
- [ ] The Todo section lists notes with open todos; ticking the last one removes the note from it
- [ ] Hovering a line shows a grip on its left; it covers the line, a list item with its sub-items, or a whole heading, table, code block, quote or card
- [ ] In a callout the grip sits left of the icon column, not over the icon
- [ ] Clicking the grip selects the block; dragging it shows a drop line, scrolls near the edges, and moves the block
- [ ] Moved list items take the indent of where they land; tables and cards get blank lines around them
- [ ] [Touch] No grips

## 9. Slash commands

- [ ] `/` at the start of a line or after a space opens the menu, with Format and Insert sections; not in code or links
- [ ] Typing filters it (`/to` → Todo, `/checkbox` → Todo); no match closes it
- [ ] ↑, ↓, Enter and clicking choose; Esc closes
- [ ] Each command does what it says: Text, Heading 1–3, Todo, Bullet list, Numbered list, Quote, Code block, Diagram, Card, the five callouts, Table, Image, File, Divider, Link, Tag, Date
- [ ] Block commands replace a line's existing prefix rather than stacking; Divider under text adds a blank line so the text doesn't become a heading

## 10. Note list

- [ ] New note (⌘N in the apps, ⌥N on the web) starts with `# ` and the cursor in it; in a tag view the tag is added; from Trash it switches to Notes
- [ ] Leaving a new note untouched deletes it
- [ ] Rows show icon, title or "Untitled", excerpt, pin, lock and date; pinned first, then newest
- [ ] ↑ and ↓ move between notes when the list has focus
- [ ] [Touch] Swiping right pins (restores in Trash), left trashes (in Trash, needs a tap to delete); a long swipe does the action; one row open at a time
- [ ] [Desktop] Two-finger trackpad swipes do the same; Settings → Appearance → Trackpad reverses them
- [ ] Right-click (long-press [Touch], context-menu key, ⇧F10) opens the menu: Pin, Floating Window [Desktop], Icon, Lock items, Copy Text, Move to Trash / Delete Forever
- [ ] ⌘Z right after trashing a note brings it back
- [ ] Trash shows "Notes in the trash can be restored." and Empty Trash; empty states read right

## 11. Sidebar, tags and search

- [ ] Notes, Todo, Untagged and Trash filter the list, with counts
- [ ] Tags show as a tree with counts; the chevron expands nested tags; clicking filters to the tag and those under it
- [ ] Rename… renames a tag in every note (not inside code, not in locked notes), keeps its icon, and the filter follows
- [ ] Change Icon… and Reset Icon work for tags
- [ ] ⌘⇧F focuses search (leaving focus mode, or going back to the list on a phone); every word must match; Esc clears
- [ ] Locked notes are found only by their title

## 12. Menus, pickers and note info

- [ ] Menus open at the pointer, stay inside the window, move with ↑ ↓, and close on Esc, a click outside, scroll or resize
- [ ] The icon picker searches by name, Enter picks the first match, arrow keys move around the grid, and focus starts on the current icon
- [ ] Share: Share… where the system has it, Copy Markdown, Copy Plain Text, Download Markdown [Web]
- [ ] Note info shows words, characters, sentences, paragraphs, reading time and dates

## 13. Settings

- [ ] ← and → move between tabs; Esc closes; every change applies at once, in every window
- [ ] Appearance: each of the 13 themes in light and dark; System follows the OS live
- [ ] Icons: Lucide and SF Symbols [Mac]; on the web SF Symbols is disabled with a note
- [ ] [Mac] Main window opacity and blur
- [ ] [Desktop] Floating notes: theme, appearance, opacity, blur and border [Mac], window buttons, over full-screen apps [Mac]
- [ ] Text: the preview follows font, size, spacing presets and every slider; Reset to default
- [ ] About: version, Source on GitHub, Report an issue, license, credits, third-party licenses load

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
- [ ] Forgot your passphrase? → Erase this device asks first, then starts over (synced notes come back)
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
- [ ] Closed locked notes are left out, and the panel says how many
- [ ] [Web] It downloads; [Desktop] it saves to Downloads and Show in Finder works

## 19. Floating notes [Desktop]

- [ ] Open in Floating Window from the toolbar or menu; it stays on top, shows the note's title, and edits appear everywhere at once
- [ ] Moving and resizing is remembered; open floating notes come back after relaunch
- [ ] ⌘W closes it; trashing the note closes it
- [ ] [Mac] Window buttons on hover or always, as set

## 20. Layout

- [ ] Wide (1000 px and up): three columns; ⌘\ hides and shows the sidebar
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
