import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";
import { storyId, storyPage } from "./links";
import { loadThread } from "./thread";

/*
 * Hacker News (news.ycombinator.com): a story's discussion, read under its post in the Library's
 * feeds rather than only linked to (docs/plugins.md). Only read: voting and replying need an
 * account, and Hacker News has no API for either.
 */

export const hackerNews = (): Plugin => ({
  id: "hacker-news",
  name: "Hacker News",
  description: t("plugins.hackerNews.description"),
  icon: "message-circle",
  enabledByDefault: true,
  requires: ["feeds"],
  contributes: {
    discussions: [
      {
        id: "hacker-news",
        name: "Hacker News",
        recognizes: (url) => storyId(url) !== null,
        page: (url) => storyPage(storyId(url)!),
        load: (url, signal) => loadThread(storyId(url)!, signal),
      },
    ],
  },
});
