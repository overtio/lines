<script lang="ts">
  // The Calendar's month, above the note list: a grid of days, the chosen one's notes listed below.
  // It's a grid as date pickers are: the arrow keys move by day and week, Page Up and Page Down by
  // month (with ⇧, by year), and ↵ or a double-click makes a note on the day.
  import { flushSync } from "svelte";
  import { t, locale } from "../i18n/index.svelte";
  import { addDays, addMonths, dateOf, type Day, firstWeekday, monthWeeks, notesOnDays, weekOf } from "../notes/calendar";
  import { noteColor } from "../notes/looks.svelte";
  import { notes } from "../notes/store.svelte";
  import { type PaletteColor, paletteVar } from "../palette";
  import { prefs } from "../prefs.svelte";
  import Button from "./ui/Button.svelte";
  import IconButton from "./ui/IconButton.svelte";

  let { day, today }: { day: Day; today: Day } = $props();

  const weekStart = $derived(firstWeekday(prefs.weekStart, locale));

  const weeks = $derived(monthWeeks(day, weekStart));
  const month = $derived(day.slice(0, 7));
  const onDays = $derived(notesOnDays(notes.entries, weeks[0][0], weeks[5][6], prefs.calendarEdited));

  /** A dot for each color on the day, three at most: its notes' own, their types' or tags', or the accent. */
  const DOTS = 3;
  const dotsOn = (cell: Day) => [...new Set<PaletteColor>((onDays.get(cell) ?? []).map((entry) => noteColor(entry) ?? "accent"))].slice(0, DOTS);

  const monthName = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const longDate = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const narrowDay = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const longDay = new Intl.DateTimeFormat(locale, { weekday: "long" });

  let grid = $state<HTMLTableElement>();

  /**
   * Chooses `next`, its week or day showing in the note's place, and with `focus`, moves focus to it
   * once it's drawn (in another month, perhaps).
   */
  function choose(next: Day, focus = false) {
    notes.setFilter({ kind: "calendar", day: next });
    notes.select(null);
    if (!focus) return;
    flushSync();
    grid?.querySelector<HTMLElement>(`[data-day="${next}"]`)?.focus();
  }

  function newNote(on: Day) {
    if (on !== day) choose(on);
    notes.create();
  }

  function onkeydown(event: KeyboardEvent) {
    let next: Day;
    switch (event.key) {
      case "ArrowLeft":
        next = addDays(day, -1);
        break;
      case "ArrowRight":
        next = addDays(day, 1);
        break;
      case "ArrowUp":
        next = addDays(day, -7);
        break;
      case "ArrowDown":
        next = addDays(day, 7);
        break;
      case "Home":
        next = weekOf(day, weekStart)[0];
        break;
      case "End":
        next = weekOf(day, weekStart)[6];
        break;
      case "PageUp":
        next = addMonths(day, event.shiftKey ? -12 : -1);
        break;
      case "PageDown":
        next = addMonths(day, event.shiftKey ? 12 : 1);
        break;
      case "Enter":
        event.preventDefault();
        newNote(day);
        return;
      default:
        return;
    }
    event.preventDefault();
    choose(next, true);
  }
</script>

<div class="mx-3 mb-2.5">
  <div class="mb-1 flex items-center gap-0.5 pl-1.5">
    <h2 id="calendar-month" class="m-0 min-w-0 flex-1 truncate text-sm font-semibold" aria-live="polite">{monthName.format(dateOf(day))}</h2>
    {#if day !== today}
      <Button variant="quiet" class="text-sm" onclick={() => choose(today)}>{t("calendar.today")}</Button>
    {/if}
    <IconButton icon="chevron-left" iconSize={16} label={t("calendar.previous")} onclick={() => choose(addMonths(day, -1))} />
    <IconButton icon="chevron-right" iconSize={16} label={t("calendar.next")} onclick={() => choose(addMonths(day, 1))} />
  </div>

  <table bind:this={grid} class="w-full table-fixed border-collapse" role="grid" aria-labelledby="calendar-month">
    <thead>
      <tr>
        {#each weeks[0] as weekday (weekday)}
          <th scope="col" abbr={longDay.format(dateOf(weekday))} class="pb-1 text-2xs font-semibold text-faint">
            {narrowDay.format(dateOf(weekday))}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each weeks as week (week[0])}
        <tr>
          {#each week as cell (cell)}
            {@const count = onDays.get(cell)?.length ?? 0}
            {@const chosen = cell === day}
            <td class="p-px" aria-selected={chosen}>
              <button
                type="button"
                data-day={cell}
                tabindex={chosen ? 0 : -1}
                aria-current={cell === today ? "date" : undefined}
                aria-label={t("calendar.day", { date: longDate.format(dateOf(cell)), count })}
                class={[
                  "tabular relative grid h-8 w-full place-items-center rounded-md pb-1 text-sm transition-colors coarse:h-10",
                  chosen
                    ? "bg-accent font-semibold text-on-accent"
                    : [
                        "hover:bg-hover",
                        cell === today ? "font-semibold text-accent" : cell.startsWith(month) ? "text-fg" : "text-faint",
                      ],
                ]}
                onclick={() => choose(cell)}
                ondblclick={() => newNote(cell)}
                {onkeydown}
              >
                {Number(cell.slice(8))}
                {#if count}
                  <!-- On the chosen day, over the accent, they're all its text's color. -->
                  <span class="absolute bottom-0.5 flex gap-0.5" aria-hidden="true">
                    {#each dotsOn(cell) as color (color)}
                      <span class={["size-1 rounded-full", chosen ? "bg-on-accent" : "bg-(--look)"]} style:--look={paletteVar(color)}></span>
                    {/each}
                  </span>
                {/if}
              </button>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
