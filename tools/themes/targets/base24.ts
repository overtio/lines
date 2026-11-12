import { hex } from "../../../src/lib/themes/color";
import type { Theme } from "../../../src/lib/plugins/types";
import { brighter, hues, ramp, resolve } from "../colors";
import { schemesOf, slug, type Written } from "./common";

/*
 * Base24 schemes (tinted-theming), a light and a dark one: the palette templates make themes of for
 * hundreds of apps (terminals, editors, window managers), and that Linux setups (Stylix, tinty)
 * theme everything from. Base24 is Base16 with two darker backgrounds and bright hues after it, so
 * Base16's templates read it too.
 */

export function base24(theme: Theme): Written {
  const files: Written = {};
  for (const scheme of schemesOf(theme)) {
    const get = resolve(theme[scheme], scheme);
    const hue = hues(get);
    const { neutrals, background } = ramp(get);
    const colors = [
      ...neutrals,
      hue.red,
      hue.orange,
      hue.yellow,
      hue.green,
      hue.cyan,
      hue.blue,
      hue.magenta,
      hue.brown,
      ...background,
      ...[hue.red, hue.yellow, hue.green, hue.cyan, hue.blue, hue.magenta].map((color) => brighter(color)),
    ];
    const name = `${theme.name} ${scheme === "dark" ? "Dark" : "Light"}`;
    files[`${slug(theme.name)}-${scheme}.yaml`] = [
      `system: "base24"`,
      `name: ${JSON.stringify(name)}`,
      `slug: "${slug(name)}"`,
      `author: ${JSON.stringify(theme.author ?? "lines' theme tools")}`,
      `variant: "${scheme}"`,
      "palette:",
      ...colors.map((color, i) => `  base${i.toString(16).padStart(2, "0").toUpperCase()}: "${hex(color)}"`),
      "",
    ].join("\n");
  }
  return files;
}
