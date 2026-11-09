#!/usr/bin/env node
/*
 * Pictures of lines for a person to look over before a release: each of its looks and the things
 * it draws, light and dark, at a desktop's width and a phone's, with what to look for beside each.
 * It builds the app with the tests' helpers (src/test/), serves it, and takes them headless, into
 * qa/shots/ with a page to see them on (qa/shots/index.html). qa/README.md says when to use it.
 *
 *   bun run qa-shots                     Chromium, everything
 *   bun run qa-shots --browser webkit    WebKit (Safari, and the Apple apps' web view)
 *   bun run qa-shots --only paper,typing the scenes whose names have these words
 *   bun run qa-shots --no-build          the last build again
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build, preview } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const engine = option("browser", "chromium");
const only = option("only", "").split(",").filter(Boolean);
const out = `${root}qa/shots/`;
const outDir = "dist-test";

const PROSE = `# A day's notes

Writing is easier when the page is **calm**, the words are *clear*, and nothing gets in the way.

## What to do

- Plan the week, with a [link](https://example.com) and \`code\`
- [ ] Call the bank
- [x] Water the plants

> A quote, to see how it sits on the page.

The last paragraph runs long enough to wrap onto a second line, so its rows show under each line.`;

const CODE = `# Code notes
# #tour

def greet(name: str) -> str:
    """Say hello."""
    return f"Hello, {name}"

for person in ["Ada", "Grace", "Alan"]:
    print(greet(person))
`;

/*
 * Each scene: a note (and its format), Settings to start with, what to open, what to photograph,
 * and what a person should see in it. `schemes` defaults to light and dark.
 */
