<script lang="ts">
  import { tick, untrack } from "svelte";
  import { speak } from "../a11y";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import type { IconName } from "../icons/icons";
  import { formatDate } from "../format";
  import { lockedNotes } from "../notes/locked.svelte";
  import { isClosed, notes, type Entry } from "../notes/store.svelte";
  import { longPress } from "../longPress";
  import { copyText, isApple, reducedMotion } from "../platform";
  import { deletePicked, pinPicked, restorePicked, tagPicked, trashPicked } from "../notes/picked";
  import { menuPoint } from "../popover";
  import { prefs } from "../prefs.svelte";
  import { typeIcons } from "../notes/tagIcons.svelte";
  import { ui } from "../ui.svelte";
  import { canFloat, floatingOpen, toggleFloating } from "../windows/floating";

  let {
    entry,
    selected,
    picked,
    tabbable,
    now,
    open,
    onswipe,
    onkeydown,
  }: {
    entry: Entry;
    /** Its note is the open one. */
    selected: boolean;
    /** It's among the notes picked to act on together (⌘-click, ⇧-click, ⌘A). */
    picked: boolean;
    /** Whether Tab lands on this row; the list's other rows are reached with the arrow keys. */
    tabbable: boolean;
    now: Date;
    /** Whether this row may stay swiped open; turning it off closes the row. */
    open: boolean;
    /** Reports a row opening or closing, so only one is open at a time. */
    onswipe: (open: boolean) => void;
    onkeydown: (event: KeyboardEvent) => void;
  } = $props();

  interface Action {
    label: string;
    menuLabel: string;
    /** What screen readers hear once it's done. */
    done: string;
    icon: IconName;
    tone: "pin" | "danger" | "success";
    /** Whether swiping all the way across runs it; otherwise it has to be tapped. */
    full: boolean;
    /** Whether the note leaves the current list, so its row folds away first. */
    leaves: boolean;
    run: () => void;
  }

  /** Width of a revealed action. */
  const ACTION_W = 76;
  /** Share of the row's width past which letting go runs the action. */
  const FULL = 0.4;
  /** How stiff the rubber band is past the revealed action; lower is stiffer. */
  const STRETCH = 0.7;
  /** Matches the slide transition in the styles. */
  const SLIDE_MS = 300;

  const id = $derived(entry.note.id);
  /** The icon of its type (`type: person`), which a note of that type has unless it has its own. */
  const typeIcon = $derived(entry.meta.type ? typeIcons.get(entry.meta.type) : undefined);
  const icon = $derived(entry.note.icon ?? typeIcon);

  // Screen readers call the row by its title, pinned or locked (hidden text by the icons) and date;
  // the excerpt is its description, which they read after a pause, so moving through the list is quick.

  // Swipe right for the leading action and left for the trailing one, like Mail.
  const leading = $derived<Action>(
    entry.note.trashed
      ? {
          label: t("list.swipeRestore"),
          menuLabel: t("list.restore"),
          done: t("list.didRestore"),
          icon: "restore",
          tone: "success",
          full: true,
          leaves: true,
          run: () => notes.restore(id),
        }
      : entry.note.pinned
        ? {
            label: t("list.swipeUnpin"),
            menuLabel: t("list.unpin"),
            done: t("list.didUnpin"),
            icon: "pin-off",
            tone: "pin",
            full: true,
            leaves: false,
            run: () => notes.togglePin(id),
          }
        : {
            label: t("list.swipePin"),
            menuLabel: t("list.pin"),
            done: t("list.pinned"),
            icon: "pin",
            tone: "pin",
            full: true,
            leaves: false,
            run: () => notes.togglePin(id),
          },
  );
  const trailing = $derived<Action>(
    entry.note.trashed
      ? {
          label: t("list.swipeDelete"),
          menuLabel: t("list.deleteForever"),
          done: t("list.didDelete"),
          icon: "trash",
          tone: "danger",
          full: false,
          leaves: true,
          run: () => notes.deleteForever(id),
        }
      : {
          label: t("list.swipeTrash"),
          menuLabel: t("list.trash"),
          done: t("list.didTrash"),
          icon: "trash",
          tone: "danger",
          full: true,
          leaves: true,
          run: () => notes.trash(id),
        },
  );

  let li: HTMLLIElement;
  let item: HTMLButtonElement;
  let offset = $state(0);
  let width = $state(320);
  let dragging = $state(false);
  /** How far the finger (or trackpad) has travelled; `offset` is that after resistance. */
  let travel = 0;
  let menuOpen = $state(false);
  let leaving = false;
  let suppressClick = false;

  // The actions sit under the row and move with its edge, reaching up to 20px under its rounded
  // corner but never past the row's far side. Moving them (rather than resizing) keeps a swipe
  // free of layout work.
  const under = $derived(Math.min(20, Math.abs(offset)));
  const leadingX = $derived(offset > 0 ? Math.min(offset + under, width) : 0);
  const trailingX = $derived(offset < 0 ? Math.max(offset - under, -width) : 0);

  const armed = $derived.by(() => {
    const action = offset > 0 ? leading : trailing;
    return dragging && action.full && Math.abs(offset) > width * FULL;
  });

  $effect(() => {
    if (armed) navigator.vibrate?.(8);
  });

  $effect(() => {
    if (!open) untrack(() => !dragging && offset && close());
  });

  // While open, a press anywhere else closes the row.
  const swiped = $derived(offset !== 0);

  $effect(() => {
    if (!swiped || dragging) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!li.contains(event.target as Node)) close();
    };
    addEventListener("pointerdown", onPointerDown, true);
    return () => removeEventListener("pointerdown", onPointerDown, true);
  });

  /**
   * Follows the finger 1:1 until the action is fully shown, then stretches like a rubber band
   * that gets stiffer the further it's pulled (the curve iOS uses), never passing the row's width.
   */
  function resist(x: number) {
    const distance = Math.abs(x);
    if (distance <= ACTION_W) return x;
    const room = ((x > 0 ? leading : trailing).full ? width : ACTION_W + 36) - ACTION_W;
    const over = distance - ACTION_W;
    return Math.sign(x) * (ACTION_W + room * (1 - 1 / ((over * STRETCH) / room + 1)));
  }

  function begin() {
    width = li.offsetWidth;
    // A settled row is closed or shows its action, both on the 1:1 part of the curve.
    travel = offset;
    dragging = true;
    onswipe(true);
  }

  function end(velocity: number) {
    dragging = false;
    const direction = Math.sign(offset);
    const distance = Math.abs(offset);
    const action = direction > 0 ? leading : trailing;
    if (action.full && distance > width * FULL) return perform(action);
    // A flick opens or closes the row even if it didn't travel far.
    const toward = velocity * direction;
    if (toward > -0.3 && (distance > ACTION_W * 0.6 || toward > 0.3)) offset = direction * ACTION_W;
    else close();
  }

  function close() {
    if (leaving) return;
    offset = 0;
    onswipe(false);
  }

  function perform(action: Action) {
    dragging = false;
    // The row moves or goes away, perhaps with focus in it (given back by the menu as it closed):
    // focus stays in the list, and screen readers hear what happened.
    const run = () => {
      const hadFocus = li.contains(document.activeElement);
      action.run();
      speak(action.done);
      if (hadFocus) refocus();
    };
    const still = reducedMotion.matches;
    if (!action.leaves) {
      // Let the row slide shut before it jumps to its new place.
      const delay = offset && !still ? SLIDE_MS : 0;
      close();
      setTimeout(run, delay);
      return;
    }
    const swiped = offset !== 0;
    onswipe(false);
    leaving = true;
    if (swiped) offset = Math.sign(offset) * width;
    const { height, paddingTop } = getComputedStyle(li);
    li.animate([{ height, paddingTop, opacity: 1 }, { height: "0px", paddingTop: "0px", opacity: 0 }], {
      duration: still ? 0 : 220,
      delay: swiped && !still ? 160 : 0,
      easing: getComputedStyle(li).getPropertyValue("--ease-sheet"),
      fill: "forwards",
    })
      .finished.catch(() => {})
      .then(run);
  }

  /** Focus back on this note's row once the list has redrawn, or on the row Tab lands on if it left. */
  function refocus() {
    requestAnimationFrame(() => {
      const list = document.querySelector(".note-list");
      const row = list?.querySelector<HTMLElement>(`[data-id="${id}"]`) ?? list?.querySelector<HTMLElement>('.item[tabindex="0"]');
      row?.focus({ preventScroll: true });
    });
  }

  // Touch and pens drag the row. Mice right-click instead, and trackpads scroll sideways (below).
  let gesture: {
    pointerId: number;
    x: number;
    y: number;
    from: number;
    horizontal: boolean;
    lastX: number;
    lastT: number;
    velocity: number;
  } | null = null;

  function onpointerdown(event: PointerEvent) {
    suppressClick = false;
    if (event.pointerType === "mouse" || event.button !== 0) return;
    const { pointerId, clientX: x, clientY: y, timeStamp } = event;
    gesture = { pointerId, x, y, from: 0, horizontal: false, lastX: x, lastT: timeStamp, velocity: 0 };
  }

  // A long press opens the menu, since iOS has no right-click. (Moving 10px cancels it, the
  // same distance that starts a swipe.)
  function onlongpress(x: number, y: number) {
    gesture = null;
    showMenu(x, y);
  }

  function onpointermove(event: PointerEvent) {
    const g = gesture;
    if (!g || event.pointerId !== g.pointerId) return;
    if (!g.horizontal) {
      const dx = event.clientX - g.x;
      const dy = event.clientY - g.y;
      if (Math.hypot(dx, dy) < 10) return;
      // Mostly vertical: a scroll, which the browser handles.
      if (Math.abs(dy) > Math.abs(dx)) {
        gesture = null;
        return;
      }
      g.horizontal = true;
      g.x = event.clientX;
      begin();
      g.from = travel;
      item.setPointerCapture(event.pointerId);
    }
    const dt = event.timeStamp - g.lastT;
    if (dt > 0) g.velocity = 0.6 * ((event.clientX - g.lastX) / dt) + 0.4 * g.velocity;
    g.lastX = event.clientX;
    g.lastT = event.timeStamp;
    travel = g.from + event.clientX - g.x;
    offset = resist(travel);
  }

  function onpointerup(event: PointerEvent) {
    const g = gesture;
    if (!g || event.pointerId !== g.pointerId) return;
    gesture = null;
    if (!g.horizontal) return;
    suppressClick = true;
    end(event.type === "pointercancel" ? 0 : g.velocity);
  }

  /**
   * Turns a wheel delta into how far the row moves. Safari and the Mac app report whether macOS
   * "natural scrolling" is on, so by default the row follows the fingers either way; elsewhere
   * natural scrolling is assumed. The Trackpad setting can reverse it.
   */
  function rowDelta(event: WheelEvent & { webkitDirectionInvertedFromDevice?: boolean }) {
    const natural = event.webkitDirectionInvertedFromDevice ?? true;
    return -event.deltaX * (natural ? 1 : -1) * (prefs.swipe === "reversed" ? -1 : 1);
  }

  // Two-finger sideways swipes on a trackpad arrive as horizontal wheel events.
  $effect(() => {
    let settle: ReturnType<typeof setTimeout> | undefined;
    let quietUntil = 0;
    const onWheel = (event: WheelEvent) => {
      if (!settle) {
        if (leaving) return;
        // The tail of momentum from the last swipe: keep ignoring it until it dies down.
        if (event.timeStamp < quietUntil) {
          if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) event.preventDefault();
          quietUntil = event.timeStamp + 120;
          return;
        }
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        begin();
      }
      event.preventDefault();
      travel += rowDelta(event);
      offset = resist(travel);
      clearTimeout(settle);
      // There's no "fingers lifted" event, so settle once the deltas (including momentum) stop.
      settle = setTimeout(() => {
        settle = undefined;
        quietUntil = performance.now() + 120;
        end(0);
      }, 120);
    };
    li.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      clearTimeout(settle);
      li.removeEventListener("wheel", onWheel);
    };
  });

  function onclick(event: MouseEvent) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (offset) return close();
    // ⌘-click (Ctrl-click elsewhere; on a Mac that's a right-click) picks it along with others,
    // ⇧-click every note from the last one clicked. A click on its own picks just this one.
    if (isApple ? event.metaKey : event.ctrlKey) return notes.togglePick(id);
    if (event.shiftKey) return notes.pickRange(id);
    notes.clearPicks();
    notes.select(id);
    // Opened from the keyboard (Enter or Space, which click with no pointer: detail 0), the note's
    // text takes focus, ready to read or write. A click leaves focus in the list, for ↑ and ↓.
    // (On a phone, the open note's own focus handling applies.)
    if (event.detail === 0 && ui.layout !== "narrow") void tick().then(() => document.querySelector<HTMLElement>("main .cm-content")?.focus());
  }

  function oncontextmenu(event: MouseEvent) {
    event.preventDefault();
    gesture = null;
    // Android fires this after a long press too, when our own menu is already up.
    if (menuOpen) return;
    const { x, y } = menuPoint(event);
    showMenu(x, y);
  }

  /** Locking it, or for a locked note that's open, locking it again or taking the lock off. */
  function lockItems() {
    const { locked, trashed } = entry.note;
    if (trashed || (locked && !locked.open)) return [];
    if (!locked) return [{ label: t("list.lock"), icon: "lock" as const, run: () => lockedNotes.lockNote(id) }];
    return [
      { label: t("list.lockNow"), icon: "lock" as const, run: () => void lockedNotes.close() },
      { label: t("list.removeLock"), icon: "lock-open" as const, run: () => void notes.removeLock(id) },
    ];
  }

  /** The menu of every picked note, when this is one of them. */
  function showPickedMenu(x: number, y: number) {
    const entries = notes.pickedEntries;
    const trashed = notes.filter.kind === "trash";
    menuOpen = true;
    ui.openMenu({
      x,
      y,
      label: t("list.pickedMenu", { count: entries.length }),
      items: trashed
        ? [
            { label: t("list.restore"), icon: "restore", run: restorePicked },
            "separator",
            { label: t("list.deleteForever"), icon: "trash", danger: true, run: deletePicked },
          ]
        : [
            entries.some((e) => !e.note.pinned)
              ? { label: t("list.pin"), icon: "pin", run: pinPicked }
              : { label: t("list.unpin"), icon: "pin-off", run: pinPicked },
            { label: t("list.addTag"), icon: "hash", run: () => tagPicked(x, y) },
            "separator",
            { label: t("list.trash"), icon: "trash", danger: true, run: trashPicked },
          ],
      onclose: () => (menuOpen = false),
    });
  }

  function showMenu(x: number, y: number) {
    if (offset) close();
    if (picked && notes.pickedEntries.length > 1) return showPickedMenu(x, y);
    // A note that isn't picked has its own menu, and the others are let go.
    notes.clearPicks();
    menuOpen = true;
    ui.openMenu({
      x,
      y,
      label: entry.meta.title || t("list.untitled"),
      items: [
        { label: leading.menuLabel, icon: leading.icon, run: () => perform(leading) },
        ...(canFloat && !entry.note.trashed
          ? [
              {
                label: floatingOpen.has(id) ? t("list.unfloat") : t("list.float"),
                icon: "picture-in-picture-2" as const,
                run: () => toggleFloating(id),
              },
            ]
          : []),
        {
          label: entry.note.icon ? t("list.changeIcon") : t("list.addIcon"),
          icon: "smile",
          run: () =>
            (ui.iconPicker = {
              key: `note:${id}`,
              label: entry.meta.title || t("list.untitled"),
              fallback: typeIcon ?? "file-text",
              icon: () => notes.get(id)?.note.icon ?? null,
              set: (icon) => notes.setIcon(id, icon),
              x,
              y,
            }),
        },
        ...lockItems(),
        ...(isClosed(entry.note)
          ? []
          : [{ label: t("list.copyText"), icon: "copy" as const, run: () => void copyText(entry.note.body).then(() => speak(t("list.copied"))) }]),
        "separator",
        { label: trailing.menuLabel, icon: trailing.icon, danger: true, run: () => perform(trailing) },
      ],
      onclose: () => (menuOpen = false),
    });
  }
