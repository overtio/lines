# Performance

lines should feel instant with a big library: a key shows on screen within two frames, a click is answered within 100 ms, and nothing stalls when thousands of notes change at once. `bun run bench` measures that, in the engines lines runs on, and fails when something takes longer than its budget.

## Running the benchmarks

```sh
bunx playwright install webkit chromium         # once
bun run bench                                  # both browsers, every scenario (about 10 minutes)
bun run bench --browser webkit --only typing   # one browser, the scenarios named so
bun run bench --notes 10000                    # a bigger library (5,000 notes by default)
```

It builds the app with its benchmark helpers (`vite build --mode bench`, into `dist-bench/`), serves it, and drives it headless in WebKit (Safari, and the Mac, iPhone and iPad apps' web views) and Chromium (Chrome, Edge, and the Windows, Linux and Android apps), at 1440 × 900 on a Retina-like screen. Each run is compared with the one before it on the same machine (the "vs last" column), so a change can be checked by running it before and after. The exit code is 1 when a budget is missed.

The helpers (`src/bench/harness.ts`) are only in that build: `src/main.ts` loads them when Vite's mode is `bench`, and every other build leaves them out.

## What's measured

The library is 5,000 everyday notes (a title, paragraphs, lists, todos, now and then a table or code; one in a hundred LaTeX, one in a hundred a small spreadsheet; one in twenty with properties, and one in twenty a book or film in the Library, rated), and six big ones, pinned: a typical note with a formula table, a rated book with scores in its text and a table of every book (`@type.book`, 250 rows of ratings drawn as marks), Markdown notes of 3,000 and 12,000 lines with every kind of block, a 3,000-line LaTeX note, and a 3,000-row spreadsheet. It's made by `src/bench/library.ts` from a seeded random, so every run has the same notes.

Everything is driven with real input (keys, clicks and the mouse wheel, as Playwright sends them to the browser), and timed inside the page from when the browser stamped the input to when the frame showing its result has been drawn. That includes waiting for the screen's next frame, as the person waits too: up to 16.7 ms, 8 on average. Keys are typed 60 ms apart (a fast typist), and arrow keys pressed 35 ms apart (a held key repeating).

| Scenario | What | Budget |
|---|---|---|
| Start | Reloading with the library: notes read from the database, and the list's first row shown | median ≤ 1 s |
| Open a note | Clicking a note in the list until its text is in the editor and drawn: a typical note, the rated book, 3,000 lines, 12,000 lines | median ≤ 100, 100, 200, 400 ms |
| Switch between notes | Clicking 20 everyday notes in turn | ≤ 100 ms |
| Typing | Each key in the typical, 3,000-line and 12,000-line notes, after their title, at the end of the rated book (under its table), and at the end of the 12,000-line one | ≤ 33, 33, 33, 50, 50 ms |
| Moving the cursor | ↓ and ↑ through the 3,000-line note | ≤ 33 ms |
| Scrolling | Scrolling the 3,000-line note with the mouse wheel: how long each frame took, and how many took over 50 ms | ≤ 20 ms; none |
| Searching | Each key typed in the list's search, over every note | ≤ 33 ms |
| Changing every note | ⌘A in the list, ⌫ to move them all to the Trash, ⌘Z to bring them back | ≤ 100, 200, 200 ms |
| Spreadsheet | Opening the 3,000-row spreadsheet; typing in a cell; changing it (Return), a note or a price the row's formula uses; undoing that; arrow keys | median ≤ 300 ms; ≤ 33 ms each |
| LaTeX | Opening the 3,000-line LaTeX note, typing, arrow keys | median ≤ 200 ms; ≤ 33, 33 ms |
| Memory (Chromium) | What scripts hold after loading, and the most after any scenario, once unused memory is collected | ≤ 150 MB, ≤ 300 MB |

Budgets are on the 95th percentile unless they say median, so an occasional slow key counts. Two frames (33 ms) is where typing stops feeling instant; 100 ms is where a click stops feeling immediate.

## Results

On a MacBook Pro (M1 Pro, macOS 27), headless, with Playwright 1.64 (WebKit 27.2, Chromium 156), on 2026-11-06 and 07: before the list drew only its visible rows and the editor, LaTeX notes and spreadsheets redrew only what changed, and after.

| ms, 5,000 notes | WebKit before | WebKit after | Chromium before | Chromium after |
|---|--:|--:|--:|--:|
| Start: list shown (median) | 1,450 | 154 | 1,057 | 169 |
| Open a typical note (median) | 234 | 27 | 64 | 22 |
| Open the 12,000-line note (median) | 227 | 23 | 63 | 20 |
| Switch notes (p95) | 1,835 | 46 | 115 | 33 |
| Typing, typical note (p95) | 155 | 13 | 26 | 22 |
| Typing, 12,000-line note (p95) | 1,958 | 13 | 26 | 23 |
| Arrow keys, 3,000-line note (p95) | 668 | 20 | 25 | 22 |
| Scrolling: frames over 50 ms | 8 | 0–1 | 1 | 0 |
| Search, each key (p95) | 1,871 | 28 | 308 | 21 |
| Select all 5,000 notes (⌘A) | 109,859 | 29 | 4,926 | 15 |
| Move them all to the Trash | 1,784 | 54 | 2,086 | 62 |
| Undo that | 3,470 | 66 | 990 | 34 |
| Open the 3,000-row spreadsheet (median) | 668 | 136 | 379 | 116 |
| …its first open (p95) | 1,608 | 307 | 1,451 | 199 |
| Arrow keys in it (p95) | 299 | 19 | 25 | 22 |
| LaTeX, typing (p95) | 261 | 15 | 34 | 23 |
| LaTeX, arrow keys (p95) | 496 | 20 | 28 | 23 |
| Script memory after loading |  |  | 287 MB | 24 MB |

Every measure is within its budget in Chromium. In WebKit, three can miss, now and then, and `bun run bench` shows them as known misses rather than failing: the first few keys after jumping to the end of the 12,000-line note (up to 100 ms, [#126](https://github.com/overtio/lines/issues/126)), and a key in the list's search that changes which rows are drawn, or a frame while scrolling when a spreadsheet block is first drawn (35–60 ms, [#133](https://github.com/overtio/lines/issues/133)).

Headless browsers aren't the Mac app's web view, and this isn't an iPhone: the numbers compare changes, and show where lines stands, rather than promise times on every device.

## Keeping it fast

What these benchmarks have taught, for code in lines:

- **Work per keystroke must not grow with the library.** The editor hands its text to the store 120 ms after typing pauses; whatever reacts to the store (the note list, counts, tags) runs then, and delays the next key if it's slow.
- **Change many notes in one go.** Changing a reactive collection item by item (a `SvelteSet`'s `add` in a loop) wakes everything that reads it each time: with 5,000 notes, 25 million wake-ups. Build the new set, then assign it once.
- **Draw what's on screen.** A list of thousands of rows, each a component, makes every change walk all of them. And WebKit pays for every element in the page on every frame, even ones nothing changed: with 5,000 note rows, each key in the editor took 100 ms or more, and neither `contain` nor `content-visibility` helped; drawing 60 rows brought it to 15. Long notes and spreadsheets draw only their visible part too.
- **Redraw only what a change touches.** A key or a cursor move changes a line or two of a note. What the editor draws within lines (styles, hidden markup) is drawn only for the part in view (a `ViewPlugin` over `view.viewport`). What changes the layout (tables, math and diagrams drawn as blocks) has to be known for the whole note, so it's kept in the editor's state, moved along with each change, and drawn again only for the top-level blocks a change or the cursor touched (`drawnBlocks` in `src/lib/editor/util.ts`). LaTeX notes are drawn the same way.
- **Read text once.** A parser rule that reads from each `$` to the end of its paragraph is quadratic: a 3,000-row sheet, read as one Markdown paragraph full of prices, took a second to open. Find what such a rule needs in one pass, and give each note its own language's parser from the start.
- **Load ahead what stalls the frame it arrives in.** KaTeX's script and fonts load once a note with math opens, not when the first formula scrolls into view: arriving mid-scroll, they cost WebKit a 60 ms frame. A stylesheet added later restyles the whole page, so KaTeX's comes with the app's.
- **Make costly things once.** `Intl` formatters, regular expressions and parsed notes are cached rather than rebuilt for each cell or keystroke. A spreadsheet's rows keep their identity while unchanged, so the formula engine, column widths and CSV skip them, and a change measures only the cells it touched.
- **Don't set state in effects**: derive it, or set it from an event handler. Components that do it in the same update can stop redrawing, with no error.

Profiling: `bun run dev`, then the browser's performance panel, or a CPU profile from Playwright (`context.newCDPSession(page)`, `Profiler.start` / `Profiler.stop`) against the dev server, where function names are kept.
