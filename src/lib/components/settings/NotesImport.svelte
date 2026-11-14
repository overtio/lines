<script lang="ts">
  // Notes from another app (an Obsidian vault), in Settings → Export and Import: what it exported,
  // chosen here and read by its import (`read`, lib/imports/notes.ts); what importing it would do,
  // before anything's written: what's here already, from importing it before (asking whether it's
  // the same, where it may be), and what won't come across as it was, with examples; then the
  // import, which keeps the files its notes show and makes the notes, and Undo (ImportStep.svelte,
  // lib/imports/imports.svelte.ts). Rows of the card of its plugin's group.
  import { speak } from "../../a11y";
  import { locale, t } from "../../i18n/index.svelte";
  import { type Exported, exportedFrom } from "../../imports/exported";
  import { imports } from "../../imports/imports.svelte";
  import { type NotesPlan, planNotes, type Source } from "../../imports/notes";
  import { notes } from "../../notes/store.svelte";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Switch from "../ui/Switch.svelte";
  import CardBlock from "./CardBlock.svelte";
  import ImportStep from "./ImportStep.svelte";

  type Props = {
    /** The import's id, as its plugin gives it. */
    id: string;
    /** The button that chooses what to import: "Choose Vault Folder…". */
    choose: string;
    /** Whether that's a folder (a vault), rather than files of `accept`'s kinds (a ZIP). */
    folder?: boolean;
    accept?: string;
    /** What the export chosen holds, as its import reads it. */
    read: (exported: Exported) => Promise<Source>;
    onclose?: () => void;
  };
  let { id, choose, folder = false, accept, read, onclose }: Props = $props();

  const list = (parts: string[]) => new Intl.ListFormat(locale, { type: "conjunction" }).format(parts);
  /** A few of `count` things by name, and how many more there are. */
  const some = (names: string[], count: number) => list([...names, ...(count > names.length ? [t("import.more", { count: count - names.length })] : [])]);

  let picker = $state<HTMLInputElement>();
  let chooseButton = $state<HTMLElement>();
  let reading = $state(false);
  let error = $state<string | null>(null);
  /** What the export holds (large: not made deeply reactive), and the id a new collection of it would have. */
  let found = $state.raw<{ source: Source; fresh: string } | null>(null);
  /** What importing it would do, against the notes as they were when it was chosen, or asked again. */
  let plan = $state.raw<NotesPlan | null>(null);
  let folderTags = $state(true);
  /** Whether it's the collection imported before that it may be (`plan.earlier`). */
  let same = $state(true);

  const planned = () => found && planNotes(id, found.source, notes.entries, { same, fresh: found.fresh });

  const counts = $derived.by(() => {
    if (!plan) return "";
    return list([
      t("import.count.notes", { count: plan.add.length }),
      ...(plan.attachments.length ? [t("import.count.attachments", { count: plan.attachments.length })] : []),
      ...(plan.folders ? [t("import.count.folders", { count: plan.folders })] : []),
    ]);
  });
  /** What didn't come across as it was: a line for each kind, with a few of them. */
  const report = $derived(
    found ? [...found.source.report.kinds].map(([kind, { count, examples }]) => t(kind, { count, examples: some(examples, count) })) : [],
  );
  const lines = $derived.by(() => {
    if (!found || !plan) return [];
    const { name } = found.source;
    const there = plan.there.slice(0, 3).map((note) => note.name);
    return [
      plan.add.length ? t("import.found", { things: counts, name }) : t("import.nothingNew", { name }),
      ...(plan.there.length ? [t("import.there", { count: plan.there.length, examples: some(there, plan.there.length) })] : []),
      ...report,
    ];
  });
  /** Asked about, or imported from here before (Settings closed and opened again meanwhile). */
  const shown = $derived(!!found || imports.state?.id === id);

  async function chosen() {
    const files = [...(picker?.files ?? [])];
    if (picker) picker.value = "";
    if (!files.length) return;
    reading = true;
    error = null;
    found = plan = null;
    try {
      found = { source: await read(await exportedFrom(files)), fresh: crypto.randomUUID() };
      same = true;
      plan = planned();
      speak(lines.join(" "));
    } catch (problem) {
      console.warn(`lines: couldn't read what was chosen to import from ${id}`, problem);
      error = t("import.unreadable");
    } finally {
      reading = false;
    }
  }

  /** Imports what was chosen, as it would be now: the import keeps going with Settings closed, and shows how it's going when it's opened again. */
  function start() {
    if (!found) return;
    plan = planned();
    if (!plan?.add.length) return;
    void imports.importNotes(id, found.source, plan, { folderTags, report });
    found = null;
  }

  function close() {
    found = plan = null;
    if (onclose) onclose();
    else chooseButton?.focus();
  }
</script>

<CardBlock class="items-start">
  <Button icon={folder ? "folder" : "import"} busy={reading} disabled={reading || imports.busy} onclick={() => picker?.click()} {@attach (button: HTMLElement) => void (chooseButton = button)}>
    {reading ? t("import.reading") : choose}
  </Button>
  {#if folder}
    <input bind:this={picker} type="file" webkitdirectory class="hidden" onchange={chosen} />
  {:else}
    <input bind:this={picker} type="file" {accept} class="hidden" onchange={chosen} />
  {/if}
  {#if error}
    <Callout tone="danger" class="w-full">{error}</Callout>
  {/if}
</CardBlock>
{#if shown}
  {#key found}
    <ImportStep
      {id}
      {lines}
      action={plan?.add.length ? t("import.start", { count: plan.add.length }) : undefined}
      asking={!!found}
      onimport={start}
      oncancel={close}
      result={(done) => t("import.done", { count: done.added })}
      undone={(undone) => t("import.undone", { count: undone.trashed })}
    >
      {#snippet options()}
        {#if plan?.earlier}
          <FieldRow label={t("import.same", { name: plan.earlier.name })} note={t("import.sameNote", { shared: plan.earlier.shared })}>
            <Switch
              label={t("import.same", { name: plan.earlier.name })}
              checked={same}
              onchange={(on) => {
                same = on;
                plan = planned();
              }}
            />
          </FieldRow>
        {/if}
        {#if plan?.add.length && plan.folders}
          <FieldRow label={t("import.folderTags")} note={t("import.folderTagsNote")}>
            <Switch label={t("import.folderTags")} checked={folderTags} onchange={(on) => (folderTags = on)} />
          </FieldRow>
        {/if}
      {/snippet}
    </ImportStep>
  {/key}
{/if}
