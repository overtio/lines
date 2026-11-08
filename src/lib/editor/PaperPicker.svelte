<script lang="ts">
  import { locale, t } from "../i18n/index.svelte";
  import type { Paper, PaperSource } from "../plugins/types";
  import WebSearchPicker from "./WebSearchPicker.svelte";

  /* A source's research papers to pick from (papers.ts), one to a row: its title, then who wrote it, when and where. */

  type Props = { source: PaperSource; x: number; y: number; onchoose: (paper: Paper) => void; onclose: () => void };
  let { source, x, y, onchoose, onclose }: Props = $props();

  const both = new Intl.ListFormat(locale, { type: "conjunction" });

  /** Its authors as a citation names them: one, both of two, or the first of more "et al.". */
  const authors = (names: string[]) => (names.length > 2 ? t("editor.papers.etAl", { name: names[0] }) : both.format(names));
  const about = (paper: Paper) => [authors(paper.authors), paper.year, paper.venue].filter(Boolean).join(" · ");
  const label = (paper: Paper) => [paper.title, authors(paper.authors), paper.year, paper.venue].filter(Boolean).join(", ");
</script>

<WebSearchPicker
  name={source.name}
  credit={source.credit}
  search={source.search}
  hint={t("editor.papers.hint")}
  columns={1}
  {label}
  listClass="flex flex-col gap-0.5"
  itemClass="flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left hover:bg-hover focus-visible:bg-hover"
  widthClass="w-[min(520px,calc(100vw-16px))]"
  {x}
  {y}
  {onchoose}
  {onclose}
>
  {#snippet item(paper: Paper)}
    <span class="line-clamp-2 text-sm font-medium text-text">{paper.title}</span>
    <span class="w-full truncate text-xs text-muted">{about(paper)}</span>
  {/snippet}
</WebSearchPicker>
