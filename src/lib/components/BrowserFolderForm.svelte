<!--
  Saving notes to a folder on the web (sync/browserFolder.ts): the person picks a folder, and the
  notes are written there as Markdown files and kept in step with this browser.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "../icons/Icon.svelte";
  import { allowFolder, canUseFolders, folderAllowed, isBrowserFolder, pickBrowserFolder } from "../sync/browserFolder";
  import { sync } from "../sync/engine.svelte";
  import { isFolder, type FolderConfig } from "../sync/providers";
  import { ui } from "../ui.svelte";

  const current = $derived(sync.config && isFolder(sync.config) && isBrowserFolder(sync.config.path) ? sync.config : null);
  let busy = $state(false);
  let message = $state<string | null>(null);
  /** After a reload the browser wants a click before lines may use the folder again. */
  let needsPermission = $state(false);

  const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

  onMount(() => {
    if (current) void folderAllowed(current.path).then((allowed) => (needsPermission = !allowed));
  });

  async function choose() {
    busy = true;
    message = null;
    try {
      const picked = await pickBrowserFolder();
      if (!picked) return;
      const config: FolderConfig = { kind: "folder", provider: "folder", name: picked.name, path: picked.path };
      await sync.test(config);
      await sync.configure(config);
      ui.settings = null;
    } catch (error) {
      message = describe(error);
    } finally {
      busy = false;
    }
  }

  async function allow() {
    if (!current) return;
    message = null;
    try {
      needsPermission = !(await allowFolder(current.path));
      if (!needsPermission) await sync.syncNow();
    } catch (error) {
      message = describe(error);
    }
  }

  async function disconnect() {
    busy = true;
    message = null;
    try {
      await sync.configure(null);
    } catch (error) {
      message = describe(error);
    } finally {
      busy = false;
    }
  }
</script>

<div class="browser-folder">
  {#if canUseFolders}
    <p class="prose">
      Save your notes to a folder on this computer, as Markdown files that any app can open. lines keeps them up to date
      as you write, and your notes stay in this browser too.
    </p>

    {#if current}
      <div class="folder">
        <Icon name="folder" size={17} />
        <span class="name">{current.name}</span>
        {#if needsPermission}
          <button type="button" class="text-button" onclick={allow}>Allow access</button>
        {:else}
          <span class="badge">Connected</span>
        {/if}
      </div>
      {#if needsPermission}
        <p class="note">Your browser asks again after a restart before lines may use the folder.</p>
      {/if}
    {/if}
  {:else}
    <p class="prose">
      This browser can't save to a folder. Open lines in Chrome or Edge to save your notes as files, or export them from
      Settings → Data. Your notes are kept in this browser in the meantime.
    </p>
  {/if}

  {#if message}
    <p class="message" role="alert">{message}</p>
  {/if}

  {#if canUseFolders}
    <footer class="form-footer">
      {#if current}
        <button type="button" class="text-button danger" onclick={disconnect} disabled={busy}>Disconnect</button>
      {/if}
      <button type="button" class="primary push" onclick={choose} disabled={busy}>
        <Icon name="folder" size={15} />
        {busy ? "Connecting…" : current ? "Choose Another Folder…" : "Choose a Folder…"}
      </button>
    </footer>
  {/if}
</div>

<style>
  .browser-folder {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .browser-folder .prose {
    margin: 0;
  }

  .folder {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 12px;
    border-radius: 10px;
    background: var(--input);
    font-size: 13.5px;
  }

  .folder :global(.icon) {
    color: var(--accent);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--success);
  }
</style>
