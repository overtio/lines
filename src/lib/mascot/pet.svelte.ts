import { untrack } from "svelte";
import { t } from "../i18n/index.svelte";
import { plugins } from "../plugins/registry.svelte";
import type { Mascot, MascotPose } from "../plugins/types";
import { prefs } from "../prefs.svelte";
import { hex, mix, parse } from "../themes/color";
import { windowLabel } from "../windows/channel";
import { isSettingsWindow } from "../windows/settings.svelte";
import type { CaretPlace } from "../editor/cursor";
import { frame, sizeOf } from "./draw";

/*
 * A mascot (Settings → Mascot) living in the main window. It walks along the bottom of the note,
 * sits and looks about, and falls asleep when you've been away a while. When you type it hops up
 * beside the line you're writing: in the note's margin if there's room, or else at the end of the
 * sentence, shuffling along as it grows (editor/cursor.ts says where that is); it bobs along with
 * your keys and cheers you on now and then, and when you stop it hops back down. It turns to the pointer and pounces when it rests
 * nearby, says something when clicked, and can be picked up and dropped. Ticking a todo makes it
 * celebrate. It ticks ten times a second, only while it's shown and the window is; with reduced
 * motion it stays where it is and only changes how it sits.
 */

const SCALE = { small: 2, medium: 3, large: 4 };
const TICK = 100;
/** In ticks: how long after the last key it stays beside the line, and how long with nothing before it sleeps. */
const STAY = 120;
const NAP = 600;
const WORDS_TO_CHEER = 50;

type Mode = "idle" | "walk" | "hop" | "perch" | "sleep" | "carried" | "fall" | "cheer";

interface Spot {
  x: number;
  y: number;
}

/** A place beside the line being written; `along`, after its text, where it moves as the text grows. */
interface Perch extends Spot {
  along: boolean;
}

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

class Pet {
  readonly #host = document.createElement("div");
  readonly #sprite = document.createElement("canvas");
  readonly #bubble = document.createElement("div");
  readonly #width: number;
  readonly #height: number;
  readonly #timer: ReturnType<typeof setInterval>;
  readonly #listeners = new AbortController();

  #x = 0;
  #y = 0;
  #left = false;
  #mode: Mode = "idle";
  #after: Mode = "idle";
  #pose: MascotPose = "stand";
  #until = 20;
  #tick = 0;
  #walkTo = 0;
  #hop: { from: Spot; to: Spot; at: number; length: number } | undefined;
  #vy = 0;
  #lastKey = -Infinity;
  #lastSeen = 0;
  #bounce = 0;
  #words = 0;
  #typedSpace = false;
  #said = -Infinity;
  #bubbleUntil = 0;
  #drag: { x: number; y: number; moved: boolean } | undefined;
  #pointer: Spot | undefined;
  #accent = "";
  #accentDark = "";
  #caret: CaretPlace | null = null;

