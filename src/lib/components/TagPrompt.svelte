<script lang="ts">
  import { speak } from "../a11y";
  import { t } from "../i18n/index.svelte";
  import { cleanTagInput, normalizeTag } from "../notes/parse";
  import { notes, type TagNode } from "../notes/store.svelte";
  import { ui } from "../ui.svelte";
  import Prompt from "./ui/Prompt.svelte";

  /** How many tags it suggests at most. */
  const SUGGESTIONS = 6;

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

  function close() {
    ui.tagPrompt = null;
    value = "";
    active = -1;
  }

  function add(name: string) {
    const tag = normalizeTag(name.trim().replace(/^#/, ""));
    if (!prompt || !tag) return;
    const count = notes.addTag(prompt.ids, tag);
    const locked = prompt.ids.some((id) => notes.get(id)?.note.locked);
    speak(`${t("list.tagged", { count, tag })}${locked ? ` ${t("list.taggedLocked")}` : ""}`);
    close();
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
      active = -1;
    }
  }
</script>

<Prompt
  at={prompt}
  title={t("list.tagFor", { count: prompt?.ids.length ?? 0 })}
  icon="hash"
  action={t("list.tagAdd")}
  ready={!!typed || active >= 0}
  bind:value
  onclose={close}
  onsubmit={() => add(active >= 0 ? suggestions[active] : value)}
  {onkeydown}
  oninput={(event) => {
    // "two words" is #two-words.
    event.currentTarget.value = value = cleanTagInput(event.currentTarget.value);
    active = -1;
  }}
  placeholder={t("list.tagName")}
  aria-label={t("list.tagName")}
  role="combobox"
  aria-expanded={suggestions.length > 0}
  aria-controls="tag-prompt-suggestions"
  aria-autocomplete="list"
  aria-activedescendant={active >= 0 ? `tag-suggestion-${active}` : undefined}
>
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
</Prompt>
