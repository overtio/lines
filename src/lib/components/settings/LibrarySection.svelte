<script lang="ts">
  // Library: whether a note that's just a link is looked up and filled in, and on the web, which
  // sources a web page can ask at all (docs/library.md); what things are rated on; bringing things
  // in from elsewhere, each import a plugin's group (a browser's bookmarks, Readwise); and feeds:
  // how often they're fetched, and OPML.
  import { feeds } from "../../feeds/feeds.svelte";
  import { locale, t } from "../../i18n/index.svelte";
  import { isTauri } from "../../platform";
  import { plugins } from "../../plugins/registry.svelte";
  import type { LibraryImport } from "../../plugins/types";
  import { prefs } from "../../prefs.svelte";
  import Callout from "../ui/Callout.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Switch from "../ui/Switch.svelte";
  import CardBlock from "./CardBlock.svelte";
  import FeedSettings from "./FeedSettings.svelte";
  import RatingSettings from "./RatingSettings.svelte";

  /** The sources a web page can ask: those on that let it (the rest are the apps' alone). */
  const names = $derived(new Intl.ListFormat(locale, { type: "conjunction" }).format(plugins.librarySources.map((source) => source.name)));

  /** An import's rows, loaded the first time they're shown. */
  const panelOf = (source: LibraryImport) =>
    source.panel().catch((error) => {
      console.error(`lines: couldn't load the ${source.id} import`, error);
      throw error;
    });
</script>

<FieldGroup title={t("library.settings.links")} note={t("library.settings.sources")}>
  <FieldRow label={t("library.settings.lookUp")} note={t("library.settings.lookUpNote")}>
    <Switch label={t("library.settings.lookUp")} checked={prefs.lookUpLinks} onchange={(on) => (prefs.lookUpLinks = on)} />
    {#snippet below()}
      {#if !isTauri && names}<Callout class="mt-3 text-xs">{t("library.settings.web", { names })}</Callout>{/if}
    {/snippet}
  </FieldRow>
  <FieldRow label={t("library.settings.countAgain")} note={t("library.settings.countAgainNote")}>
    <Switch label={t("library.settings.countAgain")} checked={prefs.countAddedAgain} onchange={(on) => (prefs.countAddedAgain = on)} />
  </FieldRow>
</FieldGroup>

<RatingSettings />

{#each plugins.libraryImports as source (source.id)}
  {#await panelOf(source) then { default: Panel }}
    <FieldGroup title={source.name} note={source.note}>
      <Panel />
    </FieldGroup>
  {:catch}
    <FieldGroup title={source.name} note={source.note}>
      <CardBlock>
        <Callout tone="danger" class="w-full">{t("library.import.unavailable")}</Callout>
      </CardBlock>
    </FieldGroup>
  {/await}
{/each}

{#if feeds.on}
  <FeedSettings />
{/if}
