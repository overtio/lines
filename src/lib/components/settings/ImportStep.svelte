<script lang="ts">
  // An import, as rows of its group's card in Settings: what it would do, said before anything's
  // written (`lines`, with choices about how in `options`); then the import (lib/imports/imports.svelte.ts)
  // as it goes, keeping the files notes show first if it has them; and what it did (with what
  // didn't come across as it was, as it says), with Undo, which a failure partway still has. Asked
  // about another (`asking`), the last import's Undo stays under what the next would do. Focus goes
  // where the next thing to do is: Import (or Cancel, with nothing to import), then the progress,
  // then Undo.
  import type { Snippet } from "svelte";
  import { locale, t } from "../../i18n/index.svelte";
  import Icon from "../../icons/Icon.svelte";
  import { type ImportState, imports } from "../../imports/imports.svelte";
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
    /** Whether what it found is shown with the last import's result, rather than the result alone. */
    asking?: boolean;
    onimport: () => void;
    oncancel: () => void;
    result: (done: Done) => string;
    undone: (undone: Undone) => string;
  };
  let { id, lines, action, options, asking = false, onimport, oncancel, result, undone }: Props = $props();

  const state = $derived(imports.state?.id === id ? imports.state : null);
  const going = $derived(
    state?.kind === "copying"
      ? { label: t("import.copying", { done: state.done.toLocaleString(locale), count: state.total.toLocaleString(locale) }), done: state.done, total: state.total }
      : state?.kind === "importing"
        ? { label: t("import.progress", { done: state.written.toLocaleString(locale), count: state.total.toLocaleString(locale) }), done: state.written, total: state.total }
        : null,
  );
  const settled = $derived(state?.kind === "done" || state?.kind === "undone" ? state : null);

  const focus = (element: HTMLElement) => element.focus();
</script>

{#snippet asked()}
  <CardBlock>
    <div class="flex flex-col gap-1">
      {#each lines as line, i (line)}
        <p class={["m-0 leading-normal", i ? "text-xs text-muted" : "text-sm text-fg"]}>{line}</p>
      {/each}
    </div>
  </CardBlock>
  {#if options}{@render options()}{/if}
  <CardBlock class="flex-row flex-wrap items-center gap-1.5">
    {#if action}
      <!-- One import at a time: another's under way, this waits for it. -->
      <Button variant="primary" icon="import" disabled={imports.busy} onclick={onimport} {@attach focus}>{action}</Button>
      <Button variant="quiet" onclick={oncancel}>{t("settings.cancel")}</Button>
    {:else}
      <Button variant="quiet" onclick={oncancel} {@attach focus}>{t("settings.cancel")}</Button>
    {/if}
  </CardBlock>
{/snippet}

{#if going}
  <CardBlock class="flex-row flex-wrap items-center gap-x-3 gap-y-1.5 outline-none" role="status" tabindex={-1} {@attach focus}>
    <div class="flex min-w-0 flex-1 basis-48 flex-col gap-1.5">
      <progress class="w-full accent-accent" max={going.total || 1} value={going.done} aria-label={going.label}></progress>
      <p class="m-0 text-xs leading-normal text-muted">{going.label}</p>
    </div>
    <Button variant="quiet" onclick={() => imports.cancel()}>{t("import.stop")}</Button>
  </CardBlock>
{:else}
  {#if !settled || asking}{@render asked()}{/if}
  {#if settled}
    {@const undoable = settled.kind === "done" && (settled.added > 0 || settled.appended > 0)}
    <!-- Focus is on Undo while it's there; then here, where it was; but on Import, asked about another. -->
    <CardBlock class="gap-1.5 outline-none" tabindex={-1} {@attach (block: HTMLElement) => void (!undoable && !asking && block.focus())}>
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <p class="m-0 flex min-w-0 flex-1 items-center gap-2 text-sm leading-normal text-muted" role="status">
          <Icon name="check" size={15} class="shrink-0 text-success" />
          {settled.kind === "undone" ? undone(settled) : settled.stopped && !undoable ? t("import.stoppedEarly") : result(settled)}
        </p>
        {#if undoable}
          <Button variant="quiet" class="-my-1" onclick={() => imports.undo()} {@attach (button: HTMLElement) => void (!asking && button.focus())}>{t("import.undo")}</Button>
        {/if}
      </div>
      {#if settled.kind === "done" && (settled.failed || (settled.stopped && undoable))}
        <p class={["m-0 text-xs leading-normal", settled.failed ? "text-danger" : "text-muted"]} role={settled.failed ? "alert" : undefined}>
          {t(settled.failed ? "import.failed" : "import.stopped")}
        </p>
      {:else if settled.kind === "undone" && settled.kept}
        <p class="m-0 text-xs leading-normal text-muted">{t("import.kept", { count: settled.kept })}</p>
      {/if}
      {#if settled.kind === "done" && !asking}
        {#each settled.report ?? [] as line (line)}
          <p class="m-0 text-xs leading-normal text-muted">{line}</p>
        {/each}
      {/if}
    </CardBlock>
  {/if}
{/if}
