<script lang="ts">
  import { type Component, tick } from "svelte";
  import { speak } from "../../a11y";
  import { t } from "../../i18n/index.svelte";
  import Icon from "../../icons/Icon.svelte";
  import { exportNotes } from "../../notes/export";
  import { importable } from "../../notes/import";
  import type { SampleSet } from "../../notes/samples";
  import { isClosed, notes } from "../../notes/store.svelte";
  import { isApple, isDesktopApp, isSite, revealFile, saveFile } from "../../platform";
  import { plugins } from "../../plugins/registry.svelte";
  import type { Import, ImportFile } from "../../plugins/types";
  import { sync } from "../../sync/engine.svelte";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Switch from "../ui/Switch.svelte";
  import CardBlock from "./CardBlock.svelte";
  import ImportGroup from "./ImportGroup.svelte";

  let includeTrash = $state(false);
  let busy = $state(false);
  let saved = $state<{ count: number; filename: string; path: string | null } | null>(null);
  let error = $state<string | null>(null);

  /** Locked notes that aren't open, which can't be exported. */
  const closed = $derived(notes.entries.filter((e) => (includeTrash || !e.note.trashed) && isClosed(e.note)).length);
  const count = $derived(notes.counts.all + (includeTrash ? notes.counts.trash : 0) - closed);
  // Phones and tablets have no Finder to show the file in.
  const canReveal = isDesktopApp;

  let importing = $state(false);
  let imported = $state<{ count: number; skipped: string[] } | null>(null);
  let importError = $state<string | null>(null);
  let picker = $state<HTMLInputElement>();
  let importButton = $state<HTMLElement>();

  type Panel = Component<{ files?: ImportFile[]; onclose?: () => void }>;
  /** Files a plugin's import reads (a browser's bookmarks), each import asking what to do with them below. */
  let steps = $state.raw<{ files: ImportFile[]; step: Panel }[]>([]);
  /** Plugins' imports of files of their own. */
  const fileImports = $derived(plugins.imports.filter((each): each is Import & Required<Pick<Import, "files">> => !!each.files));

  /** The extension a file's name ends in, in lowercase. */
  const extensionOf = (name: string) => name.slice(name.lastIndexOf(".") + 1).toLowerCase();

  /** The chosen files a plugin imports its own way, by the plugin's import (read to tell), and the rest. */
  async function sortChosen(files: File[]) {
    const theirs = new Map<string, ImportFile[]>();
    const rest: File[] = [];
    for (const file of files) {
      const own = fileImports.filter((each) => each.files.extensions.includes(extensionOf(file.name)));
      const text = own.length ? await file.text() : "";
      const by = own.find((each) => each.files.recognizes(text));
      if (by) theirs.set(by.id, [...(theirs.get(by.id) ?? []), { name: file.name, text }]);
      else rest.push(file);
    }
    return { theirs, rest };
  }

  async function importChosen() {
    const files = [...(picker?.files ?? [])];
    if (!files.length) return;
    importing = true;
    imported = null;
    importError = null;
    steps = [];
    try {
      const { theirs, rest } = await sortChosen(files);
      steps = await Promise.all(
        [...theirs].map(async ([id, files]) => ({ files, step: (await fileImports.find((each) => each.id === id)!.panel()).default })),
      );
      if (rest.length || !theirs.size) {
        imported = await notes.importFiles(rest);
        speak(t("settings.imported", { count: imported.count }));
      }
    } catch (e) {
      importError = e instanceof Error ? e.message : String(e);
    } finally {
      importing = false;
      picker!.value = "";
    }
  }

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
  const resetButtonId = $props.id();
  const resetQuestion = $derived(t(isSite ? "settings.startAgainQuestion" : "settings.resetQuestion", { count: notes.entries.length }));

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
    document.getElementById(resetButtonId)?.focus();
  }

  function cancelReset() {
    confirmingReset = false;
    void focusResetButton();
  }

  /** Deletes every note here and adds this build's welcome note, tour and examples (development builds and the demo website). */
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

