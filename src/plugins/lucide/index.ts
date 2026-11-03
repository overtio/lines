import { t } from "../../lib/i18n/index.svelte";
import type { Plugin } from "../../lib/plugins/types";
import LucideIcon from "./LucideIcon.svelte";

/** Lucide's icons (lucide.dev): lines' own, everywhere, and what it falls back to. */
export const lucide = (): Plugin => ({
  id: "lucide",
  name: "Lucide",
  description: t("plugins.lucide.description"),
  icon: "shapes",
  enabledByDefault: true,
  required: true,
  contributes: { iconSets: [{ id: "lucide", name: "Lucide", component: LucideIcon }] },
});
