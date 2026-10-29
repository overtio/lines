<script lang="ts" generics="T extends string">
  import type { Snippet } from "svelte";
  import Icon from "../icons/Icon.svelte";
  import type { IconName } from "../icons/icons";

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
  } = $props();

  let group: HTMLDivElement;

  // One tab stop for the group, like native radio buttons: the chosen option, else the first.
  const focusable = $derived(options.find((o) => o.id === value && !o.disabled) ?? options.find((o) => !o.disabled));

  /** Arrow keys move the choice, skipping disabled options and wrapping around. */
  function onkeydown(event: KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const enabled = options.filter((o) => !o.disabled);
    const index = enabled.findIndex((o) => o.id === focusable?.id);
    const next = enabled[(index + step + enabled.length) % enabled.length];
    if (!next) return;
    onselect(next.id);
    group.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus();
  }
</script>

<div class="segmented" class:stacked role="radiogroup" tabindex="-1" aria-label={label} bind:this={group} {onkeydown}>
  {#each options as option (option.id)}
    <button
      type="button"
      role="radio"
      data-id={option.id}
      aria-checked={value === option.id}
      class:active={value === option.id}
      tabindex={option === focusable ? 0 : -1}
      disabled={option.disabled}
      onclick={() => onselect(option.id)}
    >
      {#if content}
        {@render content(option)}
      {:else}
        {#if option.icon}<Icon name={option.icon} size={15} />{/if}
        {option.label}
      {/if}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 10px;
    background: var(--input);
  }

  button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 30px;
    padding: 0 10px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .stacked button {
    flex-direction: column;
    gap: 0;
    padding: 6px 4px;
  }

  button.active {
    background: var(--bg-elevated);
    color: var(--text);
    box-shadow: var(--shadow-segment);
  }

  button:disabled {
    opacity: var(--disabled-opacity);
  }
</style>
