<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import type { IconName } from "../icons/icons";
  import { formatDate } from "../format";
  import { t } from "../i18n/index.svelte";
  import { lock } from "../lock/lock.svelte";
  import { notesOnDays } from "../notes/calendar";
  import { typeLabel } from "../notes/properties";
  import { notes } from "../notes/store.svelte";
  import { tagLooks, typeLooks } from "../notes/looks.svelte";
  import { menuPoint } from "../popover";
  import { longPress } from "../longPress";
  import { isSite, openExternal } from "../platform";
  import { prefs } from "../prefs.svelte";
  import { sync } from "../sync/engine.svelte";
  import { today } from "../today.svelte";
  import type { Filter } from "../notes/types";
  import { isDivider, type PlaceGroup, sidebarLayout } from "../sidebarLayout.svelte";
  import { panes } from "../panes.svelte";
  import { type MenuItem, ui } from "../ui.svelte";
  import { updates } from "../updates.svelte";
  import { openSettings } from "../windows/settings.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import SidebarDivider from "./SidebarDivider.svelte";
  import SidebarRow from "./SidebarRow.svelte";
  import { reorderable } from "./reorder";
  import { type Describe, hideItems, showHiddenItems, sizeItems, sortItems } from "./sidebarMenus";
  import TagTree from "./TagTree.svelte";
  import { GITHUB_MARK, REPO, VERSION } from "../release";

  type Place = Exclude<Filter["kind"], "tag" | "type">;
  /** A section's list: rows across, tiles (`data-tile`) two to a line, a small gap so neighboring highlights never touch. */
  const ROWS = "grid grid-cols-2 gap-x-1.5 gap-y-0.5 [&>:not([data-tile])]:col-span-2 [&>[data-tile]]:mb-1";
  const todayCount = $derived(notesOnDays(notes.entries, today.day, today.day, prefs.calendarEdited).get(today.day)?.length ?? 0);
  /** The lists at the top, each named by what it shows. */
  const PLACES: { key: Place; filter: () => Filter; label: string; icon: IconName; count?: () => number; shown?: () => boolean }[] = [
    // While new notes go elsewhere, only with something in it.
    { key: "inbox", filter: () => ({ kind: "inbox" }), label: t("sidebar.inbox"), icon: "inbox", count: () => notes.counts.inbox, shown: () => prefs.newNotes === "inbox" || notes.counts.inbox > 0 },
    { key: "all", filter: () => ({ kind: "all" }), label: t("sidebar.notes"), icon: "notes", count: () => notes.counts.all },
    // The Calendar opens on today, and counts what's on it.
    { key: "calendar", filter: () => ({ kind: "calendar", day: today.day }), label: t("sidebar.calendar"), icon: "calendar", count: () => todayCount },
    { key: "todo", filter: () => ({ kind: "todo" }), label: t("sidebar.todo"), icon: "square-check", count: () => notes.counts.todo },
    { key: "untagged", filter: () => ({ kind: "untagged" }), label: t("sidebar.untagged"), icon: "tag", count: () => notes.counts.untagged },
    { key: "trash", filter: () => ({ kind: "trash" }), label: t("sidebar.trash"), icon: "trash", count: () => notes.counts.trash },
  ];
  /** Notes, the way back to every note, can't be hidden. */
  const ALWAYS: Place = "all";

  const placeKeys = PLACES.map((place) => place.key);
  const placeOf = new Map(PLACES.map((place) => [place.key, place]));
  const isShown = (place: (typeof PLACES)[number] | Divider) => "divider" in place || ((place.shown?.() ?? true) && !sidebarLayout.isHidden(`place:${place.key}`));

  /** The sections of the sidebar, in order: those of places (named or a gap), Types and Tags. */
  /** A line between places (sidebarLayout.ts). */
  type Divider = { key: string; divider: true };
  type Section =
    | { key: string; kind: "places"; group: PlaceGroup; places: ((typeof PLACES)[number] | Divider)[] }
    | { key: "types" | "tags"; kind: "types" | "tags"; label: string; icon: IconName };
  const BUILT_IN: Section[] = [
    { key: "types", kind: "types", label: t("sidebar.types"), icon: "shapes" },
    { key: "tags", kind: "tags", label: t("sidebar.tags"), icon: "hash" },
  ];
  const groups = $derived(sidebarLayout.groups(placeKeys));
  const sections = $derived(
    sidebarLayout.sorted(
      "sections",
      [
        ...groups.map(
          (group): Section => ({
            key: group.id,
            kind: "places",
            group,
            places: group.places.flatMap((key): ((typeof PLACES)[number] | Divider)[] => {
              if (isDivider(key)) return [{ key, divider: true }];
              const place = placeOf.get(key as Place);
              return place ? [place] : [];
            }),
          }),
        ),
        ...BUILT_IN,
      ],
      (section) => section.key,
    ),
  );
  const sectionKeys = $derived(sections.map((section) => section.key));

  /** A section's name: Types, Tags, or what a section of places was named (none for one that's a gap). */
  const nameOf = (section: Section) => (section.kind === "places" ? section.group.name : section.label);
  /** Whether it has a heading: a name, or a name being given it. */
  const hasHeading = (section: Section) => !!nameOf(section) || renamingGroup === section.key;

  /** The sections drawn: not hidden, and with something in them (a named one, even empty, to drag places into). */
  const shownSections = $derived(
    sections.filter((section) => {
      if (sidebarLayout.isHidden(`section:${section.key}`)) return false;
      if (section.kind === "places") return hasHeading(section) || section.places.some(isShown);
      return section.kind === "types" ? notes.types.length > 0 : notes.tagTree.length > 0;
    }),
  );

  /** The room after a section, in pixels: more before one with a heading, a little before one that's only a gap. */
  function gapAfter(i: number) {
    const next = shownSections[i + 1];
    if (!next) return 0;
    return hasHeading(next) ? (sidebarLayout.isCollapsed(shownSections[i].key) ? 12 : 18) : 10;
  }

  /**
   * How many dividers each section's rows end with, and (one without a heading) start with: those
   * are drawn halfway into the gap beside it rather than against its rows (`dividerStyle`).
   */
  const edges = $derived(
    shownSections.map((section) => {
      const open = !hasHeading(section) || !sidebarLayout.isCollapsed(section.key);
      // Which of its rows shown are dividers, in order.
      const rows: boolean[] = !open ? [] : (section.kind === "places" ? section.places.filter(isShown) : section.kind === "types" ? shownTypes : []).map((row) => "divider" in row);
      const count = (from: boolean[]) => (from.indexOf(false) === -1 ? from.length : from.indexOf(false));
      const trail = count([...rows].reverse());
      return { rows: rows.length, trail, lead: hasHeading(section) ? 0 : Math.min(count(rows), rows.length - trail) };
    }),
  );

  /** The room after a section's wrapper: none when a divider at its end, or the next one's start, takes the gap. */
  const marginAfter = (i: number) => (edges[i].trail || edges[i + 1]?.lead ? 0 : gapAfter(i));

  /** A divider's room around it, the `j`th row of section `i`: at the section's end or start, half the gap on each side of its line. */
  function dividerStyle(i: number, j: number) {
    const { rows, trail, lead } = edges[i];
    const pad: string[] = [];
    if (j >= rows - trail) {
      const half = gapAfter(i) / 2;
      // The rows above are a little apart already (gap-0.5).
      if (j === rows - trail) pad.push(`padding-top: ${Math.max(0, half - 2)}px`);
      if (j === rows - 1 && !edges[i + 1]?.lead) pad.push(`padding-bottom: ${half}px`);
    } else if (j < lead) {
      const half = gapAfter(i - 1) / 2;
      if (j === 0 && !edges[i - 1]?.trail) pad.push(`padding-top: ${half}px`);
      if (j === lead - 1) pad.push(`padding-bottom: ${Math.max(0, half - 2)}px`);
    }
    return pad.join("; ") || undefined;
  }

  const types = $derived(sidebarLayout.arrange("types", "types", notes.types, (each) => each.type, (each) => each.type, (each) => each.count));
  type TypeRow = (typeof types)[number] | Divider;
  const typeKey = (row: TypeRow) => ("divider" in row ? row.key : row.type);
  /** The types, and the dividers put among them while they're in an order of your own. */
  const typeRows = $derived<TypeRow[]>(
    sidebarLayout.sortOf("types") === "manual"
      ? sidebarLayout.sorted("types", [...types, ...sidebarLayout.dividersIn("types").map((key) => ({ key, divider: true as const }))], typeKey)
      : types,
  );
  const typeKeys = $derived(typeRows.map(typeKey));
  const shownTypes = $derived(typeRows.filter((row) => "divider" in row || !sidebarLayout.isHidden(`type:${row.type}`)));

  /** Every tag, nested ones too, so a hidden one that no note has any more isn't offered back. */
  const tagPaths = $derived.by(() => {
    const paths = new Set<string>();
    const walk = (nodes: typeof notes.tagTree) => nodes.forEach((node) => (paths.add(node.path), walk(node.children)));
    walk(notes.tagTree);
    return paths;
  });

  /** A hidden row as Show Hidden lists it. */
  const describe: Describe = (hidden) => {
    const [kind, name] = [hidden.slice(0, hidden.indexOf(":")), hidden.slice(hidden.indexOf(":") + 1)];
    if (kind === "place") return placeOf.get(name as Place) ?? null;
    if (kind === "section") {
      const section = sections.find((each) => each.key === name);
      if (!section) return null;
      return section.kind === "places" ? (section.group.name ? { label: section.group.name, icon: "folder" } : null) : section;
    }
    if (kind === "type") return notes.types.some(({ type }) => type === name) ? { label: typeLabel(name), icon: typeLooks.icon(name) } : null;
    if (kind === "tag") return tagPaths.has(name) ? { label: `#${name}`, icon: tagLooks.icon(name) } : null;
    return null;
  };

  /** The place, section or type whose menu is open, outlined like a right-clicked note. */
  let menuFor = $state<string | null>(null);

  /** Opens a sidebar row's menu: its own items, then hiding it, then Show Hidden. */
  function openRowMenu(key: string, label: string, own: MenuItem[], arrange: MenuItem[], x: number, y: number) {
    menuFor = key;
    const rest = [...arrange, ...showHiddenItems(describe, x, y)];
    ui.openMenu({ x, y, label, items: own.length && rest.length ? [...own, "separator", ...rest] : [...own, ...rest], onclose: () => (menuFor = null) });
  }

  /** Right-click on a row, or (with its key) the menu key. Android also fires this after a long press, when the menu is up. */
  function onRowContextMenu(event: MouseEvent, key: string, open: (x: number, y: number) => void) {
    event.preventDefault();
    if (menuFor === key) return;
    const { x, y } = menuPoint(event);
    open(x, y);
  }

  function placeMenu(place: (typeof PLACES)[number], group: PlaceGroup, x: number, y: number) {
    // A section that's only a gap is named from its places' menus, and a new one made there by keyboard too.
    const own: MenuItem[] = [
      ...(group.name ? [] : [{ label: t("sidebar.nameSection"), icon: "pencil" as const, run: () => startGroupRename(group) }]),
      { label: t("sidebar.newSectionWith"), icon: "plus", run: () => newSection({ place: place.key, group }) },
      { label: t("sidebar.addDividerBelow"), icon: "minus", run: () => sidebarLayout.addDivider(placeKeys, place.key) },
      "separator",
      ...sizeItems(group.id, `place:${place.key}`),
    ];
    openRowMenu(`place:${place.key}`, place.label, own, place.key === ALWAYS ? [] : hideItems("place", place.key), x, y);
  }

  function dividerMenu(key: string, x: number, y: number) {
    openRowMenu(key, t("sidebar.divider"), [{ label: t("sidebar.removeDivider"), icon: "trash", run: () => sidebarLayout.removeDivider(placeKeys, key) }], [], x, y);
  }

  function sectionMenu(section: Section, x: number, y: number) {
    const label = nameOf(section);
    if (section.kind !== "places") {
      // Its rows, which follow its size again once it's chosen.
      const rows = section.kind === "types" ? notes.types.map(({ type }) => `type:${type}`) : [...tagPaths].map((path) => `tag:${path}`);
      const own: MenuItem[] = [...sortItems(section.kind), "separator", ...sizeItems(section.kind, "", rows)];
      return openRowMenu(`section:${section.key}`, label, own, hideItems("section", section.key), x, y);
    }
    const own: MenuItem[] = [
      { label: t("sidebar.rename"), icon: "pencil", run: () => startGroupRename(section.group) },
      ...(groups.length > 1 ? [{ label: t("sidebar.deleteSection"), icon: "trash" as const, run: () => sidebarLayout.deleteGroup(placeKeys, section.key) }] : []),
      "separator",
      ...sizeItems(section.key, "", section.group.places.filter((key) => !isDivider(key)).map((key) => `place:${key}`)),
    ];
    openRowMenu(`section:${section.key}`, label, own, hideItems("section", section.key), x, y);
  }

  /** The section of places being named in its heading, and the name typed so far. */
  let renamingGroup = $state<string | null>(null);
  let groupDraft = $state("");

  function startGroupRename(group: PlaceGroup) {
    renamingGroup = group.id;
    groupDraft = group.name;
  }

  /** Keeps the name typed (none leaves the section a gap); Esc keeps the one it had. */
  function finishGroupRename(keep = true) {
    const id = renamingGroup;
    renamingGroup = null;
    if (id && keep) sidebarLayout.renameGroup(placeKeys, id, groupDraft);
  }

  /** A new section, after the last of places (above Types and Tags), named and ready to rename. */
  /**
   * A new section, named and ready to rename. Made from a place's menu, it's that place's, right after
   * the section it was in; from the empty space, an empty one after the last of places (above Types and Tags).
   */
  function newSection(from?: { place: Place; group: PlaceGroup }) {
    const name = t("sidebar.newSection");
    // Where it goes is worked out before it's there to count.
    const keys = [...sectionKeys];
    const after = from ? keys.indexOf(from.group.id) : sections.map((section) => section.kind).lastIndexOf("places");
    const before = keys[after + 1] ?? null;
    const places = from ? [from.place] : [];
    const id = sidebarLayout.addGroup(placeKeys, name, places);
    sidebarLayout.move("sections", [...keys, id], id, before);
    startGroupRename({ id, name, places });
  }

  /** Right-click on the sidebar's empty space: a new section, and what's hidden, to show again. */
  function onEmptyContextMenu(event: MouseEvent) {
    if (event.defaultPrevented) return;
    event.preventDefault();
    const { x, y } = menuPoint(event);
    ui.openMenu({
      x,
      y,
      label: t("sidebar.label"),
      items: [
        { label: t("sidebar.newSection"), icon: "plus", run: () => newSection() },
        { label: t("sidebar.addDivider"), icon: "minus", run: () => sidebarLayout.addDivider(placeKeys, null) },
        ...showHiddenItems(describe, x, y),
      ],
    });
  }

  const syncIcon = $derived.by((): IconName => {
    if (sync.status === "syncing") return "loader";
    if (sync.status === "error") return "cloud-alert";
    if (isSite && sync.status === "off") return "folder";
    return sync.status === "off" || sync.status === "offline" ? "cloud-off" : "cloud-check";
  });

  const syncLabel = $derived.by(() => {
    switch (sync.status) {
      case "off":
        return isSite ? t("sidebar.saveToFolder") : t("sidebar.setUpSync");
      case "syncing":
        return t("sidebar.syncing");
      case "offline":
        return t("sidebar.offline");
      case "error":
        return t("sidebar.syncProblem");
      default:
        if (isSite) return sync.lastSynced ? t("sidebar.savedAt", { date: formatDate(sync.lastSynced) }) : t("sidebar.savingToFolder");
        return sync.lastSynced ? t("sidebar.syncedAt", { date: formatDate(sync.lastSynced) }) : t("sidebar.syncOn");
    }
  });

  function choose(filter: Filter) {
    notes.setFilter(filter);
    // The Calendar shows its week or day in the note's place.
    if (filter.kind === "calendar") notes.select(null);
    ui.closeDrawer();
  }

  /** The type being renamed in place, and the name typed so far. */
  let renamingType = $state<string | null>(null);
  let typeDraft = $state("");

  /** Renames the type, if it was given a new name; from the keyboard, focus goes back to its row. */
  function finishTypeRename(refocus = false) {
    const from = renamingType;
    renamingType = null;
    if (!from) return;
    const to = typeDraft.trim();
    let type = from;
    if (to && to.toLowerCase() !== from) {
      notes.renameType(from, to);
      typeLooks.rename(from, to.toLowerCase());
      sidebarLayout.rename("type", from, to.toLowerCase());
      type = to.toLowerCase();
    }
    if (refocus) requestAnimationFrame(() => document.querySelector<HTMLElement>(`.sidebar [data-type="${CSS.escape(type)}"]`)?.focus());
  }

  /** Only what a type can be called: letters, digits, spaces, `-` and `_`. */
  function onTypeInput(event: Event & { currentTarget: HTMLInputElement }) {
    event.currentTarget.value = typeDraft = event.currentTarget.value.replace(/[^\p{L}\p{N} _-]/gu, "");
  }

  function onTypeRenameKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== "Escape") return;
    event.preventDefault();
    if (event.key === "Escape") typeDraft = renamingType ?? "";
    finishTypeRename(true);
  }


  function showTypeMenu(type: string, x: number, y: number) {
    const own: MenuItem[] = [
      {
        label: t("sidebar.rename"),
        icon: "pencil",
        run: () => {
          renamingType = type;
          typeDraft = type;
        },
      },
      {
        label: t("sidebar.iconAndColor"),
        icon: "smile",
        run: () =>
          (ui.iconPicker = {
            key: `type:${type}`,
            label: typeLabel(type),
            fallback: typeLooks.icon(type),
            icon: () => typeLooks.chosenIcon(type) ?? null,
            set: (icon) => typeLooks.setIcon(type, icon),
            color: { get: () => typeLooks.color(type) ?? null, set: (color) => typeLooks.setColor(type, color) },
            x,
            y,
          }),
      },
      { label: t("sidebar.addDividerBelow"), icon: "minus", run: () => sidebarLayout.addListDivider("types", typeKeys, type, "types") },
      "separator",
      ...sizeItems("types", `type:${type}`),
    ];
    openRowMenu(`type:${type}`, typeLabel(type), own, hideItems("type", type), x, y);
  }
