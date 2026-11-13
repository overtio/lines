<script lang="ts">
  // A choice from a long list, found by typing: a field drawn as a Select is, one height
  // (h-control), whose options its owner finds by what's typed (`query`). Closed, or open before
  // anything's typed, it shows the choice. Only the first options are drawn, more as the list is
  // scrolled or arrowed through, so hundreds open at once.
  import { Combobox } from "bits-ui";
  import type { Snippet } from "svelte";
  import { speak } from "../../a11y";
  import Icon from "../../icons/Icon.svelte";
  import { floating, option as optionClass } from "./styles";

  type Option = { value: string; label: string };
  type Props = {
    value: string;
    options: readonly Option[];
    onchange: (value: string) => void;
    label: string;
    placeholder?: string;
    /** What's typed since it opened. */
    query?: string;
    /** Shown under the options (in place of them, while there are none): why, or what to do. */
    message?: string | null;
    /** How many options there are, as a screen reader hears it. */
    counted: (count: number) => string;
    onopen?: () => void;
    /** An option's content, in place of its label. */
    item?: Snippet<[Option]>;
    class?: string;
  };
  let { value, options, onchange, label, placeholder, query = $bindable(""), message = null, counted, onopen, item, class: className }: Props = $props();

  /** How many options are drawn at first, and added each time the end of the list comes near. */
  const PAGE = 60;

  let open = $state(false);
  let typing = $state(false);
  let limit = $state(PAGE);
  const shown = $derived(options.slice(0, limit));
  const chosen = $derived(options.find((option) => option.value === value)?.label ?? value);

  function more() {
    if (limit < options.length) limit += PAGE;
  }

  function openChange(opened: boolean) {
    limit = PAGE;
    if (opened) {
      onopen?.();
    } else {
      typing = false;
      query = "";
    }
  }

  /** Opened by the page rather than Bits UI, which says so only of its own. */
  function show() {
    if (open) return;
    open = true;
    openChange(true);
  }

  function type(event: Event & { currentTarget: HTMLInputElement }) {
    query = event.currentTarget.value;
    typing = true;
    limit = PAGE;
  }

  // Said as it opens, the options arrive or typing pauses.
  $effect(() => {
    if (!open) return;
    const said = options.length ? counted(options.length) : message;
    if (!said) return;
    const timer = setTimeout(() => speak(said), 400);
    return () => clearTimeout(timer);
  });
</script>

<Combobox.Root type="single" {value} onValueChange={(next) => next && next !== value && onchange(next)} bind:open onOpenChange={openChange} allowDeselect={false}>
  <div class={["relative min-w-32", className]}>
    <Combobox.Input aria-label={label} {placeholder} oninput={type} onclick={show} onfocus={(event) => event.currentTarget.select()}>
      {#snippet child({ props })}
        <input
          {...props}
          value={typing ? query : chosen}
          autocomplete="off"
          spellcheck="false"
          class="ui-select h-control w-full truncate rounded-md border border-line bg-panel pr-8 pl-2.5 font-[inherit] text-sm text-fg shadow-segment transition-colors placeholder:text-faint enabled:hover:bg-hover disabled:opacity-45"
        />
      {/snippet}
    </Combobox.Input>
    <!-- The field opens the list as well, by click, typing or ↓, so the button is only for the pointer. -->
    <Combobox.Trigger tabindex={-1} aria-hidden="true" class="absolute inset-y-0 right-0 flex w-8 items-center justify-center">
      <Icon name="chevrons-up-down" size={14} class="text-faint" />
    </Combobox.Trigger>
  </div>
  <Combobox.Portal>
    <Combobox.Content sideOffset={4} collisionPadding={8} class="{floating} max-h-72 w-(--bits-combobox-anchor-width) p-1">
      <Combobox.Viewport onscroll={({ currentTarget: list }) => list.scrollTop + list.clientHeight * 2 >= list.scrollHeight && more()}>
        {#each shown as option, index (option.value)}
          <Combobox.Item value={option.value} label={option.label} class="{optionClass} justify-between gap-4" onHighlight={() => index >= shown.length - 8 && more()}>
            {#snippet children({ selected })}
              {#if item}{@render item(option)}{:else}<span class="truncate">{option.label}</span>{/if}
              {#if selected}<Icon name="check" size={14} class="shrink-0 text-accent!" />{/if}
            {/snippet}
          </Combobox.Item>
        {/each}
        {#if message}<p class="m-0 px-2.5 py-1.5 text-sm text-muted">{message}</p>{/if}
      </Combobox.Viewport>
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>
