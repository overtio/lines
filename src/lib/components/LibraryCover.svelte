<script lang="ts">
  // A library item's cover beside its row on its shelf, in the shape its kind's covers come in (a
  // book's tall, an album's square, a video's wide); its kind's icon where it has none, or while the
  // picture isn't on this device. Decoration: the row says what it is.
  import Icon from "../icons/Icon.svelte";
  import { attachmentURL } from "../notes/attachments";
  import type { LibraryKind } from "../plugins/types";

  let { name, kind }: { name: string | null; kind: LibraryKind } = $props();

  const SHAPES = { square: "size-13", tall: "h-15 w-10", wide: "h-11.25 w-20" };
</script>

{#snippet placeholder()}
  <span class="grid size-full place-items-center rounded-sm bg-hover text-faint"><Icon name={kind.icon} size={18} /></span>
{/snippet}

<span class={["ui-cover block shrink-0", SHAPES[kind.cover ?? "square"]]} aria-hidden="true">
  {#if name}
    {#await attachmentURL(name)}
      <span class="block size-full rounded-sm bg-hover"></span>
    {:then url}
      {#if url}
        <img class="size-full rounded-sm object-cover shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_8%,transparent)]" src={url} alt="" draggable="false" />
      {:else}
        {@render placeholder()}
      {/if}
    {/await}
  {:else}
    {@render placeholder()}
  {/if}
</span>
