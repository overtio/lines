<script lang="ts">
  // Every text button, one height (h-control): primary for the main action in a place, secondary
  // beside it, quiet in toolbars and rows; danger for what deletes, and danger-primary when that's
  // the main action (turning encryption off).
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import Icon from "../../icons/Icon.svelte";
  import type { IconName } from "../../icons/icons";

  type Props = HTMLButtonAttributes & {
    variant?: "primary" | "secondary" | "quiet" | "danger" | "danger-primary";
    icon?: IconName;
    /** Spins the icon while something is under way. */
    busy?: boolean;
    children: Snippet;
  };
  let { variant = "secondary", icon, busy = false, class: className, children, ...rest }: Props = $props();

  const variants = {
    primary: "bg-accent px-4 font-semibold text-on-accent enabled:hover:opacity-90",
    secondary: "border border-line bg-panel px-3 text-fg shadow-segment enabled:hover:bg-hover",
    quiet: "px-2.5 text-muted enabled:hover:bg-hover enabled:hover:text-fg",
    danger: "px-2.5 text-danger enabled:hover:bg-hover",
    "danger-primary": "bg-danger px-4 font-semibold text-on-danger enabled:hover:opacity-90",
  };
</script>

<button
  type="button"
  class={[
    "inline-flex h-control shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-45",
    variants[variant],
    className,
  ]}
  {...rest}
>
  {#if busy || icon}<Icon name={busy ? "loader" : icon!} size={15} class={busy ? "animate-spin" : ""} />{/if}
  {@render children()}
</button>
