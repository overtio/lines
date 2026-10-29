<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import { sync } from "../sync/engine.svelte";
  import PassphraseForm from "./PassphraseForm.svelte";

  /** End-to-end encryption for the connected bucket or folder. */

  let asking = $state<"on" | "off" | "change" | null>(null);
  let done = $state<string | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);

  const encrypted = $derived(!!sync.config?.encryption);
  const issue = $derived(sync.encryptionIssue);

  function ask(what: typeof asking) {
    asking = what;
    done = null;
    error = null;
  }

  async function turnOff() {
    busy = true;
    error = null;
    try {
      await sync.decrypt();
      asking = null;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<section class="encryption">
  <h3>End-to-end encryption</h3>

  {#if issue === "locked" || issue === "rekeyed"}
    <p class="prose">
      {issue === "locked"
        ? "The notes there are encrypted. Enter the passphrase they were encrypted with to sync them."
        : "Encryption was set up again on another device. Enter its new passphrase to keep syncing."}
    </p>
    <PassphraseForm kind="current" submit="Unlock" busyLabel="Unlocking…" onsubmit={(passphrase) => sync.unlockLibrary(passphrase)} />
  {:else if issue === "turned-off"}
    <p class="prose">Encryption was turned off on another device, so the notes there are plain Markdown files again.</p>
    <footer class="form-footer">
      <button class="primary push" onclick={turnOff} disabled={busy}>Turn off here too</button>
    </footer>
  {:else if encrypted}
    <div class="status">
      <Icon name="shield-check" size={16} />
      <span>Notes are encrypted on this device before they're synced. Only your devices can read them.</span>
    </div>
    {#if asking === "change"}
      <p class="prose spaced">Your other devices keep syncing. A new device will need the new passphrase.</p>
      <PassphraseForm
        kind="new"
        submit="Change passphrase"
        busyLabel="Changing…"
        oncancel={() => ask(null)}
        onsubmit={async (passphrase) => {
          await sync.changePassphrase(passphrase);
          asking = null;
          done = "Passphrase changed.";
        }}
      />
    {:else if asking === "off"}
      <p class="prose spaced">
        Your notes will be uploaded again as plain Markdown files that your storage provider can read. Other devices stop
        syncing until encryption is turned off there too.
      </p>
      <footer class="form-footer">
        <button class="text-button push" onclick={() => ask(null)} disabled={busy}>Cancel</button>
        <button class="primary danger" onclick={turnOff} disabled={busy}>
          {busy ? "Turning off…" : "Turn off encryption"}
        </button>
      </footer>
    {:else}
      <footer class="form-footer actions">
        <button class="text-button danger flush" onclick={() => ask("off")}>Turn off…</button>
        <button class="text-button push" onclick={() => ask("change")}>Change passphrase…</button>
      </footer>
    {/if}
  {:else}
    <p class="prose">
      Encrypt notes and attachments on this device before they're synced, so your storage provider can't read them. Your
      other devices ask for the passphrase once.
    </p>
    {#if asking === "on"}
      <PassphraseForm
        kind="new"
        submit="Encrypt synced notes"
        busyLabel="Encrypting…"
        oncancel={() => ask(null)}
        onsubmit={async (passphrase) => {
          await sync.encrypt(passphrase);
          asking = null;
          done = "Encryption is on. Your notes are being uploaded again, encrypted.";
        }}
      />
      <p class="note">
        If you forget the passphrase, a device that already has it can set a new one. The bucket or folder no longer holds
        Markdown files other apps can open; Export still makes them.
      </p>
    {:else}
      <button class="primary" onclick={() => ask("on")}><Icon name="lock" size={15} /> Set up encryption…</button>
    {/if}
  {/if}

  {#if error}
    <p class="message" role="alert">{error}</p>
  {:else if done}
    <p class="message ok" role="status">{done}</p>
  {/if}
</section>

<style>
  .encryption {
    margin-top: 8px;
  }

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

  .spaced {
    margin: 14px 0 0;
  }

  .actions {
    margin-top: 12px;
  }

  .primary.danger {
    background: var(--danger);
    color: #fff;
  }

  .message {
    margin-top: 12px;
  }
</style>
