<script lang="ts">
  import { WrongPassphrase } from "../crypto";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { lock, touchIdAvailable } from "../lock/lock.svelte";
  import { eraseThisDevice } from "../lock/erase";
  import Button from "./ui/Button.svelte";
  import UnlockField from "./UnlockField.svelte";

  /** Shown instead of the app while it's locked, until the passphrase (or Touch ID) opens it. */

  let passphrase = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  let shakes = $state(0);
  let forgot = $state(false);
  let input = $state<HTMLInputElement>();
  let card = $state<HTMLFormElement>();
  let touchId = $state(false);

  void touchIdAvailable.then((available) => {
    touchId = available && !!lock.settings?.touchId;
    // Straight to the Touch ID prompt, as Mac apps do; the passphrase is right there if it's cancelled.
    if (touchId) void useTouchId();
  });

  async function unlock(event: SubmitEvent) {
    event.preventDefault();
    if (!passphrase || busy) return;
    busy = true;
    error = null;
    try {
      await lock.unlock(passphrase);
    } catch (e) {
      error = e instanceof WrongPassphrase ? e.message : t("lock.screen.unlockFailed", { error: e instanceof Error ? e.message : String(e) });
      shakes++;
      passphrase = "";
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
      if (await lock.unlockWithTouchId()) return;
    } catch (e) {
      error = t("lock.touchId.failed", { error: String(e) });
    }
    busy = false;
    requestAnimationFrame(() => input?.focus());
  }

  /** Asked in the page: the Mac app's web view has no confirm() (it returns false without asking). */
  let erasing = $state(false);

  /** Focus stays on the lock screen, as in a modal dialog: Tab goes round its controls. */
  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && erasing) {
      event.preventDefault();
      erasing = false;
      return;
    }
    if (event.key !== "Tab" || !card) return;
    const controls = [...card.querySelectorAll<HTMLElement>("input, button")].filter((control) => !control.matches(":disabled"));
    const [first, last] = [controls[0], controls.at(-1)];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  const focus = (node: HTMLElement) => node.focus();
</script>

<svelte:window {onkeydown} />

<div
  class="grid h-full place-items-center bg-surface px-4 py-6 transition-opacity duration-200 starting:opacity-0"
  role="dialog"
  aria-modal="true"
  aria-labelledby="lock-title"
  aria-describedby="lock-hint"
  data-tauri-drag-region
>
  <form class="flex w-[min(320px,100%)] flex-col items-center text-center" aria-busy={busy} bind:this={card} onsubmit={unlock}>
    <div class="mb-[18px] grid size-[60px] place-items-center rounded-[18px] bg-tag text-accent" aria-hidden="true">
      <Icon name="lock" size={26} strokeWidth={1.75} />
    </div>
    <h1 id="lock-title" class="m-0 text-xl font-semibold tracking-tight">{t("lock.screen.title")}</h1>
    <p class="m-0 mt-1.5 mb-[22px] text-sm text-muted" id="lock-hint">{t("lock.screen.hint")}</p>

    <UnlockField
      bind:value={passphrase}
      bind:input
      label={t("lock.form.passphrase")}
      placeholder={t("lock.form.passphrase")}
      go={t("lock.screen.unlock")}
      going={t("lock.screen.unlocking")}
      {error}
      errorId="lock-error"
      {busy}
      {shakes}
      autofocus
    />

    {#if touchId}
      <Button variant="quiet" icon="fingerprint" onclick={useTouchId} disabled={busy}>{t("lock.unlockWithTouchId")}</Button>
    {/if}

    <div class="mt-7 text-xs leading-normal text-faint">
      {#if forgot}
        <p class="m-0 mb-2" id="lock-forgot">{t("lock.screen.forgotHint")}</p>
        {#if erasing}
          <p class="m-0 mb-2" id="lock-erase">{t("lock.screen.eraseQuestion")}</p>
          <div class="flex justify-center gap-2" role="group" aria-labelledby="lock-erase">
            <Button variant="quiet" onclick={() => (erasing = false)} {@attach focus}>{t("lock.cancel")}</Button>
            <Button variant="danger" onclick={() => void eraseThisDevice()}>{t("lock.screen.erase")}</Button>
          </div>
        {:else}
          <!-- Focus comes here when the explanation shows, and back here from Cancel. -->
          <Button variant="danger" aria-describedby="lock-forgot" onclick={() => (erasing = true)} {@attach focus}>
            {t("lock.screen.askErase")}
          </Button>
        {/if}
      {:else}
        <Button variant="quiet" onclick={() => (forgot = true)}>{t("lock.screen.forgot")}</Button>
      {/if}
    </div>
  </form>
</div>
