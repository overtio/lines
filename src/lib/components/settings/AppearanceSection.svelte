<script lang="ts">
  import { RadioGroup } from "bits-ui";
  import { t } from "../../i18n/index.svelte";
  import Icon from "../../icons/Icon.svelte";
  import type { IconName } from "../../icons/icons";
  import { plugins } from "../../plugins/registry.svelte";
  import { prefs, type Appearance, type Contrast } from "../../prefs.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";

  const appearances: { id: Appearance; label: string }[] = [
    { id: "system", label: t("settings.appearanceSystem") },
    { id: "light", label: t("settings.appearanceLight") },
    { id: "dark", label: t("settings.appearanceDark") },
  ];
  const contrasts: { id: Contrast; label: string }[] = [
    { id: "system", label: t("settings.appearanceSystem") },
    { id: "standard", label: t("settings.contrastStandard") },
    { id: "more", label: t("settings.contrastMore") },
  ];

  /** Icon sets from the plugins turned on; one that can't work here (SF Symbols on the web) shows why. */
  const iconSets = $derived(
    plugins.all
      .filter((plugin) => plugins.isOn(plugin))
      .flatMap((plugin) =>
        (plugin.contributes.iconSets ?? []).map(({ id, name }) => ({
          id,
          label: name,
          disabled: !plugins.isActive(plugin),
          availability: plugin.available === false ? plugin.availability : undefined,
        })),
      ),
  );
  const iconsUnavailable = $derived(iconSets.flatMap((set) => set.availability ?? []).join(" ") || null);
  const previewIcons: IconName[] = ["notes", "tag", "pin", "trash"];

  const themes = $derived(plugins.themes);
  // The accessibility themes come after the others, under their own heading, in the same group.
  const themeGroups = $derived([themes.filter((theme) => !theme.accessible), themes.filter((theme) => theme.accessible)]);
  // What shows: the theme chosen, or Lines while the chosen one's plugin is off.
  const theme = $derived(plugins.theme(prefs.theme).id);
</script>

<FieldGroup title={t("settings.theme")}>
  <div class="border-b border-line p-3">
    <!-- One group of radio buttons, so Tab stops once and the arrow keys go through every theme. -->
    <RadioGroup.Root value={theme} onValueChange={(id) => (prefs.theme = id)} aria-label={t("settings.theme")}>
      {#each themeGroups as group, index (index)}
        {#if index > 0 && group.length}
          <h4 class="m-0 mt-4 mb-2 px-1 text-sm font-medium text-muted">{t("settings.themesAccessibility")}</h4>
        {/if}
        <div class="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
          {#each group as option (option.id)}
            {@const { bg, "bg-sidebar": sidebar, text, accent } = option[prefs.dark ? "dark" : "light"]}
            <RadioGroup.Item value={option.id} class="group flex flex-col gap-1.5 rounded-xl p-1 pb-1.5 text-center hover:bg-hover">
              <!-- In forced colors the previews keep each theme's own colors, and the chosen one an outline for its ring. -->
              <span
                class="flex h-16 overflow-hidden rounded-lg inset-ring inset-ring-line transition-shadow forced-color-adjust-none group-data-[state=checked]:ring-2 group-data-[state=checked]:ring-accent group-data-[state=checked]:inset-ring-0 forced-colors:group-data-[state=checked]:outline-2 forced-colors:group-data-[state=checked]:outline-[HighlightText]"
                style:background={bg}
                style:color={text}
                aria-hidden="true"
              >
                <span class="w-[26%] pt-[9px] pl-[7px]" style:background={sidebar}>
                  <span class="block size-[7px] rounded-full" style:background={accent}></span>
                </span>
                <span class="flex flex-1 flex-col gap-1.5 px-2.5 py-[11px]">
                  <span class="h-1 w-[60%] rounded-[2px] bg-current opacity-85"></span>
                  <span class="h-1 rounded-[2px] bg-current opacity-35"></span>
                  <span class="h-1 w-[40%] rounded-[2px]" style:background={accent}></span>
                </span>
              </span>
              <span class="text-xs font-medium text-muted group-data-[state=checked]:text-fg">{option.name}</span>
            </RadioGroup.Item>
          {/each}
        </div>
      {/each}
    </RadioGroup.Root>
    <p class="m-0 mt-3 px-1 text-xs leading-normal text-muted">{t("settings.themesAccessibilityNote")}</p>
  </div>
</FieldGroup>

<FieldGroup>
  <FieldRow label={t("settings.mode")}>
    <Segmented label={t("settings.mode")} options={appearances} value={prefs.appearance} onselect={(id) => (prefs.appearance = id)} />
  </FieldRow>
  <FieldRow label={t("settings.contrast")} note={t("settings.contrastNote")}>
    <Segmented label={t("settings.contrast")} options={contrasts} value={prefs.contrast} onselect={(id) => (prefs.contrast = id)} />
  </FieldRow>
  {#if iconSets.length > 1}
    <FieldRow label={t("settings.icons")} note={iconsUnavailable}>
      <Segmented label={t("settings.icons")} options={iconSets} value={plugins.iconSet(prefs.icons).id} onselect={(id) => (prefs.icons = id)}>
        {#snippet content(set)}
          {#if !set.disabled}
            <span class="flex gap-1.5">
              {#each previewIcons as name (name)}<Icon {name} size={15} set={set.id} />{/each}
            </span>
          {/if}
          {set.label}
        {/snippet}
      </Segmented>
    </FieldRow>
  {/if}
</FieldGroup>
