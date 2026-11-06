<script lang="ts" generics="T extends string">
  // One of a few options side by side, as radio buttons: Tab stops once, the arrow keys choose.
  import { RadioGroup } from "bits-ui";
  import type { Snippet } from "svelte";
  import Icon from "../../icons/Icon.svelte";
  import type { IconName } from "../../icons/icons";

  interface Option {
    id: T;
    label: string;
    icon?: IconName;
    disabled?: boolean;
  }

  let {
    options,
    value,
    onselect,
    label,
    stacked = false,
    content,
    class: className,
  }: {
    options: readonly Option[];
    /** The chosen option, or null when none is (custom spacing, say). */
    value: T | null;
    onselect: (id: T) => void;
    /** What the group is, for screen readers. */
    label: string;
    /** Each option's content is stacked, e.g. a sample over its name. */
    stacked?: boolean;
    /** Custom content for an option, in place of its icon and label. */
    content?: Snippet<[Option]>;
    class?: string;
  } = $props();
</script>

<RadioGroup.Root
  value={value ?? ""}
  onValueChange={(id) => id && onselect(id as T)}
  orientation="horizontal"
  aria-label={label}
  class={["flex gap-0.5 rounded-lg bg-input p-[3px]", className]}
>
  {#each options as option (option.id)}
    <RadioGroup.Item
      value={option.id}
      disabled={option.disabled}
      class={[
        "flex min-h-[30px] flex-1 items-center justify-center rounded-md text-sm font-medium whitespace-nowrap text-muted transition-colors enabled:hover:text-fg data-disabled:opacity-45 data-[state=checked]:bg-panel data-[state=checked]:text-fg data-[state=checked]:shadow-segment coarse:min-h-11",
        stacked ? "flex-col px-1 py-1.5" : "gap-2 px-2.5",
      ]}
    >
      {#if content}
        {@render content(option)}
      {:else}
        {#if option.icon}<Icon name={option.icon} size={15} />{/if}
        {option.label}
      {/if}
    </RadioGroup.Item>
  {/each}
</RadioGroup.Root>
