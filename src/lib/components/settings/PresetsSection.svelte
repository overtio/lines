<script lang="ts">
  // Settings → Presets: a whole look chosen in one (themes/presets.svelte.ts), the plugins'
  // and your own; what's chosen can be undone, saved as a preset of yours, and yours renamed,
  // updated to the look there is now, shared as a file, or deleted. Others' come in by Import.
  import { DropdownMenu, RadioGroup } from "bits-ui";
  import { tick } from "svelte";
  import { speak } from "../../a11y";
  import { locale, t } from "../../i18n/index.svelte";
  import Icon from "../../icons/Icon.svelte";
  import { fileName } from "../../notes/fileName";
  import { reducedMotion } from "../../platform";
  import { plugins } from "../../plugins/registry.svelte";
  import { prefs } from "../../prefs.svelte";
  import { fontFamily } from "../../themes/fonts.svelte";
  import { currentSettings, PRESET_FILE_EXTENSION, presets, readPresetFile, writePresetFile, type Preset } from "../../themes/presets.svelte";
  import { schemeShown } from "../../themes/show.svelte";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import { floating, option as menuOption } from "../ui/styles";
  import TextField from "../ui/TextField.svelte";
  import ShareFileMenu from "./ShareFileMenu.svelte";

  const heading = $props.id();
  const chosen = $derived(presets.chosen);

  /** A preset's tile: its theme's colors, as shown light or dark now, its type and its corners. */
  function tile({ settings }: Preset) {
    const theme = plugins.theme(settings.theme);
    const { bg, text, accent } = theme[schemeShown(theme, prefs.dark)];
    const style = plugins.style(settings.style);
    const font = settings.font === "system" ? (style?.font?.family ?? "system-ui, sans-serif") : fontFamily(settings.font);
    return { bg, text, accent, font, round: style?.properties?.["radius-scale"] ?? "1" };
  }

  /** The preset just chosen, and the look before it, to go back to. */
  let undo = $state<{ name: string; before: ReturnType<typeof presets.choose> } | null>(null);

  function choose(preset: Preset) {
    undo = { name: preset.name, before: presets.choose(preset) };
    speak(t("settings.presetChosen", { name: preset.name }));
  }

  function goBack() {
    if (!undo) return;
    presets.restore(undo.before);
    speak(t("settings.presetUndone"));
    undo = null;
  }

  /** A preset of yours just made has its name ready to type over. */
  let nameField = $state<HTMLInputElement>();

  /** The look there is now, as a preset of yours, chosen. */
  async function save() {
    undo = null;
    const id = presets.add(presets.freeName(t("settings.presetNewName", { name: chosen?.name ?? "Lines" })), currentSettings());
    prefs.preset = id;
    await tick();
    nameField?.focus({ preventScroll: true });
    nameField?.select();
    nameField?.scrollIntoView({ block: "center", behavior: reducedMotion.matches ? "instant" : "smooth" });
  }

  function update() {
    if (!chosen) return;
    presets.update(chosen.id);
    speak(t("settings.presetUpdated", { name: chosen.name }));
  }

  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  let picker = $state<HTMLInputElement>();
  let pasting = $state(false);
  let imported = $state<string | null>(null);
  let importError = $state<string | null>(null);

  /** Adds the presets in files (or pasted text), and chooses the first; says which it couldn't read. */
  function importPresets(sources: { text: string; name: string }[]) {
    imported = importError = null;
    const added: Preset[] = [];
    const unreadable: string[] = [];
    for (const { text, name } of sources) {
      const file = readPresetFile(text);
      if (file) added.push(presets.get(presets.addFile(file))!);
      else unreadable.push(`“${name}”`);
    }
    if (added.length) {
      choose(added[0]);
      imported = t("settings.presetsImported", { names: list.format(added.map((preset) => preset.name)) });
    }
    if (unreadable.length) importError = t("settings.presetUnreadable", { names: list.format(unreadable) });
    speak([imported, importError].filter(Boolean).join(" "));
  }

  async function importChosen() {
    const files = [...(picker?.files ?? [])];
    picker!.value = "";
    importPresets(await Promise.all(files.map(async (file) => ({ text: await file.text(), name: file.name }))));
  }

  function pasted(event: ClipboardEvent) {
    const text = event.clipboardData?.getData("text/plain");
    event.preventDefault();
    if (!text?.trim()) return;
    pasting = false;
    importPresets([{ text, name: t("settings.presetPastedName") }]);
  }

  async function startPasting() {
    pasting = true;
    imported = importError = null;
    await tick();
    document.getElementById(`${heading}-paste`)?.focus();
  }

  /** Asking first, in the page: the Mac app's web view has no confirm(). */
  let confirming = $state(false);

  async function remove() {
    if (!chosen) return;
    const { id, name } = chosen;
    confirming = false;
    presets.remove(id);
    speak(t("settings.presetDeleted", { name }));
    await tick();
    document.getElementById(heading)?.focus();
  }

  async function cancelDelete() {
    confirming = false;
    await tick();
    document.getElementById(`${heading}-delete`)?.focus();
  }
</script>

