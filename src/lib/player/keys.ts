import { isApple } from "../platform";
import { BACK, FORWARD, player } from "./player.svelte";

/*
 * The player's keys, anywhere in the main window, a note's text too, so it's played without leaving
 * what you're writing: ⌃⌘P plays or pauses, ⌃⌘← and ⌃⌘→ go back 15 seconds and forward 30; Ctrl+Alt+P,
 * Ctrl+Alt+, and Ctrl+Alt+. on Windows and Linux, where Ctrl+Alt+arrows switch workspaces. As lines'
 * lock (⌃⌘L), they're ⌃⌘ on a Mac, which the system and the editor leave alone. Listed in shortcuts.ts.
 */

type Action = "toggle" | "back" | "forward";

/** By where the key is, so they're the same keys in every layout (AZERTY's `.` needs Shift; this key doesn't). */
const KEYS: Record<string, Action> = isApple ? { KeyP: "toggle", ArrowLeft: "back", ArrowRight: "forward" } : { KeyP: "toggle", Comma: "back", Period: "forward" };

/** On Windows, Ctrl+Alt is AltGr too: a key that types a character with it (`ö`, `<`) is that character's, not the player's. */
const isWindows = /Windows/.test(navigator.userAgent);
const typesWithAltGr = (event: KeyboardEvent) => isWindows && event.key.length === 1 && !/^[a-z,.;:]$/i.test(event.key);

/** Does what a key pressed asks of the player, if it's one of its and there's an episode in it; whether it did. */
export function playerKey(event: KeyboardEvent): boolean {
  const chord = event.ctrlKey && !event.shiftKey && (isApple ? event.metaKey && !event.altKey : event.altKey && !event.metaKey);
  const action = chord && !typesWithAltGr(event) ? KEYS[event.code] : undefined;
  if (!action || !player.episode) return false;
  // Held down, it's pressed once: play and pause don't flicker; skipping goes on, as it would pressed again.
  if (action === "toggle") {
    if (!event.repeat) player.toggle();
  } else player.skip(action === "back" ? -BACK : FORWARD);
  return true;
}
