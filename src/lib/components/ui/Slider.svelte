<script lang="ts">
  // A number picked along a line, with its value written after it (when there's `format`).
  import { Slider } from "bits-ui";

  type Props = {
    value: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    /** How the value is written after it, and read out unless `spoken` says otherwise. */
    format?: (value: number) => string;
    spoken?: (value: number) => string;
    oninput?: (value: number) => void;
    disabled?: boolean;
    class?: string;
  };
  let { value = $bindable(), min, max, step = 1, label, format, spoken, oninput, disabled = false, class: className }: Props = $props();
</script>

<div class={["flex min-w-0 items-center gap-3", className]}>
  <Slider.Root
    type="single"
    bind:value
    onValueChange={(changed) => oninput?.(changed)}
    {min}
    {max}
    {step}
    {disabled}
    class="relative flex h-5 min-w-0 flex-1 touch-none items-center select-none data-disabled:opacity-45"
  >
    <!-- In forced colors, which drop backgrounds, the track is its border and the part chosen is Highlight. -->
    <span class="ui-slider-track relative h-1 w-full grow overflow-hidden rounded-full bg-ink/15 forced-colors:h-1.5 forced-colors:border forced-colors:border-[CanvasText]">
      <Slider.Range class="absolute h-full bg-accent forced-colors:bg-[Highlight] forced-colors:[forced-color-adjust:none]" />
    </span>
    <Slider.Thumb
      index={0}
      aria-label={label}
      aria-valuetext={(spoken ?? format)?.(value)}
      class="ui-slider-thumb block size-4 cursor-pointer rounded-full border border-line bg-[#fff] shadow-segment transition-[scale] active:scale-110 coarse:size-6"
    />
  </Slider.Root>
  {#if format}
    <!-- Hidden from screen readers, which hear the value from the slider (and would otherwise hear it twice). -->
    <output aria-hidden="true" class="tabular w-12 shrink-0 text-right text-xs text-muted">{format(value)}</output>
  {/if}
</div>
