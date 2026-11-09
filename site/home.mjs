import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO, ROOT } from "./content.mjs";
import { layout, script } from "./pages.mjs";

/*
 * The home page: what lines is, in a few words and many pictures (site/images/, which
 * screenshots.mjs takes), what notes can be, the plugins, and the downloads.
 */

const VALUES = [
  { icon: "sparkles", title: "Beautiful", text: "Seventeen themes, light and dark, and pages that are a pleasure to read." },
  { icon: "leaf", title: "Calm", text: "A focused space to write, with tags instead of folders. Nothing pings, nothing nags." },
  { icon: "heart", title: "Free", text: "Free and open source, with no account, no ads and no subscription." },
  { icon: "shield-check", title: "Private", text: "End-to-end encrypted sync, locked notes, and an app lock with Touch ID." },
  { icon: "hard-drive", title: "Local", text: "Your notes live on your device and work offline. Sync through storage you choose, or not at all." },
  { icon: "puzzle", title: "Extensible", text: "A small core with plugins around it. Keep what you use, and turn off the rest." },
];

const KINDS = [
  {
    picture: "latex",
    icon: "graduation-cap",
    label: "LaTeX",
    title: "Papers, drawn as you type",
    text: "Write theorems, proofs and equations as you would in a paper, and read them as they'll print. Export a .tex that compiles, or typeset the PDF right in the app.",
    link: ["docs/latex.html", "LaTeX notes"],
  },
  {
    picture: "spreadsheet",
    icon: "sheet",
    label: "Spreadsheets",
    title: "Numbers that add up",
    text: "Formulas with Excel's keys and functions, money and dates shown your way, and sheets that use each other's cells. Open and save CSV and Excel files.",
    link: ["docs/spreadsheets.html", "Spreadsheets"],
  },
  {
    picture: "diagrams",
    icon: "box",
    label: "Diagrams and models",
    title: "Plans you can see",
    text: "Flowcharts and timing diagrams from a few lines, drawings sketched by hand, and 3D models to turn around, then print.",
    link: ["docs/linedown.html#3d-models", "Diagrams and models"],
  },
];

const MORE = [
  ["sigma", "Math"],
  ["pen-tool", "Drawings"],
  ["send", "API requests"],
  ["play", "Audio and video"],
  ["square-terminal", "Terminal recordings"],
  ["printer", "PDF and print"],
  ["lock", "Locked notes"],
  ["key-round", "Secrets"],
];

const THEMES = ["Sepia", "Nord", "Catppuccin", "Ember"];

/** The apps of the latest release, by system, with the files there are for each. */
const SYSTEMS = [
  { id: "mac", name: "Mac", about: "Apple silicon and Intel", files: [".dmg"] },
  { id: "windows", name: "Windows", about: "64-bit, Windows 10 and later", files: ["-setup.exe", ".msi"] },
  { id: "linux", name: "Linux", about: "64-bit, Ubuntu 22.04 and later", files: [".AppImage", ".deb", ".rpm"] },
];

