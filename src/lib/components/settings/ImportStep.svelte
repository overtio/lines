<script lang="ts">
  // An import into the Library, as rows of its group's card in Settings: what it would do, said
  // before anything's written (`lines`, with choices about how in `options`); then the import
  // (lib/library/imports.svelte.ts) as it goes, and what it did, with Undo, which a failure partway
  // still has. Focus goes where the next thing to do is: Import (or Cancel, with nothing to
  // import), then the progress, then Undo.
  import type { Snippet } from "svelte";
  import { locale, t } from "../../i18n/index.svelte";
  import Icon from "../../icons/Icon.svelte";
  import { type ImportState, imports } from "../../library/imports.svelte";
  import Button from "../ui/Button.svelte";
  import CardBlock from "./CardBlock.svelte";

  type Done = Extract<ImportState, { kind: "done" }>;
  type Undone = Extract<ImportState, { kind: "undone" }>;
  type Props = {
    /** The import's, as `imports` knows it. */
    id: string;
    /** What it found: the first line said plainly, the rest (what's there already, what's left out) quieter. */
    lines: string[];
    /** Import's label, saying what it imports ("Import 3 Resources"); none when there's nothing to. */
    action?: string;
    options?: Snippet;
    onimport: () => void;
    oncancel: () => void;
    result: (done: Done) => string;
    undone: (undone: Undone) => string;
  };
  let { id, lines, action, options, onimport, oncancel, result, undone }: Props = $props();

  const state = $derived(imports.state?.id === id ? imports.state : null);
  const progress = $derived(state?.kind === "importing" ? t("library.import.progress", { done: state.written.toLocaleString(locale), count: state.total.toLocaleString(locale) }) : "");

  const focus = (element: HTMLElement) => element.focus();
</script>

{#if !state}
  <CardBlock>
    <div class="flex flex-col gap-1">
      {#each lines as line, i (line)}
        <p class={["m-0 leading-normal", i ? "text-xs text-muted" : "text-sm text-fg"]}>{line}</p>
      {/each}
    </div>
  </CardBlock>
  {#if action && options}{@render options()}{/if}
  <CardBlock class="flex-row flex-wrap items-center gap-1.5">
    {#if action}
      <!-- One import at a time: another's under way, this waits for it. -->
      <Button variant="primary" icon="import" disabled={imports.state?.kind === "importing"} onclick={onimport} {@attach focus}>{action}</Button>
      <Button variant="quiet" onclick={oncancel}>{t("settings.cancel")}</Button>
    {:else}
      <Button variant="quiet" onclick={oncancel} {@attach focus}>{t("settings.cancel")}</Button>
    {/if}
  </CardBlock>
{:else if state.kind === "importing"}
  <CardBlock class="flex-row flex-wrap items-center gap-x-3 gap-y-1.5 outline-none" role="status" tabindex={-1} {@attach focus}>
    <div class="flex min-w-0 flex-1 basis-48 flex-col gap-1.5">
      <progress class="w-full accent-accent" max={state.total || 1} value={state.written} aria-label={progress}></progress>
      <p class="m-0 text-xs leading-normal text-muted">{progress}</p>
    </div>
    <Button variant="quiet" onclick={() => imports.stop()}>{t("library.import.stop")}</Button>
  </CardBlock>
{:else}
  {@const undoable = state.kind === "done" && (state.added > 0 || state.appended > 0)}
  <!-- Focus is on Undo while it's there; then here, where it was. -->
  <CardBlock class="gap-1.5 outline-none" tabindex={-1} {@attach (block: HTMLElement) => void (!undoable && block.focus())}>
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <p class="m-0 flex min-w-0 flex-1 items-center gap-2 text-sm leading-normal text-muted" role="status">
        <Icon name="check" size={15} class="shrink-0 text-success" />
        {state.kind === "done" ? result(state) : undone(state)}
      </p>
      {#if undoable}
        <Button variant="quiet" class="-my-1" onclick={() => imports.undo()} {@attach focus}>{t("library.import.undo")}</Button>
      {/if}
    </div>
    {#if state.kind === "done" && (state.failed || state.stopped)}
      <p class={["m-0 text-xs leading-normal", state.failed ? "text-danger" : "text-muted"]} role={state.failed ? "alert" : undefined}>
        {t(state.failed ? "library.import.failed" : "library.import.stopped")}
      </p>
    {:else if state.kind === "undone" && state.kept}
      <p class="m-0 text-xs leading-normal text-muted">{t("library.import.kept", { count: state.kept })}</p>
    {/if}
  </CardBlock>
{/if}
