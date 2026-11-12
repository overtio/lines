<script lang="ts">
  // A color: a swatch that opens lines' color picker (ColorPicker.svelte), and the color as text, to
  // type or paste (any color CSS reads), or a palette color's name. An optional one can be left empty,
  // to follow from others ("Auto").
  import { Popover } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import { solid } from "../../colors";
  import { t } from "../../i18n/index.svelte";
  import { parse } from "../../themes/color";
  import { addingTo, shownPalette, swatchesOf } from "../../themes/paletteSwatches";
  import ColorPicker from "./ColorPicker.svelte";
  import ColorText from "./ColorText.svelte";
  import IconButton from "./IconButton.svelte";
  import { floating } from "./styles";
  import type { SwatchColor } from "./Swatches.svelte";

  type Props = {
    /** What the color is for, as its row says it. */
    label: string;
    value: string | undefined;
    /** The text field's id, for its row's label. */
    id?: string;
    /** What the swatch shows: `value` unless it's a CSS variable that works the color out when there's none. */
    swatch?: string;
    /** Attributes for the swatch's frame, such as the custom properties `swatch` reads. */
    frame?: HTMLAttributes<HTMLSpanElement>;
    optional?: boolean;
    /** What the empty field shows: "Auto" unless said. */
    placeholder?: string;
    /**
     * The colors the picker offers first: unless said, the palette the window's theme is drawn in, for
     * the scheme it shows, which the picker's color can be added to if it's yours.
     */
    swatches?: SwatchColor[];
    /** Adds the picker's color to the palette `swatches` are from; without it, there's no Add to Palette. */
    onadd?: (color: string) => void;
    /** What it's called, in place of the color as text: a palette color's name. */
    name?: string;
    /** Whether a color of your own can be picked, or only one of `swatches`. */
    custom?: boolean;
    /** Whether a color that can't be automatic keeps the room of the reset button, to line up with ones that can. */
    aligned?: boolean;
    onchange: (value: string | undefined) => void;
  };
  let { label, value, id, swatch, frame, optional = false, placeholder, swatches, onadd, name, custom = true, aligned = true, onchange }: Props = $props();

  const windowPalette = $derived(swatches ? undefined : shownPalette());
  const offered = $derived(swatches ?? swatchesOf(windowPalette));
  const adding = $derived(onadd ?? addingTo(windowPalette));

  let shown = $state<HTMLSpanElement>();
  let trigger = $state<HTMLButtonElement | null>(null);
  let panel = $state<HTMLElement | null>(null);

  /**
   * Focus goes back to the swatch, unless it has moved on to something else: WebKit doesn't focus a
   * button that's clicked, so it isn't always where focus was when the picker opened.
   */
  function onCloseAutoFocus(event: Event) {
    event.preventDefault();
    const active = document.activeElement;
    if (!active || active === document.body || panel?.contains(active)) trigger?.focus({ preventScroll: true });
  }
</script>

<div class="flex items-center gap-2">
  <Popover.Root>
    <Popover.Trigger
      bind:ref={trigger}
      aria-label={t("settings.colorPick", { name: label })}
      class="grid size-8 shrink-0 place-items-center rounded-lg focus-visible:outline-offset-0"
    >
      <span {...frame} class={["contents", frame?.class]} aria-hidden="true">
        <span bind:this={shown} class="size-7 rounded-md inset-ring inset-ring-line forced-color-adjust-none" style:background={swatch ?? value}></span>
      </span>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content
        bind:ref={panel}
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        role="dialog"
        aria-label={t("settings.colorPick", { name: label })}
        {onCloseAutoFocus}
        class="{floating} p-3"
      >
        {#if shown}
          <!-- It opens on the color the swatch shows, worked out by the browser (Auto's, a `var()`, `oklch()`). -->
          <ColorPicker
            {label}
            {value}
            start={parse(solid(getComputedStyle(shown).backgroundColor))!}
            swatches={offered}
            {optional}
            {placeholder}
            {custom}
            {onchange}
            onadd={adding}
          />
        {/if}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
  {#if name === undefined}
    <ColorText {id} aria-label={label} {value} {optional} {placeholder} class="w-36" {onchange} />
  {:else}
    <span {id} class="w-36 truncate text-sm text-fg">{name}</span>
  {/if}
  <!-- Hidden but there for colors that can't be automatic, so every row's swatch lines up. -->
  {#if optional || aligned}
    <IconButton
      icon="restore"
      label={t("settings.colorReset", { name: label })}
      iconSize={15}
      class={optional ? "" : "invisible"}
      disabled={value === undefined}
      onclick={() => onchange(undefined)}
    />
  {/if}
</div>
