<script lang="ts">
  // The Feeds plugin's buttons in the podcast player: Take Notes (takeNotes.ts), and the transcript's,
  // where the episode has a transcript or chapters, which shows them above the player.
  import IconButton from "../../lib/components/ui/IconButton.svelte";
  import { t } from "../../lib/i18n/index.svelte";
  import type { Episode } from "../../lib/player/player.svelte";
  import { listening, TRANSCRIPT_ID } from "./listening.svelte";
  import { takeNotes, takesNotes } from "./takeNotes";
  import { filesOf } from "./transcript";

  let { episode }: { episode: Episode } = $props();

  const hasTranscript = $derived.by(() => {
    const files = filesOf(episode);
    return !!(files.transcript || files.chapters);
  });
</script>

{#if takesNotes(episode)}
  <IconButton icon="square-pen" iconSize={16} label={t("player.takeNotes")} busy={listening.taking} disabled={listening.taking} onclick={() => void takeNotes()} />
{/if}
{#if hasTranscript}
  <IconButton
    icon="captions"
    iconSize={16}
    label={t("player.transcript")}
    open={listening.transcript}
    aria-expanded={listening.transcript}
    aria-controls={listening.transcript ? TRANSCRIPT_ID : undefined}
    onclick={() => (listening.transcript = !listening.transcript)}
  />
{/if}
