import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { ROOT } from "./content.mjs";

/*
 * Takes the home page's pictures (site/images/): the web app with the notes in site/samples/, in
 * light and in dark. `bun run openscad-assets` (for the 3D model) and `bun run build:site` first,
 * then `bun site/screenshots.mjs`; again when what they show changes. Headless Chromium, as
 * Playwright has it: nothing opens on the screen.
 */

const APP = join(ROOT, "dist-site/app");
const SAMPLES = join(ROOT, "site/samples");
const OUT = join(ROOT, "site/images");

/** The notes in the pictures, from the bottom of the list to the top. A CSV file's name is its note's title. */
const IMPORTS = ["reading.md", "ribollita.md", "bookshelf.md", "orbits.tex", "Trip budget.csv", "florence.md"];

/** Pictures of a note's page: the note, as much of it as is worth seeing, and what's set up first. */
const NOTES = [
  { name: "latex", note: "Circular orbits", height: 880 },
  { name: "spreadsheet", note: "Trip budget", height: 430, prepare: (page) => page.getByText("$846.00", { exact: true }).click() },
  { name: "diagrams", note: "Bookshelf for the hall", height: 740 },
];

/** A few of the themes, each in the scheme it's shown in. */
const THEMES = [
  { theme: "Sepia", scheme: "light" },
  { theme: "Nord", scheme: "dark" },
  { theme: "Catppuccin", scheme: "light" },
  { theme: "Ember", scheme: "dark" },
];

if (!(await Bun.file(join(APP, "index.html")).exists())) throw new Error("Build the web app first: bun run build:site");

const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const file = Bun.file(join(APP, path.endsWith("/") ? `${path}index.html` : path));
    return (await file.exists()) ? new Response(file) : new Response("Not found", { status: 404 });
  },
});

const browser = await chromium.launch({ args: ["--mute-audio"] });
mkdirSync(OUT, { recursive: true });

/** A PNG as WebP, which the browser encodes: a fraction of the size, and as sharp. */
async function save(page, png, name) {
  const data = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = new OffscreenCanvas(image.naturalWidth, image.naturalHeight);
    canvas.getContext("2d").drawImage(image, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.9 });
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(blob);
    });
  }, png.toString("base64"));
  writeFileSync(join(OUT, `${name}.webp`), Buffer.from(data, "base64"));
  console.log(`site/images/${name}.webp`);
}

const settings = async (page, section) => {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("dialog").getByText(section, { exact: true }).first().click();
};

/** The app with the sample notes in it, and no feature tour. */
async function open(scheme, viewport, scale = 2) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, colorScheme: scheme, reducedMotion: "reduce" });
  await context.addInitScript(() => localStorage.setItem("lines.seeded", "1"));
  const page = await context.newPage();
  await page.goto(`http://localhost:${server.port}/`);
  await page.locator(".note-list").waitFor();
  await settings(page, "Export and Import");
  // One at a time, so the list has them in order: the last imported first.
  for (const name of IMPORTS) {
    await page.locator('input[type="file"]').setInputFiles({ name, mimeType: "text/plain", buffer: readFileSync(join(SAMPLES, name)) });
    await page.waitForTimeout(400);
  }
  await page.locator(".note-list").getByText("Weekend in Florence", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  return { context, page };
}

const show = async (page, note) => {
  await page.locator(".note-list").getByText(note, { exact: true }).first().click();
  // Diagrams, math and models draw a moment after the note opens.
  await page.waitForTimeout(3000);
};

for (const scheme of ["light", "dark"]) {
  const { context, page } = await open(scheme, { width: 1440, height: 900 });
  await show(page, "Weekend in Florence");
  await save(page, await page.screenshot(), `app-${scheme}`);

  for (const { name, note, height, prepare } of NOTES) {
    await show(page, note);
    await prepare?.(page);
    await page.waitForTimeout(300);
    const box = await page.locator(".editor-pane").boundingBox();
    await save(page, await page.screenshot({ clip: { ...box, height: Math.min(box.height, height) } }), `${name}-${scheme}`);
  }

  await settings(page, "Plugins");
  await page.waitForTimeout(500);
  await save(page, await page.getByRole("dialog").screenshot(), `plugins-${scheme}`);
  await context.close();
}

for (const { theme, scheme } of THEMES) {
  const { context, page } = await open(scheme, { width: 1200, height: 750 }, 1);
  await settings(page, "Theme");
  await page.getByRole("radio", { name: theme }).click();
  await page.keyboard.press("Escape");
  await show(page, "Weekend in Florence");
  await save(page, await page.screenshot(), `theme-${theme.toLowerCase()}`);
  await context.close();
}

await browser.close();
await server.stop();
