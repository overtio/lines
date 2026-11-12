import { describe, expect, test } from "bun:test";
import { stubApp } from "./stubs";
import { readFileSync } from "node:fs";
import { contrast, over, parse, toLch } from "../../src/lib/themes/color";
import { moreContrast } from "../../src/lib/themes/palette";
import { BASE_COLORS } from "../../src/lib/themes/palette";
import type { AppStyle, Mascot, MascotPose, Theme, ThemeColors } from "../../src/lib/plugins/types";

// Names are looked up in the app's language; here they're their keys.
stubApp();
const { themes } = await import("../../src/plugins/themes/themes");
const { styles } = await import("../../src/plugins/styles");
const { mascots } = await import("../../src/plugins/mascots");

const all = themes();
const ratio = (colors: Partial<ThemeColors>, text: string, surface: string) => {
  const background = parse(colors[surface])!;
  return contrast(over(parse(colors[text])!, background), background);
};

describe("built-in themes", () => {
  test("each has an id of its own, and every base color in light and dark", () => {
    expect(new Set(all.map((theme) => theme.id)).size).toBe(all.length);
    for (const theme of all) for (const scheme of ["light", "dark"] as const) for (const key of BASE_COLORS) expect(theme[scheme][key], `${theme.id} ${scheme} ${key}`).toBeString();
  });

  // Grey and faint text are as each theme has them; Increased contrast is what makes them AA (below).
  test("text reads on every pane: 4.5:1", () => {
    // Solarized's own sidebar text, base01 on base2.
    const known = ["solarized light: text-sidebar on bg-sidebar 4.39 < 4.5"];
    const misses: string[] = [];
    for (const theme of all) {
      for (const scheme of ["light", "dark"] as const) {
        const colors = theme[scheme];
        if (![colors.bg, colors["bg-list"], colors["bg-sidebar"], colors.text, colors["text-sidebar"]].every((value) => parse(value))) continue;
        for (const [text, surface, goal] of [
          ["text", "bg", 4.5],
          ["text", "bg-list", 4.5],
          ["text-sidebar", "bg-sidebar", 4.5],
        ] as const) {
          const measured = ratio(colors, text, surface);
          if (measured < goal) misses.push(`${theme.id} ${scheme}: ${text} on ${surface} ${measured.toFixed(2)} < ${goal}`);
        }
      }
    }
    expect(misses).toEqual(known);
  });

  test("Increased contrast reaches what docs/accessibility.md promises", () => {
    const misses: string[] = [];
    for (const theme of all) {
      for (const scheme of ["light", "dark"] as const) {
        const own = theme[scheme];
        if (!parse(own.bg)) continue;
        const colors = { ...own, ...moreContrast(own), ...theme.moreContrast?.[scheme] };
        for (const surface of ["bg", "bg-list", "bg-sidebar"]) {
          for (const [text, goal] of [["text", 9], ["text-muted", 7], ["text-faint", 4.5], ["accent", 4.5]] as const) {
            const measured = ratio(colors, text, surface);
            if (measured < goal - 0.05) misses.push(`${theme.id} ${scheme}: ${text} on ${surface} ${measured.toFixed(2)} < ${goal}`);
          }
        }
      }
    }
    expect(misses).toEqual([]);
  });
});

describe("themes' own highlighter, status and callout colors", () => {
  const withStyles = [...all, ...(styles().contributes.themes ?? [])];
  /** app.css's, for what a theme leaves to it: light's, then dark's. */
  const [lightCss, darkCss] = readFileSync("src/app.css", "utf8").split(':root[data-scheme="dark"],');
  const fromCss = (css: string) => Object.fromEntries([...css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/g)].map((match) => [match[1], match[2]]));
  const shared = { light: fromCss(lightCss), dark: { ...fromCss(lightCss), ...fromCss(darkCss) } };
  const NAMED = ["highlight-base", "pin", "danger", "success", "callout-info", "callout-question", "callout-warning", "callout-decision"];
  /** Themes drawn in lines' own colors, which may keep app.css's for these. */
  const LINES_COLORS = new Set(["lines", "ember", "ink", "indigo", "plum", "moss", "amber", "sepia", "forest", "ocean"]);

  const shownSchemes = (theme: Theme) => (theme.scheme ? [theme.scheme] : (["light", "dark"] as const));
  const effective = (theme: Theme, scheme: "light" | "dark") => {
    const colors: Record<string, string> = { ...shared[scheme], ...theme[scheme] };
    for (const [key, value] of Object.entries(colors)) if (value === "var(--accent)") colors[key] = colors.accent;
    return colors;
  };

  test("every theme not in lines' own colors sets its own", () => {
    for (const theme of withStyles.filter((theme) => !LINES_COLORS.has(theme.id)))
      for (const scheme of shownSchemes(theme)) for (const key of NAMED) expect(theme[scheme][key], `${theme.id} ${scheme} ${key}`).toBeString();
  });

  // app.css's white (the background, in dark) reads better on Increased contrast's darker (lighter) accent; a theme's own may not.
  test("a theme's own text on the accent reads on it, with Increased contrast too: 4.5:1", () => {
    const misses: string[] = [];
    for (const theme of withStyles) {
      for (const scheme of shownSchemes(theme)) {
        for (const colors of [theme[scheme], { ...theme[scheme], ...theme.moreContrast?.[scheme] }]) {
          if (!colors["on-accent"]) continue;
          const measured = ratio(colors, "on-accent", "accent");
          if (measured < 4.45) misses.push(`${theme.id} ${scheme}: ${colors["on-accent"]} on ${colors.accent} ${measured.toFixed(2)} < 4.5`);
        }
      }
    }
    expect(misses).toEqual([]);
  });

  test("they read: danger 4.5:1 on the note and menus, icons 3:1, text on the highlighter and on status buttons", () => {
    const misses: string[] = [];
    for (const theme of withStyles) {
      for (const scheme of shownSchemes(theme)) {
        const colors = effective(theme, scheme);
        const check = (key: string, surface: string, goal: number) => {
          const measured = ratio(colors, key, surface);
          if (measured < goal - 0.05) misses.push(`${theme.id} ${scheme}: ${key} on ${surface} ${measured.toFixed(2)} < ${goal}`);
        };
        for (const surface of ["bg", "bg-elevated"]) {
          check("danger", surface, 4.5);
          for (const key of ["success", "callout-info", "callout-question", "callout-warning", "callout-decision"]) check(key, surface, 3);
        }
        for (const status of ["danger", "success", "pin"]) check(`on-${status}`, status, 4.5);
        const bg = parse(colors.bg)!;
        const text = parse(colors.text)!;
        const share = Number(/(\d+)%/.exec(colors.highlight ?? "")?.[1] ?? (scheme === "dark" ? 25 : 40)) / 100;
        const highlighted = over({ ...parse(colors["highlight-base"])!, a: share }, bg);
        const goal = Math.min(4.5, contrast(text, bg));
        if (contrast(text, highlighted) < goal - 0.05) misses.push(`${theme.id} ${scheme}: text on the highlighter ${contrast(text, highlighted).toFixed(2)} < ${goal.toFixed(2)}`);
        // A light theme's highlighter is itself light, as a highlighter pen is, not a dark yellow that muddies the page.
        const lightness = toLch(parse(colors["highlight-base"])!).l;
        if (scheme === "light" && lightness < 0.8) misses.push(`${theme.id} light: the highlighter's lightness ${lightness.toFixed(2)} < 0.8`);
      }
    }
    expect(misses).toEqual([]);
  });
});

