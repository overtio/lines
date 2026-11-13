<script lang="ts">
  // Library: whether a note that's just a link is looked up and filled in, and on the web, which
  // sources a web page can ask at all (docs/library.md); bookmarks imported from a browser; and
  // feeds: how often they're fetched, and OPML.
  import { feeds } from "../../feeds/feeds.svelte";
  import { locale, t } from "../../i18n/index.svelte";
  import { isTauri } from "../../platform";
  import { plugins } from "../../plugins/registry.svelte";
  import { prefs } from "../../prefs.svelte";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Switch from "../ui/Switch.svelte";
  import BookmarkImport from "./BookmarkImport.svelte";
  import CardBlock from "./CardBlock.svelte";
  import FeedSettings from "./FeedSettings.svelte";

  /** The sources a web page can ask: those on that let it (the rest are the apps' alone). */
  const names = $derived(new Intl.ListFormat(locale, { type: "conjunction" }).format(plugins.librarySources.map((source) => source.name)));

  let picker = $state<HTMLInputElement>();
  let importButton = $state<HTMLElement>();
  let reading = $state(false);
  /** The bookmarks files chosen, read, whose import is asked about below. */
  let chosen = $state.raw<{ name: string; text: string }[] | null>(null);

  async function bookmarksChosen() {
    const files = [...(picker?.files ?? [])];
    if (picker) picker.value = "";
    if (!files.length) return;
    reading = true;
    chosen = await Promise.all(files.map(async (file) => ({ name: file.name, text: await file.text() })));
    reading = false;
  }
</script>

<FieldGroup title={t("library.settings.links")} note={t("library.settings.sources")}>
  <FieldRow label={t("library.settings.lookUp")} note={t("library.settings.lookUpNote")}>
    <Switch label={t("library.settings.lookUp")} checked={prefs.lookUpLinks} onchange={(on) => (prefs.lookUpLinks = on)} />
    {#snippet below()}
      {#if !isTauri && names}<Callout class="mt-3 text-xs">{t("library.settings.web", { names })}</Callout>{/if}
    {/snippet}
  </FieldRow>
</FieldGroup>

<FieldGroup title={t("library.bookmarks.title")} note={t("library.bookmarks.note")}>
  <CardBlock class="items-start">
    <Button icon="import" busy={reading} disabled={reading} onclick={() => picker?.click()} {@attach (button: HTMLElement) => void (importButton = button)}>
      {reading ? t("library.bookmarks.reading") : t("library.bookmarks.import")}
    </Button>
    <input bind:this={picker} type="file" multiple accept=".html,.htm,.json,text/html,application/json" class="hidden" onchange={bookmarksChosen} />
  </CardBlock>
  {#if chosen}
    {#key chosen}
      <BookmarkImport
        files={chosen}
        onclose={() => {
          chosen = null;
          importButton?.focus();
        }}
      />
    {/key}
  {/if}
</FieldGroup>

{#if feeds.on}
  <FeedSettings />
{/if}