<!-- What an action did, said with speak() as it happens rather than by a live region, which often isn't read when added along with its text. -->
{#snippet result(text: string)}
  <p class="m-0 flex items-center gap-2 text-sm leading-normal text-muted">
    <Icon name="check" size={15} class="shrink-0 text-success" />
    {text}
  </p>
{/snippet}

<FieldGroup title={t("settings.export")} note={t("settings.exportText")}>
  {#if notes.counts.trash}
    <FieldRow label={t("settings.includeTrash", { count: notes.counts.trash })}>
      <Switch label={t("settings.includeTrash", { count: notes.counts.trash })} checked={includeTrash} onchange={(on) => (includeTrash = on)} />
    </FieldRow>
  {/if}
  <CardBlock class="items-start">
    {#if closed}
      <p class="m-0 text-xs leading-normal text-muted">{t("settings.lockedNotIncluded", { count: closed })}</p>
    {/if}
    <Button variant="primary" icon="download" onclick={exportAll} disabled={busy || !count}>
      {busy ? t("settings.exporting") : t("settings.exportCount", { count })}
    </Button>
    {#if saved}
      <div class="flex w-full flex-wrap items-center gap-x-2 gap-y-1.5 text-sm leading-normal text-muted">
        <Icon name="check" size={15} class="shrink-0 text-success" />
        <span class="min-w-0 flex-1 [overflow-wrap:anywhere]">
          {#if saved.path}
            {savedText[0]}<code class="font-mono text-xs">{saved.path}</code>{savedText[1]}
          {:else}
            {t("settings.downloaded", { filename: saved.filename })}
          {/if}
        </span>
        {#if saved.path && canReveal}
          <Button variant="quiet" class="-my-1" onclick={() => revealFile(saved!.path!)}>
            {isApple ? t("settings.showInFinder") : t("settings.showInFolder")}
          </Button>
        {/if}
      </div>
    {/if}
    {#if error}
      <Callout tone="danger" class="w-full">{error}</Callout>
    {/if}
  </CardBlock>
</FieldGroup>

<FieldGroup title={t("settings.import")} note={t("settings.importText")}>
  <CardBlock class="items-start">
    <Button variant="primary" icon="import" onclick={() => picker?.click()} disabled={importing} {@attach (button: HTMLElement) => void (importButton = button)}>
      {importing ? t("settings.importing") : t("settings.importFiles")}
    </Button>
    <input
      bind:this={picker}
      type="file"
      multiple
      accept={[...importable(), ...fileImports.flatMap((each) => each.files.extensions)].map((extension) => `.${extension}`).join(",")}
      class="hidden"
      onchange={importChosen}
    />
    {#if imported}
      {@render result(t("settings.imported", { count: imported.count }))}
      {#if imported.skipped.length}
        <p class="m-0 text-xs leading-normal text-muted">{t("settings.importSkipped", { names: imported.skipped.join(", ") })}</p>
      {/if}
    {/if}
    {#if importError}
      <Callout tone="danger" class="w-full">{importError}</Callout>
    {/if}
  </CardBlock>
  {#each steps as chosen (chosen)}
    <chosen.step
      files={chosen.files}
      onclose={() => {
        steps = steps.filter((each) => each !== chosen);
        importButton?.focus();
      }}
    />
  {/each}
</FieldGroup>

{#each plugins.imports.filter((source) => source.into === "notes") as source (source.id)}
  <ImportGroup {source} />
{/each}

<FieldGroup title={t("settings.samples")} note={t("settings.samplesText")}>
  <CardBlock>
    <div class="flex flex-wrap items-center gap-1.5">
      <Button variant="primary" icon="sparkles" onclick={() => addSamples("tour")} disabled={!!adding}>
        {adding === "tour" ? t("settings.adding") : t("settings.addTour")}
      </Button>
      <Button variant="quiet" icon="radical" onclick={() => addSamples("examples")} disabled={!!adding}>
        {adding === "examples" ? t("settings.adding") : t("settings.addExamples")}
      </Button>
      <Button variant="quiet" icon="list-todo" onclick={() => addSamples("qa")} disabled={!!adding}>
        {adding === "qa" ? t("settings.adding") : t("settings.addQa")}
      </Button>
    </div>
    {#if added}
      {@render result(addedMessage(added))}
    {/if}
  </CardBlock>
</FieldGroup>

<!-- On the demo website, a way back to the notes it started with; elsewhere, for development. -->
{#if import.meta.env.DEV || isSite}
  <FieldGroup
    title={isSite ? t("settings.startAgain") : t("settings.development")}
    note={isSite ? t("settings.startAgainText") : t("settings.developmentText")}
  >
    <CardBlock class="items-start">
      {#if sync.config}
        <p class="m-0 text-xs leading-normal text-muted">{isSite ? t("settings.startAgainFolderFirst") : t("settings.resetSyncFirst")}</p>
      {/if}
      {#if confirmingReset}
        <p class="m-0 text-sm leading-normal text-fg" id="reset-question">{resetQuestion}</p>
        <div class="flex flex-wrap items-center gap-1.5">
          <Button variant="danger" icon="trash" class="-ml-2.5" onclick={resetNotes} aria-describedby="reset-question">
            {t("settings.resetConfirm")}
          </Button>
          <Button variant="quiet" onclick={cancelReset} {@attach (button: HTMLButtonElement) => button.focus()}>{t("settings.cancel")}</Button>
        </div>
      {:else}
        <Button variant="danger" icon="refresh" class="-ml-2.5" id={resetButtonId} onclick={askReset} disabled={resetting || !!sync.config}>
          {resetting ? t("settings.resetting") : t("settings.resetNotes")}
        </Button>
      {/if}
      {#if reset}
        {@render result(t("settings.resetDone", { count: reset }))}
      {/if}
      {#if resetError}
        <Callout tone="danger" class="w-full">{resetError}</Callout>
      {/if}
    </CardBlock>
  </FieldGroup>
{/if}