const SCENES = [
  { id: "paper-lines", title: "Paper: ruled lines", look: "Every line of text, wrapped lines and headings too, sits on a rule; the rules end at the text's width; none under code.", prefs: { paperPattern: "lines" }, note: PROSE },
  { id: "paper-graph", title: "Paper: graph paper following the text", look: "A row of cells for each line, columns unbroken down the note, faint enough to read over.", prefs: { paperPattern: "graph" }, note: PROSE },
  { id: "paper-texture", title: "Paper: linen texture", look: "A soft texture under the text, in light and dark, never stronger than the text.", prefs: { paperTexture: "linen" }, note: PROSE },
  { id: "backdrop-pages", title: "Backdrop, with a page break", look: "Two pages over the gradient, a gap between them where the break is; the toolbar frosted; the line before the break looks as any line.", prefs: { paperBackdrop: "dawn" }, note: `${PROSE}\n\n<!-- pagebreak -->\n\n## The second page\n\nIt starts on a page of its own.` },
  { id: "backdrop-nothing-open", title: "A backdrop with no note open", look: "Select a note, or start a new one, and the New Note button on a page of their own over the picture, readable.", prefs: { paperBackdrop: "dawn" } },
  { id: "page-break", title: "A page break, without a backdrop", look: "A dashed line named Page break, with room around it; the line above it in the text's own color and size.", note: "The first page ends here.\n<!-- pagebreak -->\nThe second page starts here." },
  { id: "code-note", title: "A code note", look: "Line numbers beside each line, a fixed-width font, highlighting in the theme's colors.", note: CODE, format: "code-python" },
  { id: "code-note-backdrop", title: "A code note over a backdrop", look: "The page holds the line numbers, each exactly beside its line, with even room on both sides.", prefs: { paperBackdrop: "dawn" }, note: CODE, format: "code-python" },
  {
    id: "line-marks",
    title: "Marks in the margin, and Changes",
    look: "Colored bars beside the marked lines, runs joined into one; the comments hidden; Changes' lane outside them, after an edit.",
    prefs: { plugins: { changes: true } },
    note: "Ready to send <!-- mark green: ready -->\nStill checking <!-- mark yellow: check -->\nAnd this one <!-- mark yellow: check -->\nNeeds work <!-- mark red: fix -->\nA plain line",
    act: async (page) => {
      await page.evaluate(() => window.testing.place());
      await page.keyboard.type(" (edited)");
      await page.evaluate(() => window.testing.editor().contentDOM.blur());
    },
  },
  ...["source", "visible", "live", "hidden"].map((mode) => ({
    id: `markdown-${mode}`,
    title: `Show Markdown: ${mode[0].toUpperCase()}${mode.slice(1)}`,
    look: { source: "The Markdown exactly as written, no styling.", visible: "Styled text with every mark still in sight.", live: "Marks only on the line the cursor's in (the heading).", hidden: "No marks anywhere, the cursor's line too." }[mode],
    prefs: { markdownMode: mode },
    note: PROSE,
    act: (page) => page.evaluate(() => window.testing.place(4)),
    schemes: ["light"],
  })),
  ...["ink", "indigo", "plum", "moss", "amber", "mono"].map((theme) => ({ id: `theme-${theme}`, title: `Theme: ${theme[0].toUpperCase()}${theme.slice(1)}`, look: "Text, links, tags and the chosen row read clearly; the accent stands out but isn't loud.", prefs: { theme }, note: PROSE })),
  ...["classic", "pixel", "neon"].map((style) => ({
    id: `style-${style}`,
    title: `Style: ${style[0].toUpperCase()}${style.slice(1)}`,
    look: { classic: "Bevels lit from the top left, the title bar's gradient, white text on its light end still readable.", pixel: "2px lines, square corners, what's chosen turned around, the pixel font without broken letters.", neon: "Glowing headings and lines, the grid behind the note, scan lines faint." }[style],
    prefs: { style, theme: style },
    note: PROSE,
  })),
  {
    id: "style-classic-settings",
    title: "Classic, in Settings",
    look: "Raised buttons and sunken fields; a red Delete-like button readable; switches and sliders square.",
    prefs: { style: "classic", theme: "classic" },
    settings: "Theme",
    shoot: "dialog",
  },
  { id: "style-pixel-settings", title: "Pixel, in Settings", look: "Each switch's knob all the way across when it's on; the chosen segment turned around.", prefs: { style: "pixel", theme: "pixel" }, settings: "Editor", shoot: "dialog" },
  ...["sidebar", "list", "both"].map((panes) => ({
    id: `dark-panes-${panes}`,
    title: `Dark panes: ${panes}`,
    look: "The dark panes' text, counts, search field, chosen row and scroll bars all readable; the note light; the divider between them clean.",
    prefs: { darkPanes: panes },
    note: PROSE,
    schemes: ["light"],
  })),
  { id: "dark-panes-pixel", title: "Dark panes in Pixel", look: "Pixel's 2px lines light in the dark panes, dark in the note.", prefs: { darkPanes: "both", style: "pixel", theme: "pixel" }, note: PROSE, schemes: ["light"] },
  { id: "folder-links", title: "Links to a folder and a file on the computer", look: "A folder's icon before Projects and a file's before the plan, in the link's color, lined up with the text.", note: "Work is in [Projects](file:///Users/me/My%20Projects/), and [the plan](file:///Users/me/plan.pdf) says what's next.\n\nEnd", act: (page) => page.evaluate(() => window.testing.place()), shoot: ".editor-pane" },
  { id: "heading-accent", title: "Headings in the accent", look: "Every heading in the accent; h6 not muted.", prefs: { headingColor: "accent" }, note: "# Heading one\n\n## Heading two\n\n### Heading three\n\nText under them." },
  ...["block", "underline", "thick"].map((shape) => ({
    id: `cursor-${shape}`,
    title: `Text cursor: ${shape}`,
    look: "The cursor where the next character goes, as wide as the character for a block or underline, in the accent.",
    prefs: { caretShape: shape, caretBlink: "off" },
    note: "Where the cursor sits: here",
    act: (page) => page.evaluate(() => window.testing.place(20)),
    shoot: ".editor-pane",
  })),
  ...["cat", "alien", "slime", "girl"].map((mascot) => ({
    id: `mascot-${mascot}`,
    title: `Mascot: ${mascot}`,
    look: "Crisp pixel art at the bottom of the note, in the accent where it has one; never over the text.",
    prefs: { mascot },
    note: PROSE,
    wait: 1200,
    shoot: ".editor-pane",
  })),
  {
    id: "typing-going",
    title: "Typing practice, going",
    look: "Typed text in the text's color, mistakes in red with a tint, the cursor before the next character, the speed and time above.",
    note: "Practice\n\n```typing\nSphinx of black quartz, judge my vow! The five boxing wizards jump quickly.\n```\n",
    act: async (page) => {
      await page.evaluate(() => window.testing.place());
      await page.keyboard.press("ArrowUp");
      await page.keyboard.type("Sphinx of blsck quartz, judge", { delay: 80 });
    },
    shoot: ".cm-lp-editable",
  },
  {
    id: "typing-done",
    title: "Typing practice, done",
    look: "Words a minute large, accuracy, time, mistakes, the keys missed most as keys, and A new best with a trophy; Again on the right.",
    note: "Practice\n\n```typing\nSphinx of black quartz.\n```\n",
    act: async (page) => {
      await page.evaluate(() => window.testing.place());
      await page.keyboard.press("ArrowUp");
      await page.keyboard.type("Sphinx of blsck quartz.", { delay: 60 });
    },
    shoot: ".cm-lp-editable",
  },
  ...["Theme", "Paper", "Typography", "Cursor", "Mascot", "Editor"].map((section) => ({
    id: `settings-${section.toLowerCase()}`,
    title: `Settings → ${section}`,
    look: "Rows lined up, notes under their labels, nothing cut off or crowded; the new rows (Dark panes, Heading color, Writing, Typing sounds…) like their neighbors.",
    settings: section,
    shoot: "dialog",
  })),
  { id: "phone-dark-list", title: "Phone: a dark note list", look: "The list dark, its rows readable; the top of the screen not a light strip over it (a known gap, docs/limitations.md).", prefs: { darkPanes: "list" }, width: 390, height: 780, schemes: ["light"] },
  {
    id: "phone-typing",
    title: "Phone: typing practice",
    look: "The drill fits the width, its stats on one line or wrapped cleanly.",
    note: "```typing\nThe quick brown fox jumps over the lazy dog.\n```\n",
    width: 390,
    height: 780,
  },
  { id: "phone-backdrop", title: "Phone: a backdrop", look: "Room around the page, nothing scrolls sideways.", prefs: { paperBackdrop: "dawn" }, note: PROSE, width: 390, height: 780 },
];

