<script lang="ts">
  // A small box at a point (the pointer, or a button's corner) asking for one thing: its title, a
  // field with an icon and the button that does it, and whatever goes under them (suggestions, a
  // hint, why it couldn't be done). Focus goes into the field as it opens and back as it closes.
  import { Popover } from "bits-ui";
  import type { Snippet } from "svelte";
  import type { HTMLInputAttributes } from "svelte/elements";
  import Icon from "../../icons/Icon.svelte";
  import type { IconName } from "../../icons/icons";
  import { pointAt, takeFocus } from "../../popover";
  import { floating } from "./styles";

  type Props = Omit<HTMLInputAttributes, "value" | "title" | "class" | "onsubmit" | "onkeydown"> & {
    /** Where it opens, or null while it's closed. */
    at: { x: number; y: number; align?: "start" | "center" | "end" } | null;
    title: string;
    icon: IconName;
    /** The button's label. */
    action: string;
    /** Whether the button can be pressed. */
    ready: boolean;
    /** Doing it: the button spins, and can't be pressed again. */
    busy?: boolean;
    value?: string;
    /** Its width, as a Tailwind class. */
    width?: string;
    onclose: () => void;
    onsubmit: () => void;
    /** Keys pressed anywhere in it (↑ ↓ through suggestions). */
    onkeydown?: (event: KeyboardEvent) => void;
    children?: Snippet;
  };

  let {
    at,
    title,
    icon,
    action,
    ready,
    busy = false,
    value = $bindable(""),
    width = "w-[min(300px,calc(100vw-16px))]",
    onclose,
    onsubmit,
    onkeydown,
    children,
    ...field
  }: Props = $props();

  let el = $state<HTMLElement | null>(null);
  let input = $state<HTMLInputElement>();
  let restore: (() => void) | undefined;

  const anchor = $derived(at && pointAt(at.x, at.y));
</script>

<Popover.Root open={!!at} onOpenChange={(open) => !open && onclose()}>
  <Popover.Portal>
    <Popover.Content
      bind:ref={el}
      customAnchor={anchor}
      align={at?.align ?? "start"}
      sideOffset={0}
      collisionPadding={8}
      role="dialog"
      aria-label={title}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        restore = takeFocus(el!, input);
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        restore?.();
      }}
      {onkeydown}
      class="{floating} {width} p-2.5"
    >
      <form
        onsubmit={(event) => {
          event.preventDefault();
          if (ready && !busy) onsubmit();
        }}
      >
        <p class="m-0 mx-0.5 mb-2 text-xs font-semibold text-muted" aria-hidden="true">{title}</p>
        <div class="flex items-center gap-1.5 rounded-md border border-transparent bg-input pl-2 text-faint focus-within:border-accent">
          <Icon name={icon} size={14} />
          <input
            bind:this={input}
            bind:value
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            class="h-[30px] min-w-0 flex-1 border-0 bg-transparent p-0 font-[inherit] text-sm text-fg outline-none placeholder:text-faint coarse:h-11"
            {...field}
          />
          <button
            class="m-0.5 inline-flex h-[26px] items-center gap-1 rounded-sm bg-accent px-2.5 text-xs font-semibold text-on-accent disabled:opacity-45 coarse:h-10"
            type="submit"
            disabled={!ready || busy}
            aria-busy={busy}
          >
            {#if busy}<Icon name="loader" size={12} class="animate-spin" />{/if}{action}
          </button>
        </div>
        {@render children?.()}
      </form>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
