import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";
import { GITHUB_MARK } from "../../lib/release";
import { githubText } from "./links";

/** Links to GitHub, drawn short with GitHub's mark, the way GitHub writes them: overtio/lines#12. */
export const github = (): Plugin => ({
  id: "github",
  name: "GitHub",
  description: t("plugins.github.description"),
  icon: "link",
  enabledByDefault: true,
  contributes: {
    links: [{ id: "github", mark: GITHUB_MARK, text: githubText }],
  },
});
