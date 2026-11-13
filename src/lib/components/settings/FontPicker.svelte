<script lang="ts">
  // A font installed on this device (themes/installedFonts.ts), each drawn in its own face: from
  // the system's list, asked for as the picker opens, or by its name typed where there's none.
  import { t } from "../../i18n/index.svelte";
  import { canDraw, installedFamily, listInstalledFonts, matchingFamilies } from "../../themes/installedFonts";
  import Combobox from "../ui/Combobox.svelte";

  type Props = { value: string; onchange: (family: string) => void; label: string; id?: string; describedby?: string; class?: string };
  let { value, onchange, label, id, describedby, class: className }: Props = $props();

  let query = $state("");
  /** The families installed, once listed; null where they can't be (asked again as it opens again). */
  let families = $state<string[] | null>();

  async function load() {
    if (!families) families = await listInstalledFonts();
  }

  const typed = $derived(query.trim());
  const options = $derived.by(() => {
    const found = matchingFamilies(families ?? [], typed);
    // A family typed that isn't listed but is here to draw in: where fonts can't be listed, or a web font.
    const listed = found.some((family) => family.toLowerCase() === typed.toLowerCase());
    if (typed && !listed && canDraw(typed)) found.unshift(typed);
    return found.map((family) => ({ value: family, label: family }));
  });

  const message = $derived(
    families === undefined ? t("settings.fontsFinding") : options.length ? null : typed ? t("settings.fontNotHere", { name: typed }) : t("settings.fontTypeName"),
  );
</script>

<Combobox
  class={className}
  {value}
  {options}
  {onchange}
  {label}
  {id}
  {describedby}
  bind:query
  {message}
  placeholder={t("settings.fontSearch")}
  counted={(count) => t("settings.fontsFound", { count })}
  onopen={load}
>
  {#snippet item(option)}
    <span class="truncate" style:font-family={installedFamily(option.value, "var(--font-ui)")}>{option.label}</span>
  {/snippet}
</Combobox>
