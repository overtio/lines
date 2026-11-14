#!/usr/bin/env node
/*
 * Benchmarks: how long lines takes to start, open notes, show typing, scroll, search and change
 * thousands of notes at once, in WebKit (Safari and the Apple apps) and Chromium (Chrome, Edge,
 * Windows, Linux and Android), headless. It builds the app with its benchmark helpers
 * (src/bench/), fills it with a library of notes, and drives it with real keys, clicks and scrolls.
 * docs/performance.md says what each one measures and why its budget is what it is.
 *
 *   bun run bench                      both browsers, everything
 *   bun run bench --browser webkit     one browser
 *   bun run bench --only typing,open   the scenarios whose names have these words
 *   bun run bench --notes 10000        a bigger library (5,000 by default)
 *   bun run bench --no-build           the last build again
 *   bun run bench --out dist-bench-2   build somewhere else (to run two at once)
 *
 * Fails (exit code 1) when a budget is missed. Each run is compared with the one before it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const browsers = option("browser", "webkit,chromium").split(",");
const only = option("only", "").split(",").filter(Boolean);
const count = Number(option("notes", "5000"));
const out = option("out", "dist-bench");
const LAST = `${root}node_modules/.cache/lines-bench/${out}.json`;

/*
 * Budgets are on the 95th percentile, unless they say median. A frame is 16.7 ms: a key shown
 * within two frames feels instant, and a click answered within 100 ms feels immediate.
 */
const SCENARIOS = [
  { id: "start", name: `Start with ${count.toLocaleString("en")} notes`, run: start },
  { id: "open", name: "Open a note", run: open },
  { id: "switch", name: "Switch between notes", run: switchNotes },
  { id: "typing", name: "Typing", run: typing },
  { id: "cursor", name: "Moving the cursor", run: cursor },
  { id: "scroll", name: "Scrolling a long note", run: scroll },
  { id: "search", name: "Searching notes", run: search },
  { id: "bulk", name: "Changing every note at once", run: bulk },
  { id: "sheet", name: "A 3,000-row spreadsheet", run: sheet },
  { id: "latex", name: "A 3,000-line LaTeX note", run: latex },
];

const KEYS = "The quick brown fox jumps over";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { n: sorted.length, median: at(0.5), p95: at(0.95), max: sorted.at(-1) };
}

/**
 * A measure: its samples, and the budget its 95th percentile (or median, or max) must keep within.
 * One that's `known` to miss (an open issue) is shown as missing, but doesn't fail the run.
 */
const measure = (name, samples, budget, on = "p95", unit = "ms", known) => ({ name, ...stats(samples), budget, on, unit, known });

const evaluate = (page, fn, arg) => page.evaluate(fn, arg);

/** Opens the note titled `title` from the list (another first, if it's open already); ms until it shows. */
async function openNote(page, title) {
  const id = await evaluate(page, (title) => window.bench.idOf(title), title);
  if (!id) throw new Error(`no note titled ${title}`);
  if (await evaluate(page, (id) => window.bench.isOpen(id), id)) await openRow(page, 8);
  return openId(page, id);
}

async function openId(page, id) {
  // The list draws only the rows near its view; the notes opened by name are pinned, at its top.
  await evaluate(page, (id) => document.querySelector(`.items [data-id="${id}"]`) || document.querySelector(".items").scrollTo({ top: 0 }), id);
  await page.locator(`.items [data-id="${id}"]`).first().click();
  return evaluate(page, (id) => window.bench.until(() => window.bench.shows(id)), id);
}

const openRow = async (page, n) => openId(page, await evaluate(page, (n) => window.bench.row(n), n));

/** Puts the cursor on a new line after the open note's title. */
async function cursorAfterTitle(page) {
  await page.locator(".editor-pane .cm-content").first().click({ position: { x: 40, y: 10 } });
  await page.keyboard.press("ControlOrMeta+Home");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await evaluate(page, () => window.bench.keys());
}

