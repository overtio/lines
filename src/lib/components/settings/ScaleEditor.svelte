<script lang="ts">
  // A scale of your own, made or changed (Settings → Library → Ratings): its name, and marks out of 2
  // to 10 in an icon, points out of up to 1,000, or words, the best first. Saved as one choice, which
  // syncs (library/ratings.ts); notes rated on it before are left as they're written.
  import { untrack } from "svelte";
  import { speak } from "../../a11y";
  import type { Scale } from "../../editor/scores";
  import { t } from "../../i18n/index.svelte";
  import Icon from "../../icons/Icon.svelte";
  import type { IconName } from "../../icons/icons";
  import { MOST, readScale } from "../../library/ratings";
  import { ratings, type ScaleChoice } from "../../library/ratings.svelte";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import TextField from "../ui/TextField.svelte";

  let { scale, onclose }: { scale?: ScaleChoice; onclose: () => void } = $props();

  const id = $props.id();
  const start = untrack(() => scale);
  const was = start?.scale;
  let name = $state(start?.name ?? "");
  let kind = $state<Scale["kind"]>(was?.kind ?? "marks");
  let of = $state(String(was && was.kind !== "labels" ? was.of : 5));
  let icon = $state<IconName>((was?.kind === "marks" && was.icon) || "star");
  let words = $state(was?.kind === "labels" ? was.labels.join(", ") : "");
  let error = $state<string | null>(null);

  const kinds = [
    { id: "marks", label: t("library.rating.marks") },
    { id: "points", label: t("library.rating.points") },
    { id: "labels", label: t("library.rating.words") },
  ] as const;
  /** Icons marks can be drawn in. */
  const ICONS = (["star", "heart", "circle", "flame", "sparkles", "trophy", "thumbs-up", "smile"] as const).map((icon) => ({
    id: icon,
    label: t(`library.rating.icon.${icon}`),
  }));

  function save(event: SubmitEvent) {
    event.preventDefault();
    const made = readScale(kind === "labels" ? { kind, labels: words.split(",").filter((word) => word.trim()) } : { kind, of: Number(of), icon });
    error = !name.trim()
      ? t("library.rating.scaleNameEmpty")
      : made
        ? null
        : kind === "labels"
          ? t("library.rating.wordsInvalid", { most: MOST.labels })
          : t("library.rating.outOfInvalid", { most: MOST[kind] });
    // A mistake is said as it shows (Callout).
    if (error || !made) return;
    ratings.saveScale(start?.id ?? null, name, made);
    speak(t("library.rating.scaleSaved", { name: name.trim() }));
    onclose();
  }
</script>

<form class="flex flex-col gap-3 border-b border-line px-4 py-3 last:border-0" aria-label={start ? t("library.rating.editScale", { name: start.name }) : t("library.rating.newScale")} onsubmit={save}>
  <div class="flex flex-wrap items-center gap-2">
    <!-- The keyboard's here as it opens. -->
    <TextField class="min-w-40 flex-1" bind:value={name} aria-label={t("library.rating.scaleName")} placeholder={t("library.rating.scaleNamePlaceholder")} {@attach (field) => field.focus()} />
    <Segmented label={t("library.rating.scaleKind")} options={kinds} value={kind} onselect={(chosen) => (kind = chosen)} />
  </div>
  {#if kind === "labels"}
    <div class="flex flex-col gap-1.5">
      <TextField id="{id}-words" bind:value={words} aria-label={t("library.rating.words")} aria-describedby="{id}-words-note" placeholder={t("library.rating.wordsPlaceholder")} />
      <p id="{id}-words-note" class="m-0 text-xs leading-normal text-muted">{t("library.rating.wordsNote")}</p>
    </div>
  {:else}
    <div class="flex flex-wrap items-center gap-2">
      <label for="{id}-of" class="text-sm text-fg">{t("library.rating.outOf")}</label>
      <TextField id="{id}-of" class="w-20" type="number" min="2" max={MOST[kind]} bind:value={of} />
      {#if kind === "marks"}
        <Segmented class="ms-auto" label={t("library.rating.markIcon")} options={ICONS} value={icon} onselect={(chosen) => (icon = chosen)}>
          {#snippet content(option)}
            <span class="flex items-center" title={option.label}><Icon name={option.id} size={15} /><span class="sr-only">{option.label}</span></span>
          {/snippet}
        </Segmented>
      {/if}
    </div>
  {/if}
  {#if error}<Callout tone="danger">{error}</Callout>{/if}
  <div class="flex justify-end gap-2">
    <Button variant="quiet" onclick={onclose}>{t("settings.cancel")}</Button>
    <Button variant="primary" type="submit">{t("library.rating.saveScale")}</Button>
  </div>
</form>
