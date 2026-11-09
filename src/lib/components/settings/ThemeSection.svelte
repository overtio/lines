<script lang="ts">
  import { DropdownMenu, RadioGroup } from "bits-ui";
  import { tick } from "svelte";
  import { speak } from "../../a11y";
  import { locale, t } from "../../i18n/index.svelte";
  import Icon from "../../icons/Icon.svelte";
  import type { IconName } from "../../icons/icons";
  import { DEFAULT_THEME, plugins } from "../../plugins/registry.svelte";
  import type { Theme } from "../../plugins/types";
  import { DARK_PANES, prefs, type Appearance, type Contrast } from "../../prefs.svelte";
  import { chooseBackdropImage } from "../../paper.svelte";
  import { customThemes } from "../../themes/custom.svelte";
  import { pictureName, themeFromPicture } from "../../themes/picture";
  import { readableFormats, readThemes } from "../../themes/import";
  import { paneColors, schemeShown } from "../../themes/show.svelte";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Switch from "../ui/Switch.svelte";
  import { floating, option as menuOption } from "../ui/styles";
  import TextField from "../ui/TextField.svelte";
  import ThemeEditor from "./ThemeEditor.svelte";

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
  const PANE_NAMES = { none: "settings.darkPanesNone", sidebar: "settings.darkPanesSidebar", list: "settings.darkPanesList", both: "settings.darkPanesBoth" } as const;
  const darkPanes = DARK_PANES.map((id) => ({ id, label: t(PANE_NAMES[id]) }));

  /** A theme's tile: its colors for the scheme shown, and its sidebar's dark if Dark panes says so. */
  function tile(option: Theme) {
    const own = schemeShown(option, prefs.dark);
    const colors = option[own];
    const dark = own === "light" && (prefs.darkPanes === "sidebar" || prefs.darkPanes === "both") ? paneColors(option, own, false) : colors;
    return { bg: colors.bg, text: colors.text, accent: colors.accent, sidebar: dark["bg-sidebar"], sidebarAccent: dark.accent };
  }

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

  const styleShown = $derived(plugins.style(prefs.style)?.id ?? "");

  /**
   * A style, with its colors if it brings some; leaving one whose colors still show goes back to
   * lines' own, so its colors don't stay behind with another look.
   */
  function chooseStyle(id: string) {
    const before = plugins.style(prefs.style);
    const next = plugins.style(id);
    prefs.style = id;
    if (next?.theme) prefs.theme = next.theme;
    else if (before?.theme && prefs.theme === before.theme) prefs.theme = DEFAULT_THEME;
  }

  /** The colors a style's tile shows, those choosing it would: its own, or the chosen theme's (lines' own in place of a style's). */
  function styleColors(themeId: string | undefined) {
    const own = plugins.style(prefs.style)?.theme;
    const colors = plugins.theme(themeId ?? (own && prefs.theme === own ? DEFAULT_THEME : prefs.theme));
    return colors[schemeShown(colors, prefs.dark)];
  }

  const yours = $derived(new Set(customThemes.themes.map((theme) => theme.id)));
  const builtIn = $derived(plugins.themes.filter((theme) => !yours.has(theme.id)));
  // The accessibility themes, then your own, come after the others under headings of their own, in the same group.
  const themeGroups = $derived([
    { heading: null, themes: builtIn.filter((theme) => !theme.accessible) },
    { heading: t("settings.themesAccessibility"), themes: builtIn.filter((theme) => theme.accessible) },
    { heading: t("settings.themesYours"), themes: customThemes.themes },
  ]);
  // What shows: the theme chosen, or Lines while the chosen one's plugin is off.
  const shown = $derived(plugins.theme(prefs.theme));
  const theme = $derived(shown.id);
  const themeHeading = $props.id();
  const styleHeading = `${themeHeading}-style`;
  /** The theme just made, whose name is ready to type over. */
  let made = $state<string | null>(null);

  /** A theme of your own, to change, from the one showing: a copy of yours as it's kept, or a plugin's with its colors for Increased contrast. */
  function newTheme() {
    const { author, light, dark, moreContrast } = customThemes.get(theme) ?? shown;
    made = prefs.theme = customThemes.add({ name: t("settings.themeCopyName", { name: shown.name }), author, light, dark, moreContrast });
  }

  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  let picker = $state<HTMLInputElement>();
  let pasting = $state(false);
  let imported = $state<string | null>(null);
  let importError = $state<string | null>(null);

  let pictures = $state<HTMLInputElement>();
  /** The picture a theme was just made from, which can be the backdrop too. */
  let fromPicture = $state<{ name: string; file: File } | null>(null);
  let pictureError = $state<string | null>(null);

  /** A theme of your own from a picture's colors (themes/picture.ts), shown at once, to change as wanted. */
  async function themeFromChosen() {
    const file = pictures?.files?.[0];
    pictures!.value = "";
    if (!file) return;
    imported = importError = pictureError = null;
    fromPicture = null;
    try {
      const made = await themeFromPicture(file, pictureName(file.name) || t("settings.themePictureName"));
      prefs.theme = customThemes.add(made);
      fromPicture = { name: made.name, file };
      speak(t("settings.themeFromPicture", { name: made.name }));
    } catch {
      pictureError = t("settings.themePictureError");
      speak(pictureError);
    }
  }

  async function useAsBackdrop() {
    if (!fromPicture) return;
    await chooseBackdropImage(fromPicture.file);
    fromPicture = null;
  }

  /** Adds the themes in files (or pasted text), and shows the first; says which it couldn't read. */
  async function importThemes(sources: { text: string; name: string }[]) {
    imported = importError = null;
    const added: string[] = [];
    const unreadable: string[] = [];
    let first: string | undefined;
    for (const { text, name } of sources) {
      const found = await readThemes(text, name);
      if (!found.length) unreadable.push(`“${name}”`);
      for (const each of found) {
        const id = customThemes.add(each);
        first ??= id;
        added.push(each.name);
      }
    }
    if (first) prefs.theme = first;
    if (added.length) imported = t("settings.themesImported", { names: list.format(added) });
    if (unreadable.length) importError = t("settings.themeUnreadable", { names: list.format(unreadable), formats: list.format(readableFormats()) });
    speak([imported, importError].filter(Boolean).join(" "));
  }

  async function importChosen() {
    const files = [...(picker?.files ?? [])];
    picker!.value = "";
    await importThemes(await Promise.all(files.map(async (file) => ({ text: await file.text(), name: file.name }))));
  }

  function pasted(event: ClipboardEvent) {
    const text = event.clipboardData?.getData("text/plain");
    event.preventDefault();
    if (!text?.trim()) return;
    pasting = false;
    void importThemes([{ text, name: t("settings.themePastedName") }]);
  }

  async function startPasting() {
    pasting = true;
    imported = importError = null;
    await tick();
    document.getElementById(`${themeHeading}-paste`)?.focus();
  }

  /** Deletes the theme showing, which was yours, and shows Lines in its place. */
  async function deleteTheme() {
    const { id, name } = shown;
    if (prefs.floatingTheme === id) prefs.floatingTheme = "same";
    prefs.theme = "lines";
    customThemes.remove(id);
    speak(t("settings.themeDeleted", { name }));
    await tick();
    document.getElementById(themeHeading)?.focus();
  }