/** Puts the cursor on a new line at the open note's end. */
async function cursorAtEnd(page) {
  await page.locator(".editor-pane .cm-content").first().click({ position: { x: 40, y: 10 } });
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await evaluate(page, () => window.bench.keys());
}

/** Types `text` a key at a time, as quickly as a fast typist; how long each key took to show. */
async function typeAndTime(page, text, delay = 60) {
  for (const key of text) {
    await page.keyboard.type(key);
    await sleep(delay);
  }
  return evaluate(page, () => window.bench.keys());
}

/** Presses `key` `times` times, as quickly as a held key repeats. */
async function pressAndTime(page, key, times, delay = 35) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    await sleep(delay);
  }
  return evaluate(page, () => window.bench.keys());
}

const undo = async (page, times = 3) => {
  for (let i = 0; i < times; i++) await page.keyboard.press("ControlOrMeta+z");
};

// Scenarios. Each leaves the notes as it found them.

async function start(page) {
  const loaded = [];
  const listed = [];
  for (let i = 0; i < 5; i++) {
    await page.reload();
    await page.waitForFunction(() => window.bench?.startup().firstRow > 0 && window.bench.startup().loaded > 0, null, { timeout: 60_000 });
    const times = await evaluate(page, () => window.bench.startup());
    loaded.push(times.loaded);
    listed.push(times.firstRow);
  }
  return [measure("Notes loaded", loaded, 1000, "median"), measure("List shown", listed, 1000, "median")];
}

async function open(page) {
  const times = { typical: [], rated: [], long: [], huge: [] };
  for (let i = 0; i < 4; i++) {
    times.typical.push(await openNote(page, "Typical note"));
    times.rated.push(await openNote(page, "Rated note"));
    times.long.push(await openNote(page, "Long note 3000"));
    times.huge.push(await openNote(page, "Long note 12000"));
  }
  return [
    measure("Typical note", times.typical, 100, "median"),
    measure("A rated book with a table of 250", times.rated, 100, "median"),
    measure("3,000-line note", times.long, 200, "median"),
    measure("12,000-line note", times.huge, 400, "median"),
  ];
}

async function switchNotes(page) {
  const times = [];
  for (let n = 5; n < 25; n++) times.push(await openRow(page, n));
  return [measure("Everyday notes", times, 100)];
}

async function typing(page) {
  const results = [];
  for (const [title, label, budget] of [
    ["Typical note", "Typical note", 33],
    ["Rated note", "A rated book with a table of 250", 33],
    ["Long note 3000", "3,000-line note", 33],
    ["Long note 12000", "12,000-line note", 50],
  ]) {
    await openNote(page, title);
    // The rated book's first lines are its properties: typed into at its end, under its table, instead.
    await (title === "Rated note" ? cursorAtEnd(page) : cursorAfterTitle(page));
    results.push(measure(label, await typeAndTime(page, KEYS), budget));
    await undo(page);
  }
  // At the end of the longest note, once the editor has read its way there (docs/performance.md).
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.bench.parsed(), null, { timeout: 30_000 });
  await sleep(500);
  await evaluate(page, () => window.bench.keys());
  results.push(measure("12,000-line note, at its end", await typeAndTime(page, KEYS), 50, "p95", "ms", "#126"));
  await undo(page);
  return results;
}

async function cursor(page) {
  await openNote(page, "Long note 3000");
  await cursorAfterTitle(page);
  await undo(page, 1);
  const down = await pressAndTime(page, "ArrowDown", 80);
  const up = await pressAndTime(page, "ArrowUp", 40);
  return [measure("Arrow keys, 3,000-line note", [...down, ...up], 33)];
}