</script>

<nav class="sidebar relative flex h-full flex-col text-fg-sidebar" aria-label={t("sidebar.label")}>
  <!-- Its hide button is on its inner edge, by the note list or the note. -->
  <header
    class={[
      "titlebar flex h-(--titlebar-h) shrink-0 items-center px-2.5 pt-(--titlebar-pad-top)",
      prefs.sidebarSide === "right" ? "justify-start" : "justify-end",
    ]}
    data-tauri-drag-region
  >
    <IconButton icon={prefs.sidebarSide === "left" ? "panel-left" : "panel-right"} label={t("sidebar.hide")} onclick={() => ui.toggleSidebar()} />
  </header>

  <!-- Right-clicking its empty space offers a new section, and back what's hidden. -->
  <div class="flex-1 overflow-y-auto overscroll-contain px-2.5 pt-1 pb-6" oncontextmenu={onEmptyContextMenu} role="presentation">
    {#each shownSections as section, i (section.key)}
      {@const heading = hasHeading(section)}
      {@const open = !heading || !sidebarLayout.isCollapsed(section.key)}
      <!-- The room after each, whatever comes next. Dragged by its heading, a section goes whole (reorder.ts). -->
      <div style:margin-bottom="{marginAfter(i)}px" data-reorder-area>
        {#if heading}
          <h2 class="mx-0 mt-0 mb-1" id="sidebar-{section.key}">
            {#if renamingGroup === section.key}
              <!-- As tags and types are renamed in place (SidebarRow.svelte): a field in the heading's place, with one ring. -->
              <div class="flex h-6 items-center rounded-sm bg-bg px-2.5 inset-ring-2 inset-ring-accent-soft">
                <input
                  class="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-2xs font-semibold tracking-[0.04em] text-fg uppercase outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-faint placeholder:normal-case"
                  aria-label={t("sidebar.sectionName")}
                  placeholder={t("sidebar.unnamedSection")}
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  bind:value={groupDraft}
                  onkeydown={(event) => {
                    if (event.key !== "Enter" && event.key !== "Escape") return;
                    event.preventDefault();
                    finishGroupRename(event.key === "Enter");
                  }}
                  onblur={() => finishGroupRename()}
                  {@attach (input) => (input.focus(), input.select())}
                />
              </div>
            {:else}
              <button
                class={[
                  "group flex h-6 w-full items-center gap-1 rounded-sm px-2.5 text-left text-2xs font-semibold tracking-[0.04em] text-faint uppercase transition-colors hover:text-muted",
                  menuFor === `section:${section.key}` && "inset-ring-2 inset-ring-accent",
                ]}
                aria-expanded={open}
                aria-controls="sidebar-{section.key}-list"
                onclick={() => sidebarLayout.toggleCollapsed(section.key)}
                oncontextmenu={(event) => onRowContextMenu(event, `section:${section.key}`, (x, y) => sectionMenu(section, x, y))}
                {@attach longPress((x, y) => sectionMenu(section, x, y))}
                {@attach reorderable("sections", section.key, (before) => sidebarLayout.move("sections", sectionKeys, section.key, before), true)}
              >
                <span class="truncate">{nameOf(section)}</span>
                <Icon name="chevron-right" size={12} strokeWidth={2.25} class="shrink-0 transition-transform duration-200 {open ? 'rotate-90' : ''}" />
              </button>
            {/if}
          </h2>
        {/if}
        {#if open && section.kind === "places"}
          <!-- A small gap between rows, so neighboring highlights never touch; tiles two to a line. Places are dragged from section to section. -->
          <ul id="sidebar-{section.key}-list" class={ROWS} aria-labelledby={heading ? `sidebar-${section.key}` : undefined}>
            {#each section.places.filter(isShown) as place, j (place.key)}
              {#if "divider" in place}
                <SidebarDivider
                  list="places"
                  id={place.key}
                  marked={menuFor === place.key}
                  style={dividerStyle(i, j)}
                  onmove={(before) => sidebarLayout.movePlace(placeKeys, place.key, before ?? `end:${section.key}`)}
                  onmenu={(x, y) => dividerMenu(place.key, x, y)}
                />
              {:else}
              {@const size = sidebarLayout.sizeOf(`place:${place.key}`, section.key)}
              <li data-tile={size === "large" || undefined}>
                <SidebarRow
                  {size}
                  icon={place.icon}
                  iconSize={17}
                  label={place.label}
                  count={place.count?.()}
                  active={notes.filter.kind === place.key}
                  marked={menuFor === `place:${place.key}` || panes.rowAt === `place:${place.key}`}
                  data-note-drop={place.key === "inbox" || place.key === "trash" ? `place:${place.key}` : undefined}
                  onclick={() => choose(place.filter())}
                  oncontextmenu={(event) => onRowContextMenu(event, `place:${place.key}`, (x, y) => placeMenu(place, section.group, x, y))}
                  {@attach longPress((x, y) => placeMenu(place, section.group, x, y))}
                  {@attach reorderable("places", place.key, (before) => sidebarLayout.movePlace(placeKeys, place.key, before ?? `end:${section.key}`))}
                />
              </li>
              {/if}
            {:else}
              <li class="px-2.5 py-1 text-xs text-faint" data-reorder-placeholder>{t("sidebar.emptySection")}</li>
            {/each}
            <!-- Where a place dragged to the end of this section goes. -->
            <li class="h-0" data-reorder="places" data-reorder-key="end:{section.key}" data-reorder-end aria-hidden="true"></li>
          </ul>
        {:else if open && section.kind === "types"}
          <ul id="sidebar-types-list" class={ROWS} aria-labelledby="sidebar-types">
            {#each shownTypes as row, j (typeKey(row))}
              {#if "divider" in row}
                <SidebarDivider
                  list="types"
                  id={row.key}
                  marked={menuFor === row.key}
                  style={dividerStyle(i, j)}
                  onmove={(before) => sidebarLayout.move("types", typeKeys, row.key, before, "types")}
                  onmenu={(x, y) => openRowMenu(row.key, t("sidebar.divider"), [{ label: t("sidebar.removeDivider"), icon: "trash", run: () => sidebarLayout.removeListDivider("types", row.key) }], [], x, y)}
                />
              {:else}
              {@const { type, count } = row}
              {@const size = renamingType === type ? "standard" : sidebarLayout.sizeOf(`type:${type}`, "types")}
              <li data-tile={size === "large" || undefined}>
                <SidebarRow
                  {size}
                  icon={typeLooks.icon(type)}
                  color={typeLooks.color(type)}
                  label={typeLabel(type)}
                  {count}
                  active={notes.filter.kind === "type" && notes.filter.type === type}
                  marked={menuFor === `type:${type}` || ui.iconPicker?.key === `type:${type}` || panes.rowAt === `type:${type}`}
                  data-note-drop="type:{type}"
                  rename={renamingType === type
                    ? { value: typeDraft, "aria-label": t("sidebar.typeName"), oninput: onTypeInput, onkeydown: onTypeRenameKeydown, onblur: () => finishTypeRename() }
                    : undefined}
                  data-type={type}
                  onclick={() => choose({ kind: "type", type })}
                  oncontextmenu={(event) => onRowContextMenu(event, `type:${type}`, (x, y) => showTypeMenu(type, x, y))}
                  {@attach longPress((x, y) => showTypeMenu(type, x, y))}
                  {@attach reorderable("types", type, (before) => sidebarLayout.move("types", typeKeys, type, before, "types"))}
                />
              </li>
              {/if}
            {/each}
          </ul>
        {:else if open && section.kind === "tags"}
          <TagTree nodes={notes.tagTree} onchoose={(tag) => choose({ kind: "tag", tag })} id="sidebar-tags-list" labelledby="sidebar-tags" extraItems={(x, y) => showHiddenItems(describe, x, y)} />
        {/if}
      </div>
    {/each}
  </div>

  <!-- That this is an early version (and which), and where its source is (Settings → Layout can hide them);
       a downloaded update's restart button either way. -->
  {#if prefs.sidebarAbout || updates.status.kind === "ready"}
    <div class="flex shrink-0 items-center justify-between gap-2 pt-1 pr-2.5 pb-1.5 pl-4">
      {#if prefs.sidebarAbout}
        <!-- A quiet badge: it's there to be read once, not to shout. -->
        <span
          class="tabular cursor-default rounded-sm border border-line px-[7px] py-0.5 text-2xs font-semibold tracking-[0.02em] text-faint"
          title={t("sidebar.alphaHint")}
        >
          {t("sidebar.alpha", { version: VERSION })}<span class="sr-only">. {t("sidebar.alphaHint")}</span>
        </span>
      {/if}
      <!-- Only once a newer version is downloaded (it's also installed when lines quits). -->
      {#if updates.status.kind === "ready"}
        {@const hint = t("sidebar.updateHint", { version: updates.status.version })}
        <button
          class="touch-target ml-auto grid size-7 place-items-center rounded-md text-accent transition-colors hover:bg-hover"
          onclick={() => void updates.restart()}
          aria-label={hint}
          title={hint}
        >
          <Icon name="refresh" size={15} />
        </button>
      {/if}
      {#if prefs.sidebarAbout}
        <button
          class="touch-target grid size-7 place-items-center rounded-md text-faint transition-colors hover:bg-hover hover:text-fg [&_svg]:size-4"
          onclick={() => openExternal(REPO)}
          aria-label={t("sidebar.source")}
          title={t("sidebar.source")}
        >
          {@html GITHUB_MARK}
        </button>
      {/if}
    </div>
  {/if}

  <footer class="flex shrink-0 items-center gap-1 border-t border-line px-2.5 pt-2 pb-[calc(10px_+_env(safe-area-inset-bottom))]">
    <!-- Takes the room the buttons beside it leave; a long label (other languages) is cut short, not them. -->
    <SidebarRow
      class={["min-w-0 flex-1", sync.status === "error" ? "text-danger" : "text-muted"]}
      icon={syncIcon}
      iconClass={sync.status === "error" ? "shrink-0 text-danger" : sync.status === "syncing" ? "shrink-0 animate-spin text-muted" : undefined}
      label={syncLabel}
      onclick={() => void openSettings("sync")}
      title={sync.error ?? t("sidebar.syncSettings")}
    />
    {#if lock.enabled}
      <IconButton icon="lock" iconSize={16} label={t("sidebar.lock")} onclick={() => lock.lockNow()} />
    {/if}
    <IconButton icon="settings" iconSize={17} label={t("sidebar.settings")} onclick={() => void openSettings()} />
  </footer>
</nav>

<style>
  /* While a row is dragged to another place (reorder.ts), as a block in a note is (editor.css): it fades, and a line glides to where it'll go. */
  .sidebar :global(.reordering) {
    opacity: 0.35;
  }

  .sidebar :global(.reorder-line) {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 3;
    height: 2px;
    border-radius: calc(1px * var(--radius-scale));
    background: var(--accent);
    pointer-events: none;
    transition: transform 120ms ease-out;
    will-change: transform;
  }

  @media (prefers-reduced-motion: reduce) {
    .sidebar :global(.reorder-line) {
      transition: none;
    }
  }

  :global(:root.rows-dragging),
  :global(:root.rows-dragging *) {
    cursor: grabbing !important;
    user-select: none;
  }
</style>
