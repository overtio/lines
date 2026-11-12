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

/** A day `days` from today, here, as a note's `date` property writes it. */
function dayFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** What takes each theme's own colors besides its accent: a highlight, callouts and line marks. */
const THEME_COLORS = `# Colors

A ==highlighted phrase== beside a #tag and a [link](https://example.com).

Ready <!-- mark green: ready -->
Check <!-- mark yellow: check -->
Fix <!-- mark red: fix -->
Note <!-- mark blue: note -->
Idea <!-- mark purple: idea -->

:::info
Info
:::

:::question
Question
:::

:::warning
Warning
:::

:::error
Error
:::

:::decision
Decision
:::`;

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
  ...[
    ["green-world", "Green World", "Violet backgrounds, the accent a leaf's green, tags magenta"],
    ["miku", "Miku", "Cool grey backgrounds with a teal sidebar in dark, the accent teal, tags pink"],
    ["teto", "Teto", "Warm near-black and blush backgrounds, the accent crimson, tags gold"],
  ].map(([theme, name, colors]) => ({
    id: `theme-${theme}`,
    title: `Theme: ${name}`,
    look: `${colors}; callouts and code in its own colors, each readable.`,
    prefs: { theme },
    note: `${PROSE}\n\n#garden\n\n:::info\nA callout, in the theme's blue.\n:::\n\n\`\`\`js\n// Code in its colors\nconst leaves = grow(3, "green");\n\`\`\``,
  })),
  ...["lines", "ember", "ink", "indigo", "plum", "moss", "amber", "mono", "graphite", "sepia", "forest", "ocean", "green-world", "miku", "teto", "solarized", "nord", "dracula", "catppuccin", "tokyo-night", "gruvbox", "everforest", "ayu", "void", "puddle", "lightbulb"].map((theme) => ({
    id: `theme-colors-${theme}`,
    title: `Theme colors: ${theme}`,
    look: "The highlight, callouts and marks in the theme's own colors, sitting with its accent rather than lines' own; the highlighted text readable; each callout's icon clear on its tint.",
    prefs: { theme },
    note: THEME_COLORS,
  })),
  ...["classic", "pixel", "neon", "adventure", "aero", "brutalist", "constructivist", "void"].map((style) => ({
    id: `style-${style}`,
    title: `Style: ${style[0].toUpperCase()}${style.slice(1)}`,
    look: { classic: "Bevels lit from the top left, the title bar's gradient, white text on its light end still readable.", pixel: "2px lines, square corners, what's chosen turned around, the pixel font without broken letters.", neon: "Glowing headings and lines, the grid behind the note, scan lines faint.", adventure: "Slots with notched pixel corners, the chosen row framed in the accent, grass under the title bars, headings with a hard shadow.", aero: "Gel buttons and a glossy chosen row, a sheen on the panes, the sky and bubbles behind the note faint under the text.", brutalist: "Solid rules between everything, uppercase monospace titles, the chosen row a block of the accent, a big tight heading.", constructivist: "Red bands on black rules under the title bars, the chosen row a red wedge, condensed capitals, a circle and diagonal faint behind the note.", void: "No lines or boxes, the title bars out of sight (the pointer is away), the chosen row in black with an accent dot, the rest grey but readable, headings the text's size." }[style],
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
  { id: "style-adventure-settings", title: "Adventure, in Settings", look: "Buttons, fields, switches and groups as framed slots; the chosen segment raised; focus rings inside the notched corners.", prefs: { style: "adventure", theme: "adventure" }, settings: "Theme", shoot: "dialog" },
  { id: "style-aero-settings", title: "Aero, in Settings", look: "Gel buttons and switches, frosted dialog glass, fields as pills; everything readable.", prefs: { style: "aero", theme: "aero" }, settings: "Theme", shoot: "dialog" },
  { id: "style-brutalist-settings", title: "Brutalist, in Settings", look: "Thick rules around groups and fields, uppercase monospace buttons, switches as boxes.", prefs: { style: "brutalist", theme: "brutalist" }, settings: "Editor", shoot: "dialog" },
  { id: "style-constructivist-settings", title: "Constructivist, in Settings", look: "Groups with a red band on top, condensed capitals on buttons and segments, the chosen segment red, square switches whose knob reaches the end, the dialog's red shadow.", prefs: { style: "constructivist", theme: "constructivist" }, settings: "Editor", shoot: "dialog" },
  { id: "hide-bars-no-icons", title: "Hide toolbars and no icons, in Void, the toolbar reached for", look: "The note list's title bar and the sidebar's edges out of sight; pointing at the note's toolbar brings it back, its buttons as words (Lock note, Share…) that fit without crowding; no icons in the sidebar; the search text lined up with the note titles.", prefs: { style: "void", theme: "void", hideBars: true, showIcons: false }, note: PROSE, act: (page) => page.hover("main.editor-pane .toolbar") },
  { id: "no-icons-blocks", title: "No icons, a block's buttons", look: "A spreadsheet block's button beside it keeps its icon, in its round button, with no words spilling out.", prefs: { showIcons: false }, note: "# Costs\n\n```csv\nItem,Cost\nTea,4\nBread,3\n```\n\nEnd", act: (page) => page.hover(".cm-content .cm-lp-sheet, .cm-content table, .cm-content [class*=sheet]") },
  { id: "no-icons-lines", title: "No icons, in Lines", look: "Buttons that were only an icon show their names, sized to their words, with Lines' hovers; no icons in the sidebar; the nested tags' chevron kept, turned open, clear of the count; the pinned note's row saying Pinned before its date, with no icons.", prefs: { showIcons: false }, note: `${PROSE}\n\n#idea/lenstica #idea/lines`, act: async (page) => {
      await page.click(".sidebar button[aria-expanded]");
      await page.click('main.editor-pane .toolbar button[aria-label="Pin to top"]');
    } },
  { id: "style-void-settings", title: "Void, in Settings", look: "Groups without boxes, buttons and choices as words (the chosen one black), hairline switches and fields, one size of type; everything still clearly a control.", prefs: { style: "void", theme: "void" }, settings: "Editor", shoot: "dialog" },
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
  {
    id: "calendar",
    title: "The Calendar",
    look: "The month under the search field, its weekday letters over their columns; today filled in the accent; under each day with notes a dot for each of their colors (tomorrow green and purple); days of other months faint; the day's notes listed below. Beside it the week: Plan the trip at 10 AM in today's column in the accent, an hour tall, its title and time readable; the trip under All day from three days on; tomorrow Gym in green (#health's) and, after it, Standup in purple (Meeting's color) with Meeting's calendar icon before its title, in purple; the colored events' text as readable as the accent's; today's heading in the accent and a line at the time now; the columns lined up with their headings and the hour lines. In the sidebar, Meeting's icon purple and #health's green.",
    storage: { "lines.looks": { tags: { health: { color: "green", at: 1 } }, types: { meeting: { color: "purple", at: 1 } } } },
    note: `---\ndate: ${dayFromToday(0)} 10:00\nstart: ${dayFromToday(3)}\nend: ${dayFromToday(5)}\n---\n# Plan the trip`,
    act: async (page) => {
      for (const body of [`---\ntype: meeting\ndate: ${dayFromToday(1)} 13:00\n---\n# Standup`, `---\ndate: ${dayFromToday(1)} 12:00\n---\n# Gym\n\n#health`]) {
        await page.evaluate((body) => window.testing.open(body), body);
      }
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
    },
  },
  {
    id: "icon-picker-color",
    title: "A tag's icon and color",
    look: "Over the search field, No Color (a ring with a line across) and the theme's eight colors, evenly spaced, Green ringed in its own color with a gap; the tag's icon in the header green; every swatch readable against the menu's background.",
    storage: { "lines.looks": { tags: { work: { icon: "briefcase", color: "green", at: 1 } }, types: {} } },
    note: "# Standup\n\n#work",
    act: async (page) => {
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^work/ }).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Icon and Color" }).click();
    },
    shoot: "dialog",
  },
  ...["stars", "hearts", "circles"].map((scores) => ({
    id: `scores-${scores}`,
    title: `Scores as ${scores}`,
    look: "Rating's 3 of 5 and Score's 4 of 7 drawn as marks: the filled ones in the color (stars yellow, hearts red, circles the accent), the rest faint outlines, the same size as the text and sitting on its line, evenly spaced; Plate's value plain.",
    prefs: { scores },
    note: "---\nrating: 3/5\n---\n# Film\n\nScore: 4/7\nPlate: 3WBZ56\n\nEnd",
    act: (page) => page.evaluate(() => window.testing.place()),
    shoot: ".editor-pane",
  })),
  {
    id: "tag-colors",
    title: "Tags in a note in their colors",
    look: "#work's lightbulb and pill green, #work/meetings green too (from #work), #home blue with its house, #misc in the accent as always; each name in the text's color and easy to read on its tint; the pills the same size and shape as before.",
    storage: { "lines.looks": { tags: { work: { icon: "lightbulb", color: "green", at: 1 }, home: { icon: "house", color: "blue", at: 1 } }, types: {} } },
    note: "# Week\n\nPlans for #work, #work/meetings, #home and #misc.",
    shoot: ".editor-pane",
  },
  {
    id: "panes",
    title: "Notes in panes: one on top, two at the bottom",
    look: "The open note across the top with its toolbar; below it, two notes side by side, each with its title, Swap and Close in a short header (not a title bar's height); thin lines between the panes, lined up with each other and the panes' edges; each note readable, nothing cut off but at the panes' own edges.",
    height: 900,
    act: async (page) => {
      for (const body of ["# Groceries\n\n- milk\n- eggs", "# Trip\n\nRome, then Florence.", "# Plan\n\nThe week ahead."]) await page.evaluate((body) => window.testing.open(body), body);
      const row = (title) => page.locator(".note-list [data-id]").filter({ hasText: title });
      await row("Trip").click({ button: "right" });
      await page.getByRole("menuitem", { name: "Open Below" }).click();
      await page.getByRole("region", { name: /Trip/ }).locator(".cm-content").click();
      await row("Groceries").click({ button: "right" });
      await page.getByRole("menuitem", { name: "Open to the Side" }).click();
    },
  },
  {
    id: "panes-drop",
    title: "A note dragged over the panes",
    look: "Groceries being dragged from the list over the open note's right edge: the right half of that pane tinted in the accent with an accent outline, inset a little from its edges, the note readable through it; nothing else highlighted.",
    act: async (page) => {
      for (const body of ["# Groceries\n\n- milk\n- eggs", "# Plan\n\nThe week ahead."]) await page.evaluate((body) => window.testing.open(body), body);
      const at = await page.locator("[data-pane-place='main']").boundingBox();
      await page.locator(".note-list [data-id]").filter({ hasText: "Groceries" }).hover();
      await page.mouse.down();
      await page.mouse.move(at.x + at.width - 40, at.y + at.height / 2, { steps: 8 });
    },
  },
  {
    id: "sidebar-divider",
    title: "Dividers in the sidebar",
    look: "A thin line under Calendar among the places; one after Trash, halfway between it and the Types heading (as much room above the line as below); one under Person, halfway between it and the Tags heading; one between #home and #work; each lined up with the rows' text, as quiet as the borders.",
    note: "---\ntype: person\n---\n# Ada\n\n#work #home",
    act: async (page) => {
      const sidebar = page.getByRole("navigation", { name: "Library" });
      for (const row of [/^Calendar/, /^Trash/, /^Person/, /^home/]) {
        await page.getByRole("menu").waitFor({ state: "detached" });
        await sidebar.getByRole("button", { name: row }).click({ button: "right" });
        await page.getByRole("menuitem", { name: "Add Divider Below" }).click();
      }
    },
    shoot: ".sidebar",
  },
  {
    id: "icon-picker-nested",
    title: "A nested tag's color, from its tag",
    look: "Over the search field, first a hollow ring in #work's blue (\"Same as #work\"), ringed as chosen, then the eight colors; the header's icon blue; behind, in the sidebar, meetings' # blue like work's.",
    storage: { "lines.looks": { tags: { work: { color: "blue", at: 1 } }, types: {} } },
    note: "# Plan\n\n#work/meetings",
    act: async (page) => {
      const sidebar = page.getByRole("navigation", { name: "Library" });
      await sidebar.getByRole("button", { name: "Tags in work" }).click();
      await sidebar.getByRole("button", { name: /^meetings/ }).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Icon and Color" }).click();
    },
  },
  {
    id: "icon-picker-money",
    title: "Icons found by what they're for",
    look: "Searching \"money\": the banknote, wallets, coins, hand with coins, piggy bank, the currencies, the card and the vault, each once, in a tidy grid with no gaps.",
    note: "# Budget\n\n#finance",
    act: async (page) => {
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: /^finance/ }).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Icon and Color" }).click();
      await page.getByRole("searchbox", { name: "Search icons" }).fill("money");
    },
    shoot: "dialog",
  },
  ...["neon", "classic", "pixel"].map((style) => ({
    id: `calendar-${style}`,
    title: `The Calendar in ${style[0].toUpperCase()}${style.slice(1)}`,
    look: "The week's own lines only, hour and day lines lined up with their labels and headings, no grid or pattern of the style's behind them; events, the now line and the headings in the style's colors and shapes, readable.",
    prefs: { style, theme: style },
    note: `---\nstart: ${dayFromToday(0)} ${String(new Date().getHours()).padStart(2, "0")}:00\nend: ${dayFromToday(0)} ${String(Math.min(23, new Date().getHours() + 2)).padStart(2, "0")}:00\n---\n# Standup`,
    act: (page) => page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click(),
    schemes: ["light", "dark"],
  })),
  {
    id: "calendar-repeat",
    title: "A repeating event and its Repeat menu",
    look: "Standup on each weekday this week at the hour now, each with the small repeat mark after its title; its Repeat menu open: Doesn't Repeat, Every Day, Every Weekday (checked), Every Week on today's weekday, Every 2 Weeks, Every Month on Day n, on the nth weekday, Every Year; the dots in the month on weekdays only.",
    note: `---\nstart: ${dayFromToday(0)} ${String(new Date().getHours()).padStart(2, "0")}:00\nend: ${dayFromToday(0)} ${String(Math.min(23, new Date().getHours() + 1)).padStart(2, "0")}:00\nrepeat: every weekday\n---\n# Standup`,
    act: async (page) => {
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
      await page.getByRole("button", { name: /^Standup, / }).first().click({ button: "right" });
      await page.getByRole("menuitem", { name: "Repeat" }).click();
    },
  },
  {
    id: "calendar-rename",
    title: "Renaming an event",
    look: "The event looks as it did, its color, bar, icon and time where they were, with a soft outline; its title selected in place, in the same size and weight, the cursor in it; no box of another color over it.",
    storage: { "lines.looks": { tags: {}, types: { meeting: { color: "purple", at: 1 } } } },
    // At the hour now, which the week opens just below.
    note: `---\ntype: meeting\nstart: ${dayFromToday(0)} ${String(new Date().getHours()).padStart(2, "0")}:00\nend: ${dayFromToday(0)} ${String(Math.min(23, new Date().getHours() + 2)).padStart(2, "0")}:00\n---\n# Standup`,
    act: async (page) => {
      await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Calendar" }).click();
      await page.getByRole("button", { name: /^Standup, / }).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Rename" }).click();
    },
  },
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
  ...["Theme", "Paper", "Typography", "Cursor", "Mascots", "Editor", "All Plugins"].map((section) => ({
    id: `settings-${section.toLowerCase().replaceAll(" ", "-")}`,
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
// A port of its own, as the browser tests' (tests/browser/setup.ts).
const server = await preview({ root, mode: "test", logLevel: "error", build: { outDir }, preview: { host: "127.0.0.1", port: 0, open: false } });
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
      ([prefs, plugins, storage]) => {
        if (location.protocol !== "http:") return;
        localStorage.setItem("lines.seeded", "1");
        localStorage.setItem("lines.prefs", JSON.stringify(prefs));
        if (plugins) localStorage.setItem("lines.plugins", JSON.stringify(plugins));
        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, JSON.stringify(value));
      },
      [prefs, pluginChoices, scene.storage ?? {}],
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
