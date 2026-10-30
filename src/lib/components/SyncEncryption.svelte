<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import { t } from "../i18n/index.svelte";
  import { sync } from "../sync/engine.svelte";
  import PassphraseForm from "./PassphraseForm.svelte";

  /** End-to-end encryption for the connected bucket or folder. */

  let asking = $state<"on" | "off" | "change" | null>(null);
  let done = $state<string | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  const id = $props.id();

  const encrypted = $derived(!!sync.config?.encryption);
  const issue = $derived(sync.encryptionIssue);

  /** What was asked last, so its button has focus again once the form closes. */
  let returnTo = $state<typeof asking>(null);
  const refocus = (what: NonNullable<typeof asking>) => (node: HTMLElement) => {
    if (returnTo === what) node.focus();
  };

  function ask(what: typeof asking) {
    returnTo = asking;
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

<section class="encryption" aria-labelledby="{id}-title">
  <h3 id="{id}-title">{t("sync.e2e.title")}</h3>

  {#if issue === "locked" || issue === "rekeyed"}
    <p class="prose" id="{id}-why">{issue === "locked" ? t("sync.e2e.locked") : t("sync.error.rekeyed")}</p>
    <PassphraseForm
      kind="current"
      submit={t("sync.e2e.unlock")}
      busyLabel={t("sync.e2e.unlocking")}
      describedby="{id}-why"
      onsubmit={(passphrase) => sync.unlockLibrary(passphrase)}
    />
  {:else if issue === "turned-off"}
    <p class="prose">{t("sync.e2e.turnedOff")}</p>
    <footer class="form-footer">
      <button class="primary push" onclick={turnOff} disabled={busy} aria-busy={busy}>{t("sync.e2e.turnOffToo")}</button>
    </footer>
  {:else if encrypted}
    <div class="status">
      <Icon name="shield-check" size={16} />
      <span>{t("sync.e2e.on")}</span>
    </div>
    {#if asking === "change"}
      <p class="prose spaced" id="{id}-why">{t("sync.e2e.changeHint")}</p>
      <PassphraseForm
        kind="new"
        submit={t("sync.e2e.change")}
        busyLabel={t("sync.e2e.changing")}
        describedby="{id}-why"
        oncancel={() => ask(null)}
        onsubmit={async (passphrase) => {
          await sync.changePassphrase(passphrase);
          ask(null);
          done = t("sync.e2e.changed");
        }}
      />
    {:else if asking === "off"}
      <p class="prose spaced" id="{id}-why">{t("sync.e2e.turnOffHint")}</p>
      <footer class="form-footer" role="group" aria-labelledby="{id}-why">
        <button class="text-button push" onclick={() => ask(null)} disabled={busy}>{t("sync.cancel")}</button>
        <button class="primary danger" onclick={turnOff} disabled={busy} aria-busy={busy} {@attach (node) => node.focus()}>
          {busy ? t("sync.e2e.turningOff") : t("sync.e2e.turnOff")}
        </button>
      </footer>
    {:else}
      <footer class="form-footer actions">
        <button class="text-button danger flush" onclick={() => ask("off")} {@attach refocus("off")}>{t("sync.e2e.askTurnOff")}</button>
        <button class="text-button push" onclick={() => ask("change")} {@attach refocus("change")}>{t("sync.e2e.askChange")}</button>
      </footer>
    {/if}
  {:else}
    <p class="prose">{t("sync.e2e.intro")}</p>
    {#if asking === "on"}
      <PassphraseForm
        kind="new"
        submit={t("sync.e2e.encrypt")}
        busyLabel={t("sync.e2e.encrypting")}
        describedby="{id}-forget"
        oncancel={() => ask(null)}
        onsubmit={async (passphrase) => {
          await sync.encrypt(passphrase);
          ask(null);
          done = t("sync.e2e.encrypted");
        }}
      />
      <p class="note" id="{id}-forget">{t("sync.e2e.forget")}</p>
    {:else}
      <button class="primary" onclick={() => ask("on")} {@attach refocus("on")}><Icon name="lock" size={15} /> {t("sync.e2e.setUp")}</button>
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
    color: var(--on-danger);
  }

  .message {
    margin-top: 12px;
  }
</style>
