import { plugins } from "../plugins/registry.svelte";
import { prefs } from "../prefs.svelte";
import { rule } from "./css";

/*
 * Styles (plugins' `styles`): the app's whole look beside its colors, its corners, type, borders and
 * shadows. Their properties and CSS are written last in the page, after app.css and editor.css, so
 * they outrank them, and the one chosen (or lines' own while its plugin is off) shows by the page's
 * `data-style`.
 */

const element = document.createElement("style");
element.id = "lines-styles";
document.head.append(element);

const ID = /^[a-z][a-z0-9-]*$/;

function showStyles() {
  const css = plugins.styles
    .filter((style) => ID.test(style.id))
    .flatMap((style) => {
      const root = `:root[data-style="${style.id}"]`;
      const properties = {
        ...style.properties,
        ...(style.font && { "font-system": style.font.family }),
        ...(style.headingFont && { "style-heading-font": style.headingFont.family }),
      };
      // With the scheme, to outrank a theme's colors in dark as in light; and again in a part with
      // colors of its own (a pane shown dark), which works out its shadows anew.
      return [rule(`${root}[data-scheme], ${root} [data-scheme]`, properties), style.css ?? ""];
    })
    .filter(Boolean)
    .join("\n\n");
  if (element.textContent !== css) element.textContent = css;
  const shown = plugins.style(prefs.style);
  if (shown) document.documentElement.dataset.style = shown.id;
  else delete document.documentElement.dataset.style;
}

// Before the first paint, so there's no flash of another look; then whenever it changes.
showStyles();
$effect.root(() => {
  $effect(showStyles);
});
