<script lang="ts">
  // A button that's only an icon: square, named for screen readers and in its tooltip. On a touch
  // screen it's drawn the same size but takes taps from 44px around it.
  import type { HTMLButtonAttributes } from "svelte/elements";
  import Icon from "../../icons/Icon.svelte";
  import type { IconName } from "../../icons/icons";

  type Props = HTMLButtonAttributes & {
    icon: IconName;
    label: string;
    iconSize?: number;
    /** Its menu or panel is open. */
    open?: boolean;
    /** What it turns on is on, in the accent. */
    on?: boolean;
    /** It deletes. */
    danger?: boolean;
    /** Something else to show in its tooltip, such as its shortcut. */
    tooltip?: string;
  };
  let { icon, label, iconSize = 18, open = false, on = false, danger = false, tooltip, class: className, ...rest }: Props = $props();
</script>

<button
  type="button"
  aria-label={label}
  title={tooltip ?? label}
  class={[
    "ui-icon-button touch-target grid size-8 shrink-0 place-items-center rounded-md transition-colors enabled:hover:bg-hover disabled:opacity-35",
    danger ? "text-danger" : ["enabled:hover:text-fg", open ? "bg-active text-fg" : on ? "text-accent" : "text-muted"],
    className,
  ]}
  {...rest}
>
  <Icon name={icon} size={iconSize} />
</button>
