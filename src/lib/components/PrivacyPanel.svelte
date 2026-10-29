<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import { lock, LOCK_AFTER, touchIdAvailable } from "../lock/lock.svelte";
  import { lockedNotes } from "../notes/locked.svelte";
  import { noteKeys } from "../notes/noteKeys.svelte";
  import { isApple, modKey } from "../platform";
  import { ui } from "../ui.svelte";
  import PassphraseForm from "./PassphraseForm.svelte";
  import Segmented from "./Segmented.svelte";

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

  function askNotes(what: typeof notesAsking) {
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
      notesError = `Couldn't ${input.checked ? "turn off" : "turn on"} Touch ID: ${e}`;
    }
  }

  const afterOptions = LOCK_AFTER.map((minutes) => ({
    id: String(minutes),
    label: minutes === 0 ? "Never" : minutes < 60 ? `${minutes} min` : "1 hour",
  }));

  function ask(what: typeof asking) {
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
      touchIdError = `Couldn't ${input.checked ? "turn off" : "turn on"} Touch ID: ${e}`;
    }
  }

  async function lockNow() {
    ui.settings = null;
    await lock.lockNow();
  }
</script>

<section>
  <h3>App lock</h3>
  {#if !lock.enabled}
    <p class="prose">
      Lock lines with a passphrase. Your notes, attachments and sync settings on this device are encrypted, and lines asks
      for the passphrase when it opens.
    </p>
    {#if asking === "on"}
      <PassphraseForm
        kind="new"
        submit="Turn on app lock"
        busyLabel="Encrypting notes…"
        oncancel={() => ask(null)}
        onsubmit={async (passphrase) => {
          await lock.enable(passphrase);
          asking = null;
          done = "App lock is on. lines will ask for the passphrase when it opens.";
        }}
      />
      <p class="note">
        If you forget it, the notes on this device can't be opened, not even by lines. Synced notes stay safe in your sync
        storage.
      </p>
    {:else}
      <button class="primary" onclick={() => ask("on")}><Icon name="lock" size={15} /> Set up app lock…</button>
    {/if}
  {:else}
    <div class="status">
      <Icon name="shield-check" size={16} />
      <span>Notes on this device are encrypted, and lines asks for your passphrase when it opens.</span>
    </div>

    <div class="setting">
      <span class="label">Lock after</span>
      <Segmented
        label="Lock after this long without use"
        options={afterOptions}
        value={String(lock.settings?.after ?? 5)}
        onselect={(id) => lock.setAfter(Number(id))}
      />
    </div>
    <p class="note">{lock.settings?.after ? "Without use for that long, lines locks itself." : "lines locks when it quits, or when you lock it."}</p>

    {#if touchId}
      <label class="check">
        <input type="checkbox" checked={lock.settings?.touchId} onchange={setTouchId} />
        <Icon name="fingerprint" size={15} /> Unlock with Touch ID
      </label>
      {#if touchIdError}<p class="message" role="alert">{touchIdError}</p>{/if}
    {/if}

    {#if asking === "change"}
      <PassphraseForm
        kind="change"
        submit="Change passphrase"
        busyLabel="Changing…"
        oncancel={() => ask(null)}
        onsubmit={async (passphrase, current) => {
          await lock.changePassphrase(current, passphrase);
          asking = null;
          done = "Passphrase changed.";
        }}
      />
    {:else if asking === "off"}
      <p class="prose off">Your notes will be stored on this device without encryption, as before.</p>
      <PassphraseForm
        kind="current"
        submit="Turn off app lock"
        busyLabel="Decrypting notes…"
        danger
        oncancel={() => ask(null)}
        onsubmit={async (passphrase) => {
          await lock.disable(passphrase);
          asking = null;
          done = "App lock is off.";
        }}
      />
    {:else}
      <footer class="form-footer actions">
        <button class="text-button danger" onclick={() => ask("off")}>Turn off…</button>
        <button class="text-button push" onclick={() => ask("change")}>Change passphrase…</button>
        <button class="primary" onclick={lockNow} title={isApple ? "Lock (⌃⌘L)" : `Lock (${modKey}Alt+L)`}>
          <Icon name="lock" size={15} /> Lock now
        </button>
      </footer>
    {/if}
  {/if}

  {#if done}
    <p class="message ok" role="status">{done}</p>
  {/if}
</section>

<section>
  <h3>Locked notes</h3>
  {#if !noteKeys.known}
    <p class="prose">
      Lock a note to keep what it says out of sight until you enter a password: choose Lock Note from its menu, or the lock
      in its toolbar. The first time, you choose the password.
    </p>
    <p class="note">
      A locked note is encrypted, here and wherever it syncs to. Its title stays readable, so the list can show it.
    </p>
  {:else}
    <div class="status">
      <Icon name={noteKeys.anyOpen ? "lock-open" : "shield-check"} size={16} />
      <span>
        {#if noteKeys.anyOpen}
          Locked notes are open. They lock again after 5 minutes without use, or when you lock them.
        {:else if noteKeys.settings}
          Locked notes open with your password{noteKeys.settings.touchId && touchId ? " or Touch ID" : ""}.
        {:else}
          Notes locked on your other devices open with the password you chose there.
        {/if}
      </span>
    </div>

    {#if touchId && noteKeys.settings}
      <label class="check">
        <input type="checkbox" checked={noteKeys.settings.touchId} onchange={setNotesTouchId} />
        <Icon name="fingerprint" size={15} /> Open locked notes with Touch ID
      </label>
    {/if}

    {#if notesAsking === "change"}
      <p class="prose off">Every note locked with the current password opens with the new one, on all your devices.</p>
      <PassphraseForm
        kind="change"
        noun="password"
        submit="Change password"
        busyLabel="Changing…"
        oncancel={() => askNotes(null)}
        onsubmit={async (password, current) => {
          await lockedNotes.changePassword(current, password);
          notesAsking = null;
          notesDone = "Password changed.";
        }}
      />
    {:else if notesAsking === "reset"}
      <p class="prose off">
        Choose a new password for the notes you lock from now on. Notes already locked still open only with the old one,
        so keep them locked until you remember it.
      </p>
      <PassphraseForm
        kind="new"
        noun="password"
        submit="Set new password"
        busyLabel="Setting…"
        oncancel={() => askNotes(null)}
        onsubmit={async (password) => {
          await lockedNotes.reset(password);
          notesAsking = null;
          notesDone = "New password set. Notes you lock from now on use it.";
        }}
      />
    {:else if notesAsking === "touch-id"}
      <p class="prose off">Enter the password for locked notes to let Touch ID open them.</p>
      <PassphraseForm
        kind="current"
        noun="password"
        submit="Use Touch ID"
        busyLabel="Turning on…"
        oncancel={() => askNotes(null)}
        onsubmit={async (password) => {
          await lockedNotes.unlock(password, noteKeys.settings?.key.id);
          await lockedNotes.setTouchId(true);
          notesAsking = null;
        }}
      />
    {:else if noteKeys.settings || noteKeys.anyOpen}
      <footer class="form-footer actions">
        {#if noteKeys.settings}
          <button class="text-button" onclick={() => askNotes("reset")}>Forgot password…</button>
          <button class="text-button push" onclick={() => askNotes("change")}>Change password…</button>
        {/if}
        {#if noteKeys.anyOpen}
          <button class="primary" class:push={!noteKeys.settings} onclick={() => lockedNotes.close()}>
            <Icon name="lock" size={15} /> Lock now
          </button>
        {/if}
      </footer>
    {/if}
  {/if}

  {#if notesError}
    <p class="message" role="alert">{notesError}</p>
  {:else if notesDone}
    <p class="message ok" role="status">{notesDone}</p>
  {/if}
</section>

<section>
  <h3>Synced notes</h3>
  <p class="prose">
    To encrypt notes before they leave this device, so your storage provider can't read them, turn on end-to-end
    encryption in Sync & Data.
  </p>
  <button class="text-button flush" onclick={() => (ui.settings = "sync")}>
    <Icon name="cloud" size={15} /> Open Sync & Data
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
