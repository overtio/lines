<script lang="ts">
  // Settings → Theme → Palettes: the colors themes are drawn in, lines' own and yours, each a strip of
  // its colors. The one chosen shows its colors by name, and yours can be changed (PaletteEditor). New
  // ones start from a few of the theme's colors, a picture or a copy, or come from a palette file or
  // colors pasted.
  import { DropdownMenu, RadioGroup } from "bits-ui";
  import { tick } from "svelte";
  import { speak } from "../../a11y";
  import { locale, t } from "../../i18n/index.svelte";
  import Icon from "../../icons/Icon.svelte";
  import { plugins } from "../../plugins/registry.svelte";
  import type { Palette } from "../../plugins/types";
  import { prefs } from "../../prefs.svelte";
  import { customThemes } from "../../themes/custom.svelte";
  import { paletteColor, paletteOfColors, readPalette } from "../../themes/file";
  import { paletteNames } from "../../themes/names";
  import { paletteOf } from "../../themes/palette";
  import { pictureColors, pictureName } from "../../themes/picture";
  import { shownScheme } from "../../themes/show.svelte";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import { floating, option as menuOption } from "../ui/styles";
  import TextField from "../ui/TextField.svelte";
  import PaletteEditor from "./PaletteEditor.svelte";
  import PaletteStrip from "./PaletteStrip.svelte";

  const heading = $props.id();
  const list = new Intl.ListFormat(locale, { type: "conjunction" });

  const theme = $derived(plugins.theme(prefs.theme));
  const yours = $derived(customThemes.palettes);
  const builtIn = $derived(plugins.palettes.filter((palette) => !customThemes.palette(palette.id)));
  /** The palette whose colors show: the one picked, or the one the theme showing is drawn in. */
  let picked = $state<string | null>(null);
  const chosen = $derived(plugins.palette(picked ?? paletteOf(theme.definition, shownScheme(theme).own)));
  const names = $derived(chosen ? paletteNames(chosen) : new Map<string, string>());
  /** A palette just made, whose name is ready to type over. */
  let made = $state<string | null>(null);

  /** A palette just made, chosen, its name ready to type over. */
  function show(id: string, name: string) {
    picked = made = id;
    speak(t("settings.paletteMade", { name }));
  }

  /** A name for a new palette none of yours has yet: `name`, or `name 2`, `name 3`… */
  function freeName(name: string) {
    const taken = new Set(yours.map((palette) => palette.name));
    for (let n = 1; ; n++) if (!taken.has(n === 1 ? name : `${name} ${n}`)) return n === 1 ? name : `${name} ${n}`;
  }

  /** A palette of the theme's main colors as it shows: its backgrounds, text and accent. */
  function fromTheme() {
    const colors = theme[shownScheme(theme).own];
    const start = [...new Set(["bg", "bg-sidebar", "text", "text-muted", "accent"].flatMap((part) => paletteColor(colors[part]) ?? []))];
    const name = freeName(t("settings.paletteNewName"));
    show(customThemes.addPalette(paletteOfColors(name, start)), name);
  }

  function copy(palette: Palette) {
    const name = freeName(t("settings.paletteCopyName", { name: palette.name }));
    show(customThemes.addPalette({ name, author: palette.author, colors: palette.colors }), name);
  }

  let pictures = $state<HTMLInputElement>();
  let picker = $state<HTMLInputElement>();
  let pasting = $state(false);
  let imported = $state<string | null>(null);
  let importError = $state<string | null>(null);

  async function fromPicture() {
    const file = pictures?.files?.[0];
    pictures!.value = "";
    if (!file) return;
    imported = importError = null;
    try {
      const name = freeName(pictureName(file.name) || t("settings.themePictureName"));
      show(customThemes.addPalette(paletteOfColors(name, await pictureColors(file))), name);
    } catch {
      importError = t("settings.themePictureError");
      speak(importError);
    }
  }

  /** Adds the palettes in files (or pasted text): palette files, or the colors written in them. Says which it couldn't read. */
  function importPalettes(sources: { text: string; name: string }[]) {
    imported = importError = null;
    const added: string[] = [];
    const unreadable: string[] = [];
    let first: string | undefined;
    for (const { text, name } of sources) {
      const palette = readPalette(text, name.replace(/\.[a-z0-9.]+$/i, ""));
      if (!palette) {
        unreadable.push(`“${name}”`);
        continue;
      }
      const called = freeName(palette.name);
      const id = customThemes.addPalette({ ...palette, name: called });
      first ??= id;
      added.push(called);
    }
    if (first) picked = first;
    if (added.length) imported = t("settings.palettesImported", { names: list.format(added) });
    if (unreadable.length) importError = t("settings.paletteUnreadable", { names: list.format(unreadable) });
    speak([imported, importError].filter(Boolean).join(" "));
  }

  async function importChosen() {
    const files = [...(picker?.files ?? [])];
    picker!.value = "";
    importPalettes(await Promise.all(files.map(async (file) => ({ text: await file.text(), name: file.name }))));
  }

  function pasted(event: ClipboardEvent) {
    const text = event.clipboardData?.getData("text/plain");
    event.preventDefault();
    if (!text?.trim()) return;
    pasting = false;
    importPalettes([{ text, name: t("settings.palettePastedName") }]);
  }

  async function startPasting() {
    pasting = true;
    imported = importError = null;
    await tick();
    document.getElementById(`${heading}-paste`)?.focus();
  }

  async function remove(id: string, instead: string | undefined) {
    const name = customThemes.palette(id)?.name ?? "";
    if (!customThemes.removePalette(id, instead, (each) => plugins.palette(each))) return;
    picked = null;
    speak(t("settings.paletteDeleted", { name }));
    await tick();
    document.getElementById(heading)?.focus();
  }
