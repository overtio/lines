<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import { longPress } from "../longPress";
  import { menuPoint } from "../popover";
  import { reorderable } from "./reorder";

  /*
   * A line between rows of the sidebar, put there from a row's menu: among the places, the types or
   * the tags. Dragged (or moved with ⌥↑ ⌥↓) among its list's rows as they are, and removed from its
   * own menu, so it's a button, to have focus; pressing it does nothing. At the end of a section, or
   * the start of one without a heading, it's drawn halfway into the gap beside it (`style`).
   */

  let {
    list,
    id,
    marked = false,
    style,
    onmove,
    onmenu,
  }: {
    /** The list it's ordered in (reorder.ts), and its key there. */
    list: string;
    id: string;
    /** Its menu's open. */
    marked?: boolean;
    style?: string;
    onmove: (before: string | null) => void;
    onmenu: (x: number, y: number) => void;
  } = $props();
</script>

<li {style}>
  <button
    type="button"
    class={["flex h-3.5 w-full cursor-default items-center rounded-sm px-2.5", marked && "inset-ring-2 inset-ring-accent"]}
    aria-label={t("sidebar.divider")}
    oncontextmenu={(event) => {
      event.preventDefault();
      if (marked) return;
      const { x, y } = menuPoint(event);
      onmenu(x, y);
    }}
    {@attach longPress(onmenu)}
    {@attach reorderable(list, id, onmove)}
  >
    <span class="h-px flex-1 bg-line" aria-hidden="true"></span>
  </button>
</li>
