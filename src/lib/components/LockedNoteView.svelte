<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { touchIdAvailable } from "../lock/lock.svelte";
  import { lockedNotes } from "../notes/locked.svelte";
  import { noteKeys } from "../notes/noteKeys.svelte";
  import type { Entry } from "../notes/store.svelte";
  import { openSettings } from "../windows/settings.svelte";
  import Button from "./ui/Button.svelte";
  import UnlockField from "./UnlockField.svelte";

  /** Shown instead of the editor for a locked note that isn't open: the password (or Touch ID) opens it. */
  let { entry, compact = false }: { entry: Entry; compact?: boolean } = $props();

  let password = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  let shakes = $state(0);
  let forgot = $state(false);
  let input = $state<HTMLInputElement>();
  let hasTouchId = $state(false);
  const id = $props.id();

  void touchIdAvailable.then((available) => (hasTouchId = available));

  const key = $derived(entry.note.locked!.key.id);
  // Touch ID keeps this device's key, which opens the notes locked with it.
  const touchId = $derived(hasTouchId && !!noteKeys.settings?.touchId && noteKeys.settings.key.id === key);

  async function unlock(event: SubmitEvent) {
    event.preventDefault();
    if (!password || busy) return;
    busy = true;
    error = null;
    try {
      await lockedNotes.unlock(password, key);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      shakes++;
      password = "";
      busy = false;
      // After the field is enabled again.
      requestAnimationFrame(() => input?.focus());
    }
  }

  async function useTouchId() {
    if (busy) return;
    busy = true;
    error = null;
    try {
      await lockedNotes.unlockWithTouchId();
    } catch (e) {
      error = t("lock.touchId.failed", { error: String(e) });
    }
    busy = false;
  }
</script>

<div
  class={[
    "grid min-h-0 flex-1 place-items-center overflow-auto px-4 transition-opacity duration-150 starting:opacity-0",
    compact ? "pt-3 pb-6" : "pt-6 pb-[calc(var(--titlebar-h,0px)+24px)]",
  ]}
>
  <form class="flex w-[min(300px,100%)] flex-col items-center text-center" onsubmit={unlock} aria-labelledby="{id}-title" aria-describedby="{id}-hint" aria-busy={busy}>
    <div
      class={["grid place-items-center bg-tag text-accent", compact ? "mb-2.5 size-10 rounded-xl" : "mb-4 size-[52px] rounded-[16px]"]}
      aria-hidden="true"
    >
      <Icon name="lock" size={compact ? 20 : 24} strokeWidth={1.75} />
    </div>
    <h2 id="{id}-title" class={["m-0 max-w-full truncate text-lg font-semibold tracking-tight", !entry.meta.title && "text-faint"]}>
      {entry.meta.title || t("lock.note.untitled")}
    </h2>
    <p class={["m-0 mt-1.5 text-sm leading-normal text-muted", compact ? "mb-3" : "mb-[18px]"]} id="{id}-hint">{t("lock.note.hint")}</p>

    <UnlockField
      bind:value={password}
      bind:input
      label={t("lock.note.passwordLabel")}
      placeholder={t("lock.form.password")}
      go={t("lock.note.view")}
      going={t("lock.note.opening")}
      {error}
      errorId="{id}-error"
      {busy}
      {shakes}
    />

    {#if touchId}
      <Button variant="quiet" icon="fingerprint" onclick={useTouchId} disabled={busy}>{t("lock.useTouchId")}</Button>
    {/if}

    {#if !compact}
      <div class="mt-[22px] text-xs leading-normal text-faint">
        {#if forgot}
          <p class="m-0 mb-2" id="{id}-forgot">{t("lock.note.forgotHint")}</p>
          <!-- Focus comes here when the explanation shows. -->
          <Button
            variant="quiet"
            aria-describedby="{id}-forgot"
            onclick={() => void openSettings("privacy")}
            {@attach (node) => node.focus()}
          >
            {t("lock.note.openPrivacy")}
          </Button>
        {:else}
          <Button variant="quiet" onclick={() => (forgot = true)}>{t("lock.note.forgot")}</Button>
        {/if}
      </div>
    {/if}
  </form>
</div>