</script>

{#snippet themeActions()}
  <div class="flex items-center gap-1">
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="quiet" icon="import">{t("settings.themeImport")}</Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8} aria-label={t("settings.themeImport")} class="{floating} min-w-[200px] p-[5px]">
          <DropdownMenu.Item class={menuOption} onSelect={() => picker?.click()}>
            <Icon name="file-text" size={15} />{t("settings.themeImportFile")}
          </DropdownMenu.Item>
          <DropdownMenu.Item class={menuOption} onSelect={() => void startPasting()}>
            <Icon name="clipboard" size={15} />{t("settings.themeImportPaste")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="quiet" icon="plus" title={t("settings.themeNewHint")}>{t("settings.themeNew")}</Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8} aria-label={t("settings.themeNew")} class="{floating} min-w-[200px] p-[5px]">
          <DropdownMenu.Item class={menuOption} onSelect={newTheme}>
            <Icon name="copy" size={15} />{t("settings.themeNewFrom", { name: shown.name })}
          </DropdownMenu.Item>
          <DropdownMenu.Item class={menuOption} onSelect={() => pictures?.click()}>
            <Icon name="image" size={15} />{t("settings.themeNewFromPicture")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  </div>
  <input bind:this={picker} type="file" multiple class="hidden" onchange={importChosen} />
  <input bind:this={pictures} type="file" accept="image/*" class="hidden" onchange={themeFromChosen} />
{/snippet}

{#if plugins.styles.length > 1}
  <FieldGroup title={t("settings.style")} note={t("settings.styleNote")} id={styleHeading}>
    <div class="p-3">
      <RadioGroup.Root value={styleShown} onValueChange={chooseStyle} aria-labelledby={styleHeading} class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
        {#each plugins.styles as option (option.id)}
          {@const { bg, text, accent } = styleColors(option.theme)}
          {@const round = option.properties?.["radius-scale"] ?? "1"}
          <RadioGroup.Item value={option.id} class="group flex flex-col gap-1 rounded-xl p-1 pb-1.5 text-left hover:bg-hover">
            <!-- In forced colors the previews keep each style's own colors, and the chosen one an outline for its ring. -->
            <span
              class="flex h-16 items-center gap-3 overflow-hidden rounded-lg px-3.5 inset-ring inset-ring-line transition-shadow forced-color-adjust-none group-data-[state=checked]:ring-2 group-data-[state=checked]:ring-accent group-data-[state=checked]:inset-ring-0 forced-colors:group-data-[state=checked]:outline-2 forced-colors:group-data-[state=checked]:outline-[HighlightText]"
              style:background={bg}
              style:color={text}
              aria-hidden="true"
            >
              <span class="text-[26px] leading-none" style:font-family={option.font?.family ?? "system-ui, sans-serif"}>Aa</span>
              <span class="h-3 flex-1" style:background={accent} style:border-radius="calc(6px * {round})"></span>
            </span>
            <span class="px-1 text-sm font-medium text-fg">{option.name}</span>
            {#if option.description}<span class="px-1 text-xs leading-snug text-muted">{option.description}</span>{/if}
          </RadioGroup.Item>
        {/each}
      </RadioGroup.Root>
    </div>
  </FieldGroup>
{/if}

<FieldGroup title={t("settings.themes")} note={t("settings.themeNote")} action={themeActions} id={themeHeading}>
  {#if pasting || imported || importError || fromPicture || pictureError}
    <div class="flex flex-col gap-2 border-b border-line p-3">
      {#if pasting}
        <div class="flex items-center gap-2">
          <TextField
            id="{themeHeading}-paste"
            class="flex-1"
            icon="clipboard"
            placeholder={t("settings.themePastePlaceholder")}
            aria-label={t("settings.themeImportPaste")}
            onpaste={pasted}
            onkeydown={(event) => event.key === "Escape" && (event.stopPropagation(), (pasting = false))}
          />
          <Button variant="quiet" onclick={() => (pasting = false)}>{t("settings.cancel")}</Button>
        </div>
      {/if}
      {#if imported}<Callout tone="success">{imported}</Callout>{/if}
      {#if importError}<Callout tone="danger">{importError}</Callout>{/if}
      {#if fromPicture}
        <Callout tone="success" class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span>{t("settings.themeFromPicture", { name: fromPicture.name })}</span>
          <Button icon="image" onclick={useAsBackdrop}>{t("settings.themePictureBackdrop")}</Button>
        </Callout>
      {/if}
      {#if pictureError}<Callout tone="danger">{pictureError}</Callout>{/if}
    </div>
  {/if}
  <div class="border-b border-line p-3">
    <!-- One group of radio buttons, so Tab stops once and the arrow keys go through every theme. -->
    <RadioGroup.Root value={theme} onValueChange={(id) => (prefs.theme = id)} aria-label={t("settings.theme")}>
      {#each themeGroups as group, index (index)}
        {#if group.heading && group.themes.length}
          <h4 class="m-0 mt-4 mb-2 px-1 text-sm font-medium text-muted">{group.heading}</h4>
        {/if}
        <div class="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
          {#each group.themes as option (option.id)}
            {@const { bg, text, accent, sidebar, sidebarAccent } = tile(option)}
            <RadioGroup.Item value={option.id} class="group flex flex-col gap-1.5 rounded-xl p-1 pb-1.5 text-center hover:bg-hover">
              <!-- In forced colors the previews keep each theme's own colors, and the chosen one an outline for its ring. -->
              <span
                class="flex h-16 overflow-hidden rounded-lg inset-ring inset-ring-line transition-shadow forced-color-adjust-none group-data-[state=checked]:ring-2 group-data-[state=checked]:ring-accent group-data-[state=checked]:inset-ring-0 forced-colors:group-data-[state=checked]:outline-2 forced-colors:group-data-[state=checked]:outline-[HighlightText]"
                style:background={bg}
                style:color={text}
                aria-hidden="true"
              >
                <span class="w-[26%] pt-[9px] pl-[7px]" style:background={sidebar}>
                  <span class="block size-[7px] rounded-full" style:background={sidebarAccent}></span>
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
  <FieldRow label={t("settings.mode")} note={shown.scheme ? t(shown.scheme === "dark" ? "settings.themeOnlyDarkMode" : "settings.themeOnlyLightMode", { name: shown.name }) : null}>
    <Segmented label={t("settings.mode")} options={appearances} value={prefs.appearance} onselect={(id) => (prefs.appearance = id)} />
  </FieldRow>
  <FieldRow label={t("settings.darkPanes")} note={t("settings.darkPanesNote")}>
    <Segmented label={t("settings.darkPanes")} options={darkPanes} value={prefs.darkPanes} onselect={(id) => (prefs.darkPanes = id)} />
  </FieldRow>
  <FieldRow label={t("settings.contrast")} note={t("settings.contrastNote")}>
    <Segmented label={t("settings.contrast")} options={contrasts} value={prefs.contrast} onselect={(id) => (prefs.contrast = id)} />
  </FieldRow>
  <FieldRow label={t("settings.monochrome")} note={t("settings.monochromeNote")}>
    <Switch label={t("settings.monochrome")} checked={prefs.monochrome} onchange={(on) => (prefs.monochrome = on)} />
  </FieldRow>
  <FieldRow label={t("settings.invert")} note={t("settings.invertNote")}>
    <Switch label={t("settings.invert")} checked={prefs.invert} onchange={(on) => (prefs.invert = on)} />
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

{#if yours.has(theme)}
  {#key theme}
    <ThemeEditor id={theme} fresh={made === theme} ondelete={deleteTheme} />
  {/key}
{/if}
