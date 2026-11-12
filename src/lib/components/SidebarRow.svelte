<script lang="ts">
  // A row in the sidebar: a place, a type or a tag, with its count; or, while it's renamed, a field
  // for its new name. Small, standard, or large: a tile, its icon in a circle of its color, its name
  // below, and its count big in the room beside both, a little right of its middle (Sidebar.svelte puts tiles two to a line). (`row` and `active`
  // are what App.svelte's F6 looks for.)
  import type { HTMLButtonAttributes, HTMLInputAttributes } from "svelte/elements";
  import Icon from "../icons/Icon.svelte";
  import type { IconName } from "../icons/icons";
  import { type PaletteColor, paletteVar } from "../palette";
  import type { RowSize } from "../sidebarLayout.svelte";

  type Props = HTMLButtonAttributes & {
    icon: IconName;
    iconSize?: number;
    /** The icon's own classes, in place of its usual color. */
    iconClass?: string;
    /** The color chosen for it (a tag's, a type's), which its icon has chosen or not. */
    color?: PaletteColor;
    label: string;
    count?: number;
    active?: boolean;
    /** Its menu or icon picker is open: outlined, like a right-clicked note. */
    marked?: boolean;
    /** Being renamed: the field's props, shown in place of the label. */
    rename?: HTMLInputAttributes;
    size?: RowSize;
  };
  let { icon, iconSize = 16, iconClass, color, label, count, active = false, marked = false, rename, size = "standard", class: className, ...rest }: Props = $props();

  const small = $derived(size === "small");
  const row = $derived([
    "row flex w-full items-center rounded-md px-2.5 text-left",
    small ? "h-6.5 gap-2 text-sm coarse:h-9" : "h-8 gap-2.5 text-base coarse:h-11",
  ]);

  const focusAndSelect = (input: HTMLInputElement) => {
    input.focus();
    input.select();
  };
</script>

{#snippet leading()}
  <Icon name={icon} size={small ? iconSize - 2 : iconSize} strokeWidth={1.75} class={iconClass ?? ["shrink-0", color ? "text-(--look)" : active ? "text-accent" : "text-muted"].join(" ")} />
{/snippet}

{#if rename}
  <div class={[row, "bg-bg inset-ring-2 inset-ring-accent-soft", className]} style:--look={color && paletteVar(color)}>
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
{:else if size === "large"}
  <!-- Its color, or the accent: the icon in it, on a circle of it, faint. -->
  <button
    class={[
      "row ui-sidebar-tile grid w-full grid-cols-[minmax(0,max-content)_minmax(max-content,1fr)] items-center gap-x-2 gap-y-1.5 rounded-lg px-2.5 pt-2 pb-1.5 text-left transition-colors [-webkit-touch-callout:none]",
      active ? "active bg-active text-fg" : "bg-hover hover:bg-active",
      marked && "inset-ring-2 inset-ring-accent",
      className,
    ]}
    aria-current={active}
    style:--look={color ? paletteVar(color) : "var(--accent)"}
    {...rest}
  >
    <!-- Its name before its count, as a row reads, though the count's drawn beside both, in the middle of the room there. -->
    <span class="row-start-1 grid size-7 place-items-center rounded-full bg-[color-mix(in_srgb,var(--look)_16%,transparent)] text-(--look)">
      <Icon name={icon} size={15} strokeWidth={2} class={iconClass} />
    </span>
    <span class="col-start-1 row-start-2 min-w-0 truncate text-sm font-medium">{label}</span>
    {#if count !== undefined}<span class="tabular col-start-2 row-span-2 row-start-1 translate-x-2 justify-self-center text-lg leading-none font-semibold">{count}</span>{/if}
  </button>
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
    style:--look={color && paletteVar(color)}
    {...rest}
  >
    {@render leading()}
    <span class="min-w-0 flex-1 truncate">{label}</span>
    <!-- With increased contrast, a count on the chosen row keeps 4.5:1 over its darker background. -->
    {#if count}<span class={["tabular text-xs text-faint", active && "in-data-[contrast=more]:text-muted"]}>{count}</span>{/if}
  </button>
{/if}
