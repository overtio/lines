<script lang="ts">
  import { WrongPassphrase } from "../crypto";
  import { t } from "../i18n/index.svelte";
  import { WrongPassword } from "../notes/locked.svelte";

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
    describedby,
    oncancel,
    onsubmit,
  }: {
    kind: "new" | "current" | "change";
    noun?: "passphrase" | "password";
    /** The button's label, and what it says while it works. */
    submit: string;
    busyLabel: string;
    danger?: boolean;
    /** The id of what explains the form, read with the first field. */
    describedby?: string;
    oncancel?: () => void;
    /** Throws to show why it didn't work. */
    onsubmit: (passphrase: string, current: string) => Promise<void>;
  } = $props();

  const MIN = 8;

  const TEXT = {
    passphrase: {
      field: t("lock.form.passphrase"),
      current: t("lock.form.currentPassphrase"),
      new: t("lock.form.newPassphrase"),
      differ: t("lock.form.passphrasesDiffer"),
    },
    password: {
      field: t("lock.form.password"),
      current: t("lock.form.currentPassword"),
      new: t("lock.form.newPassword"),
      differ: t("lock.form.passwordsDiffer"),
    },
  };

  const id = $props.id();
  let current = $state("");
  let passphrase = $state("");
  let again = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  /** The field the error is about: it's marked invalid, says the error, and has focus. */
  let invalid = $state<"current" | "passphrase" | "again" | null>(null);
  const fields: Record<"current" | "passphrase" | "again", HTMLInputElement | undefined> = $state({
    current: undefined,
    passphrase: undefined,
    again: undefined,
  });

  const text = $derived(TEXT[noun]);
  const asksNew = $derived(kind !== "current");
  const ready = $derived(!!passphrase && (!asksNew || !!again) && (kind !== "change" || !!current));

  function fail(message: string, field: typeof invalid) {
    error = message;
    invalid = field;
    if (field) fields[field]?.focus();
  }

  /** What a field is described by: the form's explanation for the first, and its error. */
  const describe = (field: NonNullable<typeof invalid>, first: boolean) =>
    [first ? describedby : null, invalid === field ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  async function send(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    invalid = null;
    if (asksNew && passphrase.length < MIN) return fail(t("lock.form.tooShort", { count: MIN }), "passphrase");
    if (asksNew && passphrase !== again) return fail(text.differ, "again");
    busy = true;
    try {
      await onsubmit(passphrase, current);
    } catch (e) {
      // A wrong passphrase is about the one already there; anything else (a connection, say) about no field.
      const wrong = e instanceof WrongPassphrase || e instanceof WrongPassword;
      fail(e instanceof Error ? e.message : String(e), wrong ? (kind === "change" ? "current" : "passphrase") : null);
    } finally {
      busy = false;
    }
  }
</script>

<form class="passphrase" onsubmit={send} aria-busy={busy}>
  {#if kind === "change"}
    <label>
      <span>{text.current}</span>
      <input
        type="password"
        bind:value={current}
        bind:this={fields.current}
        autocomplete="current-password"
        aria-invalid={invalid === "current"}
        aria-describedby={describe("current", true)}
        {@attach (node) => node.focus()}
      />
    </label>
  {/if}
  <label>
    <span>{kind === "change" ? text.new : text.field}</span>
    <input
      type="password"
      bind:value={passphrase}
      bind:this={fields.passphrase}
      autocomplete={asksNew ? "new-password" : "current-password"}
      aria-invalid={invalid === "passphrase"}
      aria-describedby={describe("passphrase", kind !== "change")}
      {@attach (node) => void (kind !== "change" && node.focus())}
    />
  </label>
  {#if asksNew}
    <label>
      <span>{t("lock.form.again")}</span>
      <input
        type="password"
        bind:value={again}
        bind:this={fields.again}
        autocomplete="new-password"
        aria-invalid={invalid === "again"}
        aria-describedby={describe("again", false)}
      />
    </label>
  {/if}

  {#if error}
    <p class="message" id="{id}-error" role="alert">{error}</p>
  {/if}

  <footer class="form-footer">
    {#if oncancel}
      <button type="button" class="text-button push" onclick={oncancel} disabled={busy}>{t("lock.cancel")}</button>
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

  /* In the accent at full strength, two pixels wide, so focus shows (3:1) in place of the outline. */
  input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }

  input[aria-invalid="true"]:not(:focus) {
    border-color: var(--danger);
  }

  .primary.danger {
    background: var(--danger);
    color: var(--on-danger);
  }

  /* Touch screens: a target a finger can hit (44 px high). */
  @media (pointer: coarse) {
    input {
      height: 44px;
    }
  }
</style>
