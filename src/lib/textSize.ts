import { speak } from "./a11y";
import { t } from "./i18n/index.svelte";
import { prefs, spokenPixels } from "./prefs.svelte";

/** What each key does to the text's size, by the character typed or else the key's place (other layouts). */
const BY_KEY: Record<string, -1 | 0 | 1> = { "+": 1, "=": 1, "-": -1, "0": 0 };
const BY_CODE: Record<string, -1 | 0 | 1> = { Equal: 1, NumpadAdd: 1, Minus: -1, NumpadSubtract: -1, Digit0: 0, Numpad0: 0 };

/**
 * ⌘+ and ⌘− (Ctrl elsewhere) make notes' text bigger and smaller, and ⌘0 brings back its usual
 * size, in place of zooming the whole page. Returns whether `event` was one of them.
 */
export function textSizeKey(event: KeyboardEvent): boolean {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return false;
  const by = BY_KEY[event.key] ?? BY_CODE[event.code];
  // Shift only as part of typing +.
  if (by === undefined || (event.shiftKey && by !== 1)) return false;
  event.preventDefault();
  speak(t("app.textSize", { size: spokenPixels(prefs.stepTextSize(by)) }));
  return true;
}
