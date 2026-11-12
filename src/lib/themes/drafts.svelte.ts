import type { Theme } from "../plugins/types";
import { announce, onAnnounce } from "../windows/channel";
import { moreContrastOf } from "./custom.svelte";
import { isColor, SCHEMES } from "./file";
import type { Scheme } from "./palette";

/*
 * Picking colors: with it on (Settings → Theme), right-clicking anything in lines changes the
 * colors it's drawn in (components/ColorPicking.svelte). What's changed shows at once, over the
 * theme it was changed in, but isn't the theme's until it's saved in Settings → Theme, as a theme
 * of your own or into yours; each theme keeps its own changes until then, on this device and in
 * every window.
 */

const KEY = "lines.themeDrafts";

/** A theme's colors changed and not saved, for the scheme each was changed in. */
export type Draft = Partial<Record<Scheme, Record<string, string>>>;

interface Stored {
  picking: boolean;
  drafts: Record<string, Draft>;
}

function read(json?: string): Stored {
  try {
    const raw: unknown = JSON.parse(json ?? localStorage.getItem(KEY) ?? "{}");
    const { picking, drafts } = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const kept: Record<string, Draft> = {};
    for (const [id, draft] of Object.entries(drafts && typeof drafts === "object" ? drafts : {})) {
      const each: Draft = {};
      for (const scheme of SCHEMES) {
        const colors = (draft as Draft | null)?.[scheme];
        const valid = Object.entries(colors && typeof colors === "object" ? colors : {}).filter(([key, value]) => /^[a-z][a-z0-9-]*$/.test(key) && isColor(value));
        if (valid.length) each[scheme] = Object.fromEntries(valid);
      }
      if (each.light || each.dark) kept[id] = each;
    }
    return { picking: picking === true, drafts: kept };
  } catch {
    return { picking: false, drafts: {} };
  }
}

class ThemeDrafts {
  #stored = $state<Stored>(read());

  constructor() {
    void onAnnounce((message) => message.type === "theme-drafts" && (this.#stored = read(message.drafts)));
  }

  /** Saved and sent to the other windows at each change, a color's every step while it's picked. */
  #save() {
    const json = JSON.stringify(this.#stored);
    try {
      localStorage.setItem(KEY, json);
    } catch {
      // Storage that can't be written: they last until lines restarts.
    }
    void announce({ type: "theme-drafts", drafts: json });
  }

  /** Whether right-clicking changes colors, rather than opening lines' menus. */
  get picking() {
    return this.#stored.picking;
  }

  set picking(on: boolean) {
    if (this.#stored.picking === on) return;
    this.#stored.picking = on;
    this.#save();
  }

  of(id: string): Draft | undefined {
    return this.#stored.drafts[id];
  }

  /** How many of a theme's colors are changed and not saved. */
  count(id: string) {
    const draft = this.of(id);
    return SCHEMES.reduce((sum, scheme) => sum + Object.keys(draft?.[scheme] ?? {}).length, 0);
  }

  /** Changes one of a theme's colors for a scheme, or puts back the theme's own (`undefined`). */
  set(id: string, scheme: Scheme, property: string, value: string | undefined) {
    const draft = (this.#stored.drafts[id] ??= {});
    const colors = (draft[scheme] ??= {});
    if (colors[property] === value) return;
    if (value === undefined) delete colors[property];
    else colors[property] = value;
    if (!Object.keys(colors).length) delete draft[scheme];
    if (!draft.light && !draft.dark) delete this.#stored.drafts[id];
    this.#save();
  }

  discard(id: string) {
    if (!this.#stored.drafts[id]) return;
    delete this.#stored.drafts[id];
    this.#save();
  }

  /**
   * A theme with its changes over its colors, as it shows while they're not saved; Increased
   * contrast's colors worked out again for a scheme changed. A theme with one scheme has its changes
   * in that one, which it shows in both.
   */
  over = (theme: Theme): Theme => {
    const draft = this.of(theme.id);
    if (!draft) return theme;
    const changed = (scheme: Scheme) => draft[theme.scheme ?? scheme];
    const colors = (scheme: Scheme) => (changed(scheme) ? { ...theme[scheme], ...changed(scheme) } : theme[scheme]);
    const light = colors("light");
    const dark = colors("dark");
    return {
      ...theme,
      light,
      dark,
      moreContrast: {
        light: changed("light") ? moreContrastOf(light) : theme.moreContrast?.light,
        dark: changed("dark") ? moreContrastOf(dark) : theme.moreContrast?.dark,
      },
    };
  };
}

export const themeDrafts = new ThemeDrafts();
