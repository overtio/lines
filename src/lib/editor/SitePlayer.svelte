<script module lang="ts">
  /** Players loaded this session, by address: drawn again (scrolled back to), one is the player at once, not its card. */
  const loaded = new Set<string>();
</script>

<script lang="ts">
  // A player from another site in a note (sitePlayer.ts): a card like an audio file's until it's
  // played, then the site's own player in a frame, sandboxed so it can't take lines' window
  // elsewhere. Nothing is asked of the site before, since its player follows whoever listens.
  // Styled by editor.css (.cm-lp-site-player).
  import { tick, untrack } from "svelte";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { started } from "../playing";
  import type { SitePlayer } from "./sitePlayer";

  let { player, changed }: { player: SitePlayer; changed: () => void } = $props();

  // A player is drawn for one link, the one it was made for.
  let shown = $state(untrack(() => loaded.has(player.src)));
  let frame = $state<HTMLIFrameElement>();
  /** Played from its card: it plays once it's ready. */
  let starting = false;

  const kind = $derived(t(`editor.sitePlayer.${player.kind}`));
  // The link's text, unless that's only the site's name or the address.
  const title = $derived(player.title && player.title !== player.site && !/^https?:\/\//.test(player.title) ? player.title : t("editor.sitePlayer.name", { kind, site: player.site }));

  const send = (message: unknown) => frame?.contentWindow?.postMessage(message, player.origin);
  const playing = { pause: () => send(player.pause) };

  /** What the player says: when it's ready, it's told what to say back, and to play if it was played from its card; playing, it pauses anything else. */
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
      player.listen?.forEach(send);
      if (starting) send(player.play);
      starting = false;
    } else if (said === "playing") started(playing);
  }

  /** Loads the site's player, to play, with the keyboard in it. */
  export async function play() {
    if (!shown) {
      loaded.add(player.src);
      starting = true;
      shown = true;
      await tick();
      changed();
    }
    frame?.focus();
  }
</script>

<svelte:window {onmessage} />

{#if shown}
  <iframe
    bind:this={frame}
    class="cm-lp-site-frame"
    style:height="{player.height}px"
    src={player.src}
    title={t("editor.sitePlayer.frame", { site: player.site, title })}
    allow="autoplay; encrypted-media"
    referrerpolicy="no-referrer"
    sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
  ></iframe>
{:else}
  <span class="cm-lp-file cm-lp-site-card" role="group" aria-label={title}>
    <button type="button" class="cm-lp-file-icon cm-lp-site-play cm-lp-own-input" aria-label={t("editor.sitePlayer.play", { site: player.site })} title={t("editor.sitePlayer.play", { site: player.site })} onclick={play}>
      <Icon name="play" size={16} strokeWidth={2.25} />
    </button>
    <span class="cm-lp-file-text">
      <span class="cm-lp-file-name">{title}</span>
      <span class="cm-lp-file-meta">{t("editor.sitePlayer.loads", { site: player.site })}</span>
    </span>
  </span>
{/if}
