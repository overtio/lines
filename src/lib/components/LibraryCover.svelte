<script lang="ts">
  // A library item's cover, in the shape its kind's covers come in (a book's tall, an album's
  // square, a video's wide): beside its row on its shelf, kept with its note (`name`, an attachment),
  // or smaller beside what a search found, the catalog's own picture (`src`). Its kind's icon where
  // it has none, or while the picture isn't here. Decoration: what's beside it says what it is.
  import Icon from "../icons/Icon.svelte";
  import { attachmentURL } from "../notes/attachments";
  import type { LibraryKind } from "../plugins/types";
  import { fitPicture } from "./fitPicture";

  let { name = null, src, kind, small = false }: { name?: string | null; src?: string; kind: LibraryKind; small?: boolean } = $props();

  const SHAPES = {
    square: ["size-13", "size-10"],
    tall: ["h-15 w-10", "h-12 w-8"],
    wide: ["h-11.25 w-20", "h-9 w-16"],
  };
  /** A picture from the web that didn't load. */
  let broken = $state(false);
</script>

{#snippet placeholder()}
  <span class="grid size-full place-items-center rounded-sm bg-hover text-faint"><Icon name={kind.icon} size={small ? 16 : 18} /></span>
{/snippet}

{#snippet picture(url: string)}
  <img
    class="size-full rounded-sm bg-hover object-cover shadow-[0_0_0_1px_color-mix(in_srgb,var(--ink)_8%,transparent)]"
    src={url}
    alt=""
    draggable="false"
    loading="lazy"
    onerror={() => (broken = true)}
    {@attach fitPicture}
  />
{/snippet}

<span class={["ui-cover block shrink-0", SHAPES[kind.cover ?? "square"][small ? 1 : 0]]} aria-hidden="true">
  {#if src && !broken}
    {@render picture(src)}
  {:else if name}
    {#await attachmentURL(name)}
      <span class="block size-full rounded-sm bg-hover"></span>
    {:then url}
      {#if url}{@render picture(url)}{:else}{@render placeholder()}{/if}
    {/await}
  {:else}
    {@render placeholder()}
  {/if}
</span>
