<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { touchIdAvailable } from "../lock/lock.svelte";
  import { lockedNotes } from "../notes/locked.svelte";
  import { noteKeys } from "../notes/noteKeys.svelte";
  import PassphraseForm from "./PassphraseForm.svelte";

  /** Asks for the locked notes' password (or a new one, the first time) before a note can be locked. */

  let dialog: HTMLDialogElement;
  let touchIdError = $state<string | null>(null);
  let hasTouchId = $state(false);
  /** What had focus before the dialog opened, to give it back after. */
  let opener: HTMLElement | null = null;

  void touchIdAvailable.then((available) => (hasTouchId = available));

  const request = $derived(lockedNotes.asking);
  const touchId = $derived(hasTouchId && request?.purpose === "open" && !!noteKeys.settings?.touchId);

  $effect(() => {
    if (request && !dialog.open) {
      touchIdError = null;
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!request && dialog.open) dialog.close();
  });

  function onclose() {
    lockedNotes.asking = null;
    // Not every web view gives focus back by itself. Locking a note may have moved it on (to the
    // note's lock), so only where nothing has it.
    if (opener?.isConnected && (document.activeElement === document.body || !document.activeElement)) opener.focus();
    opener = null;
  }

  function done() {
    const then = request?.then;
    lockedNotes.asking = null;
    then?.();
  }

  async function useTouchId() {
    touchIdError = null;
    try {
      if (await lockedNotes.unlockWithTouchId()) done();
    } catch (e) {
      touchIdError = t("lock.touchId.failed", { error: String(e) });
    }
  }
</script>

<dialog
  bind:this={dialog}
  {onclose}
  aria-modal="true"
  aria-labelledby="notes-password-title"
  aria-describedby="notes-password-intro"
>
  {#if request}
    <div class="badge" aria-hidden="true"><Icon name="lock" size={20} strokeWidth={1.75} /></div>
    {#if request.purpose === "set"}
      <h2 id="notes-password-title">{t("lock.dialog.setTitle")}</h2>
      <p class="prose" id="notes-password-intro">{t("lock.dialog.setIntro")}</p>
      <PassphraseForm
        kind="new"
        noun="password"
        submit={t("lock.dialog.lockNote")}
        busyLabel={t("lock.dialog.locking")}
        describedby="notes-password-forget"
        oncancel={() => (lockedNotes.asking = null)}
        onsubmit={async (password) => {
          await lockedNotes.setUp(password);
          done();
        }}
      />
      <p class="note" id="notes-password-forget">{t("lock.dialog.setHint")}</p>
    {:else}
      <h2 id="notes-password-title">{t("lock.dialog.openTitle")}</h2>
      <p class="prose" id="notes-password-intro">{t("lock.dialog.openIntro")}</p>
      <PassphraseForm
        kind="current"
        noun="password"
        submit={t("lock.dialog.lockNote")}
        busyLabel={t("lock.dialog.locking")}
        oncancel={() => (lockedNotes.asking = null)}
        onsubmit={async (password) => {
          await lockedNotes.unlock(password, noteKeys.settings?.key.id);
          done();
        }}
      />
      {#if touchId}
        <button type="button" class="text-button touch-id" onclick={useTouchId}>
          <Icon name="fingerprint" size={16} /> {t("lock.useTouchId")}
        </button>
        {#if touchIdError}<p class="message" role="alert">{touchIdError}</p>{/if}
      {/if}
    {/if}
  {/if}
</dialog>

<style>
  dialog {
    width: min(400px, calc(100vw - 32px));
    margin: max(16px, 14dvh) auto auto;
    padding: 22px 22px 20px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--bg-elevated);
    color: var(--text);
    box-shadow: var(--shadow-dialog);
  }

  dialog::backdrop {
    background: var(--scrim);
  }

  .badge {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    margin-bottom: 14px;
    border-radius: 12px;
    background: var(--tag-bg);
    color: var(--accent);
  }

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .prose,
  .note {
    margin: 6px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  .note {
    margin-top: 14px;
    font-size: 12px;
    color: var(--text-faint);
  }

  .touch-id {
    margin-top: 12px;
  }

  /* The form's own pieces, as Settings styles them. */
  .message,
  dialog :global(.message) {
    margin: 0;
    padding: 9px 12px;
    border-radius: 9px;
    font-size: 13px;
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--danger);
  }

  .touch-id + .message {
    margin-top: 10px;
  }

  dialog :global(.form-footer) {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }

  dialog :global(.form-footer .push) {
    margin-left: auto;
  }

  dialog :global(.primary) {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 32px;
    padding: 0 16px;
    border-radius: 9px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 13px;
    font-weight: 600;
  }

  dialog :global(button:disabled) {
    opacity: var(--disabled-opacity);
  }

  /* Touch screens: targets a finger can hit (44 px high). */
  @media (pointer: coarse) {
    dialog :global(.primary),
    dialog :global(.text-button) {
      min-height: 44px;
    }
  }
</style>
