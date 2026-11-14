<script lang="ts">
  import { DropdownMenu } from "bits-ui";
  import Icon from "../icons/Icon.svelte";
  import { pointAt } from "../popover";
  import { ui, type MenuItem } from "../ui.svelte";
  import { floating, option, separator } from "./ui/styles";

  /*
   * The one menu open at a time (ui.openMenu): a note's or a tag's, or a toolbar button's. It opens
   * at a point (the pointer, or under the button), flipping away from the window's edges, and gives
   * focus back where it was when it closes.
   */

  let content = $state<HTMLElement | null>(null);
  /** What had focus as it opened. */
  let previous: Element | null = null;

  const anchor = $derived(ui.menu && pointAt(ui.menu.x, ui.menu.y));

  $effect.pre(() => {
    if (ui.menu) previous = document.activeElement;
  });

  /** Focus goes back before the item runs, so a dialog it opens gives focus back there too as it closes. */
  function choose(item: Extract<MenuItem, { run: () => void }>) {
    ui.closeMenu();
    if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    item.run();
  }

  /** A press on the button that opened it is left to that button, which closes it. */
  function onInteractOutside(event: PointerEvent) {
    if (ui.menu?.anchor?.contains(event.target as Node)) event.preventDefault();
  }

  /** Focus goes back, unless something else took it as the menu closed (a click elsewhere). It's still in the menu here. */
  function onCloseAutoFocus(event: Event) {
    event.preventDefault();
    const active = document.activeElement;
    const lost = !active || active === document.body || !!content?.contains(active);
    if (lost && previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
  }
</script>

{#snippet list(items: MenuItem[])}
  {#each items as item, i (i)}
    {#if item === "separator"}
      <DropdownMenu.Separator class={separator} />
    {:else if "items" in item}
      <!-- A menu of its own, opened beside it by pointing at it, → or ↵, and closed again by ←. -->
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger class={option}>
          {#if item.icon}<Icon name={item.icon} size={15} />{/if}
          {item.label}
          <Icon name="chevron-right" size={14} class="ms-auto" />
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent sideOffset={4} collisionPadding={8} class="{floating} min-w-40 p-[5px]">
            {@render list(item.items)}
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
    {:else if item.checked !== undefined}
      <!-- A choice, read as checked or not, its check where other items have their icon. -->
      <DropdownMenu.CheckboxItem checked={item.checked} onSelect={() => choose(item)} class={option}>
        {#if item.checked}<Icon name="check" size={15} class="text-accent!" />{:else}<span class="size-[15px] shrink-0"></span>{/if}
        {item.label}
      </DropdownMenu.CheckboxItem>
    {:else}
      <DropdownMenu.Item onSelect={() => choose(item)} class={[option, item.danger && "text-danger! [&_.icon]:text-danger!"]}>
        {#if item.icon}<Icon name={item.icon} size={15} />{/if}
        {item.label}
      </DropdownMenu.Item>
    {/if}
  {/each}
{/snippet}

<!-- Bound both ways: a menu that closes itself (an item chosen) is closed in `ui` too, or the next one wouldn't open. -->
<DropdownMenu.Root bind:open={() => !!ui.menu, (open) => !open && ui.closeMenu()}>
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      bind:ref={content}
      customAnchor={anchor}
      align={ui.menu?.align ?? "start"}
      sideOffset={0}
      collisionPadding={8}
      aria-label={ui.menu?.label}
      {onInteractOutside}
      {onCloseAutoFocus}
      oncontextmenu={(event) => event.preventDefault()}
      class="{floating} min-w-48 p-[5px]"
    >
      {@render list(ui.menu?.items ?? [])}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
