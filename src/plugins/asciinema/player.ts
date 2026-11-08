import type { Player } from "asciinema-player";
import { solid } from "../../lib/colors";
import { lookKey, onLookChange } from "../../lib/editor/rendered";
import { t } from "../../lib/i18n/index.svelte";
import { webFetch } from "../../lib/platform";
import type { Shown } from "../../lib/plugins/types";
import { castInfo } from "./recordings";

/*
 * A recording's player, in the theme's colors and the note's code font. It shows the middle of the
 * recording until it plays, as asciinema.org does. The player loads the first time a note has one.
 */

let loading: Promise<typeof import("asciinema-player")> | undefined;
const loadPlayer = () => (loading ??= import("asciinema-player"));

/** Recordings fetched lately, by address, so one drawn again (scrolled back to, in a new look) shows at once. */
const fetched = new Map<string, string>();

/** A recording on the web, through the app's own fetch, which isn't held to the browser's rules for other sites. */
export async function fetchCast(url: string) {
  let cast = fetched.get(url);
  if (cast === undefined) {
    const response = await (await webFetch())(url);
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    cast = await response.text();
  }
  fetched.delete(url);
  fetched.set(url, cast);
  if (fetched.size > 20) fetched.delete(fetched.keys().next().value!);
  return cast;
}

/** The terminal's colors in this look, by the custom property its player reads, as the hex colors it needs. */
let colors: { look: string; values: [string, string][] } | undefined;

function terminalColors() {
  const look = lookKey();
  if (colors?.look === look) return colors.values;
  const dark = document.documentElement.dataset.scheme === "dark";
  const mix = (color: string, amount: number) => `color-mix(in srgb, ${color} ${amount}%, var(--bg))`;
  // Black is the dark end and white the light one, whichever the background is.
  const ends = dark
    ? { 0: mix("var(--text)", 22), 7: "var(--text)", 8: "var(--text-faint)", 15: "var(--text)" }
    : { 0: "var(--text)", 7: "var(--text-faint)", 8: "var(--text-muted)", 15: mix("var(--text)", 25) };
  const palette: Record<string, string> = {
    ...ends,
    1: "var(--danger)",
    2: "var(--success)",
    3: "var(--callout-warning)",
    4: "var(--callout-info)",
    5: "var(--callout-question)",
    6: "var(--callout-decision)",
  };
  const values: [string, string][] = [
    ["--term-color-foreground", solid("var(--text)")],
    ["--term-color-background", solid("var(--code-bg)")],
    ...Object.entries(palette).map(([n, css]): [string, string] => [`--term-color-${n}`, solid(css)]),
  ];
  colors = { look, values };
  return values;
}

/** Players on screen, each drawn again in a new look. */
const live = new Set<() => void>();
onLookChange(() => live.forEach((draw) => draw()));

/**
 * Plays the recording `read` gives in `dom`, from `startAt` and at `speed` when they're given,
 * calling `changed` when its size may have changed.
 */
export function playRecording(dom: HTMLElement, read: () => Promise<string>, { startAt, speed }: { startAt?: string; speed?: number } = {}, changed = () => {}): Shown {
  dom.classList.add("cm-lp-recording");
  dom.setAttribute("role", "group");
  dom.setAttribute("aria-label", t("editor.recording"));
  let player: Player | undefined;
  let gone = false;

  const draw = async () => {
    let cast: string;
    try {
      cast = await read();
    } catch (error) {
      console.error("lines: couldn't load a recording", error);
      if (gone) return;
      const message = Object.assign(document.createElement("span"), { className: "cm-lp-embed-message", textContent: t("editor.recording.failed") });
      dom.replaceChildren(message);
      changed();
      return;
    }
    const { create } = await loadPlayer();
    if (gone) return;
    const info = castInfo(cast);
    player?.dispose();
    dom.replaceChildren();
    for (const [property, value] of terminalColors()) dom.style.setProperty(property, value);
    // No wider than the terminal is at the size of the note's code.
    if (info?.cols) dom.style.setProperty("--recording-cols", String(info.cols));
    player = create({ data: cast }, dom, {
      fit: "width",
      preload: true,
      poster: `npt:${startAt ?? info?.middle ?? 0}`,
      startAt,
      speed,
      theme: "lines",
      adaptivePalette: true,
      keystrokeOverlay: false,
      terminalFontFamily: "var(--font-mono)",
    });
    // Its clicks and keys are its own, not the note's (editor/util.ts).
    player.el.classList.add("cm-lp-own-input");
    // Sized to the note's width, once it's measured that.
    player.el.addEventListener("resize", changed);
    changed();
  };

  live.add(draw);
  void draw();
  return {
    focus() {
      if (!player) return;
      player.el.focus();
      void player.play();
    },
    destroy() {
      gone = true;
      live.delete(draw);
      player?.dispose();
    },
  };
}
