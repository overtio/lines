<script lang="ts">
  import { t } from "../../i18n/index.svelte";
  import { prefs, type PropertiesPlace, type Side } from "../../prefs.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Switch from "../ui/Switch.svelte";

  const sides: { id: Side; label: string }[] = [
    { id: "left", label: t("settings.sideLeft") },
    { id: "right", label: t("settings.sideRight") },
  ];
  const propertiesPlaces: { id: PropertiesPlace; label: string }[] = [
    { id: "top", label: t("settings.placeTop") },
    ...sides,
    { id: "bottom", label: t("settings.placeBottom") },
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
  <FieldRow label={t("settings.propertiesPlace")} note={t("settings.propertiesPlaceNote")}>
    <Segmented
      label={t("settings.propertiesPlace")}
      options={propertiesPlaces}
      value={prefs.propertiesPlace}
      onselect={(place) => (prefs.propertiesPlace = place)}
    />
  </FieldRow>
  <FieldRow label={t("settings.sidebarAbout")} note={t("settings.sidebarAboutNote")}>
    <Switch label={t("settings.sidebarAbout")} checked={prefs.sidebarAbout} onchange={(on) => (prefs.sidebarAbout = on)} />
  </FieldRow>
  <FieldRow label={t("settings.scrollbars")} note={t("settings.scrollbarsNote")}>
    <Switch label={t("settings.scrollbars")} checked={prefs.scrollbars} onchange={(on) => (prefs.scrollbars = on)} />
  </FieldRow>
  <FieldRow label={t("settings.hideBars")} note={t("settings.hideBarsNote")}>
    <Switch label={t("settings.hideBars")} checked={prefs.hideBars} onchange={(on) => (prefs.hideBars = on)} />
  </FieldRow>
  <FieldRow label={t("settings.showIcons")} note={t("settings.showIconsNote")}>
    <Switch label={t("settings.showIcons")} checked={prefs.showIcons} onchange={(on) => (prefs.showIcons = on)} />
  </FieldRow>
</FieldGroup>
