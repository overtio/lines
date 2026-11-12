<script lang="ts">
  import { LANGUAGES, languageChoice, locale, setLanguage, type LanguageChoice, t } from "../../i18n/index.svelte";
  import { weekStartIn } from "../../notes/calendar";
  import { notes } from "../../notes/store.svelte";
  import { isDesktopApp } from "../../platform";
  import { type NewNotes, prefs, type SettingsOpens, type SwipeDirection, type WeekStart } from "../../prefs.svelte";
  import { setSettingsOpens } from "../../windows/settings.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Select from "../ui/Select.svelte";
  import Switch from "../ui/Switch.svelte";

  const languages: { value: LanguageChoice; label: string }[] = [
    { value: "system", label: t("settings.languageSystem") },
    ...LANGUAGES.map(({ id, name }) => ({ value: id, label: name })),
  ];
  const newNotes: { id: NewNotes; label: string }[] = [
    { id: "inbox", label: t("settings.newNotesInbox") },
    { id: "notes", label: t("settings.newNotesNotes") },
  ];
  const settingsOpens: { id: SettingsOpens; label: string }[] = [
    { id: "overlay", label: t("settings.settingsOpensOverlay") },
    { id: "window", label: t("settings.settingsOpensWindow") },
  ];
  const swipeDirections: { id: SwipeDirection; label: string }[] = [
    { id: "fingers", label: t("settings.swipeFingers") },
    { id: "reversed", label: t("settings.swipeReversed") },
  ];

  // Days named in the app's language, from a week known to start on a Sunday (Jan 4, 1970).
  const dayName = (weekday: number) => new Date(1970, 0, 4 + weekday).toLocaleDateString(locale, { weekday: "long" });
  const weekStarts: { value: WeekStart; label: string }[] = [
    { value: "auto", label: t("settings.weekStartAuto", { day: dayName(weekStartIn(locale)) }) },
    { value: "monday", label: dayName(1) },
    { value: "sunday", label: dayName(0) },
    { value: "saturday", label: dayName(6) },
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
  <FieldRow label={t("settings.newNotes")} note={t("settings.newNotesNote")}>
    <Segmented label={t("settings.newNotes")} options={newNotes} value={prefs.newNotes} onselect={(id) => (prefs.newNotes = id)} />
  </FieldRow>
  {#if isDesktopApp}
    <FieldRow label={t("settings.settingsOpens")} note={t("settings.settingsOpensNote")}>
      <Segmented label={t("settings.settingsOpens")} options={settingsOpens} value={prefs.settingsOpens} onselect={(id) => void setSettingsOpens(id)} />
    </FieldRow>
  {/if}
</FieldGroup>

<FieldGroup title={t("settings.calendar")}>
  <FieldRow label={t("settings.weekStart")}>
    <Select label={t("settings.weekStart")} value={prefs.weekStart} options={weekStarts} onchange={(start) => (prefs.weekStart = start)} />
  </FieldRow>
  <FieldRow label={t("settings.calendarEdited")} note={t("settings.calendarEditedNote")}>
    <Switch label={t("settings.calendarEdited")} checked={prefs.calendarEdited} onchange={(on) => (prefs.calendarEdited = on)} />
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
