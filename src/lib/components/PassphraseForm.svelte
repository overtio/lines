<script lang="ts">
  import { WrongPassphrase } from "../crypto";
  import { t } from "../i18n/index.svelte";
  import { WrongPassword } from "../notes/locked.svelte";
  import Button from "./ui/Button.svelte";
  import Callout from "./ui/Callout.svelte";
  import TextField from "./ui/TextField.svelte";

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

  /** A field with its name over it. */
  const field = "flex flex-col gap-1.5 text-xs font-medium text-muted";

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

<form class="flex flex-col gap-2.5" onsubmit={send} aria-busy={busy}>
  {#if kind === "change"}
    <label class={field}>
      {text.current}
      <TextField
        type="password"
        bind:value={current}
        bind:input={fields.current}
        autocomplete="current-password"
        aria-invalid={invalid === "current"}
        aria-describedby={describe("current", true)}
        {@attach (node: HTMLInputElement) => node.focus()}
      />
    </label>
  {/if}
  <label class={field}>
    {kind === "change" ? text.new : text.field}
    <TextField
      type="password"
      bind:value={passphrase}
      bind:input={fields.passphrase}
      autocomplete={asksNew ? "new-password" : "current-password"}
      aria-invalid={invalid === "passphrase"}
      aria-describedby={describe("passphrase", kind !== "change")}
      {@attach (node: HTMLInputElement) => void (kind !== "change" && node.focus())}
    />
  </label>
  {#if asksNew}
    <label class={field}>
      {t("lock.form.again")}
      <TextField
        type="password"
        bind:value={again}
        bind:input={fields.again}
        autocomplete="new-password"
        aria-invalid={invalid === "again"}
        aria-describedby={describe("again", false)}
      />
    </label>
  {/if}

  {#if error}
    <Callout id="{id}-error" tone="danger">{error}</Callout>
  {/if}

  <div class="flex flex-wrap items-center justify-end gap-1.5">
    {#if oncancel}
      <Button variant="quiet" onclick={oncancel} disabled={busy}>{t("lock.cancel")}</Button>
    {/if}
    <!-- Red, rather than the accent, for what takes protection away (turning the lock off). -->
    <Button type="submit" variant={danger ? "danger-primary" : "primary"} disabled={!ready || busy}>
      {busy ? busyLabel : submit}
    </Button>
  </div>
</form>
