<script lang="ts">
  import { t } from "../../i18n/index.svelte";
  import { prefs, type Side } from "../../prefs.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Switch from "../ui/Switch.svelte";

  const sides: { id: Side; label: string }[] = [
    { id: "left", label: t("settings.sideLeft") },
    { id: "right", label: t("settings.sideRight") },
  ];
</script>

<FieldGroup>
  <FieldRow label={t("settings.sidebarSide")}>
    <Segmented label={t("settings.sidebarSide")} options={sides} value={prefs.sidebarSide} onselect={(side) => (prefs.sidebarSide = side)} />
  </FieldRow>
  <FieldRow label={t("settings.listSide")}>
    <Segmented label={t("settings.listSide")} options={sides} value={prefs.listSide} onselect={(side) => (prefs.listSide = side)} />
  </FieldRow>
  <FieldRow label={t("settings.tabs")} note={t("settings.tabsNote")}>
    <Switch label={t("settings.tabs")} checked={prefs.tabs} onchange={(on) => (prefs.tabs = on)} />
  </FieldRow>
  <FieldRow label={t("settings.outline")} note={t("settings.outlineNote")}>
    <Switch label={t("settings.outline")} checked={prefs.outline} onchange={(on) => (prefs.outline = on)} />
  </FieldRow>
  {#if prefs.outline}
    <FieldRow label={t("settings.outlineSide")}>
      <Segmented label={t("settings.outlineSide")} options={sides} value={prefs.outlineSide} onselect={(side) => (prefs.outlineSide = side)} />
    </FieldRow>
  {/if}
  <FieldRow label={t("settings.scrollbars")} note={t("settings.scrollbarsNote")}>
    <Switch label={t("settings.scrollbars")} checked={prefs.scrollbars} onchange={(on) => (prefs.scrollbars = on)} />
  </FieldRow>
</FieldGroup>
