<script lang="ts">
  import { Popover } from "bits-ui";
  import { speak } from "../a11y";
  import { feedError, feeds } from "../feeds/feeds.svelte";
  import { FetchError } from "../feeds/fetch";
  import { NoFeed } from "../feeds/find";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { notes } from "../notes/store.svelte";
  import { isTauri } from "../platform";
  import { pointAt, takeFocus } from "../popover";
  import { ui } from "../ui.svelte";
  import { floating } from "./ui/styles";

  // Subscribing to a feed: its link, its site's, or its podcast's page on Apple Podcasts, pasted in.

  let el = $state<HTMLElement | null>(null);
  let input = $state<HTMLInputElement>();
  let restore: (() => void) | undefined;
  let value = $state("");
  let busy = $state<AbortController | null>(null);
  let error = $state<string | null>(null);

  const prompt = $derived(ui.subscribePrompt);
  const anchor = $derived(prompt && pointAt(prompt.x, prompt.y));

  function close() {
    busy?.abort();
    ui.subscribePrompt = null;
    value = "";
    error = null;
    busy = null;
  }

  async function onsubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!value.trim() || busy) return;
    const abort = (busy = new AbortController());
    error = null;
    speak(t("feeds.finding"));
    try {
      const url = await feeds.subscribe(value, abort.signal);
      if (abort.signal.aborted) return;
      close();
      notes.setFilter({ kind: "feeds", feed: url });
      speak(t("feeds.subscribed", { title: feeds.subscription(url)?.title ?? url }));
    } catch (failure) {
      if (abort.signal.aborted) return;
      error = failure instanceof NoFeed ? t("feeds.noFeedThere") : failure instanceof FetchError ? feedError(failure.message) : feedError(String(failure));
      speak(error);
    } finally {
      if (busy === abort) busy = null;
    }
  }
</script>

<Popover.Root open={!!prompt} onOpenChange={(open) => !open && close()}>
  <Popover.Portal>
    <Popover.Content
      bind:ref={el}
      customAnchor={anchor}
      align={prompt?.align ?? "start"}
      sideOffset={0}
      collisionPadding={8}
      role="dialog"
      aria-label={t("feeds.subscribeTitle")}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        restore = takeFocus(el!, input);
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        restore?.();
      }}
      class="{floating} w-[min(340px,calc(100vw-16px))] p-2.5"
    >
      <form {onsubmit}>
        <p class="m-0 mx-0.5 mb-2 text-xs font-semibold text-muted" aria-hidden="true">{t("feeds.subscribeTitle")}</p>
        <div class="flex items-center gap-1.5 rounded-md border border-transparent bg-input pl-2 text-faint focus-within:border-accent">
          <Icon name="rss" size={14} />
          <input
            bind:this={input}
            bind:value
            oninput={() => (error = null)}
            inputmode="url"
            placeholder={t("feeds.linkPlaceholder")}
            aria-label={t("feeds.linkLabel")}
            aria-invalid={!!error}
            aria-describedby={error ? "subscribe-error" : undefined}
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            class="h-[30px] min-w-0 flex-1 border-0 bg-transparent p-0 font-[inherit] text-sm text-fg outline-none placeholder:text-faint coarse:h-11"
          />
          <button
            class="m-0.5 inline-flex h-[26px] items-center gap-1 rounded-sm bg-accent px-2.5 text-xs font-semibold text-on-accent disabled:opacity-45 coarse:h-10"
            type="submit"
            disabled={!value.trim() || !!busy}
            aria-busy={!!busy}
          >
            {#if busy}<Icon name="loader" size={12} class="animate-spin" />{/if}{t("feeds.subscribeButton")}
          </button>
        </div>
        {#if error}
          <p id="subscribe-error" class="m-0 mx-0.5 mt-2 text-xs leading-normal text-danger">{error}</p>
        {:else if !isTauri}
          <p class="m-0 mx-0.5 mt-2 text-xs leading-normal text-faint">{t("feeds.webHint")}</p>
        {/if}
      </form>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
