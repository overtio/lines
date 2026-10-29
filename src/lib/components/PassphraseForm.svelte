<script lang="ts">
  /**
   * Asks for a passphrase: a new one (typed twice), the current one, or both to change it. Used
   * by the app lock and by encrypted sync, and as a "password" by locked notes.
   */
  let {
    kind,
    noun = "passphrase",
    submit,
    busyLabel,
    danger = false,
    oncancel,
    onsubmit,
  }: {
    kind: "new" | "current" | "change";
    noun?: "passphrase" | "password";
    /** The button's label, and what it says while it works. */
    submit: string;
    busyLabel: string;
    danger?: boolean;
    oncancel?: () => void;
    /** Throws to show why it didn't work. */
    onsubmit: (passphrase: string, current: string) => Promise<void>;
  } = $props();

  const MIN = 8;

  let current = $state("");
  let passphrase = $state("");
  let again = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);

  const asksNew = $derived(kind !== "current");
  const Noun = $derived(noun[0].toUpperCase() + noun.slice(1));
  const ready = $derived(!!passphrase && (!asksNew || !!again) && (kind !== "change" || !!current));

  async function send(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    if (asksNew && passphrase.length < MIN) return void (error = `Use at least ${MIN} characters. A few words you'll remember work well.`);
    if (asksNew && passphrase !== again) return void (error = `The two ${noun}s don't match.`);
    busy = true;
    try {
      await onsubmit(passphrase, current);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<form class="passphrase" onsubmit={send}>
  {#if kind === "change"}
    <label>
      <span>Current {noun}</span>
      <input type="password" bind:value={current} autocomplete="current-password" {@attach (node) => node.focus()} />
    </label>
  {/if}
  <label>
    <span>{kind === "change" ? `New ${noun}` : Noun}</span>
    <input
      type="password"
      bind:value={passphrase}
      autocomplete={asksNew ? "new-password" : "current-password"}
      {@attach (node) => void (kind !== "change" && node.focus())}
    />
  </label>
  {#if asksNew}
    <label>
      <span>Type it again</span>
      <input type="password" bind:value={again} autocomplete="new-password" />
    </label>
  {/if}

  {#if error}
    <p class="message" role="alert">{error}</p>
  {/if}

  <footer class="form-footer">
    {#if oncancel}
      <button type="button" class="text-button push" onclick={oncancel} disabled={busy}>Cancel</button>
    {/if}
    <button type="submit" class="primary" class:push={!oncancel} class:danger disabled={!ready || busy}>
      {busy ? busyLabel : submit}
    </button>
  </footer>
</form>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 12px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-muted);
  }

  input {
    height: 36px;
    padding: 0 11px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--bg);
    color: var(--text);
    font: inherit;
    font-size: 14px;
    font-weight: 400;
    outline: none;
  }

  input:focus {
    border-color: var(--accent-soft);
  }

  .primary.danger {
    background: var(--danger);
    color: #fff;
  }
</style>
