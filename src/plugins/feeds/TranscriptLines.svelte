<script lang="ts">
  import { on } from "svelte/events";
  import IconButton from "../../lib/components/ui/IconButton.svelte";
  import { t } from "../../lib/i18n/index.svelte";
  import { reducedMotion } from "../../lib/platform";
  import { type Episode, player } from "../../lib/player/player.svelte";
  import { stamp } from "../../lib/player/times";
  import { quote } from "./takeNotes";
  import type { Heard } from "./transcript";
  import { indexAt } from "./transcripts";

  // An episode's transcript above the podcast player (Transcript.svelte), following it as it plays:
  // the sentence playing marked and kept in view, unless you've just scrolled; each plays from where
  // it starts. Its chapters are headings between them (or, without a transcript, the list). ↑ and ↓
  // move between the lines, Home and End to the first and last, and Tab comes back to the one left.
  // Quote puts the sentence playing in the note open, with its time. A transcript has thousands of
  // lines: drawn once, then only the line playing and the one Tab stops on change, by hand.

  let { episode, heard }: { episode: Episode; heard: Heard } = $props();

  /** Each line: a sentence, or where a chapter starts. */
  type Line = { start: number; text: string; speaker?: string; chapter?: boolean };
  const lines = $derived.by((): Line[] => {
    const heads: Line[] = heard.chapters.map((chapter) => ({ start: chapter.start, text: chapter.title, chapter: true }));
    // A chapter before the sentences that start in it, from the same second.
    return [...heads, ...(heard.cues as Line[])].sort((a, b) => a.start - b.start || Number(!!b.chapter) - Number(!!a.chapter));
  });
  const sentences = $derived(lines.filter((line) => !line.chapter));
  const current = $derived(indexAt(lines, player.time));
  const saying = $derived(sentences[indexAt(sentences, player.time)]);
  const chapter = $derived(heard.chapters[indexAt(heard.chapters, player.time)]);

  let list = $state<HTMLOListElement>();
  /** The line focus was last on, which Tab comes back to; until then, the one playing, or the first. */
  let focused = $state<number | null>(null);
  /** When you last scrolled or moved in the list yourself: it's left where you put it a while. */
  let movedAt = 0;
  const LEAVE = 4000;

  const row = (i: number) => list?.children[i]?.firstElementChild as HTMLElement | undefined;

  /** One line marked as playing at a time, and one taking Tab: set on those two rows, never on every row. */
  const marking = (attribute: "aria-current" | "tabindex", on: string, off: string | null) => {
    let marked: HTMLElement | undefined;
    return (i: number) => {
      if (marked && off === null) marked.removeAttribute(attribute);
      else marked?.setAttribute(attribute, off!);
      marked = row(i);
      marked?.setAttribute(attribute, on);
    };
  };
  const markPlaying = marking("aria-current", "true", null);
  const markTabStop = marking("tabindex", "0", "-1");

  $effect(() => {
    if (!list) return;
    markPlaying(current);
    const playing = row(current);
    if (!playing || Date.now() - movedAt < LEAVE) return;
    list.scrollTo({ top: playing.parentElement!.offsetTop - list.clientHeight / 2 + playing.offsetHeight / 2, behavior: reducedMotion.matches ? "auto" : "smooth" });
  });

  $effect(() => {
    if (list) markTabStop(focused ?? Math.max(current, 0));
  });

  $effect(() => {
    if (!list) return;
    const moved = () => (movedAt = Date.now());
    const stops = [on(list, "wheel", moved, { passive: true }), on(list, "touchmove", moved, { passive: true })];
    return () => stops.forEach((stop) => stop());
  });

  function onkeydown(event: KeyboardEvent) {
    const at = focused ?? Math.max(current, 0);
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: lines.length - 1 }[event.key];
    if (to === undefined || !row(to)) return;
    event.preventDefault();
    movedAt = Date.now();
    row(to)!.focus();
  }

  function onfocusin(event: FocusEvent) {
    const item = (event.target as HTMLElement).closest("li");
    if (item && list) focused = [...list.children].indexOf(item);
  }
</script>

<div class="flex items-center gap-2">
  <p class="m-0 min-w-0 flex-1 truncate text-xs text-muted" aria-live="polite">
    {chapter ? chapter.title : t("player.transcript")}
  </p>
  {#if saying}
    <IconButton class="-mr-2" icon="text-quote" iconSize={15} label={t("player.quote")} onclick={() => void quote(saying)} />
  {/if}
</div>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<ol bind:this={list} class="lines relative -mx-2 my-0 max-h-[min(16rem,32vh)] list-none overflow-y-auto p-0" aria-label={t("player.transcript")} {onkeydown} {onfocusin}>
  {#each lines as line, i (i)}
    <li>
      <button
        type="button"
        tabindex="-1"
        class={[
          "flex w-full flex-col rounded-md px-2 py-1 text-left transition-colors hover:bg-hover aria-[current=true]:bg-active",
          line.chapter ? "chapter mt-1 text-xs font-semibold" : "text-sm leading-snug",
        ]}
        onclick={() => player.play(episode, line.start)}
      >
        <span class="tabular flex items-center gap-1 text-2xs font-normal text-faint">
          {#if line.chapter}<span class="sr-only">{t("player.chapter")}</span>{/if}
          {stamp(line.start)}{#if line.speaker}<span aria-hidden="true">·</span>{line.speaker}{/if}
        </span>
        {line.text}
      </button>
    </li>
  {/each}
</ol>

<style>
  /* The sentences already played, quieter than those to come: by the one playing, not set on each. */
  .lines > li:has(~ li > :global([aria-current="true"])) > button:not(:global(.chapter)) {
    color: var(--text-muted);
  }
</style>
