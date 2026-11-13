<script lang="ts">
  // A font to choose, each drawn in its own face: one installed on this device
  // (themes/installedFonts.ts), from the system's list, asked for as the picker opens, or by its
  // name typed where there's none; and, given what none chosen means (`none`), that first, then
  // lines' recommended fonts, but for any that `none` already is.
  import { t } from "../../i18n/index.svelte";
  import { fontName, fontOff, noteFonts } from "../../themes/fonts.svelte";
  import type { FontChoice } from "../../themes/formattingFonts";
  import { canDraw, installedFamily, listInstalledFonts, matching } from "../../themes/installedFonts";
  import Combobox from "../ui/Combobox.svelte";
  import { ownFace } from "./ownFace";

  type Props = {
    value: FontChoice | null;
    onchange: (choice: FontChoice | null) => void;
    label: string;
    id?: string;
    describedby?: string;
    /** What none chosen is called, and its font ("Same as text"). */
    none?: { label: string; family: string };
    /** A recommended font left out, as it's what `none` is (the code font). */
    without?: string;
    class?: string;
  };
  let { value, onchange, label, id, describedby, none, without, class: className }: Props = $props();

  type Option = { value: string; label: string; family: string; group?: string; choice: FontChoice | null };

  const key = (choice: FontChoice | null) => (!choice ? "none" : "font" in choice ? `font:${choice.font}` : `installed:${choice.installed}`);
  const option = (choice: FontChoice | null, label: string, family: string, group?: string): Option => ({ value: key(choice), label, family, group, choice });

  let query = $state("");
  /** The families installed, once listed; null where they can't be (asked again as it opens again). */
  let families = $state<string[] | null>();

  async function load() {
    if (!families) families = await listInstalledFonts();
  }

  const typed = $derived(query.trim());
  const recommended = $derived(
    noteFonts()
      .filter((font) => font.id !== without)
      .map((font) => option({ font: font.id }, fontName(font), font.family, t("settings.fontRecommended"))),
  );

  const options = $derived.by(() => {
    const found = matching(families ?? [], typed);
    // A family typed that isn't listed but is here to draw in: where fonts can't be listed, or a web font.
    if (typed && !found.some((family) => family.toLowerCase() === typed.toLowerCase()) && canDraw(typed)) found.unshift(typed);
    const installed = found.map((family) => option({ installed: family }, family, installedFamily(family, "var(--font-ui)"), none && t("settings.fontInstalledGroup")));
    if (!none) return installed;
    const label = (each: Option) => each.label;
    return [...matching([option(null, none.label, none.family)], typed, label), ...matching(recommended, typed, label), ...installed];
  });

  /** How the choice reads while the fonts it's among aren't listed, or a font's plugin is off. */
  const valueLabel = $derived(
    !value ? (none?.label ?? "") : "installed" in value ? value.installed : (recommended.find((each) => each.value === key(value))?.label ?? fontOff(value.font)?.name ?? value.font),
  );

  const message = $derived(
    families === undefined ? t("settings.fontsFinding") : !typed ? (families ? null : t("settings.fontTypeName")) : options.length ? null : t("settings.fontNotHere", { name: typed }),
  );

  function choose(chosen: string) {
    // Only what's offered; anything else leaves the choice as it was.
    const offered = options.find((each) => each.value === chosen);
    if (offered) onchange(offered.choice);
  }
</script>

<Combobox
  class={className}
  value={key(value)}
  {options}
  onchange={choose}
  {label}
  {valueLabel}
  {id}
  {describedby}
  bind:query
  {message}
  placeholder={t("settings.fontSearch")}
  counted={(count) => t("settings.fontsFound", { count })}
  onopen={load}
>
  {#snippet item(option)}
    <span class="truncate" {@attach ownFace(option.family)}>{option.label}</span>
  {/snippet}
</Combobox>
