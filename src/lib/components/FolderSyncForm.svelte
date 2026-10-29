<script lang="ts" module>
  import type { CloudFolder } from "../sync/folder";

  /** The drives found last time, shown at once while they're looked up again. */
  let drives = $state<CloudFolder[] | null>(null);
</script>

<!--
  Sync through a cloud drive folder: lines writes the notes, the drive's own app (iCloud Drive,
  Google Drive, Proton Drive, Dropbox, OneDrive…) carries them to other devices.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "../icons/Icon.svelte";
  import type { IconName } from "../icons/icons";
  import { isApple, revealFile } from "../platform";
  import { sync } from "../sync/engine.svelte";
  import { findCloudFolders, pickFolder, type DriveId } from "../sync/folder";
  import { isFolder, type FolderConfig } from "../sync/providers";
  import { ui } from "../ui.svelte";

  const SUBFOLDER = "lines";

  const current = $derived(sync.config && isFolder(sync.config) ? sync.config : null);
  let chosen = $state<FolderConfig | null>(sync.config && isFolder(sync.config) ? { ...sync.config } : null);
  let busy = $state(false);
  let message = $state<string | null>(null);

  const ICONS: Record<DriveId, IconName> = {
    icloud: "cloud",
    google: "hard-drive",
    proton: "shield",
    dropbox: "package",
    onedrive: "cloud",
    box: "package",
    folder: "folder",
  };

  const asConfig = (drive: CloudFolder): FolderConfig => ({
    kind: "folder",
    provider: drive.provider,
    name: drive.name,
    path: `${drive.path}/${SUBFOLDER}`,
  });

  onMount(() => {
    if (!chosen && drives?.[0]) chosen = asConfig(drives[0]);
    findCloudFolders()
      .then((found) => {
        drives = found;
        if (!chosen && found[0]) chosen = asConfig(found[0]);
      })
      .catch(() => (drives ??= []));
  });

  const isChosen = (drive: CloudFolder) => chosen?.path === `${drive.path}/${SUBFOLDER}`;
  const custom = $derived(chosen && !drives?.some(isChosen) ? chosen : null);

  const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

  async function chooseOther() {
    message = null;
    try {
      const path = await pickFolder();
      if (path) chosen = { kind: "folder", provider: "folder", name: path.split("/").pop() || path, path };
    } catch (error) {
      message = describe(error);
    }
  }

  async function connect() {
    if (!chosen) return;
    busy = true;
    message = null;
    try {
      const config = $state.snapshot(chosen);
      // Creates the folder if needed, and checks lines may use it.
      await sync.test(config);
      await sync.configure(config);
      ui.settings = null;
    } catch (error) {
      message = describe(error);
    } finally {
      busy = false;
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

<div class="folder-sync">
  <p class="prose">
    Your notes go in a “{SUBFOLDER}” folder in the drive, and the drive's app syncs them to your other devices. Turn on the
    same drive there, and connect lines to it.
  </p>

  {#if drives === null}
    <p class="prose">Looking for cloud drives…</p>
  {:else}
    <div class="drives" role="radiogroup" aria-label="Cloud drive">
      {#each drives as drive (drive.path)}
        <button
          type="button"
          role="radio"
          aria-checked={isChosen(drive)}
          class:active={isChosen(drive)}
          onclick={() => ((chosen = asConfig(drive)), (message = null))}
        >
          <Icon name={ICONS[drive.provider]} size={17} />
          <span class="name">{drive.name}</span>
          {#if current && current.path === `${drive.path}/${SUBFOLDER}`}<span class="badge">Connected</span>{/if}
        </button>
      {/each}
      {#if custom}
        <button type="button" role="radio" aria-checked="true" class="active">
          <Icon name="folder" size={17} />
          <span class="name" title={custom.path}>{custom.path}</span>
          {#if current?.path === custom.path}<span class="badge">Connected</span>{/if}
        </button>
      {/if}
    </div>
    {#if !drives.length}
      <p class="prose">
        No cloud drives found on this Mac. Turn on iCloud Drive in System Settings → your name → iCloud, or install
        Google Drive, Proton Drive, Dropbox or OneDrive. Or use any folder:
      </p>
    {/if}
    <button type="button" class="text-button flush other" onclick={chooseOther}>
      <Icon name="folder" size={15} /> Choose another folder…
    </button>
  {/if}

  {#if chosen?.provider === "icloud"}
    <p class="note">
      iCloud Drive keeps your Macs in step. Syncing with the iPhone app and signing in with iCloud on the web are on
      the way.
    </p>
  {/if}

  {#if message}
    <p class="message" role="alert">{message}</p>
  {/if}

  <footer class="form-footer">
    {#if current}
      <button type="button" class="text-button danger" onclick={disconnect} disabled={busy}>Disconnect</button>
      <button type="button" class="text-button" onclick={() => revealFile(`${current.path}/notes`)}>
        {isApple ? "Show in Finder" : "Show folder"}
      </button>
    {/if}
    <button type="button" class="primary push" onclick={connect} disabled={!chosen || busy || chosen.path === current?.path}>
      {busy ? "Connecting…" : current ? (chosen?.path === current.path ? "Connected" : "Switch") : "Connect"}
    </button>
  </footer>
</div>

<style>
  .folder-sync {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .folder-sync .prose {
    margin: 0;
  }

  .drives {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 3px;
    border-radius: 10px;
    background: var(--input);
  }

  .drives button {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 38px;
    padding: 0 12px;
    border-radius: 8px;
    font-size: 13.5px;
    color: var(--text-muted);
    text-align: left;
  }

  .drives button.active {
    background: var(--bg-elevated);
    color: var(--text);
    box-shadow: var(--shadow-segment);
  }

  .drives button.active :global(.icon) {
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

  .other {
    align-self: flex-start;
    margin-top: -4px;
  }
</style>
