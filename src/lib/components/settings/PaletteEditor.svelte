<script lang="ts">
  // A palette of yours: its name, and its colors, each a color, a name (or none, for lines to name it
  // from its look) and a place, up to 32; shared as a file, and deleted, the themes of yours drawn in
  // it drawn in another palette that's chosen first.
  import { onMount, tick } from "svelte";
  import { speak } from "../../a11y";
  import { locale, t } from "../../i18n/index.svelte";
  import { fileName } from "../../notes/fileName";
  import { reducedMotion } from "../../platform";
  import { BLACK, fromLch, hex, parse, toLch } from "../../themes/color";
  import { customThemes } from "../../themes/custom.svelte";
  import { PALETTE_FILE_EXTENSION, PALETTE_SIZE, writePaletteFile } from "../../themes/file";
  import { nameFor, paletteNames } from "../../themes/names";
  import { addingTo, paletteChoices, swatchesOf } from "../../themes/paletteSwatches";
  import Button from "../ui/Button.svelte";
  import ColorField from "../ui/ColorField.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import Select from "../ui/Select.svelte";
  import TextField from "../ui/TextField.svelte";
  import ShareFileMenu from "./ShareFileMenu.svelte";

  /** `fresh`: just made, so its name is selected, to type over. `ondelete` gets the palette the themes drawn in it are drawn in instead. */
  let { id, fresh = false, ondelete }: { id: string; fresh?: boolean; ondelete: (instead: string | undefined) => void } = $props();
  const uid = $props.id();
  let nameField = $state<HTMLInputElement>();
  onMount(() => {
    if (!fresh || !nameField) return;
    nameField.focus({ preventScroll: true });
    nameField.select();
    nameField.scrollIntoView({ block: "center", behavior: reducedMotion.matches ? "instant" : "smooth" });
  });

  // Gone for a moment if it's deleted in another window, until Settings stops showing this.
  const palette = $derived(customThemes.palette(id));
  const names = $derived(palette ? paletteNames(palette) : new Map<string, string>());
  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  /** The themes of yours drawn in it, by name. */
  const usedBy = $derived(list.format(customThemes.themesIn(id).map((theme) => theme.name)));
  const full = $derived((palette?.colors.length ?? 0) >= PALETTE_SIZE);

  /** The palette as a file to share, made when it's shared. */
  const file = () => ({ name: `${fileName(palette!.name)}${PALETTE_FILE_EXTENSION}`, text: writePaletteFile(palette!) });

  /** Focus on the first of these, by id, that can take it, once the rows have changed. */
  async function focus(...ids: string[]) {
    await tick();
    const elements = ids.map((each) => document.getElementById(each) as HTMLButtonElement | null);
    elements.find((element) => element && !element.disabled)?.focus();
  }

  /** Moves a color, focus staying on its arrow, or going to the other once it's reached the end. */
  function move(colorId: string, by: -1 | 1) {
    customThemes.moveColor(id, colorId, by);
    const [same, other] = by < 0 ? ["up", "down"] : ["down", "up"];
    void focus(`${uid}-${colorId}-${same}`, `${uid}-${colorId}-${other}`);
  }

  function remove(colorId: string) {
    const at = palette!.colors.findIndex((entry) => entry.id === colorId);
    const name = names.get(colorId)!;
    customThemes.removeColor(id, colorId);
    speak(t("settings.paletteColorRemoved", { name }));
    // The next row's ×, or its color when it's the last left, which can't be taken out.
    const next = palette!.colors[Math.min(at, palette!.colors.length - 1)];
    void focus(`${uid}-${next.id}-remove`, `${uid}-${next.id}`);
  }

  /** A color to start a new one from: the last one's, turned round the hue wheel to one the palette hasn't. */
  function startColor() {
    const have = new Set(palette!.colors.map((entry) => entry.color));
    const last = toLch(parse(palette!.colors.at(-1)!.color) ?? BLACK);
    for (let turn = 1; turn < 9; turn++) {
      const color = hex(fromLch({ l: last.l, c: Math.max(last.c, 0.1), h: last.h + turn * 40 }));
      if (!have.has(color)) return color;
    }
    return hex(fromLch({ ...last, l: last.l > 0.5 ? last.l - 0.2 : last.l + 0.2 }));
  }

  /** A new color, to change at once: its color as text has focus. */
  function add() {
    const added = customThemes.addColor(id, startColor());
    if (!added) return;
    speak(t("settings.paletteColorAdded"));
    void focus(`${uid}-${added}`);
  }

  /** Asking first, in the page: the Mac app's web view has no confirm(). */
  let confirming = $state(false);
  /** The palettes the themes drawn in it can be drawn in instead, and the one chosen. */
  const others = $derived(paletteChoices().filter((each) => each.value !== id));
  let chosen = $state<string>();
  const instead = $derived(chosen ?? others[0]?.value);

  async function confirmDelete() {
    confirming = true;
    speak(usedBy ? t("settings.paletteDeleteUsed", { name: palette!.name, names: usedBy }) : t("settings.paletteDeleteQuestion", { name: palette!.name }));
    await tick();
    document.getElementById(`${uid}-cancel`)?.focus();
  }

  async function cancelDelete() {
    confirming = false;
    await tick();
    document.getElementById(`${uid}-delete`)?.focus();
  }
