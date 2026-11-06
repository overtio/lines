<script lang="ts">
  import { t } from "../../i18n/index.svelte";
  import { sync } from "../../sync/engine.svelte";
  import PassphraseForm from "../PassphraseForm.svelte";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import CardBlock from "./CardBlock.svelte";
  import StatusRow from "./StatusRow.svelte";

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

<FieldGroup title={t("sync.e2e.title")} note={!encrypted && !issue ? t("sync.e2e.intro") : null}>
  {#if issue === "locked" || issue === "rekeyed"}
    <CardBlock>
      <p class="m-0 text-sm leading-normal text-muted" id="{id}-why">{issue === "locked" ? t("sync.e2e.locked") : t("sync.error.rekeyed")}</p>
      <PassphraseForm
        kind="current"
        submit={t("sync.e2e.unlock")}
        busyLabel={t("sync.e2e.unlocking")}
        describedby="{id}-why"
        onsubmit={(passphrase) => sync.unlockLibrary(passphrase)}
      />
    </CardBlock>
  {:else if issue === "turned-off"}
    <CardBlock>
      <p class="m-0 text-sm leading-normal text-muted">{t("sync.e2e.turnedOff")}</p>
      <Button variant="primary" class="self-end" onclick={turnOff} disabled={busy} aria-busy={busy}>{t("sync.e2e.turnOffToo")}</Button>
    </CardBlock>
  {:else if encrypted}
    <StatusRow icon="shield-check">{t("sync.e2e.on")}</StatusRow>
    {#if asking === "change"}
      <CardBlock>
        <p class="m-0 text-sm leading-normal text-muted" id="{id}-why">{t("sync.e2e.changeHint")}</p>
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
      </CardBlock>
    {:else if asking === "off"}
      <CardBlock>
        <p class="m-0 text-sm leading-normal text-muted" id="{id}-why">{t("sync.e2e.turnOffHint")}</p>
        <div class="flex flex-wrap items-center justify-end gap-1.5" role="group" aria-labelledby="{id}-why">
          <Button variant="quiet" onclick={() => ask(null)} disabled={busy}>{t("sync.cancel")}</Button>
          <Button
            variant="danger-primary"
            onclick={turnOff}
            disabled={busy}
            aria-busy={busy}
            {@attach (node: HTMLButtonElement) => node.focus()}
          >
            {busy ? t("sync.e2e.turningOff") : t("sync.e2e.turnOff")}
          </Button>
        </div>
      </CardBlock>
    {:else}
      <CardBlock>
        <div class="flex flex-wrap items-center gap-1.5">
          <Button variant="danger" class="-ml-2.5" onclick={() => ask("off")} {@attach refocus("off")}>{t("sync.e2e.askTurnOff")}</Button>
          <Button variant="quiet" class="ml-auto" onclick={() => ask("change")} {@attach refocus("change")}>{t("sync.e2e.askChange")}</Button>
        </div>
      </CardBlock>
    {/if}
  {:else if asking === "on"}
    <CardBlock>
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
      <p class="m-0 text-xs leading-normal text-muted" id="{id}-forget">{t("sync.e2e.forget")}</p>
    </CardBlock>
  {:else}
    <CardBlock class="items-start">
      <Button variant="primary" icon="lock" onclick={() => ask("on")} {@attach refocus("on")}>{t("sync.e2e.setUp")}</Button>
    </CardBlock>
  {/if}

  {#if error || done}
    <CardBlock>
      <Callout tone={error ? "danger" : "success"}>{error ?? done}</Callout>
    </CardBlock>
  {/if}
</FieldGroup>
