<script lang="ts" module>
  import type { CloudFolder } from "../../sync/folder";

  /** The drives found last time, shown at once while they're looked up again. */
  let drives = $state<CloudFolder[] | null>(null);
</script>

<!--
  Sync through a cloud drive folder: lines writes the notes, the drive's own app (iCloud Drive,
  Google Drive, Proton Drive, Dropbox, OneDrive…) carries them to other devices.
-->
<script lang="ts">
  import { RadioGroup } from "bits-ui";
  import { onMount } from "svelte";
  import Icon from "../../icons/Icon.svelte";
  import type { IconName } from "../../icons/icons";
  import { t } from "../../i18n/index.svelte";
  import { isApple, revealFile } from "../../platform";
  import { sync } from "../../sync/engine.svelte";
  import { findCloudFolders, pickFolder, type DriveId } from "../../sync/folder";
  import { isFolder, type FolderConfig } from "../../sync/providers";
  import { closeSettings } from "../../windows/settings.svelte";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import CardBlock from "./CardBlock.svelte";

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

  const pathOf = (drive: CloudFolder) => `${drive.path}/${SUBFOLDER}`;
  const custom = $derived(chosen && !drives?.some((drive) => pathOf(drive) === chosen?.path) ? chosen : null);

  const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

  function choose(drive: CloudFolder) {
    chosen = asConfig(drive);
    message = null;
  }

  async function chooseOther() {
    message = null;
    try {
      const path = await pickFolder();
      if (path) chosen = { kind: "folder", provider: "folder", name: path.split("/").pop() || path, path };
    } catch (error) {
      message = t("sync.folder.failed", { error: describe(error) });
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
      void closeSettings();
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

<CardBlock>
  <p class="m-0 text-sm leading-normal text-muted">{t("sync.folder.intro", { folder: SUBFOLDER })}</p>

  {#if drives === null}
    <p class="m-0 text-sm text-muted" role="status">{t("sync.folder.looking")}</p>
  {:else}
    <!-- One tab stop for the group, and the arrow keys move the choice, as in any group of radio buttons. -->
    <RadioGroup.Root
      value={chosen?.path ?? ""}
      onValueChange={(path) => {
        const drive = drives?.find((each) => pathOf(each) === path);
        if (drive) choose(drive);
      }}
      aria-label={t("sync.folder.drives")}
      class="flex flex-col gap-0.5 rounded-lg bg-input p-[3px]"
    >
      {#each drives as drive (drive.path)}
        {@render item(pathOf(drive), ICONS[drive.provider], drive.name)}
      {/each}
      {#if custom}
        {@render item(custom.path, "folder", custom.path)}
      {/if}
    </RadioGroup.Root>
    {#if !drives.length}
      <p class="m-0 text-sm leading-normal text-muted">{t("sync.folder.none")}</p>
    {/if}
    <Button variant="quiet" icon="folder" class="-mt-1 -ml-2.5 self-start" onclick={chooseOther}>{t("sync.folder.chooseOther")}</Button>
  {/if}

  {#if chosen?.provider === "icloud"}
    <p class="m-0 text-xs leading-normal text-muted">{t("sync.folder.icloud")}</p>
  {/if}

  {#if message}
    <Callout tone="danger">{message}</Callout>
  {/if}

  <div class="flex flex-wrap items-center gap-1.5">
    {#if current}
      <Button variant="danger" class="-ml-2.5" onclick={disconnect} disabled={busy}>{t("sync.disconnect")}</Button>
      <Button variant="quiet" onclick={() => revealFile(`${current.path}/notes`)}>
        {isApple ? t("sync.folder.showInFinder") : t("sync.folder.show")}
      </Button>
    {/if}
    <Button variant="primary" class="ml-auto" onclick={connect} disabled={!chosen || busy || chosen.path === current?.path} aria-busy={busy}>
      {busy
        ? t("sync.connecting")
        : current
          ? chosen?.path === current.path
            ? t("sync.connected")
            : t("sync.folder.switch")
          : t("sync.connect")}
    </Button>
  </div>
</CardBlock>

{#snippet item(path: string, icon: IconName, name: string)}
  <RadioGroup.Item
    value={path}
    class="flex h-[38px] items-center gap-2.5 rounded-md px-3 text-left text-sm text-muted transition-colors hover:text-fg data-[state=checked]:bg-panel data-[state=checked]:text-fg data-[state=checked]:shadow-segment data-[state=checked]:[&_.icon]:text-accent coarse:h-11"
  >
    <Icon name={icon} size={17} />
    <span class="min-w-0 flex-1 truncate" title={path === custom?.path ? path : undefined}>{name}</span>
    {#if current?.path === path}<span class="text-2xs font-semibold text-success">{t("sync.connected")}</span>{/if}
  </RadioGroup.Item>
{/snippet}