</script>

{#snippet actions()}
  <div class="flex items-center gap-1">
    {#if confirming}
      <Button id="{uid}-cancel" variant="quiet" onclick={cancelDelete}>{t("settings.cancel")}</Button>
      <Button variant="danger-primary" onclick={() => ondelete(usedBy ? instead : undefined)}>{t("settings.paletteDelete")}</Button>
    {:else}
      <ShareFileMenu label={t("settings.paletteShare")} copyLabel={t("settings.paletteCopy")} copied={t("settings.paletteCopied")} downloadLabel={t("settings.paletteDownload")} {file} />
      <IconButton
        id="{uid}-delete"
        icon="trash"
        label={t("settings.paletteDelete")}
        onclick={() => void confirmDelete()}
      />
    {/if}
  </div>
{/snippet}

{#if palette}
  <FieldGroup title={palette.name} note={usedBy ? t("settings.paletteUsedBy", { names: usedBy }) : t("settings.paletteUnused")} action={actions}>
    {#if confirming && usedBy && instead}
      <FieldRow label={t("settings.paletteInstead", { names: usedBy })} note={t("settings.paletteInsteadNote")}>
        <Select value={instead} options={others} label={t("settings.paletteInstead", { names: usedBy })} class="w-48" onchange={(to) => (chosen = to)} />
      </FieldRow>
    {/if}
    <FieldRow label={t("settings.paletteName")} for="{uid}-name">
      <TextField
        id="{uid}-name"
        bind:input={nameField}
        value={palette.name}
        maxlength={80}
        class="w-56"
        oninput={(event) => customThemes.renamePalette(id, event.currentTarget.value)}
        onblur={(event) => (event.currentTarget.value = palette.name)}
      />
    </FieldRow>
    <!-- A row for each color, its name in the field: a label beside it would only say it again. -->
    <ol class="m-0 list-none p-0" aria-label={t("settings.paletteColorsList")}>
      {#each palette.colors as entry, index (entry.id)}
        {@const name = names.get(entry.id)!}
        <li class="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-line px-4 py-2">
          <ColorField
            id="{uid}-{entry.id}"
            label={name}
            value={entry.color}
            swatches={swatchesOf(palette)}
            onadd={addingTo(palette)}
            aligned={false}
            onchange={(value) => value && customThemes.setPaletteColor(id, entry.id, value)}
          />
          <span class="flex min-w-48 flex-1 items-center gap-2">
            <TextField
              value={entry.name ?? ""}
              placeholder={nameFor(parse(entry.color)!)}
              maxlength={80}
              aria-label={t("settings.paletteColorName", { name })}
              class="flex-1"
              oninput={(event) => customThemes.nameColor(id, entry.id, event.currentTarget.value)}
            />
            <span class="flex items-center">
              <IconButton id="{uid}-{entry.id}-up" icon="chevron-up" label={t("settings.paletteMoveUp", { name })} disabled={index === 0} onclick={() => move(entry.id, -1)} />
              <IconButton
                id="{uid}-{entry.id}-down"
                icon="chevron-down"
                label={t("settings.paletteMoveDown", { name })}
                disabled={index === palette.colors.length - 1}
                onclick={() => move(entry.id, 1)}
              />
              <IconButton
                id="{uid}-{entry.id}-remove"
                icon="x"
                label={t("settings.paletteRemoveColor", { name })}
                disabled={palette.colors.length < 2}
                onclick={() => remove(entry.id)}
              />
            </span>
          </span>
        </li>
      {/each}
    </ol>
    <FieldRow label={t("settings.paletteAddColor")} note={full ? t("settings.paletteFull", { count: PALETTE_SIZE }) : null}>
      <Button icon="plus" disabled={full} onclick={add}>{t("settings.paletteAdd")}</Button>
    </FieldRow>
  </FieldGroup>
{/if}
