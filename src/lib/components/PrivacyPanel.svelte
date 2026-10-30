<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import { t } from "../i18n/index.svelte";
  import { lock, LOCK_AFTER, touchIdAvailable } from "../lock/lock.svelte";
  import { CLOSE_AFTER, lockedNotes } from "../notes/locked.svelte";
  import { noteKeys } from "../notes/noteKeys.svelte";
  import { isApple, modKey, reducedMotion } from "../platform";
  import PassphraseForm from "./PassphraseForm.svelte";
  import Segmented from "./Segmented.svelte";
  import { closeSettings } from "../windows/settings.svelte";

  const id = $props.id();

  /** What's being asked for: turning the lock on or off, or a new passphrase. */
  let asking = $state<"on" | "off" | "change" | null>(null);
  let done = $state<string | null>(null);
  let touchId = $state(false);
  let touchIdError = $state<string | null>(null);

  /** The same, for locked notes: what's being asked for, and how it went. */
  let notesAsking = $state<"change" | "reset" | "touch-id" | null>(null);
  let notesDone = $state<string | null>(null);
  let notesError = $state<string | null>(null);

  void touchIdAvailable.then((available) => (touchId = available));

  /** What was asked last in each section, so its button has focus again once the form closes. */
  let returnTo = $state<typeof asking>(null);
  let notesReturnTo = $state<typeof notesAsking>(null);
  const refocus = (what: NonNullable<typeof asking>) => (node: HTMLElement) => {
    if (returnTo === what) node.focus();
  };
  const refocusNotes = (what: NonNullable<typeof notesAsking>) => (node: HTMLElement) => {
    if (notesReturnTo === what) node.focus();
  };

  function askNotes(what: typeof notesAsking) {
    notesReturnTo = notesAsking;
    notesAsking = what;
    notesDone = null;
    notesError = null;
  }

  async function setNotesTouchId(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    notesError = null;
    // Turning it on keeps the key, which takes the password unless locked notes are open.
    if (input.checked && !noteKeys.ready) {
      input.checked = false;
      return askNotes("touch-id");
    }
    try {
      await lockedNotes.setTouchId(input.checked);
    } catch (e) {
      input.checked = !input.checked;
      // Put back as it was: checked now means it was being turned off.
      notesError = t(input.checked ? "lock.touchId.turnOffFailed" : "lock.touchId.turnOnFailed", { error: String(e) });
    }
  }

  const afterOptions = LOCK_AFTER.map((minutes) => ({
    id: String(minutes),
    label: minutes === 0 ? t("lock.app.never") : minutes < 60 ? t("lock.app.minutes", { count: minutes }) : t("lock.app.hour"),
  }));

  function ask(what: typeof asking) {
    returnTo = asking;
    asking = what;
    done = null;
  }

  async function setTouchId(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    touchIdError = null;
    try {
      await lock.setTouchId(input.checked);
    } catch (e) {
      input.checked = !input.checked;
      touchIdError = t(input.checked ? "lock.touchId.turnOffFailed" : "lock.touchId.turnOnFailed", { error: String(e) });
    }
  }

  /** Sync is at the top of the same tab. */
  function showSync() {
    const heading = document.getElementById("settings-sync");
    heading?.scrollIntoView({ block: "start", behavior: reducedMotion.matches ? "auto" : "smooth" });
    heading?.focus({ preventScroll: true });
  }

  async function lockNow() {
    void closeSettings();
    await lock.lockNow();
  }
</script>

