<script module lang="ts">
  /** A color to choose: `id` is what's chosen, `name` what it's called (its label and tooltip). */
  export interface SwatchColor {
    id: string;
    name: string;
    color: string;
  }
</script>

<script lang="ts">
  // Named colors as a grid of swatches: a radio group, one Tab stop, the arrow keys moving through
  // them (and choosing, as radio buttons do), the chosen one ringed.
  import { RadioGroup } from "bits-ui";

  type Props = {
    colors: SwatchColor[];
    /** The chosen color's id, if one is. */
    value: string | undefined;
    /** What the group is, for screen readers. */
    label: string;
    onselect: (id: string) => void;
    class?: string;
  };
  let { colors, value, label, onselect, class: className }: Props = $props();
</script>

<RadioGroup.Root
  value={value ?? ""}
  onValueChange={onselect}
  aria-label={label}
  class={["grid grid-cols-[repeat(8,var(--swatch))] gap-1 [--swatch:28px] coarse:[--swatch:36px]", className]}
>
  {#each colors as { id, name, color } (id)}
    <!-- Ringed in the text's color when chosen, which shows on every swatch, the background's too. -->
    <RadioGroup.Item
      value={id}
      aria-label={name}
      title={name}
      class="grid size-(--swatch) place-items-center rounded-full p-[3px] inset-ring-2 inset-ring-transparent focus-visible:outline-offset-1 data-[state=checked]:inset-ring-fg"
    >
      <span class="size-full rounded-full inset-ring inset-ring-line forced-color-adjust-none" style:background={color} aria-hidden="true"></span>
    </RadioGroup.Item>
  {/each}
</RadioGroup.Root>
