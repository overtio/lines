<script lang="ts">
  // Above the podcast player while its transcript's button is on: the episode's transcript and
  // chapters once they're read (transcript.ts), or why they couldn't be.
  import { t } from "../../lib/i18n/index.svelte";
  import type { Episode } from "../../lib/player/player.svelte";
  import { listening, TRANSCRIPT_ID } from "./listening.svelte";
  import { filesOf, hear } from "./transcript";
  import TranscriptLines from "./TranscriptLines.svelte";

  let { episode }: { episode: Episode } = $props();

  const shown = $derived.by(() => {
    if (!listening.transcript) return false;
    const files = filesOf(episode);
    return !!(files.transcript || files.chapters);
  });
  const FAILURES = { blocked: t("player.transcriptBlocked"), gone: t("player.transcriptGone"), unreadable: t("player.transcriptFailed") };
</script>

{#if shown}
  <div id={TRANSCRIPT_ID} class="-mx-5 mb-1 flex flex-col gap-1 border-b border-line px-5 pb-2">
    {#await hear(episode)}
      <p class="m-0 text-xs text-faint" role="status">{t("player.readingTranscript")}</p>
    {:then heard}
      {#if heard.cues.length || heard.chapters.length}
        <TranscriptLines {episode} {heard} />
      {/if}
      {#if heard.failure && !heard.cues.length}
        <p class="m-0 text-xs text-faint" role="status">{FAILURES[heard.failure]}</p>
      {/if}
    {/await}
  </div>
{/if}
