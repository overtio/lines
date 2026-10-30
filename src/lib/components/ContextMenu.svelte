<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import { dismissable, placeAt, takeFocus } from "../popover";
  import { ui, type MenuItem } from "../ui.svelte";

  let el = $state<HTMLDivElement>();

  // Open at the pointer, flipping left or up near the window edges, with the first item focused
  // (focus goes back where it was when the menu closes).
  $effect(() => {
    const menu = ui.menu;
    if (!menu || !el) return;
    placeAt(el, menu.x, menu.y, menu.align);
    return takeFocus(el, el.querySelector<HTMLElement>('[role="menuitem"]') ?? el);
  });

  $effect(() => {
    if (ui.menu) return dismissable(() => el, () => ui.closeMenu(), ui.menu.anchor);
  });

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      ui.closeMenu();
      return;
    }
    const items = [...el!.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = (index <= 0 ? items.length : index) - 1;
    else if (event.key === "Home" || event.key === "PageUp") next = 0;
    else if (event.key === "End" || event.key === "PageDown") next = items.length - 1;
    else if (event.key.length === 1 && /\S/.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
      // A letter jumps to the next item starting with it, as in native menus.
      const key = event.key.toLocaleLowerCase();
      const order = [...items.slice(index + 1), ...items.slice(0, index + 1)];
      const found = order.find((item) => item.textContent?.trim().toLocaleLowerCase().startsWith(key));
      if (!found) return;
      next = items.indexOf(found);
    } else return;
    event.preventDefault();
    items[next]?.focus();
  }

  function choose(item: Exclude<MenuItem, "separator">) {
    ui.closeMenu();
    item.run();
  }
</script>

{#if ui.menu}
  <div
    class="menu popover"
    role="menu"
    tabindex="-1"
    aria-label={ui.menu.label}
    bind:this={el}
    {onkeydown}
    oncontextmenu={(event) => event.preventDefault()}
  >
    {#each ui.menu.items as item, i (i)}
      {#if item === "separator"}
        <div class="separator" role="separator"></div>
      {:else}
        <button role="menuitem" tabindex="-1" class:danger={item.danger} onclick={() => choose(item)}>
          {#if item.icon}<Icon name={item.icon} size={15} />{/if}
          {item.label}
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .menu {
    min-width: 190px;
    padding: 5px;
  }

  button {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    height: 28px;
    padding: 0 10px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text);
    text-align: left;
    white-space: nowrap;
  }

  button :global(.icon) {
    color: var(--text-muted);
  }

  button:hover,
  button:focus-visible {
    background: var(--active);
    outline: none;
  }

  .danger,
  .danger :global(.icon) {
    color: var(--danger);
  }

  .separator {
    height: 1px;
    margin: 4px 8px;
    background: var(--border);
  }

  /* Fingers need bigger targets. */
  @media (pointer: coarse) {
    button {
      height: 44px;
      font-size: 15px;
    }
  }
</style>
