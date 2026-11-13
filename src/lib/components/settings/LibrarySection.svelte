<script lang="ts">
  // Library: whether a note that's just a link is looked up and filled in, and on the web, which
  // sources a web page can ask at all (docs/library.md).
  import { locale, t } from "../../i18n/index.svelte";
  import { isTauri } from "../../platform";
  import { plugins } from "../../plugins/registry.svelte";
  import { prefs } from "../../prefs.svelte";
  import Callout from "../ui/Callout.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Switch from "../ui/Switch.svelte";

  /** The sources a web page can ask: those on that let it (the rest are the apps' alone). */
  const names = $derived(new Intl.ListFormat(locale, { type: "conjunction" }).format(plugins.librarySources.map((source) => source.name)));
</script>

<FieldGroup title={t("library.settings.links")} note={t("library.settings.sources")}>
  <FieldRow label={t("library.settings.lookUp")} note={t("library.settings.lookUpNote")}>
    <Switch label={t("library.settings.lookUp")} checked={prefs.lookUpLinks} onchange={(on) => (prefs.lookUpLinks = on)} />
    {#snippet below()}
      {#if !isTauri && names}<Callout class="mt-3 text-xs">{t("library.settings.web", { names })}</Callout>{/if}
    {/snippet}
  </FieldRow>
</FieldGroup>
