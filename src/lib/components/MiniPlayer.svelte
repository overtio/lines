<script lang="ts">
  import { feeds } from "../feeds/feeds.svelte";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { clock } from "../library/text";
  import { notes } from "../notes/store.svelte";
  import { BACK, FORWARD, player } from "../player/player.svelte";
  import { ui } from "../ui.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import Slider from "./ui/Slider.svelte";

  // The episode playing, at the bottom of the sidebar (or of the note list, where the sidebar is a
  // drawer): its artwork, title and show, which open it; where it's got to; and its controls.

  let { class: className }: { class?: string } = $props();

  const episode = $derived(player.episode);
  /** Where the slider's been dragged to, until it's let go of. */
  let scrub = $state<number | null>(null);
  const at = $derived(scrub ?? player.time);
  const length = $derived(Math.max(player.duration, at));
  /** A time as the player shows it, nothing yet as 0:00. */
  const time = (seconds: number) => clock(seconds) ?? "0:00";
  const spokenTime = (seconds: number) => t("player.time", { elapsed: time(seconds), left: time(Math.max(0, length - seconds)) });
  const speed = (rate: number) => `${rate}×`;

  function show() {
    const from = episode?.from;
    if (!from) return;
    if ("note" in from) notes.show(from.note);
    else {
      notes.setFilter({ kind: "feeds", feed: from.feed });
      feeds.show(from.feed, from.post);
    }
    ui.closeDrawer();
  }
</script>

{#if episode}
  <section class={["flex flex-col gap-1.5 border-t border-line px-3 pt-2.5 pb-2", className]} aria-label={t("player.label")}>
    <div class="flex min-w-0 items-center gap-2.5">
      <button class="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left" onclick={show} title={t("player.show")}>
        {#if episode.artwork}
          <img src={episode.artwork} alt="" class="size-9 shrink-0 rounded-md bg-input object-cover" />
        {:else}
          <span class="grid size-9 shrink-0 place-items-center rounded-md bg-input text-muted"><Icon name="headphones" size={16} /></span>
        {/if}
        <span class="flex min-w-0 flex-col">
          <span class="truncate text-sm font-semibold">{episode.title}</span>
          {#if episode.show}<span class="truncate text-xs text-muted">{episode.show}</span>{/if}
        </span>
      </button>
      <IconButton icon="x" iconSize={15} label={t("player.close")} onclick={() => player.close()} />
    </div>

    <Slider
      class="px-0.5"
      value={at}
      min={0}
      max={Math.max(1, length)}
      label={t("player.position")}
      spoken={spokenTime}
      disabled={!length}
      oninput={(value) => (scrub = value)}
      oncommit={(value) => {
        player.seek(value);
        scrub = null;
      }}
    />
    <div class="tabular -mt-1 flex justify-between px-0.5 text-2xs text-faint" aria-hidden="true">
      <span>{time(at)}</span>
      <span>−{time(Math.max(0, length - at))}</span>
    </div>

    {#if player.error}
      <p class="m-0 text-xs text-danger" role="alert">{player.error}</p>
    {/if}

    <div class="flex items-center justify-between">
      <span class="w-10"></span>
      <div class="flex items-center gap-1">
        <IconButton icon="seek-back" iconSize={17} label={t("player.back", { seconds: BACK })} onclick={() => player.skip(-BACK)} />
        <IconButton
          icon={player.playing ? "pause" : "play"}
          iconSize={19}
          busy={player.loading}
          label={player.playing ? t("player.pause") : t("player.play")}
          class="text-fg!"
          onclick={() => player.toggle()}
        />
        <IconButton icon="seek-forward" iconSize={17} label={t("player.forward", { seconds: FORWARD })} onclick={() => player.skip(FORWARD)} />
      </div>
      <!-- Round the speeds, one at a time. -->
      <button
        class="tabular h-7 w-10 rounded-md text-xs font-semibold text-muted transition-colors hover:bg-hover hover:text-fg"
        aria-label={t("player.speed", { speed: speed(player.rate) })}
        title={t("player.speed", { speed: speed(player.rate) })}
        onclick={() => player.setRate(player.nextRate())}>{speed(player.rate)}</button
      >
    </div>
  </section>
{/if}