<section aria-labelledby="{id}-app">
  <h3 id="{id}-app">{t("lock.app.title")}</h3>
  {#if !lock.enabled}
    <p class="prose">{t("lock.app.intro")}</p>
    {#if asking === "on"}
      <PassphraseForm
        kind="new"
        submit={t("lock.app.turnOn")}
        busyLabel={t("lock.app.encrypting")}
        describedby="{id}-forget"
        oncancel={() => ask(null)}
        onsubmit={async (passphrase) => {
          await lock.enable(passphrase);
          ask(null);
          done = t("lock.app.turnedOn");
        }}
      />
      <p class="note" id="{id}-forget">{t("lock.app.forget")}</p>
    {:else}
      <button class="primary" onclick={() => ask("on")} {@attach refocus("on")}>
        <Icon name="lock" size={15} /> {t("lock.app.setUp")}
      </button>
    {/if}
  {:else}
    <div class="status">
      <Icon name="shield-check" size={16} />
      <span>{t("lock.app.on")}</span>
    </div>

    <div class="setting">
      <span class="label" aria-hidden="true">{t("lock.app.after")}</span>
      <Segmented
        label={t("lock.app.afterLabel")}
        options={afterOptions}
        value={String(lock.settings?.after ?? 5)}
        onselect={(minutes) => lock.setAfter(Number(minutes))}
      />
    </div>
    <p class="note">{lock.settings?.after ? t("lock.app.afterHint") : t("lock.app.neverHint")}</p>

    {#if touchId}
      <label class="check">
        <input
          type="checkbox"
          checked={lock.settings?.touchId}
          onchange={setTouchId}
          aria-invalid={!!touchIdError}
          aria-describedby={touchIdError ? `${id}-touch-id-error` : undefined}
        />
        <Icon name="fingerprint" size={15} /> {t("lock.unlockWithTouchId")}
      </label>
      {#if touchIdError}<p class="message" id="{id}-touch-id-error" role="alert">{touchIdError}</p>{/if}
    {/if}

    {#if asking === "change"}
      <PassphraseForm
        kind="change"
        submit={t("lock.app.change")}
        busyLabel={t("lock.changing")}
        oncancel={() => ask(null)}
        onsubmit={async (passphrase, current) => {
          await lock.changePassphrase(current, passphrase);
          ask(null);
          done = t("lock.app.changed");
        }}
      />
    {:else if asking === "off"}
      <p class="prose off" id="{id}-off">{t("lock.app.turnOffHint")}</p>
      <PassphraseForm
        kind="current"
        submit={t("lock.app.turnOff")}
        busyLabel={t("lock.app.decrypting")}
        danger
        describedby="{id}-off"
        oncancel={() => ask(null)}
        onsubmit={async (passphrase) => {
          await lock.disable(passphrase);
          ask(null);
          done = t("lock.app.turnedOff");
        }}
      />
    {:else}
      <footer class="form-footer actions">
        <button class="text-button danger" onclick={() => ask("off")} {@attach refocus("off")}>{t("lock.app.askTurnOff")}</button>
        <button class="text-button push" onclick={() => ask("change")} {@attach refocus("change")}>{t("lock.app.askChange")}</button>
        <button class="primary" onclick={lockNow} title={t("lock.lockShortcut", { shortcut: isApple ? "⌃⌘L" : `${modKey}Alt+L` })}>
          <Icon name="lock" size={15} /> {t("lock.lockNow")}
        </button>
      </footer>
    {/if}
  {/if}

  {#if done}
    <p class="message ok" role="status">{done}</p>
  {/if}
</section>

<section aria-labelledby="{id}-notes">
  <h3 id="{id}-notes">{t("lock.notes.title")}</h3>
  {#if !noteKeys.known}
    <p class="prose">{t("lock.notes.intro")}</p>
    <p class="note">{t("lock.notes.introHint")}</p>
  {:else}
    <div class="status">
      <Icon name={noteKeys.anyOpen ? "lock-open" : "shield-check"} size={16} />
      <span>
        {#if noteKeys.anyOpen}
          {t("lock.notes.open", { minutes: CLOSE_AFTER / 60_000 })}
        {:else if noteKeys.settings}
          {noteKeys.settings.touchId && touchId ? t("lock.notes.withPasswordOrTouchId") : t("lock.notes.withPassword")}
        {:else}
          {t("lock.notes.fromOtherDevices")}
        {/if}
      </span>
    </div>

    {#if touchId && noteKeys.settings}
      <label class="check">
        <input
          type="checkbox"
          checked={noteKeys.settings.touchId}
          onchange={setNotesTouchId}
          {@attach refocusNotes("touch-id")}
          aria-invalid={!!notesError}
          aria-describedby={notesError ? `${id}-notes-error` : undefined}
        />
        <Icon name="fingerprint" size={15} /> {t("lock.notes.touchId")}
      </label>
    {/if}

    {#if notesAsking === "change"}
      <p class="prose off" id="{id}-notes-change">{t("lock.notes.changeHint")}</p>
      <PassphraseForm
        kind="change"
        noun="password"
        submit={t("lock.notes.change")}
        busyLabel={t("lock.changing")}
        describedby="{id}-notes-change"
        oncancel={() => askNotes(null)}
        onsubmit={async (password, current) => {
          await lockedNotes.changePassword(current, password);
          askNotes(null);
          notesDone = t("lock.notes.changed");
        }}
      />
    {:else if notesAsking === "reset"}
      <p class="prose off" id="{id}-notes-reset">{t("lock.notes.resetHint")}</p>
      <PassphraseForm
        kind="new"
        noun="password"
        submit={t("lock.notes.reset")}
        busyLabel={t("lock.notes.resetting")}
        describedby="{id}-notes-reset"
        oncancel={() => askNotes(null)}
        onsubmit={async (password) => {
          await lockedNotes.reset(password);
          askNotes(null);
          notesDone = t("lock.notes.wasReset");
        }}
      />
    {:else if notesAsking === "touch-id"}
      <p class="prose off" id="{id}-notes-touch-id">{t("lock.notes.touchIdHint")}</p>
      <PassphraseForm
        kind="current"
        noun="password"
        submit={t("lock.useTouchId")}
        busyLabel={t("lock.notes.turningOn")}
        describedby="{id}-notes-touch-id"
        oncancel={() => askNotes(null)}
        onsubmit={async (password) => {
          await lockedNotes.unlock(password, noteKeys.settings?.key.id);
          await lockedNotes.setTouchId(true);
          askNotes(null);
        }}
      />
    {:else if noteKeys.settings || noteKeys.anyOpen}
      <footer class="form-footer actions">
        {#if noteKeys.settings}
          <button class="text-button" onclick={() => askNotes("reset")} {@attach refocusNotes("reset")}>
            {t("lock.notes.askForgot")}
          </button>
          <button class="text-button push" onclick={() => askNotes("change")} {@attach refocusNotes("change")}>
            {t("lock.notes.askChange")}
          </button>
        {/if}
        {#if noteKeys.anyOpen}
          <button class="primary" class:push={!noteKeys.settings} onclick={() => lockedNotes.close()}>
            <Icon name="lock" size={15} /> {t("lock.lockNow")}
          </button>
        {/if}
      </footer>
    {/if}
  {/if}

  {#if notesError}
    <p class="message" id="{id}-notes-error" role="alert">{notesError}</p>
  {:else if notesDone}
    <p class="message ok" role="status">{notesDone}</p>
  {/if}
</section>

<section aria-labelledby="{id}-synced">
  <h3 id="{id}-synced">{t("lock.synced.title")}</h3>
  <p class="prose">{t("lock.synced.intro")}</p>
  <button class="text-button flush" onclick={showSync}>
    <Icon name="cloud" size={15} /> {t("lock.synced.open")}
  </button>
</section>

<style>
  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border-radius: 10px;
    background: var(--input);
    font-size: 13px;
    line-height: 1.4;
    color: var(--text-muted);
  }

  .status > :global(.icon) {
    flex-shrink: 0;
    color: var(--success);
  }

  .setting {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-top: 16px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .setting .label {
    width: 136px;
  }

  .check :global(.icon) {
    color: var(--text-muted);
  }

  .actions {
    margin-top: 18px;
  }

  .off {
    margin: 14px 0 0;
  }

  .message {
    margin-top: 12px;
  }
</style>
