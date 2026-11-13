<script lang="ts">
  import { speak } from "../../a11y";
  import { feeds } from "../../feeds/feeds.svelte";
  import { t } from "../../i18n/index.svelte";
  import Icon from "../../icons/Icon.svelte";
  import { downloadText, isTauri } from "../../platform";
  import { FEED_REFRESH, type FeedRefresh, prefs } from "../../prefs.svelte";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Select from "../ui/Select.svelte";

  // The feeds' part of Settings → Library: how often they're fetched, and OPML in and out.

  const intervals = FEED_REFRESH.map((minutes) => ({
    value: String(minutes),
    label: minutes ? t("feeds.every", { minutes }) : t("feeds.onlyWhenAsked"),
  }));

  let picker = $state<HTMLInputElement>();
  let importing = $state(false);
  let imported = $state<number | null>(null);
  let error = $state<string | null>(null);

  async function importChosen() {
    const file = picker?.files?.[0];
    if (!file) return;
    importing = true;
    imported = null;
    error = null;
    try {
      imported = await feeds.importOpml(await file.text());
      speak(t("feeds.imported", { count: imported }));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      importing = false;
      if (picker) picker.value = "";
    }
  }

  function exportAll() {
    downloadText("feeds.opml", feeds.exportOpml(), "text/x-opml");
    speak(t("settings.downloaded", { filename: "feeds.opml" }));
  }
</script>

<FieldGroup title={t("feeds.title")} note={isTauri ? undefined : t("feeds.webHint")}>
  <FieldRow label={t("feeds.refreshEvery")} note={t("feeds.refreshEveryNote")}>
    <Select
      label={t("feeds.refreshEvery")}
      value={String(prefs.feedRefresh)}
      options={intervals}
      onchange={(minutes) => (prefs.feedRefresh = Number(minutes) as FeedRefresh)}
    />
  </FieldRow>
  <FieldRow label={t("feeds.opml")} note={t("feeds.opmlNote")}>
    <Button icon="import" onclick={() => picker?.click()} disabled={importing}>{importing ? t("feeds.importing") : t("feeds.importOpml")}</Button>
    <Button icon="download" onclick={exportAll} disabled={!feeds.subscriptions.length}>{t("feeds.exportOpml")}</Button>
    <input bind:this={picker} type="file" accept=".opml,.xml,text/x-opml,application/xml,text/xml" class="hidden" onchange={importChosen} />
    {#snippet below()}
      {#if imported !== null}
        <p class="m-0 mt-2 flex items-center gap-2 text-sm leading-normal text-muted" role="status">
          <Icon name="check" size={15} class="shrink-0 text-success" />
          {t("feeds.imported", { count: imported })}
        </p>
      {/if}
      {#if error}
        <Callout tone="danger" class="mt-2 w-full">{error}</Callout>
      {/if}
    {/snippet}
  </FieldRow>
</FieldGroup>