const scenes = SCENES.filter((scene) => !only.length || only.some((word) => scene.id.includes(word)));

if (!args.includes("--no-build")) await build({ root, mode: "test", logLevel: "error", build: { outDir, emptyOutDir: true } });
const server = await preview({ root, mode: "test", logLevel: "error", build: { outDir }, preview: { port: 4337, strictPort: false, open: false } });
const url = server.resolvedUrls.local[0];
const browser = await (engine === "webkit" ? webkit : chromium).launch();

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const shots = [];
for (const scene of scenes) {
  for (const scheme of scene.schemes ?? ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: scene.width ?? 1280, height: scene.height ?? 800 }, colorScheme: scheme, deviceScaleFactor: 2, reducedMotion: "reduce" });
    const { plugins: pluginChoices, ...prefs } = scene.prefs ?? {};
    await context.addInitScript(
      ([prefs, plugins]) => {
        if (location.protocol !== "http:") return;
        localStorage.setItem("lines.seeded", "1");
        localStorage.setItem("lines.prefs", JSON.stringify(prefs));
        if (plugins) localStorage.setItem("lines.plugins", JSON.stringify(plugins));
      },
      [prefs, pluginChoices],
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => window.testing?.notes.ready);
    if (scene.note !== undefined) await page.evaluate(([body, format]) => window.testing.open(body, format), [scene.note, scene.format]);
    await scene.act?.(page);
    if (scene.settings) {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("dialog").getByRole("navigation").getByText(scene.settings, { exact: true }).first().click();
    }
    await page.waitForTimeout(scene.wait ?? 400);
    const file = `${scene.id}-${scheme}.png`;
    const target = scene.shoot === "dialog" ? page.getByRole("dialog") : scene.shoot ? page.locator(scene.shoot).first() : page;
    await target.screenshot({ path: out + file });
    shots.push({ scene, scheme, file, errors });
    if (errors.length) console.warn(`${scene.id} (${scheme}): ${errors.join("; ")}`);
    await context.close();
  }
  process.stdout.write(".");
}
await browser.close();
await server.close();

const esc = (text) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cards = scenes
  .map((scene) => {
    const pictures = shots
      .filter((shot) => shot.scene === scene)
      .map((shot) => `<figure><a href="${shot.file}"><img src="${shot.file}" alt="${esc(`${scene.title}, ${shot.scheme}`)}" loading="lazy"></a><figcaption>${shot.scheme}${shot.errors.length ? ` · <strong>errors: ${esc(shot.errors.join("; "))}</strong>` : ""}</figcaption></figure>`)
      .join("");
    return `<section id="${scene.id}"><h2>${esc(scene.title)}</h2><p>${esc(scene.look)}</p><div class="pictures">${pictures}</div></section>`;
  })
  .join("\n");
writeFileSync(
  `${out}index.html`,
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>lines · QA pictures</title>
<style>
  :root { color-scheme: light dark; font: 15px/1.5 system-ui, sans-serif; }
  body { max-width: 1400px; margin: 0 auto; padding: 24px; }
  section { margin: 0 0 40px; }
  h2 { margin: 0 0 4px; font-size: 18px; }
  p { margin: 0 0 12px; opacity: 0.8; }
  .pictures { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 520px), 1fr)); gap: 16px; }
  figure { margin: 0; }
  img { width: 100%; height: auto; border: 1px solid color-mix(in srgb, currentColor 15%, transparent); border-radius: 8px; }
  figcaption { font-size: 13px; opacity: 0.7; }
</style></head>
<body><h1>lines · QA pictures</h1><p>${esc(`${engine}, ${new Date().toISOString().slice(0, 16).replace("T", " ")}`)}. Look at each picture for what it says; anything else that looks wrong counts too. qa/README.md has more.</p>
${cards}
</body></html>
`,
);
console.log(`\n${shots.length} pictures in qa/shots/; open qa/shots/index.html.`);
