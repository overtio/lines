<script lang="ts">
  import { Popover } from "bits-ui";
  import { speak } from "../a11y";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { normalizeTag } from "../notes/parse";
  import { notes, type TagNode } from "../notes/store.svelte";
  import { pointAt, takeFocus } from "../popover";
  import { ui } from "../ui.svelte";
  import { floating } from "./ui/styles";

  /** How many tags it suggests at most. */
  const SUGGESTIONS = 6;

  let el = $state<HTMLElement | null>(null);
  let input = $state<HTMLInputElement>();
  /** Gives focus back where it was when the box closes. */
  let restore: (() => void) | undefined;
  let value = $state("");
  /** The suggestion ↑ and ↓ are on, if any. */
  let active = $state(-1);

  const prompt = $derived(ui.tagPrompt);

  const allTags = $derived.by(() => {
    const paths: string[] = [];
    const walk = (nodes: TagNode[]) => {
      for (const node of nodes) {
        paths.push(node.path);
        walk(node.children);
      }
    };
    walk(notes.tagTree);
    return paths;
  });

  /** Tags already used that match what's typed: those starting with it first. */
  const suggestions = $derived.by(() => {
    const q = value.trim().replace(/^#/, "").toLowerCase();
    if (!q) return allTags.slice(0, SUGGESTIONS);
    const starts = allTags.filter((tag) => tag.split("/").some((part) => part.startsWith(q)) || tag.startsWith(q));
    const contains = allTags.filter((tag) => !starts.includes(tag) && tag.includes(q));
    return [...starts, ...contains].filter((tag) => tag !== q).slice(0, SUGGESTIONS);
  });

  const typed = $derived(normalizeTag(value.trim().replace(/^#/, "")));

  /** It opens at a point: the pointer, or a button's corner. */
  const anchor = $derived(prompt && pointAt(prompt.x, prompt.y));

  // A new search starts with nothing chosen.
  $effect(() => {
    void value;
    active = -1;
  });

  function close() {
    ui.tagPrompt = null;
    value = "";
  }

  function add(name: string) {
    const tag = normalizeTag(name.trim().replace(/^#/, ""));
    if (!prompt || !tag) return;
    const count = notes.addTag(prompt.ids, tag);
    const locked = prompt.ids.some((id) => notes.get(id)?.note.locked);
    speak(`${t("list.tagged", { count, tag })}${locked ? ` ${t("list.taggedLocked")}` : ""}`);
    close();
  }

  function onsubmit(event: SubmitEvent) {
    event.preventDefault();
    add(active >= 0 ? suggestions[active] : value);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!suggestions.length) return;
      event.preventDefault();
      // Past either end, back to what's typed.
      const count = suggestions.length + 1;
      const next = (active + 1 + (event.key === "ArrowDown" ? 1 : -1) + count) % count;
      active = next - 1;
    } else if (event.key === "Tab" && active >= 0) {
      // Fills in the suggestion, to type a tag nested under it.
      event.preventDefault();
      value = `${suggestions[active]}/`;
    }
  }
</script>

<Popover.Root open={!!prompt} onOpenChange={(open) => !open && close()}>
  <Popover.Portal>
    <Popover.Content
      bind:ref={el}
      customAnchor={anchor}
      align={prompt?.align ?? "start"}
      sideOffset={0}
      collisionPadding={8}
      role="dialog"
      aria-label={t("list.tagFor", { count: prompt?.ids.length ?? 0 })}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        restore = takeFocus(el!, input);
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        restore?.();
      }}
      {onkeydown}
      class="{floating} w-[min(300px,calc(100vw-16px))] p-2.5"
    >
      <form {onsubmit}>
        <p class="m-0 mx-0.5 mb-2 text-xs font-semibold text-muted" aria-hidden="true">{t("list.tagFor", { count: prompt?.ids.length ?? 0 })}</p>
        <div class="flex items-center gap-1.5 rounded-md border border-transparent bg-input pl-2 text-faint focus-within:border-accent">
          <Icon name="hash" size={14} />
          <input
            bind:this={input}
            bind:value
            placeholder={t("list.tagName")}
            aria-label={t("list.tagName")}
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="tag-prompt-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `tag-suggestion-${active}` : undefined}
            class="h-[30px] min-w-0 flex-1 border-0 bg-transparent p-0 font-[inherit] text-sm text-fg outline-none placeholder:text-faint coarse:h-11"
          />
          <button
            class="m-0.5 h-[26px] rounded-sm bg-accent px-2.5 text-xs font-semibold text-on-accent disabled:opacity-45 coarse:h-10"
            type="submit"
            disabled={!typed && active < 0}>{t("list.tagAdd")}</button
          >
        </div>
        {#if suggestions.length}
          <ul id="tag-prompt-suggestions" role="listbox" aria-label={t("list.tagName")} class="mt-1.5">
            {#each suggestions as tag, i (tag)}
              <li id="tag-suggestion-{i}" role="option" aria-selected={i === active}>
                <!-- For a pointer; the keyboard uses ↑ ↓ and Enter in the field. -->
                <button
                  type="button"
                  tabindex="-1"
                  onclick={() => add(tag)}
                  class={[
                    "w-full rounded-sm px-2 py-[5px] text-left text-sm hover:bg-hover hover:text-fg coarse:min-h-11",
                    i === active ? "bg-hover text-fg" : "text-muted",
                  ]}>#{tag}</button
                >
              </li>
            {/each}
          </ul>
        {/if}
      </form>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
