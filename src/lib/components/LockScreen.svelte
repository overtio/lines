<script lang="ts">
  import { WrongPassphrase } from "../crypto";
  import { t } from "../i18n/index.svelte";
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

<div class="lock" role="dialog" aria-modal="true" aria-labelledby="lock-title" aria-describedby="lock-hint" data-tauri-drag-region>
  <form class="card" aria-busy={busy} bind:this={card} onsubmit={unlock}>
    <div class="badge" aria-hidden="true"><Icon name="lock" size={26} strokeWidth={1.75} /></div>
    <h1 id="lock-title">{t("lock.screen.title")}</h1>
    <p class="hint" id="lock-hint">{t("lock.screen.hint")}</p>

    {#key shakes}
      <div class="field" class:shake={shakes > 0}>
        <input
          bind:this={input}
          bind:value={passphrase}
          type="password"
          placeholder={t("lock.form.passphrase")}
          aria-label={t("lock.form.passphrase")}
          aria-invalid={!!error}
          aria-describedby={error ? "lock-error" : undefined}
          autocomplete="current-password"
          disabled={busy}
          {@attach focus}
        />
        <button class="go" type="submit" disabled={!passphrase || busy} aria-label={busy ? t("lock.screen.unlocking") : t("lock.screen.unlock")}>
          <Icon name={busy ? "loader" : "chevron-right"} size={18} class={busy ? "spin" : ""} />
        </button>
      </div>
    {/key}

    <p class="error" id="lock-error" role="alert">{error ?? ""}</p>

    {#if touchId}
      <button type="button" class="text-button" onclick={useTouchId} disabled={busy}>
        <Icon name="fingerprint" size={16} /> {t("lock.unlockWithTouchId")}
      </button>
    {/if}

    <div class="forgot">
      {#if forgot}
        <p id="lock-forgot">{t("lock.screen.forgotHint")}</p>
        {#if erasing}
          <p id="lock-erase">{t("lock.screen.eraseQuestion")}</p>
          <div class="confirm" role="group" aria-labelledby="lock-erase">
            <button type="button" class="text-button" onclick={() => (erasing = false)} {@attach focus}>{t("lock.cancel")}</button>
            <button type="button" class="text-button danger" onclick={() => void eraseThisDevice()}>{t("lock.screen.erase")}</button>
          </div>
        {:else}
          <!-- Focus comes here when the explanation shows, and back here from Cancel. -->
          <button type="button" class="text-button danger" aria-describedby="lock-forgot" onclick={() => (erasing = true)} {@attach focus}>
            {t("lock.screen.askErase")}
          </button>
        {/if}
      {:else}
        <button type="button" class="text-button" onclick={() => (forgot = true)}>{t("lock.screen.forgot")}</button>
      {/if}
    </div>
  </form>
</div>

<style>
  .confirm {
    display: flex;
    justify-content: center;
    gap: 8px;
  }

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

  /* The accent at full strength, two pixels wide, so focus shows (3:1) in place of the outline. */
  input:focus {
    border-color: var(--accent);
    box-shadow:
      0 0 0 1px var(--accent),
      0 0 0 4px color-mix(in srgb, var(--accent) 12%, transparent);
  }

  input[aria-invalid="true"]:not(:focus) {
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

  /* Touch screens: a target a finger can hit (44 × 44). */
  @media (pointer: coarse) {
    input {
      height: 50px;
      padding-right: 56px;
    }

    .go {
      top: 3px;
      right: 3px;
      width: 44px;
      height: 44px;
    }

    .text-button {
      min-height: 44px;
    }
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
