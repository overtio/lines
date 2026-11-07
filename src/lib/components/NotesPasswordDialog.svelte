<script lang="ts">
  import { Dialog } from "bits-ui";
  import { untrack } from "svelte";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { touchIdAvailable } from "../lock/lock.svelte";
  import { lockedNotes } from "../notes/locked.svelte";
  import { noteKeys } from "../notes/noteKeys.svelte";
  import PassphraseForm from "./PassphraseForm.svelte";
  import Button from "./ui/Button.svelte";
  import Callout from "./ui/Callout.svelte";

  /** Asks for the locked notes' password (or a new one, the first time) before a note can be locked. */

  let touchIdError = $state<string | null>(null);
  let hasTouchId = $state(false);
  let content = $state<HTMLElement | null>(null);
  /** What had focus before the dialog opened, to give it back after. */
  let opener: Element | null = null;

  void touchIdAvailable.then((available) => (hasTouchId = available));

  const request = $derived(lockedNotes.asking);
  const touchId = $derived(hasTouchId && request?.purpose === "open" && !!noteKeys.settings?.touchId);

  // Noted before the dialog's form takes focus as it opens.
  $effect.pre(() => {
    if (request) untrack(() => (opener ??= document.activeElement));
  });

  function onOpenAutoFocus() {
    touchIdError = null;
  }

  function onCloseAutoFocus(event: Event) {
    event.preventDefault();
    // Locking a note may have moved focus on (to the note's lock), so only where nothing has it.
    const active = document.activeElement;
    const lost = !active || active === document.body || !!content?.contains(active);
    if (lost && opener instanceof HTMLElement && opener.isConnected) opener.focus();
    opener = null;
  }

  function done() {
    const after = request?.after;
    lockedNotes.asking = null;
    after?.();
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

<Dialog.Root open={!!request} onOpenChange={(open) => !open && (lockedNotes.asking = null)}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-scrim" />
    <!-- A click outside leaves it open, as a password half typed would be lost. -->
    <Dialog.Content
      bind:ref={content}
      {onOpenAutoFocus}
      {onCloseAutoFocus}
      interactOutsideBehavior="ignore"
      class="fixed top-[max(16px,14dvh)] left-1/2 z-50 w-[min(400px,calc(100vw-32px))] -translate-x-1/2 rounded-xl border border-line bg-panel px-[22px] pt-[22px] pb-5 text-fg shadow-dialog outline-none animate-pop-in"
    >
      {#if request}
        <div class="mb-3.5 grid size-10 place-items-center rounded-xl bg-tag text-accent" aria-hidden="true">
          <Icon name="lock" size={20} strokeWidth={1.75} />
        </div>
        <Dialog.Title class="m-0 text-lg font-semibold tracking-tight">
          {request.purpose === "set" ? t("lock.dialog.setTitle") : t("lock.dialog.openTitle")}
        </Dialog.Title>
        <Dialog.Description class="m-0 mt-1.5 mb-4 text-sm leading-normal text-muted">
          {request.purpose === "set" ? t("lock.dialog.setIntro") : t("lock.dialog.openIntro")}
        </Dialog.Description>
        {#if request.purpose === "set"}
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
          <p class="m-0 mt-3.5 text-xs leading-normal text-faint" id="notes-password-forget">{t("lock.dialog.setHint")}</p>
        {:else}
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
            <Button variant="quiet" icon="fingerprint" class="mt-3 -ml-2.5" onclick={useTouchId}>{t("lock.useTouchId")}</Button>
            {#if touchIdError}<Callout tone="danger" class="mt-2.5">{touchIdError}</Callout>{/if}
          {/if}
        {/if}
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
