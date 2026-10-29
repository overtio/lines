# Code audit — 2026-10-29

Findings from a review of the whole repo. Each was checked against the code. Fixed items are ticked; items left open say why. Checked with `pnpm check` (now also type-checks the Vite config and flags unused code), `cargo clippy`, `cargo test`, and browser tests of the changed behaviour.

## P0 — data loss

- [x] **S1** Switching sync target while a pass is queued: the queued pass runs with the old config after `configure()` cleared the records, then the new pass sees every note as "deleted elsewhere" and removes it locally. `sync/engine.svelte.ts` `configure`, `syncNow`.
- [x] **S2** A missing sync folder (drive signed out, folder moved) is silently recreated empty by `sync_folder_list` (`create_dir_all`), so every synced note looks deleted on the other side and is removed. Same for an S3 200 response that isn't a `ListBucketResult`. Needs: don't create the root, check the XML root, and a mass-deletion guard in the engine.
- [x] **S3** A failed pass leaves its other `pool` workers running, so the next pass overlaps it (duplicate conflict copies, racing record writes). `engine.svelte.ts` `pool`.
- [x] **E1** Typing in the last 120 ms before a remote/other-window change is discarded: `replaceDoc` overwrites the doc and `store.reload` only checks the store's pending saves, not the editor's unsynced typing. `Editor.svelte`, `notes/store.svelte.ts` `reload`.
- [x] **N1** IndexedDB `put`/`delete` resolve on request success, not on transaction commit, so `flush()` on window close can report saved before it is. `notes/storage.ts`.
- [x] **S4** iCloud placeholders (`.x.md.icloud`) are left out of the listing, so on macOS < 14 an evicted note is deleted locally and comes back later. `folder_sync.rs`.

## P1 — bugs

- [x] **E2** Format toolbar throws when the selection start is off-screen (⌘A at the bottom of a long note): `coordsAtPos(...)!` is null. `editor/formatting.ts`.
- [x] **E3** A stray `/` after a space opens the slash menu with "Text" preselected; Enter then strips the line's list/quote marker instead of inserting a newline. `editor/slashCommands.ts`.
- [x] **E4** Typing `:` over any selection wraps the whole line in a card, even for a selection inside one line. `editor/fences.ts`.
- [x] **E5** ⌘↩ (toggle todo) also toggles the next line when a selection ends at a line start, ignores read-only, and stacks markers (`1. x` → `- [ ] 1. x`). `editor/setup.ts`.
- [x] **E6** Tab / Shift-Tab in a quoted list indents before the `>`, which changes nothing. `editor/lists.ts`.
- [x] **E7** Clicking an image or a divider doesn't place the cursor (widgets ignore the event). `editor/livePreview.ts`.
- [x] **E8** Astral characters in tags (`#𠮷`) are a tag in the note list but not in the editor. `editor/syntax.ts`.
- [x] **E10** Backspace on an empty list item takes three presses: the marker first turns into invisible indentation, then the indentation goes, then the line. `editor/lists.ts`.
- [x] **E9** Format button appears on any language-less block starting with `[`/`{` (e.g. `[INFO]` logs) and always fails; also shown in read-only notes. `editor/formatCode.ts`.
- [x] **N2** Tags are found in link anchors (`[x](#setup)` → tag `setup`) and after an unclosed fence. `notes/parse.ts`.
- [x] **N3** `#a//b` and `#/x` create nameless nodes in the tag tree; `normalizeTag` only strips trailing slashes. `notes/parse.ts`.
- [x] **N4** "New note" inside a tag view starts with `#tag`, which `isBlank` doesn't count as blank, so an untouched new note is never cleaned up. `notes/store.svelte.ts`.
- [x] **N5** Startup hangs with no message if loading notes or `localStorage` throws. `notes/store.svelte.ts`.
- [x] **N6** Renaming a tag onto/into one with an icon loses or overwrites icons. `notes/tagIcons.svelte.ts`.
- [x] **U1** Narrow layout: the off-screen pane (list or editor) is still focusable; Tab into it scrolls the app sideways. `App.svelte`.
- [x] **U2** ⌘⇧F in focus mode deselects the note and focuses a hidden search field. `App.svelte`.
- [x] **U3** Closing a context menu / icon picker / info popover drops keyboard focus to `<body>`. `ContextMenu.svelte`, `IconPicker.svelte`, `NoteInfo.svelte`.
- [x] **U4** "Today/Yesterday" labels go stale overnight, while every row re-formats its date on every store change. `NoteList.svelte`.
- [x] **U5** `longPress` leaks a timer on a second touch, which can still open the menu. `longPress.ts`.
- [x] **U6** Nested tag expansion is forgotten when a parent collapses. `TagTree.svelte`.
- [x] **U7** Popovers aren't clamped to the viewport; the icon picker overflows a phone screen. `popover.ts`.
- [x] **U8** Info/Share toggle relies on a 400 ms timer; a long press on the button closes and reopens it. `App.svelte`.
- [x] **P1** Prefs: `appearance` and `font` aren't validated on load, unknown keys are kept, and every window saves + announces on startup (making the others reload). `prefs.svelte.ts`.
- [x] **F1** Floating note that fails to open stays marked open and is retried every launch. `windows/floating.ts`.
- [x] **R1** Export picks a free file name, then writes with truncation (check-then-write race). `src-tauri/src/export.rs`.
- [x] **Y1** Sync forms: Disconnect and "Choose folder…" have no error handling or busy state; whitespace-only fields enable Connect. `BucketSyncForm.svelte`, `FolderSyncForm.svelte`.

