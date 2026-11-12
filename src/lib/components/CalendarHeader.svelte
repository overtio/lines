<script lang="ts">
  // The Calendar's week or day's dates, and moving between them: Today, ‹ ›, and Day or Week. In the
  // note's toolbar, where the week or day is in the note's place (App.svelte), or else (with tabs in
  // the toolbar) over the week itself.
  import { locale, t } from "../i18n/index.svelte";
  import { addDays, dateOf, type Day, firstWeekday, weekOf } from "../notes/calendar";
  import { notes } from "../notes/store.svelte";
  import { type CalendarView, prefs } from "../prefs.svelte";
  import { today } from "../today.svelte";
  import Button from "./ui/Button.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import Segmented from "./ui/Segmented.svelte";

  let { day }: { day: Day } = $props();

  const view = $derived(prefs.calendarView);
  const days = $derived(view === "week" ? weekOf(day, firstWeekday(prefs.weekStart, locale)) : [day]);
  const step = $derived(view === "week" ? 7 : 1);

  const rangeFormat = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", year: "numeric" });
  const longDate = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const title = $derived(view === "week" ? rangeFormat.formatRange(dateOf(days[0]), dateOf(days[6])) : longDate.format(dateOf(day)));

  const views: { id: CalendarView; label: string }[] = [
    { id: "day", label: t("calendar.dayView") },
    { id: "week", label: t("calendar.weekView") },
  ];

  const choose = (next: Day) => notes.setFilter({ kind: "calendar", day: next });
</script>

<!-- The window can be dragged by its title, as by the toolbar around it. -->
<h2 id="calendar-range" class="m-0 min-w-0 flex-1 truncate text-lg font-semibold" aria-live="polite" data-tauri-drag-region>{title}</h2>
{#if !days.includes(today.day)}
  <Button variant="quiet" onclick={() => choose(today.day)}>{t("calendar.today")}</Button>
{/if}
<div class="flex">
  <IconButton
    icon="chevron-left"
    iconSize={16}
    label={view === "week" ? t("calendar.previousWeek") : t("calendar.previousDay")}
    onclick={() => choose(addDays(day, -step))}
  />
  <IconButton icon="chevron-right" iconSize={16} label={view === "week" ? t("calendar.nextWeek") : t("calendar.nextDay")} onclick={() => choose(addDays(day, step))} />
</div>
<Segmented label={t("calendar.view")} options={views} value={view} onselect={(id) => (prefs.calendarView = id)} />
