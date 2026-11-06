<script lang="ts">
  import { tick } from "svelte";
  import { t } from "../../i18n/index.svelte";
  import { lock, LOCK_AFTER, touchIdAvailable } from "../../lock/lock.svelte";
  import { CLOSE_AFTER, lockedNotes } from "../../notes/locked.svelte";
  import { noteKeys } from "../../notes/noteKeys.svelte";
  import { isApple, modKey } from "../../platform";
  import { ui } from "../../ui.svelte";
  import { closeSettings } from "../../windows/settings.svelte";
  import PassphraseForm from "../PassphraseForm.svelte";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import SectionHeading from "../ui/SectionHeading.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Switch from "../ui/Switch.svelte";
  import CardBlock from "./CardBlock.svelte";
  import StatusRow from "./StatusRow.svelte";

  const id = $props.id();

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

  /** What was asked last in each section, so its button has focus again once the form closes. */
  let returnTo = $state<typeof asking>(null);
  let notesReturnTo = $state<typeof notesAsking>(null);
  const refocus = (what: NonNullable<typeof asking>) => (node: HTMLElement) => {
    if (returnTo === what) node.focus();
  };
  const refocusNotes = (what: NonNullable<typeof notesAsking>) => (node: HTMLElement) => {
    if (notesReturnTo === what) node.focus();
  };

  // Back to the Touch ID switch once the password it asked for is given or not.
  $effect(() => {
    if (notesReturnTo === "touch-id") document.getElementById(`${id}-notes-touch-id`)?.focus();
  });

  function askNotes(what: typeof notesAsking) {
    notesReturnTo = notesAsking;
    notesAsking = what;
    notesDone = null;
    notesError = null;
  }

  async function setNotesTouchId(on: boolean) {
    notesError = null;
    // Turning it on keeps the key, which takes the password unless locked notes are open.
    if (on && !noteKeys.ready) return askNotes("touch-id");
    try {
      await lockedNotes.setTouchId(on);
    } catch (e) {
      notesError = t(on ? "lock.touchId.turnOnFailed" : "lock.touchId.turnOffFailed", { error: String(e) });
    }
  }

  const afterOptions = LOCK_AFTER.map((minutes) => ({
    id: String(minutes),
    label: minutes === 0 ? t("lock.app.never") : minutes < 60 ? t("lock.app.minutes", { count: minutes }) : t("lock.app.hour"),
  }));

  function ask(what: typeof asking) {
    returnTo = asking;
    asking = what;
    done = null;
  }

  async function setTouchId(on: boolean) {
    touchIdError = null;
    try {
      await lock.setTouchId(on);
    } catch (e) {
      touchIdError = t(on ? "lock.touchId.turnOnFailed" : "lock.touchId.turnOffFailed", { error: String(e) });
    }
  }

  /** Over to the Sync section, with focus on its first heading. */
  async function showSync() {
    ui.settings = "sync";
    await tick();
    document.querySelector<HTMLElement>('[role="tabpanel"] h3')?.focus();
  }

  async function lockNow() {
    void closeSettings();
    await lock.lockNow();
  }
</script>

