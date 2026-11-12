import { WidgetType } from "@codemirror/view";
import { mount, unmount } from "svelte";
import { t } from "../i18n/index.svelte";
import Icon from "../icons/Icon.svelte";
import type { IconName } from "../icons/icons";
import type { ScoreStyle } from "../prefs.svelte";

/*
 * Scores: a value like `5/7` on a `Key: Value` line or in the properties (`Rating: 4/5`), drawn as
 * marks, five of seven filled (Settings → Little Touches): stars, hearts or circles, or as written.
 * With the cursor on its line, it's as written, to change. Screen readers hear "5 out of 7".
 */

/** The most marks a score is drawn with: a `12/20` is more number than marks. */
const MOST = 10;

/** A score a value is (`5/7`, `4 / 5`), whole and out of 2 to 10. */
export function scoreIn(value: string): { score: number; of: number } | null {
  const match = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  const [score, of] = [Number(match[1]), Number(match[2])];
  return of >= 2 && of <= MOST && score <= of ? { score, of } : null;
}

const MARKS: Record<Exclude<ScoreStyle, "off">, IconName> = { stars: "star", hearts: "heart", circles: "circle" };

const mounted = new WeakMap<HTMLElement, Record<string, unknown>[]>();

export class ScoreWidget extends WidgetType {
  constructor(
    readonly score: number,
    readonly of: number,
    readonly style: Exclude<ScoreStyle, "off">,
  ) {
    super();
  }
  eq(other: ScoreWidget) {
    return other.score === this.score && other.of === this.of && other.style === this.style;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = `cm-lp-score cm-lp-score-${this.style}`;
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", t("editor.score", { score: this.score, of: this.of }));
    const icons = Array.from({ length: this.of }, (_, i) => {
      const target = document.createElement("span");
      target.className = i < this.score ? "cm-lp-score-mark is-filled" : "cm-lp-score-mark";
      target.setAttribute("aria-hidden", "true");
      el.append(target);
      return mount(Icon, { target, props: { name: MARKS[this.style], size: 16, strokeWidth: 2 } });
    });
    mounted.set(el, icons);
    return el;
  }
  destroy(dom: HTMLElement) {
    for (const icon of mounted.get(dom) ?? []) void unmount(icon);
  }
  // A click puts the cursor on its line, which shows it as written.
  ignoreEvent() {
    return false;
  }
}
