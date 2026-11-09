import { plugins } from "../plugins/registry.svelte";
import type { KeyClip, KeySounds } from "../plugins/types";
import { prefs } from "../prefs.svelte";

/*
 * Typing sounds (Settings → Editor → Typing sounds): a keyboard's sound for each key pressed in this
 * window, and let go, as a mechanical keyboard makes them. One sound for each press, not for a held
 * key's repeats; each a little higher or lower than the last, as no two strokes sound the same. The
 * keyboard chosen is made (or decoded) as soon as it's chosen, so the first key isn't late.
 */

let context: AudioContext | undefined;
let output: GainNode | undefined;
let loaded: { id: string; sounds: Promise<KeySounds> } | undefined;
/** The keys down now, so a held key plays once, and its letting go only after its press. */
const down = new Set<string>();

/** Whether the keyboard chosen couldn't be played here (a pack in a format the system can't read). */
export const typing = $state({ unplayable: false });

function start() {
  if (!context) {
    context = new AudioContext({ latencyHint: "interactive" });
    output = context.createGain();
    output.connect(context.destination);
  }
  output!.gain.value = prefs.typingVolume;
  return context;
}

/** The chosen keyboard's sounds, made once for each keyboard chosen. */
function sounds() {
  const keyboard = plugins.keyboardSound(prefs.keyboardSound);
  if (!keyboard) return undefined;
  if (loaded?.id !== keyboard.id) {
    const sounds = keyboard.load(start());
    loaded = { id: keyboard.id, sounds };
    // Said once it's known, never while an effect is choosing it.
    const settled = (unplayable: boolean) => loaded?.sounds === sounds && (typing.unplayable = unplayable);
    sounds.then(() => settled(false), () => settled(true));
  }
  return loaded.sounds;
}

function play(clip: KeyClip | undefined) {
  if (!clip || !context || !output) return;
  const source = context.createBufferSource();
  source.buffer = clip.buffer;
  source.playbackRate.value = 0.97 + Math.random() * 0.06;
  source.connect(output);
  source.start(0, clip.offset ?? 0, clip.duration);
}

function pressed(event: KeyboardEvent) {
  if (event.repeat || !event.code || down.has(event.code)) return;
  down.add(event.code);
  // Browsers start sound only after a key or a click: this is the first.
  if (start().state === "suspended") void context!.resume();
  void sounds()?.then((keys) => play(keys.press(event.code)), () => {});
}

function released(event: KeyboardEvent) {
  if (!down.delete(event.code)) return;
  void sounds()?.then((keys) => play(keys.release(event.code)), () => {});
}

/** The window lost the keys (another app took them): none are down any more. */
const forget = () => down.clear();

$effect.root(() => {
  $effect(() => {
    if (!prefs.typingSounds) return;
    void sounds();
    window.addEventListener("keydown", pressed, true);
    window.addEventListener("keyup", released, true);
    window.addEventListener("blur", forget);
    return () => {
      window.removeEventListener("keydown", pressed, true);
      window.removeEventListener("keyup", released, true);
      window.removeEventListener("blur", forget);
      forget();
    };
  });
  $effect(() => {
    if (output) output.gain.value = prefs.typingVolume;
  });
});
