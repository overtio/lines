<script lang="ts">
  import { formatDate } from "../../format";
  import { t } from "../../i18n/index.svelte";
  import type { IconName } from "../../icons/icons";
  import { isDesktopApp, isSite, isTauri } from "../../platform";
  import { canUseFolders, isBrowserFolder } from "../../sync/browserFolder";
  import { sync } from "../../sync/engine.svelte";
  import { isFolder } from "../../sync/providers";
  import Button from "../ui/Button.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import BrowserFolderForm from "./BrowserFolderForm.svelte";
  import BucketSyncForm from "./BucketSyncForm.svelte";
  import CardBlock from "./CardBlock.svelte";
  import FolderSyncForm from "./FolderSyncForm.svelte";
  import StatusRow from "./StatusRow.svelte";
  import SyncEncryption from "./SyncEncryption.svelte";

  type Method = "folder" | "bucket";

  // The desktop apps can sync through a cloud drive folder, and Chromium browsers can save to a folder
  // (sync/browserFolder.ts). The demo website saves only to a folder.
  const folders = isDesktopApp || (!isTauri && canUseFolders);
  const buckets = !isSite;
  let method = $state<Method>(sync.config ? (isFolder(sync.config) ? "folder" : "bucket") : folders || !buckets ? "folder" : "bucket");
  const browserFolder = $derived(!isTauri && (!sync.config || !isFolder(sync.config) || isBrowserFolder(sync.config.path)));

  const methods: { id: Method; label: string; icon: IconName }[] = [
    {
      id: "folder",
      label: isDesktopApp ? t("sync.method.cloudDrive") : t("sync.method.folder"),
      icon: isDesktopApp ? "cloud" : "folder",
    },
    { id: "bucket", label: t("sync.method.bucket"), icon: "server" },
  ];

  const where = $derived(sync.config ? (isFolder(sync.config) ? sync.config.name : sync.config.bucket) : null);
  const syncing = $derived(sync.status === "syncing");
</script>

{#if sync.config}
  <FieldGroup>
    <!-- Problems are also said aloud by the sync engine, which hears them even with Settings closed. -->
    <StatusRow
      icon={sync.status === "error" ? "circle-alert" : syncing ? "loader" : "cloud-check"}
      tone={sync.status === "error" ? "danger" : "muted"}
      spin={syncing}
    >
      {#if sync.status === "error"}
        {sync.error}
      {:else if syncing}
        {t("sync.syncingWith", { place: where ?? "" })}
      {:else if sync.status === "offline"}
        {t("sync.offline")}
      {:else if sync.lastSynced}
        {t("sync.syncedWith", { place: where ?? "", date: formatDate(sync.lastSynced) })}
      {:else}
        {t("sync.connectedTo", { place: where ?? "" })}
      {/if}
      {#snippet action()}
        <Button variant="quiet" icon="refresh" onclick={() => sync.syncNow()} disabled={syncing} aria-busy={syncing}>
          {t("sync.syncNow")}
        </Button>
      {/snippet}
    </StatusRow>
  </FieldGroup>
{/if}

<FieldGroup
  title={folders && buckets ? t("sync.method") : methods.find((m) => m.id === method)!.label}
  note={!isDesktopApp && !isSite ? t("sync.comingToWeb") : null}
>
  {#if folders && buckets}
    <CardBlock>
      <Segmented label={t("sync.method")} options={methods} value={method} onselect={(id) => (method = id)} />
    </CardBlock>
  {/if}
  {#if method === "folder" && browserFolder}
    <BrowserFolderForm />
  {:else if method === "folder"}
    <FolderSyncForm />
  {:else}
    <BucketSyncForm />
  {/if}
</FieldGroup>

{#if sync.config}
  <SyncEncryption />
{/if}
