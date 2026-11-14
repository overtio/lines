<script lang="ts">
  import { speak } from "../a11y";
  import { feedError, feeds } from "../feeds/feeds.svelte";
  import { FetchError } from "../feeds/fetch";
  import { NoFeed } from "../feeds/find";
  import { t } from "../i18n/index.svelte";
  import { notes } from "../notes/store.svelte";
  import { isTauri } from "../platform";
  import { ui } from "../ui.svelte";
  import Prompt from "./ui/Prompt.svelte";

  // Subscribing to a feed: its link, its site's, or its podcast's page on Apple Podcasts, pasted in.

  let value = $state("");
  let busy = $state<AbortController | null>(null);
  let error = $state<string | null>(null);

  function close() {
    busy?.abort();
    ui.subscribePrompt = null;
    value = "";
    error = null;
    busy = null;
  }

  async function onsubmit() {
    const abort = (busy = new AbortController());
    error = null;
    speak(t("feeds.finding"));
    try {
      const { url, again } = await feeds.subscribe(value, abort.signal);
      if (abort.signal.aborted) return;
      close();
      notes.setFilter({ kind: "feeds", feed: url });
      speak(again ? t("library.already") : t("feeds.subscribed", { title: feeds.subscription(url)?.title ?? url }));
    } catch (failure) {
      if (abort.signal.aborted) return;
      error = failure instanceof NoFeed ? t("feeds.noFeedThere") : failure instanceof FetchError ? feedError(failure.message) : feedError(String(failure));
      speak(error);
    } finally {
      if (busy === abort) busy = null;
    }
  }
</script>

<Prompt
  at={ui.subscribePrompt}
  title={t("feeds.subscribeTitle")}
  icon="rss"
  action={t("feeds.subscribeButton")}
  ready={!!value.trim()}
  busy={!!busy}
  width="w-[min(340px,calc(100vw-16px))]"
  bind:value
  onclose={close}
  {onsubmit}
  oninput={() => (error = null)}
  inputmode="url"
  placeholder={t("feeds.linkPlaceholder")}
  aria-label={t("feeds.linkLabel")}
  aria-invalid={!!error}
  aria-describedby={error ? "subscribe-error" : undefined}
>
  {#if error}
    <p id="subscribe-error" class="m-0 mx-0.5 mt-2 text-xs leading-normal text-danger">{error}</p>
  {:else if !isTauri}
    <p class="m-0 mx-0.5 mt-2 text-xs leading-normal text-faint">{t("feeds.webHint")}</p>
  {/if}
</Prompt>
