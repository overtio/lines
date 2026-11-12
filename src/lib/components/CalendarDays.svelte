<script lang="ts" module>
  /** How far down the hours were scrolled, kept while lines is open, so opening a note and coming back keeps the place. */
  let scrolledTo: number | null = null;
</script>

<script lang="ts">
  // The Calendar's week or day, by the hour, in the note's place while no note is open: notes with
  // a time sit at it, those for the whole day above the hours. Clicking one opens it. Dragging down
  // an hour makes an event of that time (double-clicking, one an hour long), and across All day one
  // of whole days, its title typed where it is; a note at its time can
  // be dragged to another, or another day, and its bottom edge to change how long it is. A day's
  // heading shows that day alone.
  import { untrack } from "svelte";
  import { speak } from "../a11y";
  import { locale, t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import {
    addDays,
    allDayProperties,
    dateOf,
    type Day,
    dayOf,
    eventProperties,
    firstWeekday,
    itemsOn,
    type Placed,
    type Repeat,
    repeatOf,
    repeatText,
    retimed,
    type Slot,
    spansOf,
    USUAL_LENGTH,
    type Weekday,
    weekOf,
  } from "../notes/calendar";
  import { keyOf, setProperties } from "../notes/properties";
  import { longPress } from "../longPress";
  import { iconOf, noteColor } from "../notes/looks.svelte";
  import { type Entry, isClosed, notes } from "../notes/store.svelte";
  import { retitled } from "../notes/title";
  import { paletteVar } from "../palette";
  import { menuPoint } from "../popover";
  import { menuSections, ui } from "../ui.svelte";
  import { panes } from "../panes.svelte";
  import { prefs } from "../prefs.svelte";
  import CalendarHeader from "./CalendarHeader.svelte";

  /** `header`: its dates and controls over it, when the note's toolbar can't have them. */
  let { day, header = false }: { day: Day; header?: boolean } = $props();

  /** How tall an hour is, in pixels. */
  const HOUR = 48;
  /** How many items a day shows above its hours before the rest are a "more" that opens the day. */
  const ALL_DAY_SHOWN = 3;
  /** A new note made by double-clicking starts on the half hour above the pointer. */
  const SNAP = 30;
  /** Dragging moves by the quarter hour, and nothing is shorter. */
  const DRAG_SNAP = 15;
  /** How far the pointer goes before a press becomes a drag, in pixels. */
  const DRAG_START = 4;
  const DAY_MINUTES = 24 * 60;

  // The time now, for the line across today and to know which day today is.
  let now = $state(new Date());
  $effect(() => {
    const timer = setInterval(() => (now = new Date()), 30_000);
    return () => clearInterval(timer);
  });
  const today = $derived(dayOf(now));
  const minutesNow = $derived(now.getHours() * 60 + now.getMinutes());

  const view = $derived(prefs.calendarView);
  const days = $derived(view === "week" ? weekOf(day, firstWeekday(prefs.weekStart, locale)) : [day]);
  const items = $derived(itemsOn(notes.entries, days, prefs.calendarEdited));


  const longDate = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const shortDay = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const hourFormat = new Intl.DateTimeFormat(locale, { hour: "numeric" });
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });


  const at = (on: Day, minutes: number) => new Date(dateOf(on).getTime() + minutes * 60_000);
  const titleOf = (entry: Entry) => entry.meta.title || t("list.untitled");
  /** Its color as CSS: its own, its type's or a tag's, or the accent. */
  const lookOf = (entry: Entry) => paletteVar(noteColor(entry) ?? "accent");

  function choose(next: Day) {
    notes.setFilter({ kind: "calendar", day: next });
  }

  /** The note whose menu is open, outlined as a right-clicked note is in the list. */
  let menuFor = $state<string | null>(null);
  /** The note being renamed in place, and its name as typed so far. */
  let renaming = $state<{ id: string; draft: string; fresh?: boolean } | null>(null);

  /** An event's menu: opening it, renaming it, its icon and color, and the Trash. */
  function showMenu(entry: Entry, on: Day, x: number, y: number) {
    const { id } = entry.note;
    menuFor = id;
    ui.openMenu({
      x,
      y,
      label: titleOf(entry),
      items: menuSections(
        [
          { label: t("calendar.open"), icon: "file-text", run: () => open(entry, on) },
          // Beside the week, which stays.
          ...(panes.fits("right") && notes.selectedId !== id ? [{ label: t("list.openBeside"), icon: "columns-2" as const, run: () => panes.open(id, "right") }] : []),
          ...(panes.fits("down") && notes.selectedId !== id ? [{ label: t("list.openBelow"), icon: "rows-2" as const, run: () => panes.open(id, "down") }] : []),
        ],
        [
          // A locked note's title is in its locked text.
          ...(isClosed(entry.note) ? [] : [{ label: t("sidebar.rename"), icon: "pencil" as const, run: () => (renaming = { id, draft: entry.meta.title }) }]),
          ...(isClosed(entry.note) ? [] : [{ label: t("calendar.repeat"), icon: "repeat" as const, run: () => setTimeout(() => showRepeatMenu(entry, x, y)) }]),
          {
            label: t("list.iconAndColor"),
            icon: "smile",
            run: () =>
              (ui.iconPicker = {
                key: `note:${id}`,
                label: titleOf(entry),
                fallback: entry.note.icon ?? "file-text",
                icon: () => notes.get(id)?.note.icon ?? null,
                set: (icon) => notes.setIcon(id, icon),
                color: { get: () => notes.get(id)?.note.color ?? null, set: (color) => notes.setColor(id, color) },
                x,
                y,
              }),
          },
        ],
        [
          {
            label: t("list.trash"),
            icon: "trash",
            danger: true,
            run: () => {
              notes.trash(id);
              speak(t("list.didTrash"));
            },
          },
        ],
      ),
      onclose: () => (menuFor = null),
    });
  }

  const weekdayName = new Intl.DateTimeFormat(locale, { weekday: "long" });
  const monthDay = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" });

  /**
   * How often an event repeats, as choices made from its first day (Every Week on Tuesday, Every
   * Month on the Second Tuesday…), the one it has checked; a schedule typed that isn't among them
   * is shown as written, checked. Choosing one keeps when it stops, if it says.
   */
  function showRepeatMenu(entry: Entry, x: number, y: number) {
    const { id } = entry.note;
    const first = spansOf(entry.meta.properties)[0]?.from;
    if (!first) return;
    const date = dateOf(first);
    const weekday = date.getDay() as Weekday;
    const week = Math.ceil(date.getDate() / 7);
    const nth = week === 5 ? -1 : week;
    const current = repeatOf(entry.meta.properties);
    // Its schedule without when it stops, and with its first day's weekday left as said, to compare with the choices.
    const plain = (repeat: Repeat | null) =>
      repeat && repeatText({ ...repeat, until: undefined, times: undefined, ...(repeat.weekdays?.join() === String(weekday) && { weekdays: undefined }) });
    const options: { label: string; repeat: Repeat | null }[] = [
      { label: t("calendar.repeatNever"), repeat: null },
      { label: t("calendar.repeatDaily"), repeat: { unit: "day", every: 1 } },
      { label: t("calendar.repeatWeekdays"), repeat: { unit: "week", every: 1, weekdays: [1, 2, 3, 4, 5] } },
      { label: t("calendar.repeatWeekly", { weekday: weekdayName.format(date) }), repeat: { unit: "week", every: 1 } },
      { label: t("calendar.repeatBiweekly", { weekday: weekdayName.format(date) }), repeat: { unit: "week", every: 2 } },
      { label: t("calendar.repeatMonthly", { day: date.getDate() }), repeat: { unit: "month", every: 1 } },
      {
        label: t("calendar.repeatMonthlyNth", { nth: t(nth === -1 ? "calendar.nthLast" : `calendar.nth${nth as 1 | 2 | 3 | 4}`), weekday: weekdayName.format(date) }),
        repeat: { unit: "month", every: 1, nth, weekday },
      },
      { label: t("calendar.repeatYearly", { date: monthDay.format(date) }), repeat: { unit: "year", every: 1 } },
    ];
    const chosen = options.find((option) => plain(option.repeat) === plain(current));
    const written = entry.meta.properties.find((property) => keyOf(property.key) === "repeat")?.value;
    const choose = (repeat: Repeat | null, label: string) => {
      const body = notes.get(id)?.note.body;
      if (body === undefined) return;
      const ending = current && { until: current.until, times: current.times };
      notes.edit(id, setProperties(body, { repeat: repeat && repeatText({ ...repeat, ...ending }) }));
      speak(repeat ? t("calendar.didRepeat", { schedule: label }) : t("calendar.didStopRepeating"));
    };
    menuFor = id;
    ui.openMenu({
      x,
      y,
      label: t("calendar.repeat"),
      items: [
        ...(current && !chosen && written ? [{ label: written, checked: true, run: () => {} }, "separator" as const] : []),
        ...options.map((option) => ({ label: option.label, checked: option === chosen, run: () => choose(option.repeat, option.label) })),
      ],
      onclose: () => (menuFor = null),
    });
  }

  function oncontextmenu(event: MouseEvent, entry: Entry, on: Day) {
    event.preventDefault();
    const { x, y } = menuPoint(event);
    showMenu(entry, on, x, y);
  }

  /** Keeps the name typed (Enter, or leaving the field), as the note's title; Esc keeps it as it was. ⌘Z puts it back. */
  function finishRename(keep = true) {
    const done = renaming;
    renaming = null;
    const entry = done && notes.get(done.id);
    const title = done?.draft.trim();
    if (!entry) return;
    // A new event left without a title isn't kept, as an empty new note isn't.
    if (done.fresh && (!keep || !title)) return void notes.deleteForever(entry.note.id);
    if (!keep || !title || title === entry.meta.title) return;
    const body = retitled(entry.note, title);
    if (!body) return;
    // Naming a new event isn't an edit to take back with ⌘Z.
    if (done.fresh) notes.update(entry.note.id, body);
    else notes.edit(entry.note.id, body);
  }

  function onRenameKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") finishRename();
    else if (event.key === "Escape") finishRename(false);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  /** Whether the note being renamed has its field on `on`: the first day it shows on, for one shown on several. */
  const renamingOn = (entry: Entry, on: Day) =>
    renaming?.id === entry.note.id &&
    on === days.find((day) => items.get(day)?.allDay.includes(entry) || items.get(day)?.timed.some((placed) => placed.entry === entry));

  const focusAndSelect = (input: HTMLInputElement) => {
    input.focus();
    input.select();
  };

  /** Opens a note from the day it's on, so the list beside shows that day, with the note in it. */
  function open(entry: Entry, on: Day) {
    choose(on);
    notes.select(entry.note.id);
  }

  /** A day alone: from its heading, or its "more". */
  function showDay(on: Day) {
    choose(on);
    prefs.calendarView = "day";
  }

  /** A new event at `slot`, its title typed where it is, with its day in the list. */
  function newEvent(slot: Slot) {
    choose(slot.day);
    named(notes.create(undefined, { properties: eventProperties(slot) }, { open: false }));
  }

  /** A new event for whole days, from one to the other, named as `newEvent`'s is. */
  function newAllDay(a: Day, b: Day) {
    choose(a <= b ? a : b);
    named(notes.create(undefined, { properties: allDayProperties(a, b) }, { open: false }));
  }

  /** A new event's title is typed where it is, on the Calendar; with none, it's gone again. */
  function named(id: string) {
    renaming = { id, draft: "", fresh: true };
  }

  /** Dragging across All day to make an event of those days: where it began and where it is now. */
  let dayDrag = $state<{ from: Day; to: Day; x: number; moved: boolean } | null>(null);

  /** The day whose All day cell is under `x`. */
  function allDayAt(x: number): Day {
    let cell: HTMLElement | undefined;
    for (const each of document.querySelectorAll<HTMLElement>("[data-all-day]")) if (!cell || x >= each.getBoundingClientRect().left) cell = each;
    return cell!.dataset.allDay!;
  }

  function startDayDrag(event: PointerEvent & { currentTarget: HTMLElement }, on: Day) {
    if (event.button !== 0 || event.pointerType === "touch" || event.target !== event.currentTarget) return;
    dayDrag = { from: on, to: on, x: event.clientX, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onDayDragMove(event: PointerEvent) {
    if (!dayDrag) return;
    if (!dayDrag.moved && Math.abs(event.clientX - dayDrag.x) < DRAG_START) return;
    dayDrag.moved = true;
    dayDrag.to = allDayAt(event.clientX);
  }

  function onDayDragEnd() {
    const done = dayDrag;
    dayDrag = null;
    if (done?.moved) newAllDay(done.from, done.to);
  }

  /** Whether `on` is among the days being dragged across, and if it's the first of them. */
  const dragging = (on: Day) => {
    if (!dayDrag?.moved) return null;
    const [from, to] = dayDrag.from <= dayDrag.to ? [dayDrag.from, dayDrag.to] : [dayDrag.to, dayDrag.from];
    return on >= from && on <= to ? { first: on === from } : null;
  };

  /** Double-clicking an hour: an event an hour long, from the half hour above the pointer. */
  function newEventAt(event: MouseEvent & { currentTarget: HTMLElement }, on: Day) {
    if (event.target !== event.currentTarget) return;
    const start = Math.min(Math.floor((event.offsetY / HOUR) * (60 / SNAP)) * SNAP, DAY_MINUTES - USUAL_LENGTH);
    newEvent({ day: on, start, end: start + USUAL_LENGTH });
  }

  /**
   * A drag under way: making an event, moving a note, or changing how long it is. `slot` is where
   * it would go, shown as it moves; nothing changes until the pointer is let go.
   */
  interface Drag {
    kind: "new" | "move" | "resize";
    placed?: Placed<Entry>;
    /** Where the press was, on the screen and in the day. */
    x: number;
    y: number;
    minutes: number;
    slot: Slot;
    moved: boolean;
  }
  let drag = $state<Drag | null>(null);
  /** A drag just ended on a note: the click that follows isn't one that opens it. */
  let dragged = false;
  let grid = $state<HTMLElement>();

  const snap = (minutes: number, round = Math.round) => round(minutes / DRAG_SNAP) * DRAG_SNAP;
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  /** The day whose column is under `x`, and the time at `y`, in minutes. */
  function pointAt(x: number, y: number): { day: Day; minutes: number } {
    let column: HTMLElement | undefined;
    for (const each of grid!.querySelectorAll<HTMLElement>("[data-column]")) if (!column || x >= each.getBoundingClientRect().left) column = each;
    const top = column!.getBoundingClientRect().top;
    return { day: column!.dataset.column!, minutes: clamp(((y - top) / HOUR) * 60, 0, DAY_MINUTES) };
  }

  function startDrag(event: PointerEvent & { currentTarget: HTMLElement }, kind: Drag["kind"], on: Day, placed?: Placed<Entry>) {
    // A finger scrolls the hours; dragging is for a mouse, a trackpad or a pen.
    if (event.button !== 0 || event.pointerType === "touch") return;
    if (kind === "new" && event.target !== event.currentTarget) return;
    event.stopPropagation();
    dragged = false;
    const { minutes } = pointAt(event.clientX, event.clientY);
    const start = snap(minutes, Math.floor);
    const slot = placed ? { day: on, start: placed.start, end: placed.end } : { day: on, start, end: start + DRAG_SNAP };
    drag = { kind, placed, x: event.clientX, y: event.clientY, minutes, slot, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onDragMove(event: PointerEvent) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_START) return;
    drag.moved = true;
    const point = pointAt(event.clientX, event.clientY);
    const { slot, placed } = drag;
    if (drag.kind === "new") {
      const from = snap(drag.minutes, Math.floor);
      const to = snap(point.minutes);
      drag.slot = { day: slot.day, start: Math.min(from, to), end: Math.max(to, from + DRAG_SNAP) };
    } else if (drag.kind === "move" && placed) {
      const length = placed.end - placed.start;
      const start = clamp(placed.start + snap(point.minutes - drag.minutes), 0, DAY_MINUTES - length);
      // A repeating note moves to another time, all its times together, but not another day (from here).
      drag.slot = { day: placed.span.shift === undefined ? point.day : slot.day, start, end: start + length };
    } else if (placed) {
      drag.slot = { ...slot, end: clamp(snap(point.minutes), placed.start + DRAG_SNAP, DAY_MINUTES) };
    }
  }

  function onDragEnd() {
    const done = drag;
    drag = null;
    if (!done?.moved) return;
    const { slot, placed } = done;
    if (done.kind === "new") return newEvent(slot);
    if (!placed) return;
    dragged = true;
    const unchanged = slot.day === placed.span.from && slot.start === placed.start && slot.end === placed.end;
    if (unchanged) return;
    // One time of a repeating note: its own dates, the first time, move the same.
    const own = placed.span.shift ? { ...slot, day: addDays(slot.day, -placed.span.shift) } : slot;
    notes.edit(placed.entry.note.id, retimed(placed.entry.note.body, placed.span, own));
    choose(slot.day);
    speak(t("calendar.moved", { title: titleOf(placed.entry), time: timeRange(slot) }));
  }

  const timeRange = ({ day: on, start, end }: Slot) => timeFormat.formatRange(at(on, start), at(on, end));

  function openPlaced(placed: Placed<Entry>, on: Day) {
    if (dragged) dragged = false;
    else open(placed.entry, on);
  }

  // Opens where it was left, or else at the hour before now on today's week or day, or at the start of a working day.
  function scrollToWorkingHours(scroller: HTMLElement) {
    untrack(() => {
      const from = days.includes(today) ? Math.max(0, minutesNow - 60) : 7 * 60;
      scroller.scrollTop = scrolledTo ?? (from / 60) * HOUR;
    });
  }

  const columns = $derived(`3.5rem repeat(${days.length}, minmax(0, 1fr))`);
</script>

<!-- An event's title, after its icon (its own, or its type's) in its color. -->
{#snippet eventTitle(entry: Entry, on: Day)}
  {@const icon = iconOf(entry)}
  {#if icon}<Icon name={icon} size={12} strokeWidth={2} class="mr-1 inline-block -translate-y-px align-middle text-(--look)" />{/if}<span
    class={[renamingOn(entry, on) && "invisible"]}>{titleOf(entry)}</span
  >{#if repeatOf(entry.meta.properties)}<Icon
      name="repeat"
      size={11}
      strokeWidth={2}
      class="ml-1 inline-block -translate-y-px align-middle text-muted"
    />{/if}
{/snippet}

<!--
  The field an event's name is changed in: its title, in its place and its type, typed over; `inset`
  is how far in the title starts, past the event's edge (and its icon).
-->
{#snippet renameField(entry: Entry, className: string, inset: number)}
  <input
    class="absolute z-2 border-0 bg-transparent p-0 pr-1.5 text-xs text-fg outline-none {className}"
    style:padding-left="{inset + (iconOf(entry) ? 16 : 0)}px"
    aria-label={t("calendar.eventName")}
    autocomplete="off"
    spellcheck="false"
    bind:value={renaming!.draft}
    onkeydown={onRenameKeydown}
    onblur={() => finishRename()}
    {@attach focusAndSelect}
  />
{/snippet}

<svelte:window
  onkeydown={(event) => {
    if (event.key !== "Escape") return;
    drag = null;
    dayDrag = null;
  }}
/>

<!-- `calendar-days`: for styles to reach it by, as they do the panes (docs/plugins.md). -->
<section class="calendar-days flex min-h-0 flex-1 flex-col" aria-labelledby="calendar-range">
  <!-- Its dates and moving between them, here while tabs have the note's toolbar (App.svelte puts them there otherwise). -->
  {#if header}
    <div class="flex flex-wrap items-center gap-2 px-5 pb-3"><CalendarHeader {day} /></div>
  {/if}

  <!-- The days' headings and what's on them all day. The same gutter as the hours' scroll bar, so the columns line up. -->
  <div class="grid shrink-0 overflow-y-hidden border-b border-line [scrollbar-gutter:stable]" style:grid-template-columns={columns}>
    <span></span>
    {#each days as on (on)}
      {@const isToday = on === today}
      <button
        type="button"
        class={[
          "mx-0.5 mb-1 flex items-baseline justify-center gap-1.5 rounded-md py-1 text-sm transition-colors hover:bg-hover",
          on === day && view === "week" ? "bg-active" : "",
          isToday ? "text-accent" : "text-muted",
        ]}
        aria-label={longDate.format(dateOf(on))}
        aria-current={isToday ? "date" : undefined}
        onclick={() => showDay(on)}
      >
        {shortDay.format(dateOf(on))}
        <span class={["tabular text-md font-semibold", isToday ? "text-accent" : "text-fg"]}>{Number(on.slice(8))}</span>
      </button>
    {/each}

    <span class="self-start pt-1 pr-2 text-right text-2xs text-faint">{t("calendar.allDay")}</span>
    {#each days as on (on)}
      {@const allDay = items.get(on)?.allDay ?? []}
      {@const ghost = dragging(on)}
      <!-- Pressing on the cell itself, not on what's in it, makes an event of whole days: dragged across them, or double-clicked. -->
      <ul
        class={["m-0 flex min-h-7 min-w-0 list-none flex-col gap-0.5 border-l border-line p-0.5 pb-1.5", dayDrag?.moved && "select-none"]}
        aria-label={t("calendar.allDayOn", { date: longDate.format(dateOf(on)) })}
        data-all-day={on}
        ondblclick={(event) => event.target === event.currentTarget && newAllDay(on, on)}
        onpointerdown={(event) => startDayDrag(event, on)}
        onpointermove={onDayDragMove}
        onpointerup={onDayDragEnd}
        onpointercancel={() => (dayDrag = null)}
      >
        {#if ghost}
          <!-- Where the new event goes, across the days dragged over; named on its first. -->
          <li class="pointer-events-none truncate rounded-sm bg-accent/30 px-1.5 py-0.5 text-xs text-fg" aria-hidden="true">
            {ghost.first ? t("calendar.newEvent") : "\u00a0"}
          </li>
        {/if}
        {#each allDay.slice(0, allDay.length > ALL_DAY_SHOWN ? ALL_DAY_SHOWN - 1 : ALL_DAY_SHOWN) as entry (entry.note.id)}
          <li class="relative min-w-0">
            <button
              type="button"
              class={[
                "block w-full truncate rounded-sm bg-(--look)/15 px-1.5 py-0.5 text-left text-xs text-fg transition-colors hover:bg-(--look)/25",
                menuFor === entry.note.id && "inset-ring-2 inset-ring-accent",
                renaming?.id === entry.note.id && "inset-ring-2 inset-ring-accent-soft",
              ]}
              style:--look={lookOf(entry)}
              onclick={() => open(entry, on)}
              oncontextmenu={(event) => oncontextmenu(event, entry, on)}
              {@attach longPress((x, y) => showMenu(entry, on, x, y))}
            >
              {@render eventTitle(entry, on)}
            </button>
            {#if renamingOn(entry, on)}{@render renameField(entry, "inset-0", 6)}{/if}
          </li>
        {/each}
        {#if allDay.length > ALL_DAY_SHOWN}
          <li>
            <button type="button" class="w-full rounded-sm px-1.5 text-left text-xs text-muted hover:bg-hover hover:text-fg" onclick={() => showDay(on)}>
              {t("calendar.more", { count: allDay.length - ALL_DAY_SHOWN + 1 })}
            </button>
          </li>
        {/if}
      </ul>
    {/each}
  </div>

  <!-- The hours. -->
  <div
    class="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
    {@attach scrollToWorkingHours}
    onscroll={(event) => (scrolledTo = event.currentTarget.scrollTop)}
  >
    <div class="relative grid" bind:this={grid} style:grid-template-columns={columns} style:height="{24 * HOUR}px" style:--hour="{HOUR}px">
      <div class="relative" aria-hidden="true">
        {#each { length: 23 }, i (i)}
          <span class="tabular absolute right-2 -translate-y-1/2 text-2xs text-faint" style:top="{(i + 1) * HOUR}px">{hourFormat.format(at(day, (i + 1) * 60))}</span>
        {/each}
      </div>
      {#each days as on (on)}
        {@const timed = items.get(on)?.timed ?? []}
        <!-- Pressing on the column itself, not on what's in it, makes an event: dragged, or double-clicked. -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class={["hours relative border-l border-line", drag?.moved && "select-none"]}
          data-column={on}
          ondblclick={(event) => newEventAt(event, on)}
          onpointerdown={(event) => startDrag(event, "new", on)}
          onpointermove={onDragMove}
          onpointerup={onDragEnd}
          onpointercancel={() => (drag = null)}
        >
          <ul class="m-0 list-none p-0" aria-label={longDate.format(dateOf(on))}>
            {#each timed as placed (`${placed.entry.note.id}-${placed.nth}`)}
              {@const time = timeRange({ day: on, start: placed.start, end: placed.end })}
              {@const held = drag?.moved && drag.placed?.entry.note.id === placed.entry.note.id && drag.placed.nth === placed.nth ? drag.kind : null}
              <li
                class={[
                  "absolute px-px transition-opacity",
                  // Moved, it stays faded where it was; stretched, it's the one shown stretching, so not here too.
                  held === "move" && "opacity-40",
                  held === "resize" && "opacity-0",
                ]}
                style:top="{(placed.start / 60) * HOUR}px"
                style:height="{((placed.end - placed.start) / 60) * HOUR}px"
                style:left="{(placed.column / placed.columns) * 100}%"
                style:width="{100 / placed.columns}%"
              >
                <button
                  type="button"
                  class={[
                    "relative flex size-full cursor-default flex-col items-start overflow-hidden rounded-sm bg-(--look)/15 py-0.5 pr-1.5 pl-2.5 text-left before:absolute before:inset-y-[3px] before:left-[3px] before:w-[3px] before:rounded-full before:bg-(--look) text-xs leading-snug text-fg transition-colors hover:bg-(--look)/25",
                    menuFor === placed.entry.note.id && "inset-ring-2 inset-ring-accent",
                    renaming?.id === placed.entry.note.id && "inset-ring-2 inset-ring-accent-soft",
                  ]}
                  style:--look={lookOf(placed.entry)}
                  aria-label={t(repeatOf(placed.entry.meta.properties) ? "calendar.atRepeating" : "calendar.at", { title: titleOf(placed.entry), time })}
                  onclick={() => openPlaced(placed, on)}
                  oncontextmenu={(event) => oncontextmenu(event, placed.entry, on)}
                  {@attach longPress((x, y) => showMenu(placed.entry, on, x, y))}
                  onpointerdown={(event) => startDrag(event, "move", on, placed)}
                  onpointermove={onDragMove}
                  onpointerup={onDragEnd}
                  onpointercancel={() => (drag = null)}
                >
                  <span class="w-full truncate font-semibold">{@render eventTitle(placed.entry, on)}</span>
                  {#if placed.end - placed.start >= 45}<span class="w-full truncate text-muted">{time}</span>{/if}
                </button>
                {#if renamingOn(placed.entry, on)}{@render renameField(placed.entry, "inset-x-px top-0 h-[calc(1.375em+4px)] leading-snug font-semibold", 10)}{/if}
                <!-- Its bottom edge, to change how long it is: not a due date's, which is a moment. -->
                {#if placed.span.key === "date" || placed.span.key === "start"}
                  <span
                    class="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                    aria-hidden="true"
                    onpointerdown={(event) => startDrag(event, "resize", on, placed)}
                    onpointermove={onDragMove}
                    onpointerup={onDragEnd}
                    onpointercancel={() => (drag = null)}
                  ></span>
                {/if}
              </li>
            {/each}
          </ul>
          {#if drag?.moved && drag.slot.day === on}
            {@const { slot } = drag}
            <!-- Where it would go, over where it is: solid, so only its new time reads where they meet. -->
            <div
              class="pointer-events-none absolute inset-x-0 z-1 flex flex-col overflow-hidden rounded-sm bg-[color-mix(in_srgb,var(--look)_30%,var(--bg))] py-0.5 pr-1.5 pl-2.5 text-xs before:absolute before:inset-y-[3px] before:left-[3px] before:w-[3px] before:rounded-full before:bg-(--look) leading-snug text-fg shadow-segment"
              style:--look={drag.placed ? lookOf(drag.placed.entry) : "var(--accent)"}
              style:top="{(slot.start / 60) * HOUR}px"
              style:height="{((slot.end - slot.start) / 60) * HOUR}px"
              aria-hidden="true"
            >
              <span class="truncate font-semibold">{#if drag.placed}{@render eventTitle(drag.placed.entry, on)}{:else}{t("calendar.newEvent")}{/if}</span>
              <span class="tabular truncate text-muted">{timeRange(slot)}</span>
            </div>
          {/if}
          {#if on === today}
            <div class="pointer-events-none absolute inset-x-0 h-0.5 -translate-y-1/2 bg-accent" style:top="{(minutesNow / 60) * HOUR}px" aria-hidden="true">
              <span class="absolute -top-[3px] -left-1 size-2 rounded-full bg-accent"></span>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  /* A line across each day at every hour, in the theme's divider color. */
  .hours {
    background-image: linear-gradient(to bottom, var(--border) 1px, transparent 1px);
    background-size: 100% var(--hour);
    background-position: 0 -0.5px;
  }
</style>
