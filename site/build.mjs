import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { build } from "vite";
import { REPO, ROOT, docGroups, headingIds, read, render } from "./content.mjs";
import { home } from "./home.mjs";
import { doc, docsHome } from "./pages.mjs";

/*
 * Builds the website into dist-site/, beside the web app that `bun run build:site` builds into
 * dist-site/app/ first: the home page (index.html), with the latest release's downloads, and the
 * docs (docs/). Fails on a link between pages, or to a file, that leads nowhere.
 */

const OUT = join(ROOT, "dist-site");

/** The latest release's version, date and installers, or nothing when it can't be read. */
async function latestRelease() {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  try {
    const response = await fetch(`${REPO.replace("github.com", "api.github.com/repos")}/releases/latest`, {
      headers: { accept: "application/vnd.github+json", ...(token && { authorization: `Bearer ${token}` }) },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const release = await response.json();
    return {
      version: release.tag_name.replace(/^v/, ""),
      date: release.published_at,
      url: release.html_url,
      assets: release.assets.map((asset) => ({ name: asset.name, url: asset.browser_download_url, size: asset.size })),
    };
  } catch (error) {
    console.warn(`The home page links to the releases instead of the apps: the latest release couldn't be read (${error.message}).`);
  }
}

const groups = docGroups();
const entries = groups.flatMap((group) => group.pages);
const routes = new Map(entries.map((entry) => [entry.path, entry]));

/** Each docs page's Markdown, rendered; then every page's HTML, by its path in the site. */
const rendered = entries.map((entry) => render(read(entry.path), entry.path, entry.page, routes));
const pages = new Map([
  ["index.html", home({ release: await latestRelease() })],
  ["docs/index.html", docsHome({ groups })],
  ...entries.map((entry, i) => [entry.page, doc({ entry, groups, rendered: rendered[i] })]),
]);

// Every link between pages reaches its page and heading, and every link to a file its file.
const idsOf = new Map(rendered.map(({ page, ids }) => [page, ids]));
const fileIds = new Map();
const idsIn = (file) => fileIds.get(file) ?? fileIds.set(file, headingIds(file)).get(file);
const problems = rendered.flatMap(({ path, links }) =>
  links.flatMap(({ page, file, hash }) => {
    if (page) return hash && !idsOf.get(page)?.has(hash) ? [`${path}: ${page} has no #${hash}`] : [];
    if (!existsSync(join(ROOT, file))) return [`${path}: ${file} doesn't exist`];
    return hash && file.endsWith(".md") && !idsIn(file).has(hash) ? [`${path}: ${file} has no #${hash}`] : [];
  }),
);
if (problems.length) {
  console.error(`Links that lead nowhere:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

// The app (dist-site/app) stays; what the website built before goes.
for (const name of existsSync(OUT) ? readdirSync(OUT) : []) {
  if (name !== "app") rmSync(join(OUT, name), { recursive: true, force: true });
}

const site = join(ROOT, "site");
const pathIn = (id) => (id.startsWith(`${site}/`) ? id.slice(site.length + 1) : undefined);

await build({
  configFile: false,
  root: site,
  base: "./",
  logLevel: "warn",
  plugins: [
    {
      name: "lines:site-pages",
      resolveId: (id) => (pages.has(pathIn(id)) ? id : undefined),
      load: (id) => pages.get(pathIn(id)),
    },
    tailwindcss(),
  ],
  build: {
    outDir: OUT,
    emptyOutDir: false,
    rollupOptions: { input: [...pages.keys()].map((page) => join(site, page)) },
  },
});
console.log(`Built the website: ${pages.size} pages in dist-site/, beside the app in dist-site/app/.`);
