import { t } from "../../lib/i18n/index.svelte";
import type { KeyboardSound, Plugin } from "../../lib/plugins/types";
import { type Switch, sounds } from "./synth";

/*
 * Keyboards to hear as you type, made from sound (synth.ts), so there are no recordings to license:
 * a deep, lubed linear; a bright, clacky one; tactile; clicky; Topre; and a typewriter, bell and all.
 * Recorded keyboards come as sound packs of your own (lib/sounds/packs.svelte.ts).
 */

const SWITCHES: Record<string, Switch> = {
  // Lubed linears with thick PBT caps, on foam: low and round.
  creamy: {
    press: [{ modes: [[380, 18, 1], [820, 12, 0.45], [1700, 7, 0.2]], noise: { gain: 0.55, decay: 4, low: 120, high: 2600 } }],
    release: [{ modes: [[560, 9, 0.35], [1300, 6, 0.15]], noise: { gain: 0.22, decay: 3, low: 300, high: 3500 } }],
    rattle: true,
  },
  // Linears with thin ABS caps on an aluminium plate: high and sharp.
  clacky: {
    press: [{ modes: [[950, 14, 1], [2300, 9, 0.6], [4300, 6, 0.3]], noise: { gain: 0.6, decay: 3.5, low: 500, high: 8000 } }],
    release: [{ modes: [[1300, 8, 0.4], [3100, 5, 0.2]], noise: { gain: 0.3, decay: 2.5, low: 800, high: 9000 } }],
    rattle: true,
  },
  // A bump felt and heard on the way down, then the bottom.
  tactile: {
    press: [
      { modes: [], noise: { gain: 0.2, decay: 6, low: 900, high: 5000 } },
      { at: 14, modes: [[520, 16, 1], [1250, 10, 0.45], [2700, 6, 0.2]], noise: { gain: 0.5, decay: 4, low: 200, high: 4000 } },
    ],
    release: [
      { modes: [], noise: { gain: 0.12, decay: 4, low: 900, high: 5000 } },
      { at: 8, modes: [[700, 10, 0.35], [1600, 6, 0.15]], noise: { gain: 0.2, decay: 3, low: 300, high: 4000 } },
    ],
    rattle: true,
  },
  // A click jacket's snap before the bottom, and again on the way up.
  clicky: {
    press: [
      { modes: [[4100, 2.5, 1], [6300, 1.8, 0.6]], noise: { gain: 0.9, decay: 1.2, low: 2500, high: 12000 } },
      { at: 16, modes: [[900, 12, 0.6], [2400, 7, 0.35]], noise: { gain: 0.45, decay: 3, low: 400, high: 7000 } },
    ],
    release: [
      { modes: [[3800, 2, 0.5], [5900, 1.5, 0.3]], noise: { gain: 0.5, decay: 1, low: 2500, high: 12000 } },
      { at: 6, modes: [[1200, 7, 0.3]], noise: { gain: 0.2, decay: 2, low: 600, high: 6000 } },
    ],
    rattle: true,
  },
  // A rubber dome under a spring: soft, deep, a muffled thock.
  topre: {
    press: [{ modes: [[300, 26, 1], [640, 16, 0.45], [1350, 8, 0.15]], noise: { gain: 0.35, decay: 7, low: 80, high: 1600 } }],
    release: [{ modes: [[420, 12, 0.5], [900, 8, 0.2]], noise: { gain: 0.18, decay: 4, low: 150, high: 2200 } }],
    rattle: true,
  },
  // A typebar striking the platen and the frame ringing; Return rings the margin bell.
  typewriter: {
    press: [{ modes: [[170, 40, 0.9], [1180, 70, 0.45], [2650, 45, 0.3], [4050, 30, 0.2]], noise: { gain: 0.9, decay: 7, low: 300, high: 7000 } }],
    release: [{ modes: [[700, 15, 0.15]], noise: { gain: 0.15, decay: 5, low: 400, high: 3000 } }],
    enter: [{ at: 140, modes: [[1760, 500, 0.7], [2640, 350, 0.25], [4420, 250, 0.2]], noise: { gain: 0, decay: 1, low: 1, high: 1 } }],
  },
};

const NAMES: Record<keyof typeof SWITCHES, [name: Parameters<typeof t>[0], about: Parameters<typeof t>[0]]> = {
  creamy: ["keyboards.creamy", "keyboards.creamy.about"],
  clacky: ["keyboards.clacky", "keyboards.clacky.about"],
  tactile: ["keyboards.tactile", "keyboards.tactile.about"],
  clicky: ["keyboards.clicky", "keyboards.clicky.about"],
  topre: ["keyboards.topre", "keyboards.topre.about"],
  typewriter: ["keyboards.typewriter", "keyboards.typewriter.about"],
};

const keyboards = (): KeyboardSound[] =>
  Object.entries(SWITCHES).map(([id, of], index) => ({
    id,
    name: t(NAMES[id][0]),
    description: t(NAMES[id][1]),
    load: async (context) => sounds(of, context, index + 1),
  }));

export const keyboardSounds = (): Plugin => ({
  id: "keyboards",
  name: t("plugins.keyboards"),
  description: t("plugins.keyboards.description"),
  icon: "keyboard",
  enabledByDefault: true,
  contributes: { keyboardSounds: keyboards() },
});
