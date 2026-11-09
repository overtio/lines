<script lang="ts">
  // A row in the sidebar: a place, a type or a tag, with its count; or, while it's renamed, a field
  // for its new name. (`row` and `active` are what App.svelte's F6 looks for.)
  import type { HTMLButtonAttributes, HTMLInputAttributes } from "svelte/elements";
  import Icon from "../icons/Icon.svelte";
  import type { IconName } from "../icons/icons";

  type Props = HTMLButtonAttributes & {
    icon: IconName;
    iconSize?: number;
    /** The icon's own classes, in place of its usual color. */
    iconClass?: string;
    label: string;
    count?: number;
    active?: boolean;
    /** Its menu or icon picker is open: outlined, like a right-clicked note. */
    marked?: boolean;
    /** Being renamed: the field's props, shown in place of the label. */
    rename?: HTMLInputAttributes;
  };
  let { icon, iconSize = 16, iconClass, label, count, active = false, marked = false, rename, class: className, ...rest }: Props = $props();

  const row = "row flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-base coarse:h-11";

  const focusAndSelect = (input: HTMLInputElement) => {
    input.focus();
    input.select();
  };
</script>

{#snippet leading()}
  <Icon name={icon} size={iconSize} strokeWidth={1.75} class={iconClass ?? ["shrink-0", active ? "text-accent" : "text-muted"].join(" ")} />
{/snippet}

{#if rename}
  <div class={[row, "bg-bg inset-ring-2 inset-ring-accent-soft", className]}>
    {@render leading()}
    <input
      class="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-fg [font:inherit] outline-none"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      {...rename}
      {@attach focusAndSelect}
    />
  </div>
{:else}
  <button
    class={[
      row,
      "ui-sidebar-row transition-colors [-webkit-touch-callout:none]",
      active ? "active bg-active text-fg" : "hover:bg-hover",
      marked && "inset-ring-2 inset-ring-accent",
      className,
    ]}
    aria-current={active}
    {...rest}
  >
    {@render leading()}
    <span class="min-w-0 flex-1 truncate">{label}</span>
    <!-- With increased contrast, a count on the chosen row keeps 4.5:1 over its darker background. -->
    {#if count}<span class={["tabular text-xs text-faint", active && "in-data-[contrast=more]:text-muted"]}>{count}</span>{/if}
  </button>
{/if}