## P2 — smoothness and performance

- [x] **PF1** Dragging a slider in Settings writes localStorage, IPCs to every window (which re-reads all prefs) and calls `set_window_effects` on every tick. `prefs.svelte.ts`.
- [x] **PF2** Every keystroke turns the whole doc into a string that is thrown away. `editor/setup.ts`.
- [x] **PF3** Copy buttons in code blocks and key-value lines are destroyed and remounted on every keystroke (flicker, lost hover). `livePreview.ts`, `keyValue.ts`.
- [x] **PF4** Mermaid: `themeConfig()` forces ~26 style recalcs on every draw, the whole tree is walked on every selection change, `heights` grows forever, and diagrams are parsed twice. `editor/mermaid.ts`.
- [x] **PF5** Tables: every table's model is rebuilt on every keystroke and cursor move, then thrown away by `eq`. `editor/tables.ts`.
- [x] **PF6** Drag handle: `column()` forces layout on every pointermove/autoscroll frame; a doc change mid-drag moves the wrong lines. `editor/dragBlocks.ts`.
- [x] **PF7** "Connect" waits for the whole first sync before the dialog closes. `engine.svelte.ts`.
- [x] **PF8** Empty Trash is O(n²): one filter, notify, sync and announce per note. `notes/store.svelte.ts`.
- [x] **PF9** Blocking file I/O on the async runtime in folder-sync commands and on the main thread in `save_export`. `src-tauri/src/*.rs`.
- [x] **PF11** Swiping a row resized both action buttons on every frame (layout each move), and trackpad swipes eased 110 ms behind the fingers, restarting on every wheel event. Actions now move with transforms and the row follows the trackpad exactly. `NoteRow.svelte`.
- [ ] **PF10** *(left as is: one delegated listener would still have to be non-passive to stop sideways swipes scrolling, so scrolling wouldn't get faster)* Each note row adds its own non-passive wheel listener. `NoteRow.svelte`.
- [x] **J1** Switching notes always scrolls to the top while restoring the old cursor, so the next keystroke jumps. `Editor.svelte`.
- [x] **J2** The note list title jumps when the sidebar toggles (button has an `in` but no `out` transition); two "Show sidebar" buttons can show at once. `NoteList.svelte`, `App.svelte`.
- [x] **J3** Switching Settings tabs or sync provider throws away a half-filled bucket form and rescans drives. `SyncPanel.svelte`.
- [x] **J4** Hover states stick after a tap on touch screens; reduced motion only zeroes transitions, not animations. `app.css` and components.

## P3 — design consistency

- [x] **D1** White text on light accents (Ayu, Nord, Catppuccin, Tokyo Night dark) and on the orange Pin swipe action has poor contrast; needs an `--on-accent` token. `Settings.svelte`, `editor.css`, `NoteRow.svelte`.
- [x] **D2** Three popovers re-implement the same shell with drifting radii and three identical keyframes. `ContextMenu`, `IconPicker`, `NoteInfo`.
- [x] **D3** The segmented control is copy-pasted ~10 times (and re-implemented in `BucketSyncForm` with different sizes), with no arrow-key support. Settings panels.
- [x] **D4** `.spin` is defined in `SyncPanel` but used by `Sidebar`; it only works because both are bundled. Move to `app.css`.
- [x] **D5** Panels disagree on note text size, disabled opacity, error display and checkbox styling. Settings panels.
- [x] **D6** Search matches use the same colour as `==highlight==`; dead `.cm-selectionBackground` styles. `editor/setup.ts`.
- [x] **D7** Mermaid hard-codes `#ffd60a` and `15px` instead of theme variables. `editor/mermaid.ts`.

## P4 — code quality

- [x] **C1** The "walk up to an ancestor node" loop is written 8 times across the editor. Extract one helper.
- [x] **C2** Long-press and keyboard context-menu positioning are copied between `NoteRow`, `TagTree` and `longPress.ts`.
- [x] **C3** Duplicated helpers: `nonBlank` (cards/fences), coarse-pointer query (livePreview/formatting), mounted-icon WeakMap (keyValue/formatCode), two Markdown-to-plain-text strippers (parse/stats).
- [x] **C4** `focused` lives in `tables.ts` but is used by mermaid too.
- [x] **C5** Misplaced or stale comments (`BucketSyncForm`, `FolderSyncForm`, `stats.ts`, `FloatingNote.svelte`, `folder_sync.rs` safety claim) and a few that only restate the code.
- [x] **C6** Clippy: two collapsible `if`s. `folder_sync.rs`, `lib.rs`.
- [x] **C7** `tsconfig.json` mixes Node types and `vite.config.ts` into the browser project.
- [x] **C8** `ui.sidebarOpen` repeats the 1000px breakpoint; `AppearancePanel` has a redundant `sfSymbolsAvailable || isApple`.

## Dependencies

- [x] **V1** `window-vibrancy` 0.6 → 0.8, `@lucide/svelte` 1.62 → 1.63. Everything else is current. Tauri 3 and TypeScript 7 are not adopted: Tauri 3 is alpha, and svelte-check doesn't run on TypeScript 7's native compiler yet.

## Notes on the fixes

- **Sync** now refuses to act on a remote that lists no notes while this device has synced some ("nothing was changed here"); reconnecting clears that. Connecting closes the dialog at once and the first pass shows in the status row.
- **D1** adds `--on-accent` (white on light themes, the background on dark ones, dark text on Everforest and Ayu light). The orange Pin and green Restore swipe actions keep white text, as in Mail.
- **C3** leaves the mounted-icon map in `formatCode.ts` and `keyValue.ts` as two small copies, and the drag handle's 18×24 size in both CSS and JS.
- **D3** adds `Segmented.svelte` (one tab stop, arrow keys move the choice) and Settings tabs now follow the tab pattern (arrow keys, `aria-controls`). The cloud drive list keeps its own markup.
- New shared pieces: `editor/util.ts` (`ancestors`, `hasText`, focus tracking, `isEditing`), `popover.ts` (`menuPoint`, `takeFocus`, clamped `placeAt`, `dismissable` with an anchor), and in `app.css` the `.popover`, `.spin` and `.text-button.flush` classes and `--ease-sheet`, `--ease-pop`, `--on-accent`, `--disabled-opacity` and `--highlight-base` tokens.

## Not fixed here (needs a decision)

The first three are on the roadmap in `README.md`.

- **Keychain for S3 secrets.** The secret key is in `localStorage` in plain text. Moving it to the macOS keychain needs a new native dependency and a migration; worth doing before a public release.
- **Conditional S3 writes** (`If-Match` on PUT/DELETE) to close the window where another device's upload lands between our list and our put. Needs testing against each provider (R2, B2, MinIO).
- **Narrowing native permissions**: the HTTP plugin may reach any `https://` URL and folder commands accept any absolute path. Tightening means keeping the chosen folder and endpoint on the Rust side.
- **Unsafe pointer in `window_style.rs` `set_buttons`**: works today, but should use the same clone-the-window pattern as the other functions.
