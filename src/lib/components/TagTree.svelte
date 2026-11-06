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
  import { notes, type TagNode } from "../notes/store.svelte";
  import { tagIcons } from "../notes/tagIcons.svelte";
  import { ui } from "../ui.svelte";
  import SidebarRow from "./SidebarRow.svelte";
  import TagTree from "./TagTree.svelte";

  let {
    nodes,
    onchoose,
    depth = 0,
    id,
    labelledby,
  }: {
    nodes: TagNode[];
    onchoose: (tag: string) => void;
    depth?: number;
    /** For a nested tree, so its parent's disclosure button can say what it shows. */
    id?: string;
    /** The id of the heading the tree sits under. */
    labelledby?: string;
  } = $props();

  /** The tag whose menu is open, outlined like a right-clicked note. */
  let menuFor = $state<string | null>(null);
  /** The tag being renamed in place, and the name typed so far. */
  let renaming = $state<string | null>(null);
  let draft = $state("");

  function startRename(tag: string) {
    renaming = tag;
    draft = tag;
  }

  function finishRename() {
    const from = renaming;
    renaming = null;
    const to = draft.replace(/^#+/, "").replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "");
    if (!from || !to || to.toLowerCase() === from) return;
    notes.renameTag(from, to);
    tagIcons.rename(from, to.toLowerCase());
  }

  /** Only characters a tag can contain; spaces become dashes as you type. */
  function oninput(event: Event & { currentTarget: HTMLInputElement }) {
    const clean = event.currentTarget.value.replace(/\s+/g, "-").replace(/[^\p{L}\p{N}_\-/#]/gu, "");
    event.currentTarget.value = draft = clean;
  }

  function onRenameKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      (event.currentTarget as HTMLInputElement).blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      draft = renaming ?? "";
      (event.currentTarget as HTMLInputElement).blur();
    }
  }

  function showMenu(tag: string, x: number, y: number) {
    menuFor = tag;
    ui.openMenu({
      x,
      y,
      label: `#${tag}`,
      items: [
        { label: t("sidebar.rename"), icon: "pencil", run: () => startRename(tag) },
        {
          label: t("sidebar.changeIcon"),
          icon: "smile",
          run: () =>
            (ui.iconPicker = {
              key: `tag:${tag}`,
              label: tag,
              fallback: "hash",
              icon: () => (tagIcons.get(tag) === "hash" ? null : tagIcons.get(tag)),
              set: (icon) => tagIcons.set(tag, icon ?? "hash"),
              x,
              y,
            }),
        },
      ],
      onclose: () => (menuFor = null),
    });
  }

  function oncontextmenu(event: MouseEvent, tag: string) {
    event.preventDefault();
    // Android also fires this after a long press, when the menu is already up.
    if (menuFor === tag) return;
    const { x, y } = menuPoint(event);
    showMenu(tag, x, y);
  }

  function toggle(path: string) {
    if (expanded.has(path)) expanded.delete(path);
    else expanded.add(path);
  }
</script>

<!-- A small gap so neighboring highlights never touch, including nested tags. -->
<ul {id} aria-labelledby={labelledby} class={["flex flex-col gap-0.5", depth > 0 && "mt-0.5"]}>
  {#each nodes as node (node.path)}
    {@const open = expanded.has(node.path)}
    <li>
      <div class="relative" style:padding-left="{depth * 14}px">
        <!-- Room at the end for the disclosure button, as tall as the row on a touch screen. -->
        <SidebarRow
          class="pr-[30px] coarse:pr-12"
          icon={tagIcons.get(node.path)}
          label={node.name}
          count={node.count}
          active={notes.filter.kind === "tag" && notes.filter.tag === node.path}
          marked={menuFor === node.path || ui.iconPicker?.key === `tag:${node.path}`}
          rename={renaming === node.path
            ? { value: draft, "aria-label": t("list.tagName"), oninput, onkeydown: onRenameKeydown, onblur: finishRename }
            : undefined}
          onclick={() => onchoose(node.path)}
          oncontextmenu={(event) => oncontextmenu(event, node.path)}
          {@attach longPress((x, y) => showMenu(node.path, x, y))}
        />
        {#if node.children.length}
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
        <TagTree nodes={node.children} {onchoose} depth={depth + 1} id="tags-in-{node.path}" />
      {/if}
    </li>
  {/each}
</ul>
