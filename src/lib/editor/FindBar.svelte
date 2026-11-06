<script lang="ts">
  import { Toggle } from "bits-ui";
  import { t } from "../i18n/index.svelte";
  import Button from "../components/ui/Button.svelte";
  import IconButton from "../components/ui/IconButton.svelte";
  import TextField from "../components/ui/TextField.svelte";
  import { type FindState, MOST_MATCHES, type QuerySpec } from "./find.svelte";

  /*
   * The find bar (find.svelte.ts). ↵ goes to the next match and ⇧↵ to the one before; in the
   * replace field, ↵ replaces it and ⌘↵ replaces them all. Esc closes the bar, back in the note.
   */

  type Actions = {
    change: (change: Partial<QuerySpec>) => void;
    next: () => void;
    previous: () => void;
    replace: () => void;
    replaceAll: () => void;
    close: () => void;
  };
  let { find, actions }: { find: FindState; actions: Actions } = $props();

  let replacing = $state(false);

  const query = $derived(find.query);
  const invalid = $derived(!!query.search && !query.valid);
  const count = $derived.by(() => {
    if (!query.search) return "";
    if (invalid) return t("editor.find.invalid");
    if (find.count >= MOST_MATCHES) return t("editor.find.many", { count: MOST_MATCHES });
    if (find.current) return t("editor.find.count", { current: find.current, count: find.count });
    return t("editor.find.matches", { count: find.count });
  });

  const options: { key: "caseSensitive" | "regexp" | "wholeWord"; label: string; glyph: string }[] = [
    { key: "caseSensitive", label: t("editor.find.matchCase"), glyph: "Aa" },
    { key: "regexp", label: t("editor.find.regexp"), glyph: ".*" },
    { key: "wholeWord", label: t("editor.find.wholeWord"), glyph: "ab" },
  ];

  function findKeys(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (event.shiftKey) actions.previous();
    else actions.next();
  }

  function replaceKeys(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (event.metaKey || event.ctrlKey) actions.replaceAll();
    else actions.replace();
  }
</script>

<div class="flex flex-col gap-1.5 px-3 py-2" role="search" aria-label={t("editor.find.label")}>
  <div class="flex items-center gap-1">
    {#if !find.readOnly}
      <IconButton
        icon="chevron-right"
        iconSize={16}
        label={t("editor.find.showReplace")}
        aria-expanded={replacing}
        class={["[&_.icon]:transition-transform", replacing && "[&_.icon]:rotate-90"]}
        onclick={() => (replacing = !replacing)}
      />
    {/if}
    <TextField
      class="flex-1"
      icon="search"
      value={query.search}
      placeholder={t("editor.find.find")}
      aria-label={t("editor.find.find")}
      aria-invalid={invalid}
      oninput={(event) => actions.change({ search: event.currentTarget.value })}
      onkeydown={findKeys}
      {@attach (input) => input.setAttribute("main-field", "true")}
    >
      {#snippet trailing()}
        <span class={["shrink-0 text-xs tabular", invalid ? "text-danger" : "text-faint"]} role="status">{count}</span>
      {/snippet}
    </TextField>
    {#each options as option (option.key)}
      <Toggle.Root
        pressed={query[option.key]}
        onPressedChange={(pressed) => actions.change({ [option.key]: pressed })}
        aria-label={option.label}
        title={option.label}
        class="touch-target grid size-8 shrink-0 place-items-center rounded-md font-mono text-xs text-muted transition-colors hover:bg-hover hover:text-fg data-[state=on]:bg-active data-[state=on]:text-fg"
      >
        <span class={[option.key === "wholeWord" && "underline underline-offset-2"]}>{option.glyph}</span>
      </Toggle.Root>
    {/each}
    <IconButton icon="chevron-up" label={t("editor.find.previous")} tooltip="{t('editor.find.previous')} (⇧↵)" disabled={!find.count} onclick={actions.previous} />
    <IconButton icon="chevron-down" label={t("editor.find.next")} tooltip="{t('editor.find.next')} (↵)" disabled={!find.count} onclick={actions.next} />
    <IconButton icon="x" label={t("editor.find.close")} tooltip="{t('editor.find.close')} (Esc)" onclick={actions.close} />
  </div>
  {#if replacing && !find.readOnly}
    <div class="flex items-center gap-1 pl-9">
      <TextField
        class="flex-1"
        icon="pencil"
        value={query.replace}
        placeholder={t("editor.find.replaceWith")}
        aria-label={t("editor.find.replaceWith")}
        oninput={(event) => actions.change({ replace: event.currentTarget.value })}
        onkeydown={replaceKeys}
      />
      <Button variant="quiet" disabled={!find.count} onclick={actions.replace}>{t("editor.find.replace")}</Button>
      <Button variant="quiet" disabled={!find.count} onclick={actions.replaceAll}>{t("editor.find.replaceAll")}</Button>
    </div>
  {/if}
</div>