</script>

<li bind:this={li} class:menu-target={menuOpen || ui.iconPicker?.key === `note:${id}`}>
  <div class="row" class:swiped class:dragging>
    <button
      class="action leading {leading.tone}"
      class:armed={armed && offset > 0}
      style:transform="translateX(calc({leadingX}px - 100%))"
      tabindex="-1"
      aria-hidden="true"
      onclick={() => perform(leading)}
    >
      <span class="action-content"><Icon name={leading.icon} size={20} />{leading.label}</span>
    </button>
    <button
      class="action trailing {trailing.tone}"
      class:armed={armed && offset < 0}
      style:transform="translateX(calc({trailingX}px + 100%))"
      tabindex="-1"
      aria-hidden="true"
      onclick={() => perform(trailing)}
    >
      <span class="action-content"><Icon name={trailing.icon} size={20} />{trailing.label}</span>
    </button>

    <button
      bind:this={item}
      class="item"
      class:selected={notes.picked.size ? picked : selected}
      data-id={id}
      tabindex={tabbable ? 0 : -1}
      aria-current={selected}
      aria-describedby={entry.meta.excerpt ? `excerpt-${id}` : undefined}
      style:transform={offset ? `translateX(${offset}px)` : undefined}
      {onclick}
      {onkeydown}
      {oncontextmenu}
      {onpointerdown}
      {onpointermove}
      {onpointerup}
      onpointercancel={onpointerup}
      {@attach longPress(onlongpress)}
    >
      <span class="item-title" class:untitled={!entry.meta.title}>
        {#if icon}<Icon name={icon} size={15} strokeWidth={2} />{/if}
        <span>{entry.meta.title || t("list.untitled")}</span>
        {#if picked && notes.picked.size}<span class="visually-hidden">, {t("list.picked")}</span>{/if}
      </span>
      {#if entry.meta.excerpt}<span class="excerpt" id="excerpt-{id}" aria-hidden="true">{entry.meta.excerpt}</span>{/if}
      <!-- Said after the title, by name: the icons alone would say nothing. -->
      <span class="meta">
        {#if entry.note.pinned}<Icon name="pin" size={12} /><span class="visually-hidden">{t("list.pinned")}</span>{/if}
        {#if entry.note.locked}
          {@const lockLabel = entry.note.locked.open ? t("list.lockedNoteOpen") : t("list.lockedNote")}
          <span class="lock" title={lockLabel}>
            <Icon name={entry.note.locked.open ? "lock-open" : "lock"} size={12} /><span class="visually-hidden">{lockLabel}</span>
          </span>
        {/if}
        <time datetime={new Date(entry.note.updatedAt).toISOString()}>{formatDate(entry.note.updatedAt, now)}</time>
      </span>
    </button>
  </div>
</li>

<style>
  li {
    /* Lets the browser skip layout and paint for off-screen rows. */
    content-visibility: auto;
    contain-intrinsic-size: auto 94px;
    position: relative;
  }

  .row {
    position: relative;
    overflow: hidden;
    border-radius: 10px;
  }

  .item {
    --layer: transparent;
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
    padding: 12px 12px 11px;
    border-radius: 10px;
    background: linear-gradient(var(--layer), var(--layer));
    text-align: left;
    color: var(--text);
    /* Vertical scrolling stays native; sideways drags are ours. */
    touch-action: pan-y;
    -webkit-touch-callout: none;
    transition: transform 300ms var(--ease-sheet);
  }

  /* Touch screens would keep a tapped row looking hovered. */
  @media (hover: hover) {
    .item:hover {
      --layer: var(--hover);
    }
  }

  .item.selected {
    --layer: var(--active);
  }

  /* Opaque while swiped, so the action underneath doesn't show through. */
  .swiped .item {
    background-color: var(--bg-list);
  }

  .menu-target .item {
    box-shadow: inset 0 0 0 2px var(--accent);
  }

  .action {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    transition: transform 300ms var(--ease-sheet);
  }

  /* The row follows the finger (or trackpad) exactly while it's dragged. */
  .dragging .item,
  .dragging .action {
    transition: none;
    will-change: transform;
  }

  /* Each action keeps its label next to the row's edge. */
  .leading {
    justify-content: flex-end;
  }

  .trailing {
    justify-content: flex-start;
  }

  .action-content {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 76px;
    font-size: 11.5px;
    font-weight: 600;
  }

  .leading .action-content {
    margin-right: 20px;
  }

  .trailing .action-content {
    margin-left: 20px;
  }

  .action :global(.icon) {
    transition: transform 220ms cubic-bezier(0.3, 1.6, 0.6, 1);
  }

  .action.armed :global(.icon) {
    transform: scale(1.2);
  }

  .pin {
    background: var(--pin);
    color: var(--on-pin);
  }

  .danger {
    background: var(--danger);
    color: var(--on-danger);
  }

  .success {
    background: var(--success);
    color: var(--on-success);
  }

  .item-title {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.35;
    white-space: nowrap;
  }

  .item-title > span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-title > :global(.icon) {
    flex: none;
    color: var(--accent);
  }

  .untitled {
    color: var(--text-faint);
  }

  .excerpt {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-muted);
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 2px;
    font-size: 11.5px;
    color: var(--text-faint);
  }

  /* With increased contrast, the date on the open note's row keeps 4.5:1 over its darker background. */
  :global(:root[data-contrast="more"]) .item.selected .meta {
    color: var(--text-muted);
  }

  .meta :global(.icon) {
    color: var(--accent);
  }

  .meta .lock {
    display: flex;
  }

  .meta .lock :global(.icon) {
    color: var(--text-faint);
  }
</style>
