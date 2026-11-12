<script lang="ts" module>
  import { SvelteSet } from "svelte/reactivity";

  /** Expanded tags, shared by every level so nested ones stay open when a parent is collapsed. */
  const expanded = new SvelteSet<string>();
</script>

<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { menuPoint } from "../popover";
  import { longPress } from "../longPress";
  import { cleanTagInput, normalizeTag } from "../notes/parse";
  import { notes, type TagNode } from "../notes/store.svelte";
  import { tagLooks } from "../notes/looks.svelte";
  import { panes } from "../panes.svelte";
  import { sidebarLayout } from "../sidebarLayout.svelte";
  import { type MenuItem, ui } from "../ui.svelte";
  import { reorderable } from "./reorder";
  import { hideItems, sizeItems } from "./sidebarMenus";
  import SidebarRow from "./SidebarRow.svelte";
  import SidebarDivider from "./SidebarDivider.svelte";
  import TagTree from "./TagTree.svelte";

  let {
    nodes,
    onchoose,
    extraItems,
    depth = 0,
    parent = "",
    id,
    labelledby,
  }: {
    nodes: TagNode[];
    onchoose: (tag: string) => void;
    /** What every tag's menu ends with, opened at a point: Show Hidden. */
    extraItems: (x: number, y: number) => MenuItem[];
    depth?: number;
    /** The tag these are nested in; empty at the top. */
    parent?: string;
    /** For a nested tree, so its parent's disclosure button can say what it shows. */
    id?: string;
    /** The id of the heading the tree sits under. */
    labelledby?: string;
  } = $props();

  /** This level's tags in the order chosen, hidden ones too, and those shown. */
  const list = $derived(`tags:${parent}`);
  const ordered = $derived(sidebarLayout.arrange("tags", list, nodes, (node) => node.path, (node) => node.name, (node) => node.count));
  /** A line put among this level's tags (SidebarDivider.svelte), drawn while they're in an order of your own. */
  type Row = TagNode | { key: string; divider: true };
  const keyOf = (row: Row) => ("divider" in row ? row.key : row.path);
  const rows = $derived<Row[]>(
    sidebarLayout.sortOf("tags") === "manual" ? sidebarLayout.sorted(list, [...ordered, ...sidebarLayout.dividersIn(list).map((key) => ({ key, divider: true as const }))], keyOf) : ordered,
  );
  const keys = $derived(rows.map(keyOf));
  const visible = (node: TagNode) => !sidebarLayout.isHidden(`tag:${node.path}`);
  const shown = $derived(rows.filter((row) => "divider" in row || visible(row)));

  /** The tag whose menu is open, outlined like a right-clicked note. */
  let menuFor = $state<string | null>(null);
  /** The tag being renamed in place, and the name typed so far. */
  let renaming = $state<string | null>(null);
  let draft = $state("");

  function startRename(tag: string) {
    renaming = tag;
    draft = tag;
  }

  /** Renames the tag, if it was given a new name; from the keyboard, focus goes back to its row. */
  function finishRename(refocus = false) {
    const from = renaming;
    renaming = null;
    if (!from) return;
    const to = draft.replace(/^#+/, "").replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "");
    let tag = from;
    if (to && to.toLowerCase() !== from) {
      notes.renameTag(from, to);
      tag = normalizeTag(to) ?? from;
      tagLooks.rename(from, to.toLowerCase());
      sidebarLayout.rename("tag", from, tag);
    }
    if (refocus) requestAnimationFrame(() => document.querySelector<HTMLElement>(`.sidebar [data-tag="${CSS.escape(tag)}"]`)?.focus());
  }

  /** Only characters a tag can contain; spaces become dashes as you type. */
  function oninput(event: Event & { currentTarget: HTMLInputElement }) {
    event.currentTarget.value = draft = cleanTagInput(event.currentTarget.value);
  }

  function onRenameKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== "Escape") return;
    event.preventDefault();
    if (event.key === "Escape") draft = renaming ?? "";
    finishRename(true);
  }

  function showDividerMenu(key: string, x: number, y: number) {
    menuFor = key;
    ui.openMenu({
      x,
      y,
      label: t("sidebar.divider"),
      items: [{ label: t("sidebar.removeDivider"), icon: "trash", run: () => sidebarLayout.removeListDivider(list, key) }],
      onclose: () => (menuFor = null),
    });
  }

  function showMenu(tag: string, x: number, y: number, canTile: boolean) {
    menuFor = tag;
    ui.openMenu({
      x,
      y,
      label: `#${tag}`,
      items: [
        { label: t("sidebar.rename"), icon: "pencil", run: () => startRename(tag) },
        {
          label: t("sidebar.iconAndColor"),
          icon: "smile",
          run: () =>
            (ui.iconPicker = {
              key: `tag:${tag}`,
              label: tag,
              fallback: "hash",
              icon: () => tagLooks.chosenIcon(tag) ?? null,
              set: (icon) => tagLooks.setIcon(tag, icon),
              color: {
                get: () => tagLooks.color(tag) ?? null,
                set: (color) => tagLooks.setColor(tag, color),
                // A nested tag without a color of its own has the one of the tag it's in.
                inherited: tagLooks.inherited(tag),
              },
              x,
              y,
            }),
        },
        { label: t("sidebar.addDividerBelow"), icon: "minus", run: () => sidebarLayout.addListDivider(list, keys, tag, "tags") },
        "separator",
        ...sizeItems("tags", `tag:${tag}`, undefined, canTile),
        "separator",
        ...hideItems("tag", tag),
        ...extraItems(x, y),
      ],
      onclose: () => (menuFor = null),
    });
  }

  function oncontextmenu(event: MouseEvent, tag: string, canTile: boolean) {
    event.preventDefault();
    // Android also fires this after a long press, when the menu is already up.
    if (menuFor === tag) return;
    const { x, y } = menuPoint(event);
    showMenu(tag, x, y, canTile);
  }

  function toggle(path: string) {
    if (expanded.has(path)) expanded.delete(path);
    else expanded.add(path);
  }
