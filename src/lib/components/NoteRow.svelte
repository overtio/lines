<script lang="ts">
  import { untrack } from "svelte";
  import Icon from "../icons/Icon.svelte";
  import type { IconName } from "../icons/icons";
  import { formatDate } from "../format";
  import { lockedNotes } from "../notes/locked.svelte";
  import { isClosed, notes, type Entry } from "../notes/store.svelte";
  import { longPress } from "../longPress";
  import { copyText } from "../platform";
  import { menuPoint } from "../popover";
  import { prefs } from "../prefs.svelte";
  import { ui } from "../ui.svelte";
  import { canFloat, floatingOpen, toggleFloating } from "../windows/floating";

  let {
    entry,
    selected,
    now,
    open,
    onswipe,
    onkeydown,
  }: {
    entry: Entry;
    selected: boolean;
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

  // Swipe right for the leading action and left for the trailing one, like Mail.
  const leading = $derived<Action>(
    entry.note.trashed
      ? { label: "Restore", menuLabel: "Restore", icon: "restore", tone: "success", full: true, leaves: true, run: () => notes.restore(id) }
      : entry.note.pinned
        ? { label: "Unpin", menuLabel: "Unpin", icon: "pin-off", tone: "pin", full: true, leaves: false, run: () => notes.togglePin(id) }
        : { label: "Pin", menuLabel: "Pin to Top", icon: "pin", tone: "pin", full: true, leaves: false, run: () => notes.togglePin(id) },
  );
  const trailing = $derived<Action>(
    entry.note.trashed
      ? { label: "Delete", menuLabel: "Delete Forever", icon: "trash", tone: "danger", full: false, leaves: true, run: () => notes.deleteForever(id) }
      : { label: "Trash", menuLabel: "Move to Trash", icon: "trash", tone: "danger", full: true, leaves: true, run: () => notes.trash(id) },
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
    if (!action.leaves) {
      // Let the row slide shut before it jumps to its new place.
      const delay = offset ? SLIDE_MS : 0;
      close();
      setTimeout(action.run, delay);
      return;
    }
    const swiped = offset !== 0;
    onswipe(false);
    leaving = true;
    if (swiped) offset = Math.sign(offset) * width;
    const { height, paddingTop } = getComputedStyle(li);
    li.animate([{ height, paddingTop, opacity: 1 }, { height: "0px", paddingTop: "0px", opacity: 0 }], {
      duration: 220,
      delay: swiped ? 160 : 0,
      easing: getComputedStyle(li).getPropertyValue("--ease-sheet"),
      fill: "forwards",
    })
      .finished.catch(() => {})
      .then(action.run);
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

  function onclick() {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (offset) return close();
    notes.select(id);
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
    if (!locked) return [{ label: "Lock Note", icon: "lock" as const, run: () => lockedNotes.lockNote(id) }];
    return [
      { label: "Lock Now", icon: "lock" as const, run: () => void lockedNotes.close() },
      { label: "Remove Lock", icon: "lock-open" as const, run: () => void notes.removeLock(id) },
    ];
  }

  function showMenu(x: number, y: number) {
    if (offset) close();
    menuOpen = true;
    ui.openMenu({
      x,
      y,
      items: [
        { label: leading.menuLabel, icon: leading.icon, run: () => perform(leading) },
        ...(canFloat && !entry.note.trashed
          ? [
              {
                label: floatingOpen.has(id) ? "Close Floating Window" : "Open in Floating Window",
                icon: "picture-in-picture-2" as const,
                run: () => toggleFloating(id),
              },
            ]
          : []),
        {
          label: entry.note.icon ? "Change Icon…" : "Add Icon…",
          icon: "smile",
          run: () =>
            (ui.iconPicker = {
              key: `note:${id}`,
              label: entry.meta.title || "Untitled",
              fallback: "file-text",
              icon: () => notes.get(id)?.note.icon ?? null,
              set: (icon) => notes.setIcon(id, icon),
              x,
              y,
            }),
        },
        ...lockItems(),
        ...(isClosed(entry.note) ? [] : [{ label: "Copy Text", icon: "copy" as const, run: () => copyText(entry.note.body) }]),
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
      class:selected
      data-id={id}
      aria-current={selected}
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
        {#if entry.note.icon}<Icon name={entry.note.icon} size={15} strokeWidth={2} />{/if}
        <span>{entry.meta.title || "Untitled"}</span>
      </span>
      {#if entry.meta.excerpt}<span class="excerpt">{entry.meta.excerpt}</span>{/if}
      <span class="meta">
        {#if entry.note.pinned}<Icon name="pin" size={12} />{/if}
        {#if entry.note.locked}
          <span class="lock" title={entry.note.locked.open ? "Locked note, open" : "Locked note"}>
            <Icon name={entry.note.locked.open ? "lock-open" : "lock"} size={12} />
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
    color: #fff;
  }

  .danger {
    background: var(--danger);
    color: #fff;
  }

  .success {
    background: var(--success);
    color: #fff;
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
