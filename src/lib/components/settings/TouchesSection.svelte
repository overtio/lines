<script lang="ts">
  // Little Touches: small things lines does as you write, each easy to turn off.
  import { t } from "../../i18n/index.svelte";
  import type { IconName } from "../../icons/icons";
  import { prefs, type ScoreStyle } from "../../prefs.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Switch from "../ui/Switch.svelte";

  const scoreStyles: { id: ScoreStyle; label: string; icon?: IconName }[] = [
    { id: "stars", label: t("settings.scoresStars"), icon: "star" },
    { id: "hearts", label: t("settings.scoresHearts"), icon: "heart" },
    { id: "circles", label: t("settings.scoresCircles"), icon: "circle" },
    { id: "off", label: t("settings.scoresOff") },
  ];
</script>

<FieldGroup title={t("settings.touchesValues")}>
  <FieldRow label={t("settings.copyValues")} note={t("settings.copyValuesNote")}>
    <Switch label={t("settings.copyValues")} checked={prefs.copyValues} onchange={(on) => (prefs.copyValues = on)} />
  </FieldRow>
  <FieldRow label={t("settings.scores")} note={t("settings.scoresNote")}>
    <Segmented label={t("settings.scores")} options={scoreStyles} value={prefs.scores} onselect={(style) => (prefs.scores = style)} />
  </FieldRow>
</FieldGroup>