</script>

<!-- A small gap so neighboring highlights never touch, including nested tags; tiles two to a line. -->
<ul
  {id}
  aria-labelledby={labelledby}
  class={["grid grid-cols-2 gap-x-1.5 gap-y-0.5 [&>:not([data-tile])]:col-span-2 [&>[data-tile]]:mb-1", depth > 0 && "mt-0.5"]}
>
  {#each shown as row (keyOf(row))}
    {#if "divider" in row}
      <SidebarDivider
        list={list}
        id={row.key}
        marked={menuFor === row.key}
        style="padding-left: {depth * 14}px"
        onmove={(before) => sidebarLayout.move(list, keys, row.key, before, "tags")}
        onmenu={(x, y) => showDividerMenu(row.key, x, y)}
      />
    {:else}
    {@const node = row}
    <!-- Its nested tags all hidden, it has none to show: no arrow. -->
    {@const nested = node.children.some(visible)}
    {@const open = nested && expanded.has(node.path)}
    <!-- With nested tags to open, never a tile. -->
    {@const chosen = sidebarLayout.sizeOf(`tag:${node.path}`, "tags")}
    {@const size = (nested || renaming === node.path) && chosen === "large" ? "standard" : chosen}
    <!-- Dragged, a tag goes with its nested tags (reorder.ts). -->
    <li data-reorder-area data-tile={size === "large" || undefined}>
      <div class="relative" style:padding-left="{depth * 14}px">
        <!-- Room at the end for the disclosure button, as tall as the row on a touch screen. -->
        <SidebarRow
          {size}
          class={nested ? "pr-[30px] coarse:pr-12" : undefined}
          icon={tagLooks.icon(node.path)}
          color={tagLooks.shownColor(node.path)}
          label={node.name}
          count={node.count}
          active={notes.filter.kind === "tag" && notes.filter.tag === node.path}
          marked={menuFor === node.path || ui.iconPicker?.key === `tag:${node.path}` || panes.rowAt === `tag:${node.path}`}
          data-note-drop="tag:{node.path}"
          rename={renaming === node.path
            ? { value: draft, "aria-label": t("list.tagName"), oninput, onkeydown: onRenameKeydown, onblur: () => finishRename() }
            : undefined}
          data-tag={node.path}
          onclick={() => onchoose(node.path)}
          oncontextmenu={(event) => oncontextmenu(event, node.path, !nested)}
          {@attach longPress((x, y) => showMenu(node.path, x, y, !nested))}
          {@attach reorderable(list, node.path, (before) => sidebarLayout.move(list, keys, node.path, before, "tags"), true)}
        />
        {#if nested}
          <button
            class={[
              "absolute top-1/2 right-1 -mt-3 grid size-6 place-items-center rounded-sm text-faint transition-[rotate,background-color] hover:bg-hover hover:text-muted coarse:right-0 coarse:-mt-[22px] coarse:size-11",
              open && "rotate-90",
            ]}
            onclick={() => toggle(node.path)}
            aria-label={t("list.nestedTags", { tag: node.name })}
            title={t("list.nestedTags", { tag: node.name })}
            aria-expanded={open}
            aria-controls={open ? `tags-in-${node.path}` : undefined}
          >
            <Icon name="chevron-right" size={14} />
          </button>
        {/if}
      </div>
      {#if open}
        <TagTree nodes={node.children} {onchoose} {extraItems} depth={depth + 1} parent={node.path} id="tags-in-{node.path}" />
      {/if}
    </li>
    {/if}
  {/each}
</ul>