</script>

{#snippet actions()}
  <div class="flex items-center gap-1">
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="quiet" icon="import" aria-label={t("settings.paletteImportLabel")}>{t("settings.paletteImport")}</Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8} aria-label={t("settings.paletteImportLabel")} class="{floating} min-w-[200px] p-[5px]">
          <DropdownMenu.Item class={menuOption} onSelect={() => picker?.click()}>
            <Icon name="file-text" size={15} />{t("settings.paletteImportFile")}
          </DropdownMenu.Item>
          <DropdownMenu.Item class={menuOption} onSelect={() => void startPasting()}>
            <Icon name="clipboard" size={15} />{t("settings.paletteImportPaste")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="quiet" icon="plus" aria-label={t("settings.paletteNewLabel")}>{t("settings.paletteNew")}</Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8} aria-label={t("settings.paletteNewLabel")} class="{floating} min-w-[200px] p-[5px]">
          <DropdownMenu.Item class={menuOption} onSelect={fromTheme}>
            <Icon name="palette" size={15} />{t("settings.paletteNewFromTheme", { name: theme.name })}
          </DropdownMenu.Item>
          <DropdownMenu.Item class={menuOption} onSelect={() => pictures?.click()}>
            <Icon name="image" size={15} />{t("settings.themeNewFromPicture")}
          </DropdownMenu.Item>
          {#if chosen}
            <DropdownMenu.Item class={menuOption} onSelect={() => copy(chosen)}>
              <Icon name="copy" size={15} />{t("settings.paletteNewCopy", { name: chosen.name })}
            </DropdownMenu.Item>
          {/if}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  </div>
  <input bind:this={picker} type="file" multiple class="hidden" onchange={importChosen} />
  <input bind:this={pictures} type="file" accept="image/*" class="hidden" onchange={fromPicture} />
{/snippet}

{#snippet tiles(group: Palette[])}
  <div class="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
    {#each group as palette (palette.id)}
      <RadioGroup.Item value={palette.id} aria-label={palette.name} class="group flex flex-col gap-1.5 rounded-xl p-1 pb-1.5 text-center hover:bg-hover">
        <!-- In forced colors the strips keep their colors, and the chosen one an outline for its ring. -->
        <PaletteStrip
          {palette}
          decorative
          class="transition-shadow group-data-[state=checked]:ring-2 group-data-[state=checked]:ring-accent forced-colors:group-data-[state=checked]:outline-2 forced-colors:group-data-[state=checked]:outline-[HighlightText]"
        />
        <span class="truncate text-xs font-medium text-muted group-data-[state=checked]:text-fg">{palette.name}</span>
      </RadioGroup.Item>
    {/each}
  </div>
{/snippet}

<FieldGroup title={t("settings.palettes")} note={t("settings.palettesNote")} action={actions} id={heading}>
  {#if pasting || imported || importError}
    <div class="flex flex-col gap-2 border-b border-line p-3">
      {#if pasting}
        <div class="flex items-center gap-2">
          <TextField
            id="{heading}-paste"
            class="flex-1"
            icon="clipboard"
            placeholder={t("settings.palettePastePlaceholder")}
            aria-label={t("settings.paletteImportPaste")}
            onpaste={pasted}
            onkeydown={(event) => event.key === "Escape" && (event.stopPropagation(), (pasting = false))}
          />
          <Button variant="quiet" onclick={() => (pasting = false)}>{t("settings.cancel")}</Button>
        </div>
      {/if}
      {#if imported}<Callout tone="success">{imported}</Callout>{/if}
      {#if importError}<Callout tone="danger">{importError}</Callout>{/if}
    </div>
  {/if}
  <div class="p-3">
    <!-- One group of radio buttons, so Tab stops once and the arrow keys go through every palette. -->
    <RadioGroup.Root value={chosen?.id ?? ""} onValueChange={(id) => (picked = id)} aria-label={t("settings.palettes")}>
      {@render tiles(builtIn)}
      {#if yours.length}
        <h4 class="m-0 mt-4 mb-2 px-1 text-sm font-medium text-muted">{t("settings.palettesYours")}</h4>
        {@render tiles(yours)}
      {/if}
    </RadioGroup.Root>
  </div>
</FieldGroup>

{#if chosen && customThemes.palette(chosen.id)}
  {#key chosen.id}
    <PaletteEditor id={chosen.id} fresh={made === chosen.id} ondelete={(instead) => void remove(chosen.id, instead)} />
  {/key}
{:else if chosen}
  {#snippet copyAction()}
    <Button icon="copy" onclick={() => copy(chosen)}>{t("settings.makeCopy")}</Button>
  {/snippet}
  <FieldGroup title={chosen.name} note={chosen.author ? t("settings.themeBy", { author: chosen.author }) : t("settings.paletteBuiltIn")} action={copyAction}>
    <ul class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-2 p-3">
      {#each chosen.colors as { id, color } (id)}
        <li class="flex min-w-0 items-center gap-2" title={color}>
          <span class="size-6 shrink-0 rounded-full inset-ring inset-ring-line forced-color-adjust-none" style:background={color} aria-hidden="true"></span>
          <span class="truncate text-sm text-fg">{names.get(id)}</span>
        </li>
      {/each}
    </ul>
  </FieldGroup>
{/if}
