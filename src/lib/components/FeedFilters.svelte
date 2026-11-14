<script lang="ts">
  import { Dialog } from "bits-ui";
  import { speak } from "../a11y";
  import { feeds } from "../feeds/feeds.svelte";
  import { termsOf, writeTerms } from "../feeds/filters";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { ui } from "../ui.svelte";
  import Button from "./ui/Button.svelte";
  import TextField from "./ui/TextField.svelte";

  // A feed's own filters (its menu's Filters…, feeds/filters.ts): the words and phrases, between
  // commas, its posts are kept for, and those they're hidden for. Saved on its note, as its
  // `include:` and `exclude:`; the posts already kept are shown or hidden at once.

  const subscription = $derived(ui.feedFilters ? feeds.subscription(ui.feedFilters) : undefined);
  /** What's typed, starting as the feed has them. */
  let include = $derived(writeTerms(subscription?.include ?? []));
  let exclude = $derived(writeTerms(subscription?.exclude ?? []));

  function close() {
    ui.feedFilters = null;
  }

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!subscription) return;
    feeds.setFilters(subscription.url, termsOf(include), termsOf(exclude));
    speak(t("feeds.filters.saved", { title: subscription.title }));
    close();
  }
</script>

<Dialog.Root open={!!subscription} onOpenChange={(open) => !open && close()}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-scrim" />
    <Dialog.Content
      class="ui-dialog fixed top-[max(16px,14dvh)] left-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 rounded-xl border border-line bg-panel px-[22px] pt-[22px] pb-5 text-fg shadow-dialog outline-none animate-pop-in"
    >
      {#if subscription}
        <div class="mb-3.5 grid size-10 place-items-center rounded-xl bg-tag text-accent" aria-hidden="true">
          <Icon name="funnel" size={20} strokeWidth={1.75} />
        </div>
        <Dialog.Title class="m-0 text-lg font-semibold tracking-tight">{t("feeds.filters.title", { title: subscription.title })}</Dialog.Title>
        <Dialog.Description class="m-0 mt-1.5 mb-4 text-sm leading-normal text-muted">{t("feeds.filters.intro")}</Dialog.Description>
        <form class="flex flex-col gap-3" onsubmit={save}>
          <label class="flex flex-col gap-1.5 text-sm font-medium">
            {t("feeds.filters.include")}
            <TextField bind:value={include} placeholder={t("feeds.filters.includeExample")} autocomplete="off" spellcheck="false" />
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-medium">
            {t("feeds.filters.exclude")}
            <TextField bind:value={exclude} placeholder={t("feeds.filters.excludeExample")} autocomplete="off" spellcheck="false" />
          </label>
          <p class="m-0 text-xs leading-normal text-faint">{t("feeds.filters.hint")}</p>
          <div class="mt-1 flex flex-wrap items-center justify-end gap-1.5">
            <Button variant="quiet" onclick={close}>{t("feeds.filters.cancel")}</Button>
            <Button type="submit" variant="primary">{t("feeds.filters.save")}</Button>
          </div>
        </form>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
