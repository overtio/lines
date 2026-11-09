import { lines } from "../src/plugins/themes/lines";
import { themeCss } from "../src/lib/themes/css";
import { REPO, href, inline } from "./content.mjs";

/*
 * The website's pages, as HTML for build.mjs to hand Vite: the layout every page shares, and the
 * docs' (home.mjs has the home page). Every page is drawn in the Lines theme, light or dark as the
 * system is, and with more contrast when it asks for it, as the app is.
 */

const THEME = themeCss([lines]);

/*
 * Scripts the pages run, written here as functions and put in the pages as their source. Before the
 * first paint: the system's scheme and contrast, which the theme's colors follow.
 */
function followSystem() {
  const root = document.documentElement;
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const more = matchMedia("(prefers-contrast: more)");
  const show = () => {
    root.dataset.scheme = dark.matches ? "dark" : "light";
    if (more.matches) root.dataset.contrast = "more";
    else delete root.dataset.contrast;
  };
  show();
  dark.addEventListener("change", show);
  more.addEventListener("change", show);
}

export const script = (run) => `<script>(${run})();</script>`;

const esc = Bun.escapeHTML;

const NAV_LINK = "rounded-md px-2.5 py-1.5 text-muted no-underline transition-colors hover:bg-hover hover:text-fg aria-[current=page]:text-fg";

export function layout({ page, title, description, head = "", body }) {
  const up = (path) => href(page, path);
  const current = (section) => (section ? ' aria-current="page"' : "");
  const changelog = page === "docs/changelog.html";
  return `<!doctype html>
<html lang="en" data-theme="lines">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="${lines.light.bg}" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="${lines.dark.bg}" />
    <link rel="icon" type="image/svg+xml" href="${up("../public/icon.svg")}" />
    ${script(followSystem)}${head}
    <style>${THEME}</style>
    <link rel="stylesheet" href="${up("site.css")}" />
  </head>
  <body>
    <a class="skip" href="#main">Skip to content</a>
    <header class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
      <a href="${up("./")}" class="flex items-center gap-2.5 text-lg font-semibold text-fg no-underline">
        <img src="${up("../public/icon.svg")}" alt="" width="28" height="28" />lines
      </a>
      <nav aria-label="Site" class="ml-auto flex items-center gap-1 text-md">
        <a href="${up("docs/")}" class="${NAV_LINK}"${current(page.startsWith("docs/") && !changelog)}>Docs</a>
        <a href="${up("docs/changelog.html")}" class="${NAV_LINK} max-sm:hidden"${current(changelog)}>What's new</a>
        <a href="${REPO}" class="${NAV_LINK} max-sm:hidden">GitHub</a>
        <a href="${up("app/")}" class="button button-primary ml-2">Open lines</a>
      </nav>
    </header>
${body}
    <footer class="mt-24 border-t border-line">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-sm text-muted sm:px-6">
        <p class="m-0">lines is free software, under the <a href="${REPO}/blob/main/LICENSE">AGPL</a>.</p>
        <nav aria-label="More" class="flex flex-wrap gap-x-5 gap-y-2 sm:ml-auto">
          <a href="${up("./#download")}">Download</a>
          <a href="${up("docs/")}">Docs</a>
          <a href="${up("docs/changelog.html")}">What's new</a>
          <a href="${up("docs/contributing.html")}">Contributing</a>
          <a href="${REPO}">GitHub</a>
        </nav>
      </div>
    </footer>
  </body>
</html>
`;
}

/** The docs' list, by group, with the page that's open marked; `prefix` keeps its ids apart from another copy's on the page. */
function docsNav(groups, page, prefix = "") {
  return groups
    .map(
      (group, i) => `<p id="${prefix}docs-group-${i}" class="mt-6 mb-1.5 px-2.5 text-xs font-semibold text-faint first:mt-0">${esc(group.title)}</p>
          <ul aria-labelledby="${prefix}docs-group-${i}">
            ${group.pages
              .map(
                (entry) =>
                  `<li><a href="${href(page, entry.page)}" class="block rounded-md px-2.5 py-1.5 text-sm text-muted no-underline transition-colors hover:bg-hover hover:text-fg aria-[current=page]:bg-active aria-[current=page]:font-medium aria-[current=page]:text-fg"${entry.page === page ? ' aria-current="page"' : ""}>${esc(entry.label)}</a></li>`,
              )
              .join("\n            ")}
          </ul>`,
    )
    .join("\n          ");
}

/** A page of the docs: their list beside it (in a menu on narrow screens), and its outline. */
function docsLayout({ page, title, description, groups, content, outline = [] }) {
  const toc = outline.length > 1
    ? `<aside class="hidden w-52 shrink-0 xl:block">
        <nav aria-labelledby="outline" class="sticky top-0 max-h-screen overflow-y-auto py-10">
          <p id="outline" class="mt-0 mb-1.5 text-xs font-semibold text-faint">On this page</p>
          <ul class="text-sm">
            ${outline.map((heading) => `<li><a href="#${heading.id}" class="block py-1 text-muted no-underline hover:text-fg">${heading.html.replace(/<[^>]+>/g, "")}</a></li>`).join("\n            ")}
          </ul>
        </nav>
      </aside>`
    : "";
  return layout({
    page,
    title,
    description,
    body: `    <div class="mx-auto flex max-w-7xl gap-10 px-4 sm:px-6">
      <aside class="hidden w-56 shrink-0 lg:block">
        <nav aria-label="Docs" class="sticky top-0 -mx-2.5 max-h-screen overflow-y-auto py-10">
          ${docsNav(groups, page)}
        </nav>
      </aside>
      <main id="main" class="min-w-0 flex-1 py-8 lg:py-10">
        <details class="docs-menu mb-8 lg:hidden">
          <summary>All docs</summary>
          <nav aria-label="Docs" class="mt-2">
          ${docsNav(groups, page, "menu-")}
          </nav>
        </details>
        ${content}
      </main>
      ${toc}
    </div>`,
  });
}

export function doc({ entry, groups, rendered }) {
  return docsLayout({
    page: entry.page,
    title: `${entry.label} · lines docs`,
    description: entry.about.replace(/`/g, ""),
    groups,
    outline: rendered.headings,
    content: `<article class="prose">${rendered.html}</article>
        <p class="mt-14 border-t border-line pt-6 text-sm text-muted"><a href="${REPO}/edit/main/${entry.path}">Edit this page on GitHub</a></p>`,
  });
}

export function docsHome({ groups }) {
  const page = "docs/index.html";
  return docsLayout({
    page,
    title: "lines docs",
    description: "How to use lines, and how to work on it.",
    groups,
    content: `<div class="prose"><h1>Docs</h1><p class="text-lg text-muted">How to use lines, and how to work on it.</p></div>
        ${groups
          .map(
            (group, i) => `<section aria-labelledby="group-${i}" class="mt-10 max-w-3xl">
          <h2 id="group-${i}" class="m-0 text-lg font-semibold">${esc(group.title)}</h2>
          <ul class="mt-4 grid gap-3 sm:grid-cols-2">
            ${group.pages
              .map(
                (entry) => `<li><a href="${href(page, entry.page)}" class="block h-full rounded-xl border border-card-line bg-card p-4 no-underline shadow-card transition-colors hover:bg-hover">
              <span class="block font-semibold text-fg">${esc(entry.label)}</span>
              <span class="mt-1 block text-sm text-muted">${inline(entry.about)}</span>
            </a></li>`,
              )
              .join("\n            ")}
          </ul>
        </section>`,
          )
          .join("\n        ")}`,
  });
}