/** One of the icons the app draws (Lucide's), as SVG. */
function icon(name, className = "size-5") {
  const source = readFileSync(join(ROOT, `node_modules/@lucide/svelte/dist/icons/${name}.svelte`), "utf8");
  const data = source.match(/__iconData = (\{.*\});/);
  if (!data) throw new Error(`The ${name} icon isn't where @lucide/svelte used to keep it`);
  const { node } = JSON.parse(data[1]);
  const shapes = node.map(([tag, attributes]) => `<${tag} ${Object.entries(attributes).map(([key, value]) => `${key}="${value}"`).join(" ")}/>`).join("");
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes}</svg>`;
}

/** A WebP picture's size, from its header, so the page saves its room before it loads. */
function size(file) {
  const bytes = readFileSync(join(ROOT, "site/images", file));
  switch (bytes.toString("ascii", 12, 16)) {
    case "VP8X":
      return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    case "VP8L": {
      const bits = bytes.readUInt32LE(21);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
    }
    default:
      return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
}

/** A picture of the app, light or dark as the visitor's system is. */
function picture(name, alt, { lazy = true } = {}) {
  const light = `${name}-light.webp`;
  const { width, height } = size(light);
  return `<picture>
          <source media="(prefers-color-scheme: dark)" srcset="images/${name}-dark.webp" />
          <img src="images/${light}" width="${width}" height="${height}" alt="${alt}" class="shot"${lazy ? ' loading="lazy" decoding="async"' : ""} />
        </picture>`;
}

const megabytes = (bytes) => `${Math.round(bytes / 1e6)} MB`;

function downloads(release) {
  if (!release) {
    return `<p class="mt-4 text-center text-muted">The apps for Mac, Windows and Linux are on <a href="${REPO}/releases">lines' releases</a>.</p>`;
  }
  const date = new Date(release.date).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const extension = (asset) => asset.name.slice(asset.name.lastIndexOf(".") + 1);
  const systems = SYSTEMS.map((system) => {
    const [first, ...others] = system.files.map((suffix) => release.assets.find((asset) => asset.name.endsWith(suffix))).filter(Boolean);
    if (!first) return "";
    return `<li class="flex flex-col rounded-xl border border-card-line bg-card p-5 shadow-card">
            <h3 class="text-lg font-semibold">${system.name}</h3>
            <p class="mt-1 mb-5 text-sm text-muted">${system.about}</p>
            <a href="${first.url}" class="button button-primary self-start" data-system="${system.id}" data-name="${system.name}">Download .${extension(first)} <span class="font-normal opacity-80">${megabytes(first.size)}</span></a>
            ${others.length ? `<p class="mt-3 text-sm text-muted">Or ${others.map((asset) => `<a href="${asset.url}">.${extension(asset)}</a>`).join(", ")}</p>` : ""}
          </li>`;
  }).join("\n          ");
  return `<p class="mt-3 text-center text-muted">lines ${release.version}, ${date}. <a href="docs/changelog.html">What's new</a></p>
        <ul class="mt-10 grid gap-4 md:grid-cols-3">
          ${systems}
        </ul>
        <p class="mx-auto mt-6 max-w-3xl text-center text-sm text-muted">lines is in alpha, so export your notes now and then. The apps aren't signed yet: on a Mac, open lines the first time with right-click → Open; on Windows, choose More info → Run anyway. <a href="${release.url}">All of this release's files</a></p>`;
}

/** The download button offers the visitor's system's app, when there's one for it. */
function offerYourSystem() {
  const platform = (navigator.userAgentData?.platform || navigator.platform).toLowerCase();
  // iPads say they're Macs.
  const mac = platform.startsWith("mac") && navigator.maxTouchPoints < 2;
  const linux = platform.includes("linux") && !/android/i.test(navigator.userAgent);
  const system = mac ? "mac" : platform.startsWith("win") ? "windows" : linux ? "linux" : "";
  const app = system && document.querySelector(`[data-system="${system}"]`);
  const button = document.getElementById("download-button");
  if (!app || !button) return;
  button.href = app.href;
  button.textContent = `Download for ${app.dataset.name}`;
}

/** lines installed from the web app, when it was where the home page is now, opens the app. */
function openInstalled() {
  if (matchMedia("(display-mode: standalone)").matches) location.replace("app/");
}

