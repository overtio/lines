<script lang="ts">
  // What a color's swatch opens (ColorField.svelte): colors to choose from, then one of your own, by
  // saturation and brightness, hue, as text, or picked from the screen where the browser can. Each
  // change is the color at once, as it's dragged.
  import { Slider } from "bits-ui";
  import { untrack } from "svelte";
  import { solid } from "../../colors";
  import { t } from "../../i18n/index.svelte";
  import { fromHsv, hex, type Hsv, parse, type Rgb, toHsv } from "../../themes/color";
  import ColorText from "./ColorText.svelte";
  import IconButton from "./IconButton.svelte";
  import Swatches, { type SwatchColor } from "./Swatches.svelte";

  type Props = {
    /** What the color is for, as its row says it. */
    label: string;
    value: string | undefined;
    /** The color it opens on: the one its swatch shows. */
    start: Rgb;
    swatches: SwatchColor[];
    optional?: boolean;
    placeholder?: string;
    onchange: (value: string | undefined) => void;
    onadd?: (color: string) => void;
  };
  let { label, value, start, swatches, optional, placeholder, onchange, onadd }: Props = $props();

  /** The colors of the rainbow, in hue's order, for the hue slider's track. */
  const HUES = `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map((h) => hex(fromHsv({ h, s: 1, v: 1 }))).join(", ")})`;
  /** The area's and the hue's thumbs: the color in a white ring with a dark edge, which shows on any color. */
  const THUMB =
    "size-4 rounded-full border-2 border-[#fff] shadow-[0_0_0_1px_rgb(0_0_0/0.35),0_1px_3px_rgb(0_0_0/0.3)] forced-color-adjust-none focus-visible:outline-offset-2 coarse:size-6";

  // Kept apart rather than worked out from the color, so the hue stays where it was while the color is a grey.
  let hsv = $state(untrack(() => toHsv(start)));
  const color = $derived(hex(fromHsv(hsv)));
  const hue = $derived(hex(fromHsv({ h: hsv.h, s: 1, v: 1 })));
  /** The swatches' colors as hex, to find the one that's the color, if one is. */
  const swatchHexes = $derived(swatches.map((swatch) => solid(swatch.color)));
  const chosen = $derived(value ? swatches[swatchHexes.indexOf(solid(value))]?.id : undefined);
  const percent = (n: number) => Math.round(n * 100);
  const EyeDropper = window.EyeDropper;

  let area = $state<HTMLElement>();
  let thumb = $state<HTMLElement>();

  function pick(next: Hsv) {
    hsv = next;
    onchange(hex(fromHsv(next)));
  }

  /** A color chosen whole (a swatch, typed, picked from the screen): the area and hue go to it. */
  function choose(css: string | undefined) {
    onchange(css);
    const rgb = css ? parse(solid(css)) : undefined;
    if (!rgb) return;
    const next = toHsv(rgb);
    hsv = { ...next, h: next.s ? next.h : hsv.h };
  }

  const within = (n: number) => Math.min(1, Math.max(0, n));

  function dragTo(event: PointerEvent) {
    const box = area!.getBoundingClientRect();
    pick({ h: hsv.h, s: within((event.clientX - box.left) / box.width), v: within(1 - (event.clientY - box.top) / box.height) });
  }

  /** Left and right are saturation, up and down brightness: 1% a press, 10% with Shift. */
  function onAreaKeydown(event: KeyboardEvent) {
    const [s, v] = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowDown: [0, -1], ArrowUp: [0, 1] }[event.key] ?? [];
    if (s === undefined) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    pick({ h: hsv.h, s: within((percent(hsv.s) + s * step) / 100), v: within((percent(hsv.v) + v * step) / 100) });
  }

  /** Shift and an arrow move the hue 10°; the slider moves it 1° without. */
  function onHueKeydown(event: KeyboardEvent) {
    const sign = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
    if (!event.shiftKey || !sign) return;
    event.preventDefault();
    pick({ ...hsv, h: Math.min(360, Math.max(0, Math.round(hsv.h) + sign * 10)) });
  }

  async function pickFromScreen() {
    try {
      choose((await new EyeDropper!().open()).sRGBHex);
    } catch {
      // Esc: nothing picked.
    }
  }
</script>

<div class="flex w-max flex-col gap-3">
  <Swatches colors={swatches} value={chosen} label={t("settings.colorSwatches")} onselect={(id) => choose(swatches.find((swatch) => swatch.id === id)?.color)} />

  <!-- Saturation across, brightness up: the hue's own color at the top right, white at the top left,
       black along the bottom. Pressed or dragged anywhere, its thumb (the slider) goes there. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={area}
    class="relative h-36 w-full cursor-crosshair touch-none rounded-md inset-ring inset-ring-line forced-color-adjust-none"
    style:background-color={hue}
    style:background-image="linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)"
    onpointerdown={(event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      area!.setPointerCapture(event.pointerId);
      thumb!.focus({ preventScroll: true });
      dragTo(event);
    }}
    onpointermove={(event) => area!.hasPointerCapture(event.pointerId) && dragTo(event)}
  >
    <div
      bind:this={thumb}
      role="slider"
      tabindex="0"
      aria-label={t("settings.colorArea")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent(hsv.s)}
      aria-valuetext={t("settings.colorAreaValue", { saturation: percent(hsv.s), brightness: percent(hsv.v), color })}
      class="absolute -translate-1/2 {THUMB}"
      style:left="{hsv.s * 100}%"
      style:top="{(1 - hsv.v) * 100}%"
      style:background={color}
      onkeydown={onAreaKeydown}
    ></div>
  </div>

  <!-- In whole degrees: the slider moves a value between its steps onto one, which would change the color just by opening. -->
  <Slider.Root
    type="single"
    value={Math.round(hsv.h)}
    onValueChange={(h) => pick({ ...hsv, h })}
    min={0}
    max={360}
    thumbPositioning="exact"
    class="relative flex h-4 w-full touch-none items-center select-none coarse:h-6"
  >
    <span class="h-3 w-full rounded-sm inset-ring inset-ring-line forced-color-adjust-none" style:background-image={HUES}></span>
    <Slider.Thumb
      index={0}
      aria-label={t("settings.colorHue")}
      aria-valuetext={t("settings.colorHueValue", { degrees: Math.round(hsv.h), color })}
      onkeydown={onHueKeydown}
      class="block cursor-pointer {THUMB}"
      style="background: {hue}"
    />
  </Slider.Root>

  <div class="flex items-center gap-2">
    <ColorText aria-label={label} {value} {optional} {placeholder} class="flex-1" onchange={choose} />
    {#if EyeDropper}
      <IconButton icon="pipette" label={t("settings.colorFromScreen")} iconSize={16} onclick={pickFromScreen} />
    {/if}
    {#if onadd}
      <IconButton icon="plus" label={t("settings.colorAdd")} onclick={() => onadd(color)} />
    {/if}
  </div>
</div>
