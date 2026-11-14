<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import { on } from "svelte/events";
  import { feeds } from "../feeds/feeds.svelte";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { clock } from "../library/text";
  import { attachmentURL } from "../notes/attachments";
  import { notes } from "../notes/store.svelte";
  import { plugins } from "../plugins/registry.svelte";
  import { BACK, FORWARD, player, STEP } from "../player/player.svelte";
  import { ui } from "../ui.svelte";
  import Button from "./ui/Button.svelte";
  import { fitPicture } from "./fitPicture";
  import IconButton from "./ui/IconButton.svelte";
  import Slider from "./ui/Slider.svelte";

  // The episode playing, at the bottom of the sidebar (or of the note list, where the sidebar is a
  // drawer), lined up with the sidebar's rows: its artwork, title and show, which open it; where
  // it's got to; and its controls, with what plugins add (playerParts) beside them and above.

  let { class: className }: { class?: string } = $props();

  const episode = $derived(player.episode);
  /** Where the slider's being dragged to, until it's let go of. */
  let scrub = $state<number | null>(null);
  /** A pointer is on the slider: what it says is where it's dragged to, not where the episode is. */
  let dragging = false;
  const at = $derived(scrub ?? player.time);
  const length = $derived(Math.max(player.duration, at));
  /** A time as the player shows it, nothing yet as 0:00. */
  const time = (seconds: number) => clock(seconds) ?? "0:00";
  const spokenTime = (seconds: number) => t("player.time", { elapsed: time(seconds), left: time(Math.max(0, length - seconds)) });
  const speed = (rate: number) => `${rate}×`;

  /** The slider's arrow keys go STEP seconds, rather than one. */
  const ARROWS: Record<string, number> = { ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP };

  /** Around the slider: knows when a pointer drags it, and takes its arrow keys before it does. */
  const slider: Attachment<HTMLElement> = (node) => {
    const stops = [
      on(node, "pointerdown", () => (dragging = true), { capture: true }),
      on(window, "pointerup", () => {
        dragging = false;
        // Let go without a change to commit, it's back to where the episode is.
        requestAnimationFrame(() => (scrub = null));
      }),
      on(
        node,
        "keydown",
        (event) => {
          const by = ARROWS[event.key];
          if (!by) return;
          event.preventDefault();
          event.stopPropagation();
          player.skip(by);
        },
        { capture: true },
      ),
    ];
    return () => stops.forEach((stop) => stop());
  };

  /** A sound a note links to a time in, alone, opens nowhere: its title isn't a button. */
  const opens = $derived(!!episode && !("sound" in episode.from));

  function show() {
    const from = episode?.from;
    if (!from) return;
    if ("note" in from) notes.show(from.note);
    else if ("feed" in from) {
      notes.setFilter({ kind: "feeds", feed: from.feed });
      feeds.show(from.feed, from.post);
    }
    ui.closeDrawer();
  }
</script>

{#if episode}
  <section class={["flex flex-col gap-1.5 border-t border-line px-5 pt-2.5 pb-2", className]} aria-label={t("player.label")}>
    <!-- What plugins show above it: the Feeds plugin's transcript. -->
    {#each plugins.playerParts as { id, above: Above } (id)}
      {#if Above}<Above {episode} />{/if}
    {/each}
    <div class="flex min-w-0 items-center gap-2.5">
      <svelte:element
        this={opens ? "button" : "div"}
        class="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left"
        onclick={opens ? show : undefined}
        title={opens ? t("player.show") : undefined}
        role={opens ? undefined : "group"}
      >
        {#snippet artwork(src: string | null | undefined)}
          {#if src}
            <img {src} alt="" class="size-9 shrink-0 rounded-md bg-input object-cover" {@attach fitPicture} />
          {:else}
            <span class="grid size-9 shrink-0 place-items-center rounded-md bg-input text-muted"><Icon name="headphones" size={16} /></span>
          {/if}
        {/snippet}
        {#if episode.cover && !episode.artwork}
          {#await attachmentURL(episode.cover)}{@render artwork(null)}{:then src}{@render artwork(src)}{/await}
        {:else}
          {@render artwork(episode.artwork)}
        {/if}
        <span class="flex min-w-0 flex-col">
          <span class="truncate text-sm font-semibold">{episode.title}</span>
          {#if episode.show}<span class="truncate text-xs text-muted">{episode.show}</span>{/if}
        </span>
      </svelte:element>
      <IconButton class="-mr-2" icon="x" iconSize={15} label={t("player.close")} onclick={() => player.close()} />
    </div>

    <div {@attach slider}>
      <Slider
        value={Math.floor(at)}
        min={0}
        max={Math.max(1, Math.floor(length))}
        label={t("player.position")}
        spoken={spokenTime}
        disabled={!length}
        oninput={(value) => {
          if (dragging) scrub = value;
        }}
        oncommit={(value) => {
          scrub = null;
          player.seek(value);
        }}
      />
    </div>
    <div class="tabular -mt-1 flex justify-between text-2xs text-faint" aria-hidden="true">
      <span>{time(at)}</span>
      <span>−{time(Math.max(0, length - at))}</span>
    </div>

    {#if player.error}
      <p class="m-0 text-xs text-danger" role="alert">{player.error}</p>
    {/if}

    <!-- The controls between what plugins put at the left and the speed, the same room either side. -->
    <div class="flex items-center justify-between">
      <div class="-ml-2 flex min-w-10 items-center">
        {#each plugins.playerParts as { id, buttons: Buttons } (id)}
          {#if Buttons}<Buttons {episode} />{/if}
        {/each}
      </div>
      <div class="flex items-center gap-0.5">
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
      <Button
        variant="quiet"
        class="tabular -mr-2 w-10 px-0 text-xs font-semibold"
        aria-label={t("player.speed", { speed: speed(player.rate) })}
        title={t("player.speed", { speed: speed(player.rate) })}
        onclick={() => player.setRate(player.nextRate())}>{speed(player.rate)}</Button
      >
    </div>
  </section>
{/if}
