<script lang="ts">
  // One setting in a card: what it is and a note on the left, its control at the end. A wide
  // control (a row of choices, a slider) goes under them instead with `stacked`.
  import type { Snippet } from "svelte";

  type Props = {
    label: string;
    note?: string | null;
    /** The control's id, so clicking the label reaches it; its note is then `<id>-note`, for the control's aria-describedby. */
    for?: string;
    stacked?: boolean;
    dim?: boolean;
    children?: Snippet;
    /** More under the note, such as a message after the control's done something. */
    below?: Snippet;
  };
  let { label, note, for: control, stacked = false, dim = false, children, below }: Props = $props();
</script>

<div class={["border-b border-line px-4 py-3 last:border-0", dim && "opacity-45"]} data-setting>
  <div class={["flex gap-x-4 gap-y-2.5", stacked ? "flex-col" : "flex-wrap items-center"]}>
    <div class={["min-w-0", !stacked && "flex-1 basis-48"]}>
      {#if control}
        <label for={control} class="text-sm text-fg">{label}</label>
      {:else}
        <div class="text-sm text-fg">{label}</div>
      {/if}
      {#if note}<p id={control && `${control}-note`} class="m-0 mt-0.5 text-xs leading-normal text-muted">{note}</p>{/if}
    </div>
    {#if children}
      <div class={["flex min-w-0 items-center gap-2", stacked ? "w-full" : "max-w-full shrink-0"]}>{@render children()}</div>
    {/if}
  </div>
  {#if below}{@render below()}{/if}
</div>