async function scroll(page) {
  await openNote(page, "Long note 3000");
  const box = await page.locator(".editor-pane .cm-scroller").first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await evaluate(page, () => window.bench.startFrames());
  for (let i = 0; i < 60; i++) {
    await page.mouse.wheel(0, 240);
    await sleep(16);
  }
  await sleep(300);
  const frames = (await evaluate(page, () => window.bench.stopFrames())).slice(1);
  return [measure("Frame length", frames, 20), measure("Frames over 50 ms", [frames.filter((f) => f > 50).length], 0, "max", "", "#133")];
}

async function search(page) {
  await page.locator('input[type="search"]').click();
  await evaluate(page, () => window.bench.keys());
  const times = await typeAndTime(page, "garden market", 120);
  await page.keyboard.press("Escape");
  return [measure("Each key typed", times, 33, "p95", "ms", "#133")];
}

async function bulk(page) {
  await openRow(page, 6);
  await page.locator(".items [data-id]").nth(6).focus();
  await page.keyboard.press("ControlOrMeta+a");
  const select = await evaluate(page, () => window.bench.until(() => document.querySelector('[role="toolbar"]')));
  await page.keyboard.press("Backspace");
  const trash = await evaluate(page, () => window.bench.until(() => window.bench.listed() < 10 && document.querySelectorAll(".items [data-id]").length < 10));
  await page.keyboard.press("ControlOrMeta+z");
  const restore = await evaluate(page, () => window.bench.until(() => window.bench.listed() > 1000 && document.querySelectorAll(".items [data-id]").length > 5));
  await page.keyboard.press("Escape");
  return [measure("Select all", [select], 100, "max"), measure("Move all to the Trash", [trash], 200, "max"), measure("Undo", [restore], 200, "max")];
}

async function sheet(page) {
  const opened = [];
  for (let i = 0; i < 3; i++) opened.push(await openNote(page, "Big sheet 3000"));
  const cell = (column) => page.locator('.editor-pane [role="gridcell"][data-row="4"]').nth(column);
  const typed = [];
  const changed = [];
  const undone = [];
  // A note's text (column F), then a price the row's total uses (column C), each changed and undone.
  for (const [column, text] of [[5, "quick"], [2, "12"], [5, "brown"], [2, "34"]]) {
    await cell(column).click();
    await evaluate(page, () => window.bench.keys());
    typed.push(...(await typeAndTime(page, text)));
    changed.push(...(await pressAndTime(page, "Enter", 1, 200)));
    undone.push(...(await pressAndTime(page, "ControlOrMeta+z", 1, 200)));
  }
  const moved = await pressAndTime(page, "ArrowDown", 60);
  return [
    measure("Open", opened, 300, "median"),
    measure("Typing in a cell", typed, 33),
    measure("Changing a cell (Return)", changed, 33),
    measure("Undoing it", undone, 33),
    measure("Arrow keys", moved, 33),
  ];
}

async function latex(page) {
  const opened = [];
  for (let i = 0; i < 3; i++) opened.push(await openNote(page, "Long LaTeX 3000"));
  await cursorAfterTitle(page);
  const typed = await typeAndTime(page, KEYS);
  await undo(page);
  const moved = await pressAndTime(page, "ArrowDown", 60);
  return [measure("Open", opened, 200, "median"), measure("Typing", typed, 33), measure("Arrow keys", moved, 33)];
}

// The run.

