import { t } from "../../lib/i18n/index.svelte";
import { isTauri } from "../../lib/platform";
import type { Plugin } from "../../lib/plugins/types";
import SfSymbol from "./SfSymbol.svelte";

/**
 * Apple's SF Symbols. They may only be used on Apple's platforms, so macOS or iOS draws them in
 * the app as they're needed (src-tauri/src/sf_symbols.rs): they're never bundled or sent to the web.
 */
export const sfSymbols = (): Plugin => ({
  id: "sf-symbols",
  name: "SF Symbols",
  description: t("plugins.sfSymbols.description"),
  icon: "sparkles",
  enabledByDefault: true,
  available: isTauri,
  availability: t("settings.sfSymbolsNote"),
  contributes: { iconSets: [{ id: "sf", name: "SF Symbols", component: SfSymbol }] },
});
