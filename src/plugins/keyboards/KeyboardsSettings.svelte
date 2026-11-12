<script lang="ts">
  // Settings → Plugins → Keyboards, typing sounds: whether to hear a keyboard as you type, which, how loud, a
  // field to try it in, and sound packs of your own (Mechvibes'), added from a .zip or a folder.
  import { DropdownMenu } from "bits-ui";
  import { speak } from "../../lib/a11y";
  import { t } from "../../lib/i18n/index.svelte";
  import Icon from "../../lib/icons/Icon.svelte";
  import { plugins } from "../../lib/plugins/registry.svelte";
  import { formatPercent, prefs, TYPING_VOLUME } from "../../lib/prefs.svelte";
  import type { PackFiles } from "../../lib/sounds/mechvibes";
  import { soundPacks } from "../../lib/sounds/packs.svelte";
  import { typing } from "../../lib/sounds/typing.svelte";
  import { unzip } from "../../lib/zip";
  import Button from "../../lib/components/ui/Button.svelte";
  import Callout from "../../lib/components/ui/Callout.svelte";
  import FieldGroup from "../../lib/components/ui/FieldGroup.svelte";
  import FieldRow from "../../lib/components/ui/FieldRow.svelte";
  import IconButton from "../../lib/components/ui/IconButton.svelte";
  import Select from "../../lib/components/ui/Select.svelte";
  import Slider from "../../lib/components/ui/Slider.svelte";
  import { floating, option as menuOption } from "../../lib/components/ui/styles";
  import Switch from "../../lib/components/ui/Switch.svelte";
  import TextField from "../../lib/components/ui/TextField.svelte";

  const keyboard = $derived(plugins.keyboardSound(prefs.keyboardSound));
  const keyboards = $derived(plugins.keyboardSounds.map(({ id, name }) => ({ value: id, label: name })));

  let zipPicker = $state<HTMLInputElement>();
  let folderPicker = $state<HTMLInputElement>();
  let added = $state<string | null>(null);
  let failed = $state(false);

  /** Adds the pack `read` gets (its files, and a name if it has none) and chooses it, saying so, or that it isn't one. */
  async function add(read: () => Promise<[PackFiles, string] | undefined>) {
    added = null;
    failed = false;
    try {
      const pack = await read();
      if (!pack) return;
      prefs.keyboardSound = await soundPacks.add(...pack);
      added = t("settings.soundPackAdded", { name: plugins.keyboardSound(prefs.keyboardSound)?.name ?? pack[1] });
      speak(added);
    } catch {
      failed = true;
      speak(t("settings.soundPackError"));
    }
  }

  const addZip = () =>
    add(async () => {
      const file = zipPicker?.files?.[0];
      zipPicker!.value = "";
      return file && [await unzip(new Uint8Array(await file.arrayBuffer())), file.name.replace(/\.zip$/i, "")];
    });

  const addFolder = () =>
    add(async () => {
      const chosen = [...(folderPicker?.files ?? [])];
      folderPicker!.value = "";
      if (!chosen.length) return undefined;
      const files: PackFiles = new Map(await Promise.all(chosen.map(async (file) => [file.webkitRelativePath || file.name, new Uint8Array(await file.arrayBuffer())] as const)));
      return [files, chosen[0].webkitRelativePath.split("/")[0] || chosen[0].name];
    });

  async function remove(id: string) {
    if (prefs.keyboardSound === id) prefs.keyboardSound = plugins.keyboardSounds[0]?.id ?? prefs.keyboardSound;
    added = null;
    await soundPacks.remove(id);
  }
</script>

<FieldGroup title={t("settings.typingSounds")} note={t("settings.typingSoundsNote")}>
  <FieldRow label={t("settings.typingSoundsOn")}>
    <Switch label={t("settings.typingSoundsOn")} checked={prefs.typingSounds} onchange={(on) => (prefs.typingSounds = on)} />
  </FieldRow>
  {#if prefs.typingSounds && keyboard}
    <FieldRow label={t("settings.keyboard")} note={typing.unplayable ? t("settings.keyboardUnplayable") : keyboard.description}>
      <Select label={t("settings.keyboard")} value={keyboard.id} options={keyboards} onchange={(id) => (prefs.keyboardSound = id)} />
    </FieldRow>
    <FieldRow label={t("settings.typingVolume")}>
      <Slider class="w-60" bind:value={prefs.typingVolume} {...TYPING_VOLUME} label={t("settings.typingVolume")} format={formatPercent} />
    </FieldRow>
    <FieldRow label={t("settings.typingTry")}>
      <TextField class="w-60" placeholder={t("settings.typingTryPlaceholder")} aria-label={t("settings.typingTry")} autocomplete="off" spellcheck="false" />
    </FieldRow>
  {/if}
  <!-- Packs can be added with the Keyboards plugin off, which leaves no keyboard to choose until one is. -->
  {#if prefs.typingSounds}
    <FieldRow label={t("settings.soundPacks")} note={t("settings.soundPacksNote")}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button {...props} icon="plus">{t("settings.soundPackImport")}</Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8} aria-label={t("settings.soundPackImport")} class="{floating} min-w-[180px] p-[5px]">
            <DropdownMenu.Item class={menuOption} onSelect={() => zipPicker?.click()}>
              <Icon name="archive" size={15} />{t("settings.soundPackZip")}
            </DropdownMenu.Item>
            <DropdownMenu.Item class={menuOption} onSelect={() => folderPicker?.click()}>
              <Icon name="folder" size={15} />{t("settings.soundPackFolder")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <input bind:this={zipPicker} type="file" accept=".zip,application/zip" class="hidden" onchange={addZip} />
      <input bind:this={folderPicker} type="file" webkitdirectory class="hidden" onchange={addFolder} />
      {#snippet below()}
        {#if soundPacks.keyboards.length || added || failed}
          <div class="mt-3 flex flex-col gap-2">
            {#if added}<Callout tone="success">{added}</Callout>{/if}
            {#if failed}<Callout tone="danger">{t("settings.soundPackError")}</Callout>{/if}
            {#if soundPacks.keyboards.length}
              <ul class="m-0 flex list-none flex-col p-0">
                {#each soundPacks.keyboards as pack (pack.id)}
                  <li class="flex items-center gap-2 rounded-md py-1 pr-1 pl-2 text-sm hover:bg-hover">
                    <Icon name="keyboard" size={15} class="shrink-0 text-muted" />
                    <span class="min-w-0 flex-1 truncate">{pack.name}</span>
                    {#if pack.description}<span class="truncate text-xs text-muted">{pack.description}</span>{/if}
                    <IconButton icon="trash" label={t("settings.soundPackRemove", { name: pack.name })} onclick={() => void remove(pack.id)} />
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      {/snippet}
    </FieldRow>
  {/if}
</FieldGroup>
