<script lang="ts">
  import { LANGUAGES, languageChoice, setLanguage, type LanguageChoice, t } from "../../i18n/index.svelte";
  import { notes } from "../../notes/store.svelte";
  import { prefs, type Side, type SwipeDirection } from "../../prefs.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Select from "../ui/Select.svelte";
  import Switch from "../ui/Switch.svelte";

  const languages: { value: LanguageChoice; label: string }[] = [
    { value: "system", label: t("settings.languageSystem") },
    ...LANGUAGES.map(({ id, name }) => ({ value: id, label: name })),
  ];
  const sides: { id: Side; label: string }[] = [
    { id: "left", label: t("settings.sideLeft") },
    { id: "right", label: t("settings.sideRight") },
  ];
  const swipeDirections: { id: SwipeDirection; label: string }[] = [
    { id: "fingers", label: t("settings.swipeFingers") },
    { id: "reversed", label: t("settings.swipeReversed") },
  ];

  /** Only shown where there may be a trackpad. */
  const hasPointer = matchMedia("(any-pointer: fine)").matches;

  /** Starts lines again in the language chosen, once what's typed is saved. */
  async function chooseLanguage(choice: LanguageChoice) {
    if (choice === languageChoice) return;
    await notes.flush();
    setLanguage(choice);
  }
</script>

<FieldGroup>
  <FieldRow label={t("settings.language")} note={t("settings.languageNote")}>
    <Select label={t("settings.language")} value={languageChoice} options={languages} onchange={chooseLanguage} />
  </FieldRow>
</FieldGroup>

<FieldGroup title={t("settings.layout")}>
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
</FieldGroup>

{#if hasPointer}
  <FieldGroup title={t("settings.trackpad")}>
    <FieldRow label={t("settings.swipeDirection")} note={t("settings.swipeNote")}>
      <Segmented
        label={t("settings.swipeDirection")}
        options={swipeDirections}
        value={prefs.swipe}
        onselect={(id) => (prefs.swipe = id)}
      />
    </FieldRow>
  </FieldGroup>
{/if}
