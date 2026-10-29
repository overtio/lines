<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import { exportNotes } from "../notes/export";
  import type { SampleSet } from "../notes/samples";
  import { isClosed, notes } from "../notes/store.svelte";
  import { isApple, isDesktopApp, revealFile, saveFile } from "../platform";

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

  async function addSamples(set: SampleSet) {
    adding = set;
    added = null;
    error = null;
    try {
      added = { set, count: await notes.addSamples(set) };
      notes.setFilter(set === "qa" ? { kind: "tag", tag: "qa" } : { kind: "all" });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      adding = null;
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
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<section>
  <h3>Export</h3>
  <p class="prose">
    Save every note as a Markdown file, bundled in a .zip. Each file is named after its note's title and holds
    exactly what you wrote, so it opens in any text editor or other Markdown app. Images and attached files
    go in an attachments folder beside them.
  </p>

  {#if notes.counts.trash}
    <label class="check">
      <input type="checkbox" bind:checked={includeTrash} />
      Include the trash ({notes.counts.trash} {notes.counts.trash === 1 ? "note" : "notes"}, in a Trash folder)
    </label>
  {/if}

  {#if closed}
    <p class="note locked">
      {closed === 1 ? "1 locked note isn't" : `${closed} locked notes aren't`} included. Open locked notes first to export them
      too, unencrypted.
    </p>
  {/if}

  <div class="actions">
    <button class="primary" onclick={exportAll} disabled={busy || !count}>
      <Icon name="download" size={15} />
      {busy ? "Exporting…" : `Export ${count} ${count === 1 ? "note" : "notes"}`}
    </button>
  </div>

  {#if saved}
    <p class="result" role="status">
      <Icon name="check" size={15} />
      <span>
        {#if saved.path}
          Saved {saved.count} {saved.count === 1 ? "note" : "notes"} to <code>{saved.path}</code>
        {:else}
          Downloaded {saved.filename}
        {/if}
      </span>
      {#if saved.path && canReveal}
        <button class="text-button" onclick={() => revealFile(saved!.path!)}>
          {isApple ? "Show in Finder" : "Show in folder"}
        </button>
      {/if}
    </p>
  {/if}
  {#if error}
    <p class="result error" role="alert"><Icon name="circle-alert" size={15} /><span>{error}</span></p>
  {/if}
</section>

<section>
  <h3>Sample notes</h3>
  <p class="prose">
    The feature tour shows what lines can do, a note per feature. The QA notes show everything a note can hold, on its
    own and combined, with a checklist for testing a release. They're added alongside your notes.
  </p>
  <div class="actions samples">
    <button class="primary" onclick={() => addSamples("tour")} disabled={!!adding}>
      <Icon name="sparkles" size={15} />
      {adding === "tour" ? "Adding…" : "Add Feature Tour"}
    </button>
    <button class="text-button" onclick={() => addSamples("qa")} disabled={!!adding}>
      <Icon name="list-todo" size={15} />
      {adding === "qa" ? "Adding…" : "Add QA Notes"}
    </button>
  </div>
  {#if added}
    <p class="result" role="status">
      <Icon name="check" size={15} />
      <span>Added {added.count} {added.set === "qa" ? "QA notes, tagged qa" : "notes"}.</span>
    </p>
  {/if}
</section>

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

  .locked {
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
