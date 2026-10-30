<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import { formatDate } from "../format";
  import { t } from "../i18n/index.svelte";
  import { isDesktopApp, isSite, isTauri } from "../platform";
  import { canUseFolders, isBrowserFolder } from "../sync/browserFolder";
  import { sync } from "../sync/engine.svelte";
  import { isFolder } from "../sync/providers";
  import BrowserFolderForm from "./BrowserFolderForm.svelte";
  import BucketSyncForm from "./BucketSyncForm.svelte";
  import FolderSyncForm from "./FolderSyncForm.svelte";
  import Segmented from "./Segmented.svelte";
  import SyncEncryption from "./SyncEncryption.svelte";

  type Method = "folder" | "bucket";

  // The desktop apps can sync through a cloud drive folder, and Chromium browsers can save to a folder
  // (sync/browserFolder.ts). The demo website saves only to a folder.
  const folders = isDesktopApp || (!isTauri && canUseFolders);
  const buckets = !isSite;
  let method = $state<Method>(sync.config ? (isFolder(sync.config) ? "folder" : "bucket") : folders || !buckets ? "folder" : "bucket");
  const browserFolder = $derived(!isTauri && (!sync.config || !isFolder(sync.config) || isBrowserFolder(sync.config.path)));

  const where = $derived(sync.config ? (isFolder(sync.config) ? sync.config.name : sync.config.bucket) : null);
</script>

<div class="sync">
  <!-- The demo website only saves to a folder, which says what it does itself. -->
  {#if !isSite}<p class="prose">{t("sync.intro")}</p>{/if}

  {#if sync.config}
    <!-- Problems are also said aloud by the sync engine, which hears them even with Settings closed. -->
    <div class="status" class:error={sync.status === "error"}>
      {#if sync.status === "error"}
        <Icon name="circle-alert" size={16} />
        <span>{sync.error}</span>
      {:else if sync.status === "syncing"}
        <Icon name="loader" size={16} class="spin" />
        <span>{t("sync.syncingWith", { place: where ?? "" })}</span>
      {:else}
        <Icon name="cloud-check" size={16} />
        <span>
          {#if sync.status === "offline"}
            {t("sync.offline")}
          {:else if sync.lastSynced}
            {t("sync.syncedWith", { place: where ?? "", date: formatDate(sync.lastSynced) })}
          {:else}
            {t("sync.connectedTo", { place: where ?? "" })}
          {/if}
        </span>
      {/if}
      <button
        type="button"
        class="text-button"
        onclick={() => sync.syncNow()}
        disabled={sync.status === "syncing"}
        aria-busy={sync.status === "syncing"}
      >
        <Icon name="refresh" size={14} /> {t("sync.syncNow")}
      </button>
    </div>
  {/if}

  {#if folders && buckets}
    <Segmented
      label={t("sync.method")}
      options={[
        {
          id: "folder",
          label: isDesktopApp ? t("sync.method.cloudDrive") : t("sync.method.folder"),
          icon: isDesktopApp ? "cloud" : "folder",
        },
        { id: "bucket", label: t("sync.method.bucket"), icon: "server" },
      ]}
      value={method}
      onselect={(id) => (method = id)}
    />
  {/if}

  {#if method === "folder" && browserFolder}
    <BrowserFolderForm />
  {:else if method === "folder"}
    <FolderSyncForm />
  {:else}
    <BucketSyncForm />
  {/if}

  {#if sync.config}
    <SyncEncryption />
  {/if}

  {#if !isDesktopApp && !isSite}
    <p class="note">{t("sync.comingToWeb")}</p>
  {/if}
</div>

<style>
  .sync {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .sync .prose {
    margin: 0;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 8px 8px 12px;
    border-radius: 10px;
    background: var(--input);
    font-size: 13px;
    color: var(--text-muted);
  }

  .status span {
    flex: 1;
  }

  .status.error {
    color: var(--danger);
  }
</style>
