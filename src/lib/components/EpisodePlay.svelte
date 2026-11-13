<script lang="ts">
  // An `episode` note's Play button, before its `audio` link (player/notePlay.ts): plays it in
  // the mini player from where it was stopped, or pauses it.
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { notes } from "../notes/store.svelte";
  import { noteEpisode } from "../player/episodes";
  import { player } from "../player/player.svelte";

  let { note }: { note: string } = $props();

  const episode = $derived.by(() => {
    const entry = notes.get(note);
    return entry ? noteEpisode(entry) : null;
  });
  const playing = $derived(!!episode && player.playing && player.episode?.key === episode.key);
  const label = $derived(playing ? t("player.pauseEpisode") : t("player.playEpisode"));
</script>

{#if episode}
  <!-- Pressed without taking the cursor from the text. -->
  <button
    type="button"
    class="cm-episode-play"
    aria-label={label}
    title={label}
    onmousedown={(event) => event.preventDefault()}
    onclick={() => (playing ? player.pause() : player.play(episode))}
  >
    <Icon name={playing ? "pause" : "play"} size={13} strokeWidth={2.25} />
  </button>
{/if}
