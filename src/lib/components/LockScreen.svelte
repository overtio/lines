<script lang="ts">
  import { WrongPassphrase } from "../crypto";
  import Icon from "../icons/Icon.svelte";
  import { lock, touchIdAvailable } from "../lock/lock.svelte";
  import { eraseThisDevice } from "../lock/erase";

  /** Shown instead of the app while it's locked, until the passphrase (or Touch ID) opens it. */

  let passphrase = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  /** Bumped on a wrong passphrase, to shake the field again. */
  let shakes = $state(0);
  let forgot = $state(false);
  let input = $state<HTMLInputElement>();
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
      error = e instanceof WrongPassphrase ? e.message : `Couldn't unlock: ${e instanceof Error ? e.message : e}`;
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
      error = String(e);
    }
    busy = false;
    requestAnimationFrame(() => input?.focus());
  }

  async function erase() {
    const sure = confirm(
      "Erase every note and attachment on this device, and its sync settings?\n\nNotes that were synced stay in your sync storage. This can't be undone.",
    );
    if (sure) await eraseThisDevice();
  }
</script>

<div class="lock" data-tauri-drag-region>
  <form class="card" onsubmit={unlock}>
    <div class="badge" aria-hidden="true"><Icon name="lock" size={26} strokeWidth={1.75} /></div>
    <h1>lines is locked</h1>
    <p class="hint">Enter your passphrase to open your notes.</p>

    {#key shakes}
      <div class="field" class:shake={shakes > 0}>
        <input
          bind:this={input}
          bind:value={passphrase}
          type="password"
          placeholder="Passphrase"
          aria-label="Passphrase"
          aria-invalid={!!error}
          autocomplete="current-password"
          disabled={busy}
          {@attach (node) => node.focus()}
        />
        <button class="go" type="submit" disabled={!passphrase || busy} aria-label="Unlock">
          <Icon name={busy ? "loader" : "chevron-right"} size={18} class={busy ? "spin" : ""} />
        </button>
      </div>
    {/key}

    <p class="error" role="alert">{error ?? ""}</p>

    {#if touchId}
      <button type="button" class="text-button" onclick={useTouchId} disabled={busy}>
        <Icon name="fingerprint" size={16} /> Unlock with Touch ID
      </button>
    {/if}

    <div class="forgot">
      {#if forgot}
        <p>
          Without it, the notes on this device can't be opened, not even by lines. If you sync, your notes are still in
          your sync storage: erase this device, then connect sync again.
        </p>
        <button type="button" class="text-button danger" onclick={erase}>Erase this device…</button>
      {:else}
        <button type="button" class="text-button" onclick={() => (forgot = true)}>Forgot your passphrase?</button>
      {/if}
    </div>
  </form>
</div>

<style>
  .lock {
    display: grid;
    place-items: center;
    height: 100%;
    padding: 24px 16px;
    background: var(--surface);
    animation: fade-in 200ms ease;
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: min(320px, 100%);
    text-align: center;
  }

  .badge {
    display: grid;
    place-items: center;
    width: 60px;
    height: 60px;
    margin-bottom: 18px;
    border-radius: 18px;
    background: var(--tag-bg);
    color: var(--accent);
  }

  h1 {
    margin: 0;
    font-size: 19px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .hint {
    margin: 6px 0 22px;
    font-size: 13.5px;
    color: var(--text-muted);
  }

  .field {
    position: relative;
    width: 100%;
  }

  input {
    width: 100%;
    height: 40px;
    padding: 0 44px 0 14px;
    border: 1px solid var(--border);
    border-radius: 11px;
    background: var(--bg-elevated);
    color: var(--text);
    font: inherit;
    font-size: 15px;
    outline: none;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }

  input:focus {
    border-color: var(--accent-soft);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent);
  }

  input[aria-invalid="true"] {
    border-color: color-mix(in srgb, var(--danger) 55%, transparent);
  }

  .go {
    position: absolute;
    top: 5px;
    right: 5px;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: var(--accent);
    color: var(--on-accent);
    transition: opacity 120ms ease;
  }

  .go:disabled {
    opacity: 0;
    pointer-events: none;
  }

  .error {
    min-height: 1.5em;
    margin: 8px 0 4px;
    font-size: 13px;
    color: var(--danger);
  }

  .forgot {
    margin-top: 28px;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--text-faint);
  }

  .forgot p {
    margin: 0 0 8px;
  }

  .forgot .text-button {
    font-size: 12.5px;
  }

  .forgot .text-button:not(.danger) {
    color: var(--text-faint);
  }

  .shake {
    animation: shake 360ms cubic-bezier(0.36, 0.07, 0.19, 0.97);
  }

  @keyframes shake {
    20%,
    60% {
      transform: translateX(-7px);
    }
    40%,
    80% {
      transform: translateX(7px);
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
</style>
