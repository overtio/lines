<script lang="ts">
  // A font installed on this device (themes/installedFonts.ts), each drawn in its own face: from
  // the system's list, asked for as the picker first opens, or by its name typed where there's none.
  import { t } from "../../i18n/index.svelte";
  import { canDraw, installedFamily, listInstalledFonts, matchingFamilies } from "../../themes/installedFonts";
  import Combobox from "../ui/Combobox.svelte";

  type Props = { value: string; onchange: (family: string) => void; label: string; class?: string };
  let { value, onchange, label, class: className }: Props = $props();

  let query = $state("");
  /** The families installed, once listed; null where they can't be. */
  let families = $state<string[] | null>();
  let loading = $state(false);

  async function load() {
    if (families !== undefined) return;
    loading = true;
    families = await listInstalledFonts();
    loading = false;
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
    loading ? t("settings.fontsFinding") : options.length ? null : typed ? t("settings.fontNotHere", { name: typed }) : t("settings.fontTypeName"),
  );
</script>

<Combobox
  class={className}
  {value}
  {options}
  {onchange}
  {label}
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
