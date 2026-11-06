<!--
  Saving notes to a folder on the web (sync/browserFolder.ts): the person picks a folder, and the
  notes are written there as Markdown files and kept in step with this browser.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "../../icons/Icon.svelte";
  import { t } from "../../i18n/index.svelte";
  import { allowFolder, canUseFolders, folderAllowed, isBrowserFolder, pickBrowserFolder } from "../../sync/browserFolder";
  import { sync } from "../../sync/engine.svelte";
  import { isFolder, type FolderConfig } from "../../sync/providers";
  import { closeSettings } from "../../windows/settings.svelte";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import CardBlock from "./CardBlock.svelte";

  const current = $derived(sync.config && isFolder(sync.config) && isBrowserFolder(sync.config.path) ? sync.config : null);
  let busy = $state(false);
  let message = $state<string | null>(null);
  /** After a reload the browser wants a click before lines may use the folder again. */
  let needsPermission = $state(false);
  const id = $props.id();

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
      void closeSettings();
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

<CardBlock>
  {#if canUseFolders}
    <p class="m-0 text-sm leading-normal text-muted">{t("sync.browser.intro")}</p>

    {#if current}
      <div class="flex h-11 items-center gap-2.5 rounded-lg bg-input px-3 text-sm">
        <Icon name="folder" size={17} class="text-accent" />
        <span class="min-w-0 flex-1 truncate">{current.name}</span>
        {#if needsPermission}
          <Button variant="quiet" class="-mr-1.5" onclick={allow} aria-describedby="{id}-asks">{t("sync.browser.allow")}</Button>
        {:else}
          <span class="text-2xs font-semibold text-success">{t("sync.connected")}</span>
        {/if}
      </div>
      {#if needsPermission}
        <p class="m-0 text-xs leading-normal text-muted" id="{id}-asks">{t("sync.browser.asksAgain")}</p>
      {/if}
    {/if}
  {:else}
    <p class="m-0 text-sm leading-normal text-muted">{t("sync.browser.unsupported")}</p>
  {/if}

  {#if message}
    <Callout tone="danger">{message}</Callout>
  {/if}

  {#if canUseFolders}
    <div class="flex flex-wrap items-center gap-1.5">
      {#if current}
        <Button variant="danger" class="-ml-2.5" onclick={disconnect} disabled={busy}>{t("sync.disconnect")}</Button>
      {/if}
      <Button variant="primary" icon="folder" class="ml-auto" onclick={choose} disabled={busy} aria-busy={busy}>
        {busy ? t("sync.connecting") : current ? t("sync.browser.chooseAnother") : t("sync.browser.choose")}
      </Button>
    </div>
  {/if}
</CardBlock>
