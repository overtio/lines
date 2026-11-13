/*
 * OPML, the file feed readers and podcast apps trade their subscriptions in: an outline whose
 * entries each name a feed (`xmlUrl`), its title and its site (`htmlUrl`), in folders or not.
 */

export interface Outline {
  /** The feed's address. */
  url: string;
  title: string;
  /** The site it's from. */
  site?: string;
}

/** The feeds an OPML file lists, folders and all, each once. */
export function readOpml(text: string): Outline[] {
  const document = new DOMParser().parseFromString(text.replace(/^[^<]*/, ""), "application/xml");
  const found = new Map<string, Outline>();
  for (const outline of document.getElementsByTagName("outline")) {
    const url = outline.getAttribute("xmlUrl")?.trim();
    if (!url || !/^https?:\/\//i.test(url) || found.has(url)) continue;
    const title = (outline.getAttribute("title") || outline.getAttribute("text") || "").trim();
    const site = outline.getAttribute("htmlUrl")?.trim();
    found.set(url, { url, title, ...(site && /^https?:\/\//i.test(site) && { site }) });
  }
  return [...found.values()];
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** These feeds as an OPML file, titled `title`. */
export function writeOpml(title: string, outlines: Outline[], created = new Date()): string {
  const lines = outlines.map(
    ({ url, title, site }) => `    <outline type="rss" text="${escape(title)}" title="${escape(title)}" xmlUrl="${escape(url)}"${site ? ` htmlUrl="${escape(site)}"` : ""}/>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head>",
    `    <title>${escape(title)}</title>`,
    `    <dateCreated>${created.toUTCString()}</dateCreated>`,
    "  </head>",
    "  <body>",
    ...lines,
    "  </body>",
    "</opml>",
    "",
  ].join("\n");
}