export function home({ release }) {
  const values = VALUES.map(
    (value) => `<li>
            <span class="value-icon">${icon(value.icon)}</span>
            <h3 class="mt-4 text-lg font-semibold">${value.title}</h3>
            <p class="mt-1.5 text-muted">${value.text}</p>
          </li>`,
  ).join("\n          ");

  const kinds = KINDS.map(
    (kind, i) => `<div class="grid items-center gap-8 md:grid-cols-5 md:gap-14">
          <div class="md:col-span-2${i % 2 ? " md:order-last" : ""}">
            <p class="flex items-center gap-2 text-sm font-semibold text-accent">${icon(kind.icon, "size-4")}${kind.label}</p>
            <h3 class="mt-3 text-2xl font-bold tracking-tight">${kind.title}</h3>
            <p class="mt-3 text-lg text-muted">${kind.text}</p>
            <a href="${kind.link[0]}" class="more mt-4">${kind.link[1]}${icon("arrow-right", "size-4")}</a>
          </div>
          <div class="md:col-span-3">${picture(kind.picture, `A note in lines: ${kind.title.toLowerCase()}`)}</div>
        </div>`,
  ).join("\n        ");

  const themes = THEMES.map((theme) => {
    const file = `theme-${theme.toLowerCase()}.webp`;
    const { width, height } = size(file);
    return `<li><img src="images/${file}" width="${width}" height="${height}" alt="lines in ${theme}" class="shot" loading="lazy" decoding="async" /><p class="mt-2 text-center text-sm text-muted">${theme}</p></li>`;
  }).join("\n          ");

  return layout({
    page: "index.html",
    title: "lines: calm, beautiful notes that stay yours",
    description: "A quiet place to write, calculate, sketch and think. Free and open source, private, and on your own device.",
    head: `\n    ${script(openInstalled)}`,
    body: `    <main id="main">
      <section class="mx-auto max-w-5xl px-4 pt-14 text-center sm:px-6 sm:pt-24">
        <h1 class="mx-auto max-w-3xl text-display font-bold text-balance">Calm, beautiful notes that stay yours.</h1>
        <p class="mx-auto mt-6 max-w-2xl text-xl text-pretty text-muted">A quiet place to write, calculate, sketch and think. Free and open source, private, and on your own device.</p>
        <div class="mt-9 flex flex-wrap justify-center gap-3">
          <a href="app/" class="button button-primary button-large">Open in your browser</a>
          <a href="#download" id="download-button" class="button button-large">Download</a>
        </div>
        <p class="mt-4 text-sm text-faint">Mac, Windows, Linux and the web. No account.</p>
      </section>
      <div class="mx-auto mt-14 max-w-6xl px-4 sm:px-6">
        ${picture("app", "lines: tags in the sidebar, the list of notes, and a note with a callout, todos and a table", { lazy: false })}
      </div>

      <section aria-label="Why lines" class="mx-auto mt-28 max-w-5xl px-4 sm:px-6">
        <ul class="grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          ${values}
        </ul>
      </section>

      <section aria-labelledby="kinds" class="mx-auto mt-32 max-w-6xl px-4 sm:px-6">
        <div class="mx-auto max-w-2xl text-center">
          <h2 id="kinds" class="section-title">More than notes</h2>
          <p class="mt-4 text-lg text-muted">Notes, papers, spreadsheets and plans sit side by side, and any note can switch from one to another.</p>
        </div>
        <div class="mt-16 grid gap-24">
        ${kinds}
        </div>
        <ul class="mx-auto mt-20 flex max-w-3xl flex-wrap justify-center gap-2.5" aria-label="And">
          ${MORE.map(([name, label]) => `<li class="chip">${icon(name, "size-4")}${label}</li>`).join("\n          ")}
        </ul>
      </section>

      <section aria-labelledby="themes" class="mx-auto mt-32 max-w-6xl px-4 sm:px-6">
        <div class="mx-auto max-w-2xl text-center">
          <h2 id="themes" class="section-title">Seventeen themes</h2>
          <p class="mt-4 text-lg text-muted">Each in light and dark, including High Contrast and two for color blindness. Write on ruled, dotted or squared paper if you like, and choose the fonts, sizes and widths too.</p>
        </div>
        <ul class="mt-12 grid grid-cols-2 gap-5 lg:grid-cols-4">
          ${themes}
        </ul>
      </section>

      <section aria-labelledby="plugins" class="mx-auto mt-32 max-w-6xl px-4 sm:px-6">
        <div class="grid items-center gap-8 md:grid-cols-5 md:gap-14">
          <div class="md:col-span-2">
            <p class="flex items-center gap-2 text-sm font-semibold text-accent">${icon("puzzle", "size-4")}Plugins</p>
            <h2 id="plugins" class="mt-3 section-title">Made of plugins</h2>
            <p class="mt-3 text-lg text-muted">Like a code editor, lines is a small core with plugins around it: the kinds of notes, what draws math and diagrams, themes and icons. Turn off what you don't use, and nothing in your notes changes.</p>
            <a href="docs/plugins.html" class="more mt-4">How plugins work${icon("arrow-right", "size-4")}</a>
          </div>
          <div class="md:col-span-3">${picture("plugins", "Settings in lines, listing its plugins, each with a switch")}</div>
        </div>
      </section>

      <section aria-labelledby="download" class="mx-auto mt-32 max-w-5xl scroll-mt-6 px-4 sm:px-6">
        <h2 id="download" class="section-title text-center">Download lines</h2>
        ${downloads(release)}
      </section>
    </main>
    ${script(offerYourSystem)}`,
  });
}