describe("styles", () => {
  const looks = styles().contributes.styles as AppStyle[];
  const tokens = new Set([...readFileSync("src/app.css", "utf8").matchAll(/--([a-z0-9-]+)\s*:/g)].map((match) => match[1]));

  test("each has its own id, a theme that exists, and sets only app.css's tokens", () => {
    const themeIds = new Set([...all, ...(styles().contributes.themes ?? [])].map((theme) => theme.id));
    expect(new Set(looks.map((look) => look.id)).size).toBe(looks.length);
    for (const look of looks) {
      if (look.theme) expect(themeIds.has(look.theme), `${look.id}'s theme`).toBe(true);
      for (const name of Object.keys(look.properties ?? {})) expect(tokens.has(name), `${look.id} sets --${name}`).toBe(true);
    }
  });

  test("their CSS shows only while they're chosen: every rule starts with their :root", () => {
    for (const look of looks.filter((look) => look.css)) {
      const css = look.css!.replace(/\/\*[\s\S]*?\*\//g, "");
      const root = `:root[data-style="${look.id}"]`;
      for (const [, selectors] of css.matchAll(/(?:^|})\s*([^{}@]+?)\s*\{/g)) {
        // Split at the commas between selectors, not those inside :is() or :not().
        for (const selector of selectors.split(/,(?![^(]*\))/)) {
          // Keyframes' steps are inside an @keyframes block, which the pattern above skips.
          if (/^(from|to|\d+%)$/.test(selector.trim())) continue;
          expect(selector.trim().startsWith(root), `${look.id}: ${selector.trim()}`).toBe(true);
        }
      }
    }
  });
});

describe("mascots", () => {
  const all = mascots().contributes.mascots as Mascot[];
  const POSES: MascotPose[] = ["stand", "walk1", "walk2", "sit", "sleep", "cheer"];

  test("every pose is drawn, as big as the others, in the mascot's colors", () => {
    for (const mascot of all) {
      const drawn = POSES.map((pose) => mascot.frames[pose]).filter(Array.isArray) as string[][];
      const [width, height] = [drawn[0][0].length, drawn[0].length];
      for (const pose of POSES) {
        const frame = mascot.frames[pose];
        expect(frame, `${mascot.id} ${pose}`).toBeDefined();
        if (!Array.isArray(frame)) {
          // A pose that's another with its eyes shut is one that's drawn.
          expect(Array.isArray(mascot.frames[frame.like]), `${mascot.id} ${pose} is like ${frame.like}`).toBe(true);
          continue;
        }
        expect(frame.length, `${mascot.id} ${pose} height`).toBe(height);
        for (const row of frame) {
          expect(row.length, `${mascot.id} ${pose} width`).toBe(width);
          for (const cell of row) if (cell !== ".") expect(mascot.palette[cell], `${mascot.id} ${pose} color "${cell}"`).toBeString();
        }
      }
    }
  });

  test("has eyes to blink, and colors CSS reads", () => {
    for (const mascot of all) {
      expect((mascot.frames.stand as string[]).join("")).toContain("e");
      expect(mascot.palette[mascot.lid], `${mascot.id}'s lid`).toBeString();
      for (const color of Object.values(mascot.palette)) expect(color === "accent" || color === "accent-dark" || !!parse(color), `${mascot.id}: ${color}`).toBe(true);
    }
  });
});
