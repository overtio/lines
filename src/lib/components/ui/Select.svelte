<script lang="ts" generics="T extends string">
  // A choice from a short list, one height (h-control).
  import { Select } from "bits-ui";
  import Icon from "../../icons/Icon.svelte";
  import { floating, option } from "./styles";

  type Option = { value: T; label: string };
  type Props = { value: T; options: readonly Option[]; onchange: (value: T) => void; label: string; disabled?: boolean; class?: string };
  let { value, options, onchange, label, disabled = false, class: className }: Props = $props();

  const shown = $derived(options.find((o) => o.value === value)?.label ?? value);
</script>

<Select.Root type="single" {value} onValueChange={(chosen) => chosen !== value && onchange(chosen as T)} items={[...options]} {disabled}>
  <Select.Trigger
    aria-label={label}
    class={[
      "inline-flex h-control min-w-32 shrink-0 items-center justify-between gap-2 rounded-md border border-line bg-panel px-2.5 text-sm text-fg shadow-segment transition-colors enabled:hover:bg-hover data-disabled:opacity-45",
      className,
    ]}
  >
    <span class="truncate">{shown}</span>
    <Icon name="chevrons-up-down" size={14} class="shrink-0 text-faint" />
  </Select.Trigger>
  <Select.Portal>
    <Select.Content sideOffset={4} collisionPadding={8} class="{floating} max-h-72 min-w-(--bits-select-anchor-width) p-1">
      <Select.Viewport>
        {#each options as o (o.value)}
          <Select.Item value={o.value} label={o.label} class="{option} justify-between gap-4">
            {#snippet children({ selected })}
              {o.label}
              {#if selected}<Icon name="check" size={14} class="text-accent!" />{/if}
            {/snippet}
          </Select.Item>
        {/each}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
