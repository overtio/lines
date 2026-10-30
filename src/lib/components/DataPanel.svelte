<script lang="ts">
  import { tick } from "svelte";
  import { speak } from "../a11y";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { exportNotes } from "../notes/export";
  import type { SampleSet } from "../notes/samples";
  import { isClosed, notes } from "../notes/store.svelte";
  import { isApple, isDesktopApp, revealFile, saveFile } from "../platform";
  import { sync } from "../sync/engine.svelte";

  let includeTrash = $state(false);
  let busy = $state(false);
  let saved = $state<{ count: number; filename: string; path: string | null } | null>(null);
  let error = $state<string | null>(null);

  /** Locked notes that aren't open, which can't be exported. */
  const closed = $derived(notes.entries.filter((e) => (includeTrash || !e.note.trashed) && isClosed(e.note)).length);
  const count = $derived(notes.counts.all + (includeTrash ? notes.counts.trash : 0) - closed);
  // Phones and tablets have no Finder to show the file in.
  const canReveal = isDesktopApp;

  let adding = $state<SampleSet | null>(null);
  let added = $state<{ set: SampleSet; count: number } | null>(null);

  function addedMessage({ set, count }: { set: SampleSet; count: number }) {
    if (set === "qa") return t("settings.addedQa", { count });
    if (set === "examples") return t("settings.addedExamples", { count });
    return t("settings.addedTour", { count });
  }

  async function addSamples(set: SampleSet) {
    adding = set;
    added = null;
    error = null;
    try {
      added = { set, count: await notes.addSamples(set) };
      speak(addedMessage(added));
      notes.setFilter(set === "qa" ? { kind: "tag", tag: "qa" } : set === "examples" ? { kind: "tag", tag: "examples" } : { kind: "all" });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      adding = null;
    }
  }

  let resetting = $state(false);
  let reset = $state<number | null>(null);
  let resetError = $state<string | null>(null);
  /** Asking first, in the panel: the Mac app's web view has no confirm() (it returns false without asking). */
  let confirmingReset = $state(false);
  let resetButton = $state<HTMLButtonElement>();
  const resetQuestion = $derived(t("settings.resetQuestion", { count: notes.entries.length }));

  function askReset() {
    confirmingReset = true;
    reset = null;
    resetError = null;
    // Focus moves to Cancel (the button it came from is gone); the question is said, since focus skips it.
    speak(resetQuestion);
  }

  /** Back to the Reset button once the question is gone, so focus isn't lost. */
  async function focusResetButton() {
    await tick();
    resetButton?.focus();
  }

  function cancelReset() {
    confirmingReset = false;
    void focusResetButton();
  }

  /** Deletes every note here and adds this build's welcome note, tour and examples (development builds only). */
  async function resetNotes() {
    confirmingReset = false;
    resetting = true;
    reset = null;
    resetError = null;
    try {
      reset = await notes.reset();
      speak(t("settings.resetDone", { count: reset }));
    } catch (e) {
      resetError = e instanceof Error ? e.message : String(e);
    } finally {
      resetting = false;
      // Only now: while resetting, the button is disabled and can't take focus.
      void focusResetButton();
    }
  }

  async function exportAll() {
    busy = true;
    error = null;
    saved = null;
    try {
      // Include whatever is still being typed.
      await notes.flush();
      const { filename, data, count } = await exportNotes(notes.entries, includeTrash);
      const path = await saveFile(filename, data, "application/zip");
      saved = { count, filename, path };
      speak(path ? t("settings.savedTo", { count, path }) : t("settings.downloaded", { filename }));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  /** "Saved 12 notes to {path}", around the path, which is shown as code. */
  const savedText = $derived(saved?.path ? t("settings.savedTo", { count: saved.count }).split("{path}") : []);
</script>

<section>
  <h3>{t("settings.export")}</h3>
  <p class="prose">{t("settings.exportText")}</p>

  {#if notes.counts.trash}
    <label class="check">
      <input type="checkbox" bind:checked={includeTrash} />
      {t("settings.includeTrash", { count: notes.counts.trash })}
    </label>
  {/if}

  {#if closed}
    <p class="note locked">{t("settings.lockedNotIncluded", { count: closed })}</p>
  {/if}

  <div class="actions">
    <button class="primary" onclick={exportAll} disabled={busy || !count}>
      <Icon name="download" size={15} />
      {busy ? t("settings.exporting") : t("settings.exportCount", { count })}
    </button>
  </div>

  {#if saved}
    <!-- Said with speak() rather than a live region: one added along with its text is often not read. -->
    <p class="result">
      <Icon name="check" size={15} />
      <span>
        {#if saved.path}
          {savedText[0]}<code>{saved.path}</code>{savedText[1]}
        {:else}
          {t("settings.downloaded", { filename: saved.filename })}
        {/if}
      </span>
      {#if saved.path && canReveal}
        <button class="text-button" onclick={() => revealFile(saved!.path!)}>
          {isApple ? t("settings.showInFinder") : t("settings.showInFolder")}
        </button>
      {/if}
    </p>
  {/if}
  {#if error}
    <p class="result error" role="alert"><Icon name="circle-alert" size={15} /><span>{error}</span></p>
  {/if}
</section>

<section>
  <h3>{t("settings.samples")}</h3>
  <p class="prose">{t("settings.samplesText")}</p>
  <div class="actions samples">
    <button class="primary" onclick={() => addSamples("tour")} disabled={!!adding}>
      <Icon name="sparkles" size={15} />
      {adding === "tour" ? t("settings.adding") : t("settings.addTour")}
    </button>
    <button class="text-button" onclick={() => addSamples("examples")} disabled={!!adding}>
      <Icon name="radical" size={15} />
      {adding === "examples" ? t("settings.adding") : t("settings.addExamples")}
    </button>
    <button class="text-button" onclick={() => addSamples("qa")} disabled={!!adding}>
      <Icon name="list-todo" size={15} />
      {adding === "qa" ? t("settings.adding") : t("settings.addQa")}
    </button>
  </div>
  {#if added}
    <p class="result">
      <Icon name="check" size={15} />
      <span>{addedMessage(added)}</span>
    </p>
  {/if}
</section>

{#if import.meta.env.DEV}
  <section>
    <h3>{t("settings.development")}</h3>
    <p class="prose">{t("settings.developmentText")}</p>
    {#if sync.config}
      <p class="note">{t("settings.resetSyncFirst")}</p>
    {/if}
    {#if confirmingReset}
      <p class="note" id="reset-question">{resetQuestion}</p>
      <div class="actions samples">
        <button class="text-button danger" onclick={resetNotes} aria-describedby="reset-question">
          <Icon name="trash" size={15} />
          {t("settings.resetConfirm")}
        </button>
        <button class="text-button" onclick={cancelReset} {@attach (button) => button.focus()}>{t("settings.cancel")}</button>
      </div>
    {:else}
      <div class="actions">
        <button class="text-button danger" bind:this={resetButton} onclick={askReset} disabled={resetting || !!sync.config}>
          <Icon name="refresh" size={15} />
          {resetting ? t("settings.resetting") : t("settings.resetNotes")}
        </button>
      </div>
    {/if}
    {#if reset}
      <p class="result">
        <Icon name="check" size={15} />
        <span>{t("settings.resetDone", { count: reset })}</span>
      </p>
    {/if}
    {#if resetError}
      <p class="result error" role="alert"><Icon name="circle-alert" size={15} /><span>{resetError}</span></p>
    {/if}
  </section>
{/if}

<style>
  .check {
    margin: 0 0 14px;
  }

  .samples {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .locked,
  .note {
    margin: 0 0 14px;
  }

  .result {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 8px;
    margin: 14px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  .result > :global(.icon) {
    flex-shrink: 0;
    color: var(--success);
  }

  .result span {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .result code {
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .error,
  .error > :global(.icon) {
    color: var(--danger);
  }
</style>
