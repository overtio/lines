<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import type { FoundImage, ImageLibrary } from "../plugins/types";
  import WebSearchPicker from "./WebSearchPicker.svelte";

  /* A library's pictures to pick from (webImages.ts), three to a row, opening on what it features. */

  type Props = { library: ImageLibrary; x: number; y: number; onchoose: (image: FoundImage) => void; onclose: () => void };
  let { library, x, y, onchoose, onclose }: Props = $props();

  const label = (image: FoundImage) =>
    image.by ? t("editor.images.by", { image: image.alt || t("editor.image"), name: image.by }) : image.alt || t("editor.image");
</script>

<WebSearchPicker
  name={library.name}
  credit={library.credit}
  search={library.search}
  columns={3}
  {label}
  listClass="grid grid-cols-3 gap-1.5"
  itemClass="group relative aspect-4/3 overflow-hidden rounded-md bg-hover"
  widthClass="w-[min(460px,calc(100vw-16px))]"
  {x}
  {y}
  {onchoose}
  {onclose}
>
  {#snippet item(image: FoundImage)}
    <span class="absolute inset-0" style:background-color={image.color}></span>
    <img
      src={image.thumb}
      alt=""
      loading="lazy"
      decoding="async"
      draggable="false"
      onload={(event) => event.currentTarget.setAttribute("data-loaded", "")}
      class="relative size-full object-cover opacity-0 transition-opacity duration-200 data-loaded:opacity-100"
    />
    {#if image.by}
      <!-- Over the picture, so in white on a shade of it whatever the theme. -->
      <span
        class="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-[rgb(0_0_0/0.6)] px-2 pt-4 pb-1 text-left text-2xs text-[#fff] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true">{image.by}</span
      >
    {/if}
  {/snippet}
</WebSearchPicker>