<FieldGroup title={t("lock.app.title")} note={lock.enabled ? null : t("lock.app.intro")}>
  {#if !lock.enabled}
    {#if asking === "on"}
      <CardBlock>
        <PassphraseForm
          kind="new"
          submit={t("lock.app.turnOn")}
          busyLabel={t("lock.app.encrypting")}
          describedby="{id}-forget"
          oncancel={() => ask(null)}
          onsubmit={async (passphrase) => {
            await lock.enable(passphrase);
            ask(null);
            done = t("lock.app.turnedOn");
          }}
        />
        <p class="m-0 text-xs leading-normal text-muted" id="{id}-forget">{t("lock.app.forget")}</p>
      </CardBlock>
    {:else}
      <CardBlock class="items-start">
        <Button variant="primary" icon="lock" onclick={() => ask("on")} {@attach refocus("on")}>{t("lock.app.setUp")}</Button>
      </CardBlock>
    {/if}
  {:else}
    <StatusRow icon="shield-check">{t("lock.app.on")}</StatusRow>

    <FieldRow label={t("lock.app.after")} note={lock.settings?.after ? t("lock.app.afterHint") : t("lock.app.neverHint")}>
      <Segmented
        label={t("lock.app.afterLabel")}
        options={afterOptions}
        value={String(lock.settings?.after ?? 5)}
        onselect={(minutes) => lock.setAfter(Number(minutes))}
      />
    </FieldRow>

    {#if touchId}
      <FieldRow label={t("lock.unlockWithTouchId")}>
        <Switch
          label={t("lock.unlockWithTouchId")}
          checked={!!lock.settings?.touchId}
          onchange={setTouchId}
          aria-invalid={!!touchIdError}
          aria-describedby={touchIdError ? `${id}-touch-id-error` : undefined}
        />
        {#snippet below()}
          {#if touchIdError}<Callout id="{id}-touch-id-error" tone="danger" class="mt-2.5">{touchIdError}</Callout>{/if}
        {/snippet}
      </FieldRow>
    {/if}

    {#if asking === "change"}
      <CardBlock>
        <PassphraseForm
          kind="change"
          submit={t("lock.app.change")}
          busyLabel={t("lock.changing")}
          oncancel={() => ask(null)}
          onsubmit={async (passphrase, current) => {
            await lock.changePassphrase(current, passphrase);
            ask(null);
            done = t("lock.app.changed");
          }}
        />
      </CardBlock>
    {:else if asking === "off"}
      <CardBlock>
        <p class="m-0 text-sm leading-normal text-muted" id="{id}-off">{t("lock.app.turnOffHint")}</p>
        <PassphraseForm
          kind="current"
          submit={t("lock.app.turnOff")}
          busyLabel={t("lock.app.decrypting")}
          danger
          describedby="{id}-off"
          oncancel={() => ask(null)}
          onsubmit={async (passphrase) => {
            await lock.disable(passphrase);
            ask(null);
            done = t("lock.app.turnedOff");
          }}
        />
      </CardBlock>
    {:else}
      <CardBlock>
        <div class="flex flex-wrap items-center gap-1.5">
          <Button variant="danger" class="-ml-2.5" onclick={() => ask("off")} {@attach refocus("off")}>{t("lock.app.askTurnOff")}</Button>
          <Button variant="quiet" class="ml-auto" onclick={() => ask("change")} {@attach refocus("change")}>{t("lock.app.askChange")}</Button>
          <Button
            variant="primary"
            icon="lock"
            onclick={lockNow}
            title={t("lock.lockShortcut", { shortcut: isApple ? "⌃⌘L" : `${modKey}Alt+L` })}
          >
            {t("lock.lockNow")}
          </Button>
        </div>
      </CardBlock>
    {/if}
  {/if}

  {#if done}
    <CardBlock><Callout tone="success">{done}</Callout></CardBlock>
  {/if}
</FieldGroup>

{#if !noteKeys.known}
  <section aria-label={t("lock.notes.title")}>
    <SectionHeading title={t("lock.notes.title")} note={t("lock.notes.intro")} />
    <p class="m-0 px-1 text-xs leading-normal text-muted">{t("lock.notes.introHint")}</p>
  </section>
{:else}
  <FieldGroup title={t("lock.notes.title")}>
    <StatusRow icon={noteKeys.anyOpen ? "lock-open" : "shield-check"}>
      {#if noteKeys.anyOpen}
        {t("lock.notes.open", { minutes: CLOSE_AFTER / 60_000 })}
      {:else if noteKeys.settings}
        {noteKeys.settings.touchId && touchId ? t("lock.notes.withPasswordOrTouchId") : t("lock.notes.withPassword")}
      {:else}
        {t("lock.notes.fromOtherDevices")}
      {/if}
    </StatusRow>

    {#if touchId && noteKeys.settings}
      <FieldRow label={t("lock.notes.touchId")}>
        <Switch
          id="{id}-notes-touch-id"
          label={t("lock.notes.touchId")}
          checked={noteKeys.settings.touchId}
          onchange={setNotesTouchId}
          aria-invalid={!!notesError}
          aria-describedby={notesError ? `${id}-notes-error` : undefined}
        />
      </FieldRow>
    {/if}

    {#if notesAsking === "change"}
      <CardBlock>
        <p class="m-0 text-sm leading-normal text-muted" id="{id}-notes-change">{t("lock.notes.changeHint")}</p>
        <PassphraseForm
          kind="change"
          noun="password"
          submit={t("lock.notes.change")}
          busyLabel={t("lock.changing")}
          describedby="{id}-notes-change"
          oncancel={() => askNotes(null)}
          onsubmit={async (password, current) => {
            await lockedNotes.changePassword(current, password);
            askNotes(null);
            notesDone = t("lock.notes.changed");
          }}
        />
      </CardBlock>
    {:else if notesAsking === "reset"}
      <CardBlock>
        <p class="m-0 text-sm leading-normal text-muted" id="{id}-notes-reset">{t("lock.notes.resetHint")}</p>
        <PassphraseForm
          kind="new"
          noun="password"
          submit={t("lock.notes.reset")}
          busyLabel={t("lock.notes.resetting")}
          describedby="{id}-notes-reset"
          oncancel={() => askNotes(null)}
          onsubmit={async (password) => {
            await lockedNotes.reset(password);
            askNotes(null);
            notesDone = t("lock.notes.wasReset");
          }}
        />
      </CardBlock>
    {:else if notesAsking === "touch-id"}
      <CardBlock>
        <p class="m-0 text-sm leading-normal text-muted" id="{id}-notes-touch-id-why">{t("lock.notes.touchIdHint")}</p>
        <PassphraseForm
          kind="current"
          noun="password"
          submit={t("lock.useTouchId")}
          busyLabel={t("lock.notes.turningOn")}
          describedby="{id}-notes-touch-id-why"
          oncancel={() => askNotes(null)}
          onsubmit={async (password) => {
            await lockedNotes.unlock(password, noteKeys.settings?.key.id);
            await lockedNotes.setTouchId(true);
            askNotes(null);
          }}
        />
      </CardBlock>
    {:else if noteKeys.settings || noteKeys.anyOpen}
      <CardBlock>
        <div class="flex flex-wrap items-center gap-1.5">
          {#if noteKeys.settings}
            <Button variant="quiet" class="-ml-2.5" onclick={() => askNotes("reset")} {@attach refocusNotes("reset")}>
              {t("lock.notes.askForgot")}
            </Button>
            <Button variant="quiet" class="ml-auto" onclick={() => askNotes("change")} {@attach refocusNotes("change")}>
              {t("lock.notes.askChange")}
            </Button>
          {/if}
          {#if noteKeys.anyOpen}
            <Button variant="primary" icon="lock" class={noteKeys.settings ? "" : "ml-auto"} onclick={() => lockedNotes.close()}>
              {t("lock.lockNow")}
            </Button>
          {/if}
        </div>
      </CardBlock>
    {/if}

    {#if notesError || notesDone}
      <CardBlock id="{id}-notes-error"><Callout tone={notesError ? "danger" : "success"}>{notesError ?? notesDone}</Callout></CardBlock>
    {/if}
  </FieldGroup>
{/if}

<section aria-label={t("lock.synced.title")}>
  <SectionHeading title={t("lock.synced.title")} note={t("lock.synced.intro")}>
    {#snippet action()}
      <Button variant="quiet" icon="cloud" onclick={showSync}>{t("lock.synced.open")}</Button>
    {/snippet}
  </SectionHeading>
</section>
