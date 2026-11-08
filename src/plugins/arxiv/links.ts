/*
 * arXiv's papers, named the way arXiv names them: 1706.03762 (since 2007, with a version after it:
 * 1706.03762v7), or hep-th/9901001 before. A link to one reads as arXiv cites it, arXiv:1706.03762.
 */

const NEW = String.raw`\d{4}\.\d{4,5}(?:v\d+)?`;
const OLD = String.raw`[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?`;
const ID = new RegExp(`^(?:${NEW}|${OLD})$`);

/** Pages on arxiv.org that are a paper's, by the first part of their path: its abstract, PDF, HTML. */
const PAPER_PAGES = new Set(["abs", "pdf", "html", "format"]);

/** The arXiv paper a link is to, by its id (with its version, if the link has one); null for any other link. */
export function arxivLinkId(url: URL): string | null {
  if (/^(?:www\.|export\.)?arxiv\.org$/i.test(url.hostname)) {
    const [, page, ...rest] = url.pathname.split("/");
    if (!PAPER_PAGES.has(page)) return null;
    const id = rest.join("/").replace(/\.pdf$/i, "").replace(/\/$/, "");
    return ID.test(id) ? id : null;
  }
  // The DOI arXiv gives every paper.
  if (/^(?:dx\.)?doi\.org$/i.test(url.hostname)) {
    const match = /^\/10\.48550\/arxiv\.(.+)$/i.exec(url.pathname);
    return match && ID.test(match[1]) ? match[1] : null;
  }
  return null;
}

/** How a link to an arXiv paper reads in short, arXiv:1706.03762; null for any other link. */
export function arxivText(url: URL): string | null {
  const id = arxivLinkId(url);
  return id && `arXiv:${id}`;
}

/** The paper that searching for `text` means, if it names one: 1706.03762, arXiv:1706.03762, or a link to it. */
export function arxivIdIn(text: string): string | null {
  const bare = text.trim().replace(/^arxiv:\s*/i, "");
  if (ID.test(bare)) return bare;
  try {
    return arxivLinkId(new URL(/^https?:\/\//i.test(bare) ? bare : `https://${bare}`));
  } catch {
    return null;
  }
}
