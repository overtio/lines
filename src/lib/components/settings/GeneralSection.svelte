<script lang="ts">
  import { LANGUAGES, languageChoice, setLanguage, type LanguageChoice, t } from "../../i18n/index.svelte";
  import { notes } from "../../notes/store.svelte";
  import { prefs, type SwipeDirection } from "../../prefs.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Select from "../ui/Select.svelte";

  const languages: { value: LanguageChoice; label: string }[] = [
    { value: "system", label: t("settings.languageSystem") },
    ...LANGUAGES.map(({ id, name }) => ({ value: id, label: name })),
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
