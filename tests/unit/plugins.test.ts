import { describe, expect, test } from "bun:test";
import { stubApp } from "./stubs";
import { readFileSync } from "node:fs";
import { contrast, over, parse } from "../../src/lib/themes/color";
import { moreContrast } from "../../src/lib/themes/palette";
import { BASE_COLORS } from "../../src/lib/themes/palette";
import type { AppStyle, Mascot, MascotPose, ThemeColors } from "../../src/lib/plugins/types";

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
