import { t } from "../../lib/i18n/index.svelte";
import { isTauri } from "../../lib/platform";
import type { PaperSource, Plugin } from "../../lib/plugins/types";
import { arxivText } from "./links";
import { search } from "./search";

/*
 * arXiv (arxiv.org), the open archive of papers in physics, math, computer science and more. Links
 * to its papers read the way arXiv cites them, arXiv:1706.03762, and "/paper" searches it.
 */

/** A paper (Lucide's graduation cap, ISC): arXiv's own logo is only for crediting its API. */
const PAPER_MARK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>';

const source: PaperSource = {
  id: "arxiv",
  name: "arXiv",
  // In the words arXiv asks products using its API to say (info.arxiv.org/brand).
  credit: {
    text: "Thank you to arXiv for use of its open access interoperability.",
    href: "https://arxiv.org",
    title:
      "This product was not reviewed or approved by, nor does it necessarily express or reflect the policies or opinions of, arXiv.",
  },
  search,
};

export const arxiv = (): Plugin => ({
  id: "arxiv",
  name: "arXiv",
  description: t("plugins.arxiv.description"),
  icon: "graduation-cap",
  enabledByDefault: true,
  contributes: {
    links: [{ id: "arxiv", mark: PAPER_MARK, text: arxivText }],
    // arXiv's API doesn't take requests from web pages (CORS), only from the apps.
    papers: isTauri ? [source] : [],
  },
});
