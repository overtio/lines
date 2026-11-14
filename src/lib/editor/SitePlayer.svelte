<script module lang="ts">
  /** Links whose players were loaded this session: drawn again (scrolled back to), one is its player at once, not its card. */
  const loaded = new Set<string>();

  /** How long a player has to say it's ready before it's taken to have failed: offline, or what it plays is gone. */
  const READY_WITHIN = 10_000;
  /** How often one that has to be spoken to first is, until it answers. */
  const GREET_EVERY = 250;
</script>

<script lang="ts">
  // A site's player in a note (sitePlayer.ts): a card like an audio file's until it's played, then
  // the site's own player in a sandboxed frame, which can't take lines' window elsewhere. Nothing
  // is asked of the site before. Keys pressed in the frame never reach lines, so Tab out of it goes
  // back to the note. Styled by editor.css (.cm-lp-site-player).
  import { tick, untrack } from "svelte";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { openExternal } from "../platform";
  import { started } from "../playing";
  import { dropBar, keepBeside } from "./actions";
  import { leaveBlock } from "./attachments";
  import type { SitePlayer } from "./sitePlayer";

  let { player, changed }: { player: SitePlayer; changed: () => void } = $props();

  // A player is drawn for the one link it was made for.
  let shown = $state<"card" | "frame" | "failed">(untrack(() => (loaded.has(player.link) ? "frame" : "card")));
  let frame = $state<HTMLIFrameElement>();
  /** Played (from its card, or by Enter) before it was ready: it plays once it is. */
  let starting = false;
  let ready = false;
  /** Whether it last said it plays: what else plays is paused only as it starts. */
  let playing = false;

  // The link's text, unless that's only the site's name or the address.
  const title = $derived(
    player.title && player.title !== player.site && !/^https?:\/\//.test(player.title) ? player.title : t("editor.sitePlayer.name", { kind: player.kind, site: player.site }),
  );
  const open = $derived(t("editor.sitePlayer.open", { site: player.site }));

  const send = (message: unknown) => frame?.contentWindow?.postMessage(message, player.origin);
  const self = { pause: () => send(player.pause) };

  function onmessage(event: MessageEvent) {
    if (!frame || event.source !== frame.contentWindow || event.origin !== player.origin) return;
    let data: unknown = event.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }
    const said = player.read(data);
    if (said === "ready") {
      ready = true;
      player.listen?.forEach(send);
      if (starting) send(player.play);
      starting = false;
    } else if (said === "playing" && !playing) {
      playing = true;
      started(self);
    } else if (said === "paused") playing = false;
  }

  /** Loads the site's player if it isn't, and plays it, with the keyboard in it. */
  export async function play() {
    if (shown === "frame" && ready) send(player.play);
    else starting = true;
    if (shown !== "frame") {
      loaded.add(player.link);
      ready = playing = false;
      shown = "frame";
      await tick();
      changed();
    }
    frame?.focus();
  }

  /** A player that hasn't said it's ready within a while couldn't be loaded. One that says nothing till it's spoken to is, till then. */
  function watch(element: HTMLIFrameElement) {
    const timer = setTimeout(async () => {
      if (ready || !element.isConnected) return;
      loaded.delete(player.link);
      shown = "failed";
      await tick();
      changed();
    }, READY_WITHIN);
    // Once it's the site's page, which is all a message to the site reaches.
    let greeting: ReturnType<typeof setInterval> | undefined;
    const greet = () => {
      send(player.greet);
      greeting = setInterval(() => (ready ? clearInterval(greeting) : send(player.greet)), GREET_EVERY);
    };
    if (player.greet !== undefined) element.addEventListener("load", greet, { once: true });
    return () => {
      clearTimeout(timer);
      clearInterval(greeting);
      element.removeEventListener("load", greet);
    };
  }

  /** The block's buttons, beside it while there's room, as other blocks' are. */
  function beside(bar: HTMLElement) {
    const block = bar.closest<HTMLElement>(".cm-lp-block");
    if (block && bar.parentElement) keepBeside(bar, block, bar.parentElement);
    return () => dropBar(bar);
  }

  const leave = (event: FocusEvent) => leaveBlock(event.currentTarget as HTMLElement);
</script>

<svelte:window {onmessage} />

{#if shown === "frame"}
  <!-- WebKit's Tab stops at a button only when it says it's a stop. -->
  <button type="button" class="sr-only" tabindex="0" onfocus={leave}>{t("editor.sitePlayer.back")}</button>
  <iframe
    bind:this={frame}
    {@attach watch}
    class="cm-lp-site-frame"
    style:height={player.height && `${player.height}px`}
    style:aspect-ratio={player.ratio}
    src={player.src}
    title={t("editor.sitePlayer.frame", { site: player.site, title })}
    allow="autoplay; encrypted-media"
    referrerpolicy={player.referrer ?? "no-referrer"}
    sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
  ></iframe>
  {@render actions()}
  <button type="button" class="sr-only" tabindex="0" onfocus={leave}>{t("editor.sitePlayer.back")}</button>
{:else if shown === "failed"}
  <span class="cm-lp-embed-message">
    {t("editor.sitePlayer.failed", { site: player.site })}
    <button type="button" class="cm-lp-site-open cm-lp-own-input" onclick={() => openExternal(player.link)}>{open}</button>
  </span>
{:else if player.poster}
  <!-- A video's picture, Play over it; its player is loaded only once it's played. -->
  <span class="cm-lp-site-poster" role="group" aria-label={title} style:aspect-ratio={player.ratio}>
    <img src={player.poster} alt="" draggable="false" />
    <button type="button" class="cm-lp-site-play cm-lp-own-input" aria-label={t("editor.sitePlayer.play", { site: player.site })} title={player.note ?? t("editor.sitePlayer.loads", { site: player.site })} onclick={play}>
      <Icon name="play" size={20} strokeWidth={2.25} />
    </button>
  </span>
  {@render actions()}
{:else}
  <span class="cm-lp-file cm-lp-site-card" role="group" aria-label={title}>
    <button type="button" class="cm-lp-file-icon cm-lp-site-play cm-lp-own-input" aria-label={t("editor.sitePlayer.play", { site: player.site })} title={t("editor.sitePlayer.play", { site: player.site })} onclick={play}>
      <Icon name="play" size={16} strokeWidth={2.25} />
    </button>
    <span class="cm-lp-file-text">
      <span class="cm-lp-file-name">{title}</span>
      <span class="cm-lp-file-meta">{player.note ?? t("editor.sitePlayer.loads", { site: player.site })}</span>
    </span>
  </span>
  {@render actions()}
{/if}

<!-- Between the player and the way back to the note, so Tab reaches it from the player. -->
{#snippet actions()}
  <span class="cm-lp-actions" {@attach beside}>
    <button type="button" class="cm-lp-action cm-lp-own-input" tabindex="0" title={open} aria-label={open} onclick={() => openExternal(player.link)}>
      <Icon name="external-link" size={15} />
    </button>
  </span>
{/snippet}
