<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import { touchIdAvailable } from "../lock/lock.svelte";
  import { lockedNotes } from "../notes/locked.svelte";
  import { noteKeys } from "../notes/noteKeys.svelte";
  import type { Entry } from "../notes/store.svelte";
  import { ui } from "../ui.svelte";

  /** Shown instead of the editor for a locked note that isn't open: the password (or Touch ID) opens it. */
  let { entry, compact = false }: { entry: Entry; compact?: boolean } = $props();

  let password = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  /** Bumped on a wrong password, to shake the field again. */
  let shakes = $state(0);
  let forgot = $state(false);
  let input = $state<HTMLInputElement>();
  let hasTouchId = $state(false);

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
      error = String(e);
    }
    busy = false;
  }
</script>

<div class="locked" class:compact>
  <form class="card" onsubmit={unlock}>
    <div class="badge" aria-hidden="true"><Icon name="lock" size={compact ? 20 : 24} strokeWidth={1.75} /></div>
    <h2 class:untitled={!entry.meta.title}>{entry.meta.title || "Untitled"}</h2>
    <p class="hint">This note is locked. Enter the password for locked notes to view it.</p>

    {#key shakes}
      <div class="field" class:shake={shakes > 0}>
        <input
          bind:this={input}
          bind:value={password}
          type="password"
          placeholder="Password"
          aria-label="Password for locked notes"
          aria-invalid={!!error}
          autocomplete="current-password"
          disabled={busy}
          {@attach (node) => void (shakes > 0 && node.focus())}
        />
        <button class="go" type="submit" disabled={!password || busy} aria-label="View note">
          <Icon name={busy ? "loader" : "chevron-right"} size={18} class={busy ? "spin" : ""} />
        </button>
      </div>
    {/key}

    <p class="error" role="alert">{error ?? ""}</p>

    {#if touchId}
      <button type="button" class="text-button" onclick={useTouchId} disabled={busy}>
        <Icon name="fingerprint" size={16} /> Use Touch ID
      </button>
    {/if}

    {#if !compact}
      <div class="forgot">
        {#if forgot}
          <p>
            Without its password, a locked note can't be opened, not even by lines. You can set a new password for the notes
            you lock from now on.
          </p>
          <button type="button" class="text-button" onclick={() => (ui.settings = "privacy")}>Open Privacy settings</button>
        {:else}
          <button type="button" class="text-button" onclick={() => (forgot = true)}>Forgot the password?</button>
        {/if}
      </div>
    {/if}
  </form>
</div>

<style>
  .locked {
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    overflow: auto;
    padding: 24px 16px calc(var(--titlebar-h, 0px) + 24px);
    animation: fade-in 160ms ease;
  }

  .compact {
    padding: 12px 16px 24px;
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: min(300px, 100%);
    text-align: center;
  }

  .badge {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    margin-bottom: 16px;
    border-radius: 16px;
    background: var(--tag-bg);
    color: var(--accent);
  }

  .compact .badge {
    width: 40px;
    height: 40px;
    margin-bottom: 10px;
    border-radius: 12px;
  }

  h2 {
    max-width: 100%;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 17px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .untitled {
    color: var(--text-faint);
  }

  .hint {
    margin: 6px 0 18px;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-muted);
  }

  .compact .hint {
    margin-bottom: 12px;
  }

  .field {
    position: relative;
    width: 100%;
  }

  input {
    width: 100%;
    height: 38px;
    padding: 0 42px 0 13px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-elevated);
    color: var(--text);
    font: inherit;
    font-size: 14.5px;
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
    width: 28px;
    height: 28px;
    border-radius: 7px;
    background: var(--accent);
    color: var(--on-accent);
    transition: opacity 120ms ease;
  }

  .go:disabled {
    opacity: 0;
    pointer-events: none;
  }

  .error {
    min-height: 1.45em;
    margin: 8px 0 2px;
    font-size: 12.5px;
    line-height: 1.45;
    color: var(--danger);
  }

  .forgot {
    margin-top: 22px;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--text-faint);
  }

  .forgot p {
    margin: 0 0 8px;
  }

  .forgot .text-button {
    font-size: 12.5px;
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
