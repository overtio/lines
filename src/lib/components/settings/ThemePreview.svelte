<script lang="ts">
  // A theme drawn small, as lines looks in it: the sidebar, the note list and a note with a tag, a
  // link, code and a callout. `frame` gives it the theme's colors (a .theme-preview); lines of text
  // are bars, so it reads the same in every language.
  import type { HTMLAttributes } from "svelte/elements";

  let { frame }: { frame: HTMLAttributes<HTMLDivElement> } = $props();
</script>

{#snippet bar(width: string, color = "currentColor", height = "h-1.5")}
  <span class="block {height} shrink-0 rounded-full" style:width style:background={color}></span>
{/snippet}

<div {...frame} class={["flex h-40 overflow-hidden rounded-lg bg-bg text-fg inset-ring inset-ring-line forced-color-adjust-none", frame.class]} aria-hidden="true">
  <div class="flex w-[21%] flex-col gap-2.5 bg-sidebar px-2 py-3 text-fg-sidebar">
    <span class="flex items-center gap-1.5 rounded-sm bg-active px-1.5 py-1">
      <span class="size-1.5 shrink-0 rounded-full bg-accent"></span>
      {@render bar("60%")}
    </span>
    <span class="px-1.5 text-faint">{@render bar("45%", "currentColor", "h-1")}</span>
    <span class="flex flex-col gap-2.5 px-1.5">
      {@render bar("70%")}
      {@render bar("55%")}
    </span>
  </div>
  <div class="flex w-[27%] flex-col gap-1 border-x border-line bg-list p-1.5">
    {#each [true, false] as open (open)}
      <span class={["flex flex-col gap-1.5 rounded-md p-1.5", open && "bg-active"]}>
        {@render bar("75%")}
        <span class="text-muted">{@render bar("90%", "currentColor", "h-1")}</span>
        <span class="text-faint">{@render bar("35%", "currentColor", "h-1")}</span>
      </span>
    {/each}
  </div>
  <div class="flex min-w-0 flex-1 flex-col gap-2.5 px-3.5 py-3">
    {@render bar("45%", "currentColor", "h-2.5")}
    <span class="flex items-center gap-1.5">
      {@render bar("58%")}
      <span class="rounded-sm bg-tag px-1 py-0.5 text-tag-fg">{@render bar("22px")}</span>
    </span>
    <span class="flex items-center gap-1.5">
      {@render bar("30%")}
      <span class="border-b border-accent pb-px">{@render bar("40px", "var(--accent)")}</span>
    </span>
    <span class="flex gap-1.5 rounded-sm bg-code px-2 py-1.5">
      {@render bar("16%", "var(--syn-keyword)", "h-1")}
      {@render bar("22%", "var(--syn-function)", "h-1")}
      {@render bar("26%", "var(--syn-string)", "h-1")}
      {@render bar("10%", "var(--syn-number)", "h-1")}
    </span>
    <span
      class="flex items-center gap-1.5 rounded-sm border-l-2 px-2 py-1.5"
      style:border-color="var(--callout-info)"
      style:background="color-mix(in srgb, var(--callout-info) var(--callout-tint), transparent)"
    >
      {@render bar("50%")}
    </span>
  </div>
</div>