  constructor(
    readonly mascot: Mascot,
    readonly scale: number,
  ) {
    const { width, height } = sizeOf(mascot);
    this.#width = width * scale;
    this.#height = height * scale;
    this.#host.className = "mascot";
    this.#host.setAttribute("aria-hidden", "true");
    this.#sprite.className = "mascot-sprite";
    this.#sprite.width = width;
    this.#sprite.height = height;
    this.#sprite.style.width = `${this.#width}px`;
    this.#sprite.style.height = `${this.#height}px`;
    this.#bubble.className = "mascot-bubble";
    this.#host.append(this.#bubble, this.#sprite);
    document.body.append(this.#host);

    const floor = this.#floor();
    this.#x = floor.right - this.#width;
    this.#y = floor.y;
    this.#readAccent();
    this.#say(t("mascot.hello"), 20);

    // Asks the editor to say where its cursor is (editor/cursor.ts).
    document.documentElement.dataset.mascot = mascot.id;
    const { signal } = this.#listeners;
    addEventListener("lines:caret", (event) => (this.#caret = (event as CustomEvent<CaretPlace | null>).detail), { signal });
    addEventListener("keydown", (event) => this.#typed(event), { signal, capture: true });
    addEventListener("pointermove", (event) => this.#pointed(event), { signal, passive: true });
    addEventListener("lines:done", () => this.#celebrate(), { signal });
    this.#sprite.addEventListener("pointerdown", (event) => this.#grab(event), { signal });
    this.#sprite.addEventListener("pointerup", (event) => this.#release(event), { signal });
    this.#timer = setInterval(() => document.visibilityState === "visible" && this.#step(), TICK);
    this.#draw();
  }

  destroy() {
    clearInterval(this.#timer);
    this.#listeners.abort();
    this.#host.remove();
    delete document.documentElement.dataset.mascot;
  }

  /** Where it walks: along the bottom of the note's pane, or of the window. */
  #floor() {
    const pane = document.querySelector(".editor-pane")?.getBoundingClientRect();
    const area = pane && pane.width > this.#width * 3 ? pane : { left: 0, right: innerWidth, bottom: innerHeight };
    const half = this.#width / 2;
    return { left: area.left + half + 8, right: area.right - half - 8, y: area.bottom - 4 };
  }

  /**
   * Beside the line being written, if it's in view: in the note's margin (the right one, or else
   * the left, clear of the grip that drags lines and the marks there), or after the line's text.
   */
  #perch(): Perch | undefined {
    const caret = this.#caret;
    if (!caret) return undefined;
    const half = this.#width / 2;
    const y = caret.bottom;
    if (y - this.#height < caret.viewTop + 8 || y > caret.viewBottom - 4) return undefined;
    if (caret.right - caret.textRight >= this.#width + 24) return { x: caret.textRight + 16 + half, y, along: false };
    if (caret.textLeft - caret.left >= this.#width + 60) return { x: caret.textLeft - 44 - half, y, along: false };
    // After the text: past the end of its line, and of the lines above that it would stand over.
    const over = caret.above.filter((line) => line.top < caret.top && line.top > y - this.#height - 4);
    const end = Math.max(caret.lineEnd, ...over.map((line) => line.end));
    if (caret.textRight - end >= this.#width + 12) return { x: end + 8 + half, y, along: true };
    return undefined;
  }

  #readAccent() {
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    const color = parse(accent);
    this.#accent = color ? hex(color) : "#0e7a7e";
    this.#accentDark = color ? hex(mix(color, { r: 0, g: 0, b: 0, a: 1 }, 0.28)) : "#09585b";
  }

  #say(text: string, ticks = 25) {
    if (!prefs.mascotTalks) return;
    this.#bubble.textContent = text;
    this.#bubble.classList.add("is-shown");
    this.#bubbleUntil = this.#tick + ticks;
    this.#said = this.#tick;
  }

  #do(mode: Mode, ticks = 0, after: Mode = "idle") {
    this.#mode = mode;
    this.#until = this.#tick + ticks;
    this.#after = after;
  }

  /** Goes to `to` in an arc, then does `after`; at once with reduced motion. */
  #hopTo(to: Spot, after: Mode) {
    if (reducedMotion.matches) {
      this.#do(after, 40);
      return;
    }
    this.#left = to.x < this.#x;
    this.#hop = { from: { x: this.#x, y: this.#y }, to, at: 0, length: Math.max(4, Math.min(9, Math.round(Math.hypot(to.x - this.#x, to.y - this.#y) / 40))) };
    this.#do("hop", 0, after);
  }

  #typed(event: KeyboardEvent) {
    const target = event.target as Element | null;
    if (!target?.closest?.(".cm-content") || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.length !== 1 && event.key !== "Backspace" && event.key !== "Enter") return;
    const asleep = this.#mode === "sleep";
    this.#lastKey = this.#tick;
    this.#lastSeen = this.#tick;
    this.#bounce = 1;
    // Words, as spaces and line breaks after something typed.
    const space = event.key === " " || event.key === "Enter";
    if (space && !this.#typedSpace && ++this.#words % WORDS_TO_CHEER === 0) {
      this.#say(pick([t("mascot.cheer1"), t("mascot.cheer2"), t("mascot.cheer3"), t("mascot.cheer4")]));
      this.#do("cheer", 12, "perch");
    }
    this.#typedSpace = space;
    if (asleep) {
      this.#say("!", 12);
      this.#do("idle", 4);
    }
    if (this.#mode === "idle" || this.#mode === "walk" || asleep) {
      const spot = this.#perch();
      const floor = this.#floor();
      if (spot) this.#hopTo(spot, "perch");
      else if (this.#caret && !reducedMotion.matches) {
        // No room beside the line: along the floor to below it.
        this.#walkTo = Math.min(floor.right, Math.max(floor.left, this.#caret.x));
        this.#do("walk");
      }
    }
  }

  #pointed(event: PointerEvent) {
    this.#lastSeen = this.#tick;
    this.#pointer = { x: event.clientX, y: event.clientY };
    if (this.#drag) {
      if (Math.hypot(event.clientX - this.#drag.x, event.clientY - this.#drag.y) > 4) this.#drag.moved = true;
      if (this.#drag.moved) {
        this.#do("carried");
        this.#x = event.clientX;
        this.#y = event.clientY + this.#height * 0.55;
        this.#draw();
      }
      return;
    }
    // It looks at the pointer when it's near.
    if ((this.#mode === "idle" || this.#mode === "perch") && Math.abs(event.clientX - this.#x) < 200 && Math.abs(event.clientY - this.#y) < 200) {
      this.#left = event.clientX < this.#x;
    }
  }

  #grab(event: PointerEvent) {
    event.preventDefault();
    this.#sprite.setPointerCapture(event.pointerId);
    this.#drag = { x: event.clientX, y: event.clientY, moved: false };
  }

  #release(event: PointerEvent) {
    const drag = this.#drag;
    this.#drag = undefined;
    if (!drag) return;
    if (drag.moved) {
      this.#x = event.clientX;
      this.#vy = 0;
      this.#do("fall");
      return;
    }
    // A click: it's pleased, and says so its own way.
    this.#say(pick(["♥", ...(this.mascot.sounds ?? [])]), 15);
    this.#do("cheer", 8, this.#mode === "perch" ? "perch" : "idle");
  }

  #celebrate() {
    this.#say(t("mascot.done"), 18);
    this.#do("cheer", 12, this.#mode === "perch" ? "perch" : "idle");
  }

  /** A tick: what it does next, and how it looks doing it. */
  #step() {
    const now = ++this.#tick;
    if (now % 10 === 0) this.#readAccent();
    if (this.#bubbleUntil && now >= this.#bubbleUntil) {
      this.#bubble.classList.remove("is-shown");
      this.#bubbleUntil = 0;
    }
    const floor = this.#floor();
    const still = reducedMotion.matches;
    const away = now - Math.max(this.#lastKey, this.#lastSeen);
    if (away > NAP && this.#mode !== "sleep" && this.#mode !== "carried" && this.#mode !== "fall" && this.#mode !== "hop") {
      this.#do("sleep");
      this.#say("z", 15);
    }

    switch (this.#mode) {
      case "carried":
        this.#pose = "cheer";
        break;
      case "fall": {
        this.#vy += this.scale * 1.6;
        this.#y = still ? floor.y : Math.min(floor.y, this.#y + this.#vy);
        this.#x = Math.min(floor.right, Math.max(floor.left, this.#x));
        this.#pose = "cheer";
        if (this.#y >= floor.y) {
          this.#vy = 0;
          this.#pose = "stand";
          this.#do("idle", 15);
        }
        break;
      }
      case "hop": {
        const hop = this.#hop!;
        hop.at = Math.min(1, hop.at + 1 / hop.length);
        const lift = Math.sin(hop.at * Math.PI) * (24 + Math.abs(hop.to.x - hop.from.x) * 0.15);
        this.#x = hop.from.x + (hop.to.x - hop.from.x) * hop.at;
        this.#y = hop.from.y + (hop.to.y - hop.from.y) * hop.at - lift;
        this.#pose = hop.at < 1 ? "cheer" : "stand";
        if (hop.at >= 1) {
          this.#hop = undefined;
          this.#do(this.#after, this.#after === "idle" ? 20 : 0);
        }
        break;
      }
      case "perch": {
        const spot = this.#perch();
        if (!spot || now - this.#lastKey > STAY) {
          // Done writing, or the line's gone from view: back down to the floor.
          if (still) this.#do("idle", 40);
          else this.#hopTo({ x: Math.min(floor.right, Math.max(floor.left, this.#x)), y: floor.y }, "idle");
          break;
        }
        const gap = spot.x - this.#x;
        if (spot.along && Math.abs(spot.y - this.#y) <= 3 && Math.abs(gap) > 3 && Math.abs(gap) < 120 && !still) {
          // The sentence grew (or shrank): it shuffles along with its end.
          this.#left = gap < 0;
          this.#x += Math.sign(gap) * Math.min(Math.abs(gap), this.scale * 3);
          this.#pose = Math.floor(now / 2) % 2 ? "walk1" : "walk2";
          break;
        }
        if (Math.abs(gap) > 3 || Math.abs(spot.y - this.#y) > 3) {
          // Another line, or the note scrolled: over to it.
          if (still) [this.#x, this.#y] = [spot.x, spot.y];
          else this.#hopTo(spot, "perch");
          break;
        }
        this.#left = this.#caret ? this.#caret.x < this.#x : this.#left;
        this.#pose = now - this.#lastKey < 4 && now % 2 ? "stand" : "sit";
        break;
      }
      case "walk": {
        const speed = this.scale * 1.2;
        const gap = this.#walkTo - this.#x;
        this.#left = gap < 0;
        this.#x += Math.sign(gap) * Math.min(Math.abs(gap), speed);
        this.#pose = Math.floor(now / 2) % 2 ? "walk1" : "walk2";
        if (Math.abs(gap) <= speed) this.#do("idle", 30 + Math.random() * 60);
        break;
      }
      case "cheer":
        this.#pose = "cheer";
        if (now >= this.#until) this.#do(this.#after, this.#after === "idle" ? 20 : 0);
        break;
      case "sleep":
        this.#pose = "sleep";
        if (now % 30 === 0) this.#say("z", 12);
        break;
      default: {
        // Idle on the floor: sit a while, then off somewhere, or pounce on a resting pointer nearby.
        this.#y = floor.y;
        this.#x = Math.min(floor.right, Math.max(floor.left, this.#x));
        this.#pose = now < this.#until - 15 ? "stand" : "sit";
        if (now < this.#until || still) break;
        const pointer = this.#pointer;
        if (pointer && now - this.#lastSeen > 8 && Math.abs(pointer.x - this.#x) < 160 && floor.y - pointer.y < 80 && Math.abs(pointer.x - this.#x) > 20) {
          this.#hopTo({ x: pointer.x, y: floor.y }, "idle");
          this.#pointer = undefined;
          break;
        }
        if (now - this.#said > 450 && Math.random() < 0.25 && this.mascot.sounds?.length) this.#say(pick(this.mascot.sounds), 18);
        this.#walkTo = floor.left + Math.random() * Math.max(0, floor.right - floor.left);
        this.#do("walk");
      }
    }
    this.#draw();
  }

  /** What's drawn now, and where: drawn again only when that changes, not at every tick. */
  #drawn = "";
  #placed = "";

  #draw() {
    const blink = this.#mode !== "sleep" && this.#tick % 40 >= 38;
    const look = [this.#pose, blink, this.#left, this.#accent, this.#accentDark].join(" ");
    if (look !== this.#drawn) {
      this.#drawn = look;
      const art = frame(this.mascot, this.#pose, { blink, left: this.#left, accent: this.#accent, accentDark: this.#accentDark });
      const context = this.#sprite.getContext("2d")!;
      context.clearRect(0, 0, this.#sprite.width, this.#sprite.height);
      context.drawImage(art, 0, 0);
    }
    // How it moves: floating bobs, hopping bounces with its walk, and every key a little bounce.
    let lift = 0;
    if (!reducedMotion.matches) {
      if (this.mascot.moves === "float" && this.#mode !== "sleep") lift += Math.round(Math.sin(this.#tick / 4) * this.scale * 1.5 + this.scale * 2);
      if (this.mascot.moves === "hop" && this.#mode === "walk" && this.#pose === "walk2") lift += this.scale * 3;
      if (this.#bounce) lift += this.scale;
    }
    this.#bounce = 0;
    const place = `translate(${Math.round(this.#x - this.#width / 2)}px, ${Math.round(this.#y - this.#height - lift)}px)`;
    if (place !== this.#placed) this.#host.style.transform = this.#placed = place;
  }
}

/** Only the main window has one: not Settings', nor a floating note's. */
const main = !isSettingsWindow && !windowLabel().startsWith("note-");

/** The mascot chosen: the same one while other plugins are turned on and off, so it isn't made again. */
const chosen = $derived(main ? plugins.mascots.find((each) => each.id === prefs.mascot) : undefined);

$effect.root(() => {
  $effect(() => {
    const mascot = chosen;
    if (!mascot) return;
    const scale = SCALE[prefs.mascotSize];
    // Made untracked: what it reads as it goes (whether it talks) doesn't make it again.
    const pet = untrack(() => new Pet(mascot, scale));
    return () => pet.destroy();
  });
});