async function runBrowser(name, url) {
  const playwright = await import("playwright");
  const browser = await playwright[name].launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Chromium says how much memory scripts hold, after collecting what's no longer used.
  const cdp = name === "chromium" ? await context.newCDPSession(page) : null;
  const heap = async () => {
    if (!cdp) return null;
    await cdp.send("HeapProfiler.collectGarbage");
    return (await cdp.send("Runtime.getHeapUsage")).usedSize / 1_048_576;
  };

  await page.goto(url);
  await page.waitForFunction(() => window.bench && document.querySelector("[data-id]"), null, { timeout: 60_000 });
  const total = await evaluate(page, (count) => window.bench.seed(count), count);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll(".items [data-id]").length > 5, null, { timeout: 60_000 });
  process.stdout.write(`\n${name}: ${total.toLocaleString("en")} notes\n`);
  const heaps = [await heap()];

  const results = [];
  for (const scenario of SCENARIOS) {
    if (only.length && !only.some((word) => scenario.id.includes(word))) continue;
    process.stdout.write(`  ${scenario.name}…`);
    try {
      for (const result of await scenario.run(page)) results.push({ scenario: scenario.name, ...result });
      process.stdout.write(" done\n");
    } catch (error) {
      process.stdout.write(` failed: ${error.message.split("\n")[0]}\n`);
      results.push({ scenario: scenario.name, name: "(failed)", error: error.message });
    }
    heaps.push(await heap());
  }
  if (cdp) {
    results.push({ scenario: "Memory", ...measure("Scripts, after loading", [heaps[0]], 150, "max", "MB") });
    results.push({ scenario: "Memory", ...measure("Scripts, most after a scenario", [Math.max(...heaps)], 300, "max", "MB") });
  }
  if (errors.length) results.push({ scenario: "Errors", name: errors.join("; "), error: "page errors" });
  await browser.close();
  return results;
}

function report(all, previous) {
  const pad = (text, n) => String(text).padEnd(n);
  const num = (v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1));
  let failed = 0;
  for (const [browser, results] of Object.entries(all)) {
    console.log(`\n${browser}`);
    console.log(`  ${pad("", 44)}${pad("median", 9)}${pad("p95", 9)}${pad("budget", 16)}  vs last`);
    let scenario = "";
    for (const r of results) {
      if (r.scenario !== scenario) console.log(`  ${(scenario = r.scenario)}`);
      if (r.error) {
        failed++;
        console.log(`    ✗ ${r.name}: ${r.error.split("\n")[0]}`);
        continue;
      }
      const value = r[r.on];
      const ok = value <= r.budget;
      if (!ok && !r.known) failed++;
      const before = previous?.[browser]?.find((p) => p.scenario === r.scenario && p.name === r.name);
      const change = before?.[r.on] > 0 ? `${value >= before[r.on] ? "+" : ""}${Math.round(((value - before[r.on]) / before[r.on]) * 100)}%` : "";
      const budget = `${r.on === "p95" ? "" : `${r.on} `}≤ ${r.budget}${r.unit ? ` ${r.unit}` : ""}`;
      console.log(`  ${ok ? "✓" : "✗"} ${pad(r.name, 42)}${pad(num(r.median), 9)}${pad(r.n > 1 ? num(r.p95) : "", 9)}${pad(budget, 16)}  ${change}${!ok && r.known ? ` (known: ${r.known})` : ""}`);
    }
  }
  return failed;
}

if (!args.includes("--no-build") || !existsSync(`${root}${out}`)) {
  console.log("Building the app with its benchmark helpers…");
  await build({ root, mode: "bench", logLevel: "error", build: { outDir: out, emptyOutDir: true } });
}
// A port of its own on 127.0.0.1, as the browser tests' (tests/browser/setup.ts): "localhost" can be IPv6, where another worktree's bench may be.
const server = await preview({ root, mode: "bench", logLevel: "warn", build: { outDir: out }, preview: { host: "127.0.0.1", port: 0, open: false } });
const url = server.resolvedUrls.local[0];

const all = {};
try {
  for (const name of browsers) all[name] = await runBrowser(name, url);
} finally {
  await new Promise((resolve) => server.httpServer.close(resolve));
}

const previous = existsSync(LAST) ? JSON.parse(readFileSync(LAST, "utf8")) : null;
const failed = report(all, previous);
mkdirSync(dirname(LAST), { recursive: true });
writeFileSync(LAST, JSON.stringify(all, null, 2));
console.log(failed ? `\n${failed} over budget.` : "\nAll within budget.");
process.exit(failed ? 1 : 0);
