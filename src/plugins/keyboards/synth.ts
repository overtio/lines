import type { KeyClip, KeySounds } from "../../lib/plugins/types";

/*
 * Keyboards made from sound rather than recorded. A keystroke is a few things heard at once: the
 * keycap bottoming out (a burst of noise, in a band), the cap, plate and case ringing after it (a few
 * resonances dying away), on a clicky switch a sharp click just before, and coming back up a lighter
 * one. Long keys (Space, Return, Shift) ring lower and longer, with their stabilizers' rattle. Each is
 * made in six variations a little apart, so a word doesn't sound like one key over and over.
 */

/** A resonance: its frequency (Hz), how long it rings (ms, to about a third), and how loud. */
type Mode = [frequency: number, ring: number, gain: number];

/** One thing heard: at `at` ms into the sound, its resonances and a burst of noise in a band (Hz). */
export interface Hit {
  at?: number;
  modes: Mode[];
  noise: { gain: number; decay: number; low: number; high: number };
}

/** What a switch sounds like pressed and let go; for Return, an extra sound (a typewriter's bell). */
export interface Switch {
  press: Hit[];
  release: Hit[];
  enter?: Hit[];
  /** Whether long keys rattle (stabilizers); a typewriter's don't. */
  rattle?: boolean;
}

const VARIATIONS = 6;

/** The same numbers each time, so a keyboard always sounds itself. */
function seeded(seed: number) {
  let state = seed >>> 0 || 1;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

/** A biquad filter (RBJ's cookbook), run over `samples` in place. */
function filter(samples: Float32Array, rate: number, kind: "lowpass" | "highpass", frequency: number) {
  const w = (2 * Math.PI * Math.min(frequency, rate * 0.45)) / rate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const [b0, b1, b2] = kind === "lowpass" ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  const [a0, a1, a2] = [1 + alpha, -2 * cos, 1 - alpha];
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    [x2, x1, y2, y1] = [x1, x, y1, y];
    samples[i] = y;
  }
}

/** How a long key differs: lower, longer, and rattling. */
interface Size {
  pitch: number;
  length: number;
  rattle: boolean;
}

/** The hits drawn into one sound, `size` as the key is, each a little apart from the last (`random`). */
function render(hits: Hit[], rate: number, size: Size, random: () => number, peak: number): Float32Array<ArrayBuffer> {
  const spread = (amount: number) => 1 + (random() - 0.5) * amount;
  const all = size.rattle
    ? [...hits, ...[4, 11].map((at): Hit => ({ at: (hits[0]?.at ?? 0) + at * spread(0.4), modes: [], noise: { gain: 0.3, decay: 1.6, low: 1800, high: 6500 } }))]
    : hits;
  const longest = Math.max(...all.map((hit) => (hit.at ?? 0) + 5 * size.length * Math.max(hit.noise.decay, ...hit.modes.map((mode) => mode[1]))));
  const out = new Float32Array(Math.ceil((longest / 1000) * rate));
  const attack = 0.0003 * rate;
  for (const hit of all) {
    const start = Math.round(((hit.at ?? 0) / 1000) * rate);
    const { gain, decay, low, high } = hit.noise;
    if (gain) {
      const tau = (decay * size.length * spread(0.2) * rate) / 1000;
      const burst = new Float32Array(Math.min(Math.ceil(5 * tau), out.length - start));
      for (let i = 0; i < burst.length; i++) burst[i] = (random() * 2 - 1) * Math.exp(-i / tau);
      filter(burst, rate, "highpass", low * size.pitch);
      filter(burst, rate, "lowpass", high * size.pitch);
      const level = gain * spread(0.25);
      for (let i = 0; i < burst.length; i++) out[start + i] += level * burst[i];
    }
    for (const [frequency, ring, level] of hit.modes) {
      const step = (2 * Math.PI * frequency * size.pitch * spread(0.06)) / rate;
      const tau = (ring * size.length * spread(0.2) * rate) / 1000;
      const phase = random() * 2 * Math.PI;
      const loud = level * spread(0.3);
      const end = Math.min(Math.ceil(5 * tau), out.length - start);
      for (let i = 0; i < end; i++) out[start + i] += loud * (1 - Math.exp(-i / attack)) * Math.sin(phase + step * i) * Math.exp(-i / tau);
    }
  }
  // As loud as `peak` at its loudest, and in from silence so it doesn't pop.
  let max = 0;
  for (const sample of out) max = Math.max(max, Math.abs(sample));
  const scale = max ? peak / max : 0;
  for (let i = 0; i < out.length; i++) out[i] *= scale * (i < attack ? i / attack : 1);
  return out;
}

const SIZES: Record<"key" | "wide" | "space", Omit<Size, "rattle">> = {
  key: { pitch: 1, length: 1 },
  wide: { pitch: 0.86, length: 1.25 },
  space: { pitch: 0.72, length: 1.5 },
};

/** Which size of key a key is, by `KeyboardEvent.code`. */
const sizeOf = (code: string): keyof typeof SIZES =>
  code === "Space" ? "space" : /^(Enter|NumpadEnter|Backspace|Shift(Left|Right)|Tab|CapsLock|Numpad0|NumpadAdd)$/.test(code) ? "wide" : "key";

/** A switch's sounds for `context`: each size of key, pressed and let go, in its variations. */
export function sounds(of: Switch, context: BaseAudioContext, seed: number): KeySounds {
  const random = seeded(seed);
  const rate = context.sampleRate;
  const buffer = (samples: Float32Array<ArrayBuffer>) => {
    const made = context.createBuffer(1, samples.length, rate);
    made.copyToChannel(samples, 0);
    return made;
  };
  const made = (hits: Hit[], size: keyof typeof SIZES, peak: number) =>
    Array.from({ length: VARIATIONS }, () => buffer(render(hits, rate, { ...SIZES[size], rattle: !!of.rattle && size !== "key" }, random, peak)));
  const sizes = Object.keys(SIZES) as (keyof typeof SIZES)[];
  const press = Object.fromEntries(sizes.map((size) => [size, made(of.press, size, 0.8)]));
  const release = Object.fromEntries(sizes.map((size) => [size, made(of.release, size, 0.45)]));
  const enter = of.enter && made([...of.press, ...of.enter], "wide", 0.8);
  // Never the same variation twice running.
  let last: AudioBuffer | undefined;
  const pick = (choices: AudioBuffer[]): KeyClip => {
    const options = choices.filter((choice) => choice !== last);
    last = options[Math.floor(Math.random() * options.length)];
    return { buffer: last };
  };
  return {
    press: (code) => pick(enter && code.endsWith("Enter") ? enter : press[sizeOf(code)]),
    release: (code) => pick(release[sizeOf(code)]),
  };
}
