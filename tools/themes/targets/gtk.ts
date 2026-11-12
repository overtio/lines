import { hex, mix, readableOn, type Rgb } from "../../../src/lib/themes/color";
import type { Theme } from "../../../src/lib/plugins/types";
import type { Scheme } from "../../../src/lib/themes/palette";
import { alpha, type Colors, resolve } from "../colors";
import { schemesOf, type Written } from "./common";

/*
 * GTK's named colors, libadwaita's, which GNOME's apps and adw-gtk3 (for GTK 3 apps) draw with:
 *
 * - gtk-4.0/gtk.css, for ~/.config/gtk-4.0/: as libadwaita 1.6 and later read them, custom
 *   properties, the dark colors in a media query so apps follow the system's style.
 * - gtk-3.0/light.css and dark.css, one of them for ~/.config/gtk-3.0/gtk.css: as `@define-color`,
 *   which can't follow the style, for GTK 3 with adw-gtk3 (and libadwaita before 1.6).
 */

/** The named colors for one scheme, by libadwaita's names. */
function named(get: Colors, scheme: Scheme): Record<string, string> {
  const dark = scheme === "dark";
  const [bg, list, sidebar, elevated, text, ink] = ["bg", "bg-list", "bg-sidebar", "bg-elevated", "text", "ink"].map(get);
  const shade = { r: 0, g: 0, b: 0, a: 1 };
  const status = (name: string, color: Rgb, on: Rgb) => ({
    [`${name}_bg_color`]: hex(color),
    [`${name}_fg_color`]: hex(on),
    [`${name}_color`]: hex(readableOn(color, bg, 4.5)),
  });
  const pane = (name: string, background: Rgb, foreground: Rgb) => ({
    [`${name}_bg_color`]: hex(background),
    [`${name}_fg_color`]: hex(foreground),
    [`${name}_backdrop_color`]: hex(mix(background, bg, 0.5)),
    [`${name}_border_color`]: alpha(ink, dark ? 0.09 : 0.1),
    [`${name}_shade_color`]: alpha(shade, dark ? 0.25 : 0.07),
  });
  return {
    ...status("accent", get("accent"), get("on-accent")),
    ...status("destructive", get("danger"), get("on-danger")),
    ...status("success", get("success"), get("on-success")),
    ...status("warning", get("pin"), get("on-pin")),
    ...status("error", get("danger"), get("on-danger")),
    window_bg_color: hex(list),
    window_fg_color: hex(text),
    view_bg_color: hex(bg),
    view_fg_color: hex(text),
    headerbar_bg_color: hex(list),
    headerbar_fg_color: hex(text),
    headerbar_border_color: hex(text),
    headerbar_backdrop_color: hex(list),
    headerbar_shade_color: alpha(shade, dark ? 0.36 : 0.12),
    headerbar_darker_shade_color: alpha(shade, dark ? 0.9 : 0.12),
    ...pane("sidebar", sidebar, get("text-sidebar")),
    ...pane("secondary_sidebar", list, text),
    card_bg_color: hex(mix(elevated, ink, dark ? 0.04 : 0.025)),
    card_fg_color: hex(text),
    card_shade_color: alpha(shade, dark ? 0.36 : 0.07),
    dialog_bg_color: hex(elevated),
    dialog_fg_color: hex(text),
    popover_bg_color: hex(elevated),
    popover_fg_color: hex(text),
    popover_shade_color: alpha(shade, dark ? 0.25 : 0.07),
    thumbnail_bg_color: hex(elevated),
    thumbnail_fg_color: hex(text),
    shade_color: alpha(shade, dark ? 0.25 : 0.07),
    scrollbar_outline_color: dark ? alpha(shade, 0.5) : "#ffffff",
    // GTK 3's own names, for apps that still ask for them.
    theme_bg_color: hex(list),
    theme_fg_color: hex(text),
    theme_base_color: hex(bg),
    theme_text_color: hex(text),
    theme_selected_bg_color: hex(get("accent")),
    theme_selected_fg_color: hex(get("on-accent")),
  };
}

const variables = (colors: Record<string, string>, indent: string) =>
  Object.entries(colors)
    .filter(([name]) => !name.startsWith("theme_"))
    .map(([name, value]) => `${indent}--${name.replace(/_/g, "-")}: ${value};`)
    .join("\n");

export function gtk(theme: Theme): Written {
  const schemes = schemesOf(theme);
  const colors = Object.fromEntries(schemes.map((scheme) => [scheme, named(resolve(theme[scheme], scheme), scheme)])) as Partial<Record<Scheme, Record<string, string>>>;
  const first = colors.light ?? colors.dark!;
  const modern = [
    `/* ${theme.name}, for GTK 4 and libadwaita 1.6 or later: copy to ~/.config/gtk-4.0/gtk.css. Made with lines' theme tools. */`,
    "",
    `:root {\n${variables(first, "  ")}\n}`,
    ...(colors.light && colors.dark ? ["", `@media (prefers-color-scheme: dark) {\n  :root {\n${variables(colors.dark, "    ")}\n  }\n}`] : []),
    "",
  ].join("\n");
  const files: Written = { "gtk-4.0/gtk.css": modern };
  for (const scheme of schemes) {
    const defined = Object.entries(colors[scheme]!).map(([name, value]) => `@define-color ${name} ${value};`);
    files[`gtk-3.0/${scheme}.css`] = [
      `/* ${theme.name}, its ${scheme} colors, for GTK 3 with adw-gtk3 (and libadwaita before 1.6): copy to ~/.config/gtk-3.0/gtk.css. Made with lines' theme tools. */`,
      "",
      ...defined,
      "",
    ].join("\n");
  }
  return files;
}
