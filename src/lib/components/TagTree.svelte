<script lang="ts" module>
  import { SvelteSet } from "svelte/reactivity";

  /** Expanded tags, shared by every level so nested ones stay open when a parent is collapsed. */
  const expanded = new SvelteSet<string>();
</script>

<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import { menuPoint } from "../popover";
  import { longPress } from "../longPress";
  import { notes, type TagNode } from "../notes/store.svelte";
  import { tagIcons } from "../notes/tagIcons.svelte";
  import { ui } from "../ui.svelte";
  import TagTree from "./TagTree.svelte";

  let { nodes, onchoose, depth = 0 }: { nodes: TagNode[]; onchoose: (tag: string) => void; depth?: number } =
    $props();

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

  const focusAndSelect = (input: HTMLInputElement) => {
    input.focus();
    input.select();
  };

  function showMenu(tag: string, x: number, y: number) {
    menuFor = tag;
    const custom = tagIcons.get(tag) !== "hash";
    ui.openMenu({
      x,
      y,
      items: [
        { label: "Rename…", icon: "pencil", run: () => startRename(tag) },
        {
          label: "Change Icon…",
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
        ...(custom ? [{ label: "Reset Icon", icon: "hash" as const, run: () => tagIcons.set(tag, "hash") }] : []),
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

<ul>
  {#each nodes as node (node.path)}
    {@const active = notes.filter.kind === "tag" && notes.filter.tag === node.path}
    {@const open = expanded.has(node.path)}
    <li>
      <div class="tag-item" style:--depth={depth}>
        {#if renaming === node.path}
          <div class="row renaming">
            <Icon name={tagIcons.get(node.path)} size={16} strokeWidth={1.75} />
            <input
              class="label"
              value={draft}
              aria-label="Tag name"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              {oninput}
              onkeydown={onRenameKeydown}
              onblur={finishRename}
              {@attach focusAndSelect}
            />
          </div>
        {:else}
          <button
            class="row"
            class:active
            class:menu-target={menuFor === node.path || ui.iconPicker?.key === `tag:${node.path}`}
            onclick={() => onchoose(node.path)}
            oncontextmenu={(event) => oncontextmenu(event, node.path)}
            {@attach longPress((x, y) => showMenu(node.path, x, y))}
            aria-current={active}
          >
            <Icon name={tagIcons.get(node.path)} size={16} strokeWidth={1.75} />
            <span class="label">{node.name}</span>
            <span class="count">{node.count}</span>
          </button>
        {/if}
        {#if node.children.length}
          <button
            class="disclosure"
            class:open
            onclick={() => toggle(node.path)}
            aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
            aria-expanded={open}
          >
            <Icon name="chevron-right" size={14} />
          </button>
        {/if}
      </div>
      {#if open}
        <TagTree nodes={node.children} {onchoose} depth={depth + 1} />
      {/if}
    </li>
  {/each}
</ul>

<style>
  .tag-item {
    position: relative;
    padding-left: calc(var(--depth) * 14px);
  }

  .tag-item :global(.row.row) {
    padding-right: 30px;
  }

  .row.menu-target {
    box-shadow: inset 0 0 0 2px var(--accent);
  }

  .row {
    -webkit-touch-callout: none;
  }

  .renaming {
    box-shadow: inset 0 0 0 2px var(--accent-soft);
    background: var(--bg);
  }

  .renaming input {
    height: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    outline: none;
  }

  .disclosure {
    position: absolute;
    right: 4px;
    top: 50%;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    margin-top: -11px;
    border-radius: 6px;
    color: var(--text-faint);
    transition: transform 150ms ease, background-color 120ms ease;
  }

  @media (hover: hover) {
    .disclosure:hover {
      background: var(--hover);
      color: var(--text-muted);
    }
  }

  .disclosure.open {
    transform: rotate(90deg);
  }
</style>