{#snippet actions()}
  <div class="flex items-center gap-1">
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="quiet" icon="import">{t("settings.presetImport")}</Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8} aria-label={t("settings.presetImport")} class="{floating} min-w-[200px] p-[5px]">
          <DropdownMenu.Item class={menuOption} onSelect={() => picker?.click()}>
            <Icon name="file-text" size={15} />{t("settings.presetImportFile")}
          </DropdownMenu.Item>
          <DropdownMenu.Item class={menuOption} onSelect={() => void startPasting()}>
            <Icon name="clipboard" size={15} />{t("settings.presetImportPaste")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    <Button variant="quiet" icon="plus" title={t("settings.presetSaveHint")} onclick={() => void save()}>{t("settings.presetSave")}</Button>
  </div>
  <input bind:this={picker} type="file" multiple accept=".json,application/json" class="hidden" onchange={importChosen} />
{/snippet}

{#snippet tiles(group: Preset[])}
  <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
    {#each group as preset (preset.id)}
      {@const { bg, text, accent, font, round } = tile(preset)}
      <RadioGroup.Item value={preset.id} class="group flex flex-col gap-1 rounded-xl p-1 pb-1.5 text-left hover:bg-hover">
        <!-- In forced colors the previews keep each preset's own colors, and the chosen one an outline for its ring. -->
        <span
          class="flex h-16 items-center gap-3 overflow-hidden rounded-lg px-3.5 inset-ring inset-ring-line transition-shadow forced-color-adjust-none group-data-[state=checked]:ring-2 group-data-[state=checked]:ring-accent group-data-[state=checked]:inset-ring-0 forced-colors:group-data-[state=checked]:outline-2 forced-colors:group-data-[state=checked]:outline-[HighlightText]"
          style:background={bg}
          style:color={text}
          aria-hidden="true"
        >
          <span class="text-[26px] leading-none" style:font-family={font}>Aa</span>
          <span class="h-3 flex-1" style:background={accent} style:border-radius="calc(6px * {round})"></span>
        </span>
        <span class="px-1 text-sm font-medium text-fg">{preset.name}</span>
        {#if preset.description}<span class="px-1 text-xs leading-snug text-muted">{preset.description}</span>{/if}
        {#if preset.author}<span class="px-1 text-xs leading-snug text-muted">{t("settings.themeBy", { author: preset.author })}</span>{/if}
      </RadioGroup.Item>
    {/each}
  </div>
{/snippet}

<FieldGroup title={t("settings.presets")} note={t("settings.presetsNote")} action={actions} id={heading}>
  {#if pasting || imported || importError || undo}
    <div class="flex flex-col gap-2 border-b border-line p-3">
      {#if pasting}
        <div class="flex items-center gap-2">
          <TextField
            id="{heading}-paste"
            class="flex-1"
            icon="clipboard"
            placeholder={t("settings.presetPastePlaceholder")}
            aria-label={t("settings.presetImportPaste")}
            onpaste={pasted}
            onkeydown={(event) => event.key === "Escape" && (event.stopPropagation(), (pasting = false))}
          />
          <Button variant="quiet" onclick={() => (pasting = false)}>{t("settings.cancel")}</Button>
        </div>
      {/if}
      {#if imported}<Callout tone="success">{imported}</Callout>{/if}
      {#if importError}<Callout tone="danger">{importError}</Callout>{/if}
      {#if undo && !imported}
        <Callout class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span>{t("settings.presetChosen", { name: undo.name })}</span>
          <Button onclick={goBack}>{t("settings.presetUndo")}</Button>
        </Callout>
      {/if}
    </div>
  {/if}
  <div class="p-3">
    <!-- One group of radio buttons, so Tab stops once and the arrow keys go through every preset. -->
    <RadioGroup.Root
      value={chosen?.id ?? ""}
      onValueChange={(id) => {
        const preset = presets.get(id);
        if (preset) choose(preset);
      }}
      aria-labelledby={heading}
    >
      {@render tiles(presets.builtIn)}
      {#if presets.mine.length}
        <h4 class="m-0 mt-4 mb-2 px-1 text-sm font-medium text-muted">{t("settings.presetsYours")}</h4>
        {@render tiles(presets.mine)}
      {/if}
    </RadioGroup.Root>
  </div>
  {#if chosen && presets.changed}
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-4 py-3">
      <span class="min-w-0 flex-1 text-sm text-muted">{t("settings.presetChanged", { name: chosen.name })}</span>
      <div class="flex items-center gap-1">
        <Button variant="quiet" onclick={() => choose(chosen)}>{t("settings.presetReset", { name: chosen.name })}</Button>
        {#if chosen.mine}<Button onclick={update}>{t("settings.presetUpdate")}</Button>{/if}
      </div>
    </div>
  {/if}
  {#if chosen?.mine}
    {@const mine = chosen}
    <FieldRow label={t("settings.presetName")} for="{heading}-name">
      <div class="flex items-center gap-1">
        <TextField
          id="{heading}-name"
          bind:input={nameField}
          value={mine.name}
          maxlength={80}
          class="w-56"
          oninput={(event) => presets.rename(mine.id, event.currentTarget.value)}
          onblur={(event) => (event.currentTarget.value = mine.name)}
        />
        {#if confirming}
          <Button variant="quiet" onclick={cancelDelete}>{t("settings.cancel")}</Button>
          <Button variant="danger-primary" onclick={remove}>{t("settings.presetDelete")}</Button>
        {:else}
          <ShareFileMenu
            label={t("settings.presetShare")}
            copyLabel={t("settings.presetCopy")}
            copied={t("settings.presetCopied")}
            downloadLabel={t("settings.presetDownload")}
            file={() => ({ name: `${fileName(mine.name)}${PRESET_FILE_EXTENSION}`, text: writePresetFile(mine) })}
          />
          <IconButton
            id="{heading}-delete"
            icon="trash"
            label={t("settings.presetDelete")}
            onclick={() => {
              confirming = true;
              speak(t("settings.presetDeleteQuestion", { name: mine.name }));
            }}
          />
        {/if}
      </div>
    </FieldRow>
  {/if}
</FieldGroup>
