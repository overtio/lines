<script lang="ts">
  // A color: a swatch that opens lines' color picker (ColorPicker.svelte), and the color as text, to
  // type or paste (any color CSS reads). An optional one can be left empty, to follow from others ("Auto").
  import { Popover } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import { solid } from "../../colors";
  import { t } from "../../i18n/index.svelte";
  import { parse } from "../../themes/color";
  import { shownColors } from "../../themes/shownColors";
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
    /** The colors the picker offers first: the theme's, as they're drawn where the swatch is, unless said. */
    swatches?: SwatchColor[];
    /** Adds the picker's color to the palette `swatches` are from; without it, there's no Add to Palette. */
    onadd?: (color: string) => void;
    onchange: (value: string | undefined) => void;
  };
  let { label, value, id, swatch, frame, optional = false, placeholder, swatches, onadd, onchange }: Props = $props();

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
            swatches={swatches ?? shownColors(shown)}
            {optional}
            {placeholder}
            {onchange}
            {onadd}
          />
        {/if}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
  <ColorText {id} {value} {optional} {placeholder} class="w-36" {onchange} />
  <!-- Hidden but there for colors that can't be automatic, so every row's swatch lines up. -->
  <IconButton
    icon="restore"
    label={t("settings.colorReset", { name: label })}
    iconSize={15}
    class={optional ? "" : "invisible"}
    disabled={value === undefined}
    onclick={() => onchange(undefined)}
  />
</div>
