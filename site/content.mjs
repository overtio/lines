import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, posix } from "node:path";

/*
 * The docs on the website come from the repository: the README's Documentation tables are their
 * list, and the Markdown files those name their pages. Links between those files become links
 * between pages, and links to anything else in the repository go to it on GitHub.
 */

export const ROOT = join(import.meta.dir, "..");
export const REPO = "https://github.com/overtio/lines";
/** Where the website is published (website.yml); links to it in the Markdown become relative. */
export const SITE = "https://overtio.github.io/lines/";

/** In docs/, but not documentation: a dated snapshot of the code. */
const UNLISTED = new Set(["docs/AUDIT.md"]);

export const read = (path) => readFileSync(join(ROOT, path), "utf8");

function need(value, what) {
  if (!value) throw new Error(`The website needs ${what}`);
  return value;
}

/** Markdown as GitHub shows it: tables, task lists, struck text and bare links. */
const markdown = (text) => Bun.markdown.html(text, { tables: true, tasklists: true, strikethrough: true, autolinks: true });

/** A line of Markdown, without the paragraph around it. */
export const inline = (text) => markdown(text).trim().replace(/^<p>|<\/p>$/g, "");

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };

/** The id GitHub gives a heading, so links written for GitHub work here too. */
function slugger() {
  const seen = new Map();
  return (html) => {
    const text = html.replace(/<[^>]+>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (_, name) => ENTITIES[name]);
    const slug = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "").replaceAll(" ", "-");
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    return count ? `${slug}-${count}` : slug;
  };
}

/** A path in the site, as a link from `page` (another path in the site). */
export function href(page, path) {
  const link = posix.relative(posix.dirname(page), path) || ".";
  return path.endsWith("/") && link !== "." ? `${link}/` : link;
}

const EXTERNAL = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Renders `text`, from the Markdown file of the repository at `path`, for the page at `page`.
 * `routes` are the files that are pages, by repository path, with their site path and label.
 * Returns the HTML, its h2s for an outline, every id in it, and its links to pages and to other
 * files, for build.mjs to check.
 */
export function render(text, path, page, routes) {
  const slug = slugger();
  const headings = [];
  const links = [];
  const ids = new Set();
  const resolve = (file) => posix.normalize(posix.join(posix.dirname(path), decodeURI(file)));

  const target = (link) => {
    if (link.startsWith(SITE)) return href(page, link.slice(SITE.length) || "./");
    if (EXTERNAL.test(link) || link.startsWith("#")) {
      if (link.startsWith("#")) links.push({ page, hash: link.slice(1) });
      return link;
    }
    const [file, hash = ""] = link.split("#");
    const resolved = resolve(file);
    const route = routes.get(resolved);
    if (route) {
      links.push({ page: route.page, hash });
      return href(page, route.page) + (hash && `#${hash}`);
    }
    links.push({ file: resolved, hash });
    if (!existsSync(join(ROOT, resolved))) return link;
    const kind = statSync(join(ROOT, resolved)).isDirectory() ? "tree" : "blob";
    return `${REPO}/${kind}/main/${resolved}${hash && `#${hash}`}`;
  };

  // A link that reads as the file it's to reads as its page's name instead.
  const named = text.replace(/\[([^\]]+)\]\(([^)#\s]+)(#[^)\s]*)?\)/g, (link, label, file, hash = "") => {
    const route = label === file && routes.get(resolve(file));
    return route ? `[${route.label}](${file}${hash})` : link;
  });

  const withIds = markdown(named)
    .replace(/<h([1-6])>(.*)<\/h\1>/g, (_, level, content) => {
      const id = slug(content);
      if (level === "2") headings.push({ id, html: content });
      const anchor = level === "1" ? "" : `<a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>`;
      return `<h${level} id="${id}">${content}${anchor}</h${level}>`;
    })
    // Wide tables scroll by themselves, rather than the page sideways.
    .replaceAll("<table>", '<div class="table-scroll"><table>')
    .replaceAll("</table>", "</table></div>");

  const html = new HTMLRewriter()
    .on("[id]", { element: (el) => void ids.add(el.getAttribute("id")) })
    .on("a[href]:not(.anchor)", { element: (el) => el.setAttribute("href", target(el.getAttribute("href"))) })
    .on("img[src]", {
      element: (el) => {
        const src = el.getAttribute("src");
        if (EXTERNAL.test(src)) return;
        // Next to the page's own path in site/, so Vite finds the image and publishes it with the page.
        const file = posix.normalize(posix.join(posix.dirname(path), src));
        links.push({ file, hash: "" });
        el.setAttribute("src", posix.relative(posix.dirname(`site/${page}`), file));
      },
    })
    .transform(withIds);
  return { path, page, html, headings, ids, links };
}

/** The ids GitHub gives the headings of a Markdown file of the repository. */
export const headingIds = (path) => render(read(path), path, "", new Map()).ids;

/** The README's Documentation tables, each under its ### heading: the docs' pages, in order. */
export function docGroups() {
  const readme = read("README.md");
  const section = need(readme.match(/^## Documentation\n([\s\S]*?)^## /m), "the README's Documentation")[1];
  const groups = section
    .split(/^### /m)
    .slice(1)
    .map((group) => ({
      title: group.slice(0, group.indexOf("\n")).trim(),
      pages: [...group.matchAll(/^\| \[(.+?)\]\((.+?)\) \| (.+?) \|$/gm)].map(([, label, path, about]) => ({
        label,
        path,
        about,
        page: `docs/${basename(path, ".md").toLowerCase()}.html`,
      })),
    }));
  const listed = new Set(groups.flatMap((group) => group.pages.map((page) => page.path)));
  const missing = [...new Bun.Glob("docs/*.md").scanSync(ROOT)].filter((path) => !listed.has(path) && !UNLISTED.has(path));
  if (missing.length) throw new Error(`Add ${missing.join(", ")} to the README's Documentation tables, the website's list of docs`);
  return groups;
}

