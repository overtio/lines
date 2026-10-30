<script lang="ts">
  import { speak } from "../a11y";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { normalizeTag } from "../notes/parse";
  import { notes, type TagNode } from "../notes/store.svelte";
  import { dismissable, placeAt, takeFocus } from "../popover";
  import { ui } from "../ui.svelte";

  /** How many tags it suggests at most. */
  const SUGGESTIONS = 6;

  let el = $state<HTMLDivElement>();
  let input = $state<HTMLInputElement>();
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

  $effect(() => {
    const p = ui.tagPrompt;
    if (!p || !el || !input) return;
    placeAt(el, p.x, p.y, p.align);
    return takeFocus(el, input);
  });

  $effect(() => {
    if (ui.tagPrompt) return dismissable(() => el, close);
  });

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
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
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

{#if prompt}
  <div class="tag-prompt popover" role="dialog" tabindex="-1" aria-label={t("list.tagFor", { count: prompt.ids.length })} bind:this={el} {onkeydown}>
    <form {onsubmit}>
    <p class="title" aria-hidden="true">{t("list.tagFor", { count: prompt.ids.length })}</p>
    <div class="field">
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
      />
      <button class="add" type="submit" disabled={!typed && active < 0}>{t("list.tagAdd")}</button>
    </div>
    {#if suggestions.length}
      <ul id="tag-prompt-suggestions" role="listbox" aria-label={t("list.tagName")}>
        {#each suggestions as tag, i (tag)}
          <li id="tag-suggestion-{i}" role="option" aria-selected={i === active} class:active={i === active}>
            <!-- For a pointer; the keyboard uses ↑ ↓ and Enter in the field. -->
            <button type="button" tabindex="-1" onclick={() => add(tag)}>#{tag}</button>
          </li>
        {/each}
      </ul>
    {/if}
    </form>
  </div>
{/if}

<style>
  .tag-prompt {
    width: min(300px, calc(100vw - 16px));
    padding: 10px;
  }

  .title {
    margin: 0 2px 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .field {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-left: 8px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: var(--input);
    color: var(--text-faint);
  }

  .field:focus-within {
    border-color: var(--accent-soft);
  }

  input {
    flex: 1;
    min-width: 0;
    height: 30px;
    border: none;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    outline: none;
  }

  .add {
    height: 26px;
    margin: 2px;
    padding: 0 10px;
    border-radius: 6px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 12px;
    font-weight: 600;
  }

  .add:disabled {
    opacity: var(--disabled-opacity);
  }

  ul {
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
  }

  li button {
    width: 100%;
    padding: 5px 8px;
    border-radius: 6px;
    text-align: left;
    font-size: 13px;
    color: var(--text-muted);
  }

  li button:hover,
  li.active button {
    background: var(--hover);
    color: var(--text);
  }

  @media (pointer: coarse) {
    input,
    li button {
      min-height: 44px;
    }
  }
</style>
