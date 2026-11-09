<script lang="ts">
  // Settings → About → Updates, in the desktop apps: how updating stands, and whether and when
  // lines updates itself (updates.svelte.ts).
  import { speak } from "../../a11y";
  import { formatDay } from "../../format";
  import { t } from "../../i18n/index.svelte";
  import type { IconName } from "../../icons/icons";
  import { formatPercent, prefs, UPDATE_WAITS, type UpdateWait } from "../../prefs.svelte";
  import { updates, type UpdateStatus } from "../../updates.svelte";
  import Button from "../ui/Button.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Select from "../ui/Select.svelte";
  import Switch from "../ui/Switch.svelte";
  import StatusRow from "./StatusRow.svelte";

  const waitLabel = (days: UpdateWait) =>
    days === 0
      ? t("settings.updateWaitNone")
      : days === 30
        ? t("settings.updateWaitMonth")
        : days % 7 === 0
          ? t("settings.updateWaitWeeks", { count: days / 7 })
          : t("settings.updateWaitDays", { count: days });
  const waits = UPDATE_WAITS.map((days) => ({ value: String(days), label: waitLabel(days) }));

  function describe(status: UpdateStatus) {
    switch (status.kind) {
      case "checking":
        return t("settings.updatesChecking");
      case "upToDate":
        return t("settings.updatesUpToDate");
      case "available":
        return status.due === null
          ? t("settings.updatesAvailable", { version: status.version })
          : t("settings.updatesWaiting", { version: status.version, date: formatDay(status.due) });
      case "downloading":
        return status.progress === null
          ? t("settings.updatesDownloading", { version: status.version })
          : t("settings.updatesDownloadingPercent", { version: status.version, percent: formatPercent(status.progress) });
      case "ready":
        return t("settings.updatesReady", { version: status.version });
      case "failed":
        return t("settings.updatesFailed");
      default:
        return t("settings.updatesIdle");
    }
  }

  function iconOf(status: UpdateStatus): IconName {
    switch (status.kind) {
      case "checking":
      case "downloading":
        return "loader";
      case "upToDate":
        return "check";
      case "available":
        return status.due === null ? "download" : "hourglass";
      case "ready":
        return "download";
      case "failed":
        return "circle-alert";
      default:
        return "refresh";
    }
  }

  const status = $derived(updates.status);
  const busy = $derived(status.kind === "checking" || status.kind === "downloading");
  const tone = $derived(status.kind === "failed" ? "danger" : status.kind === "upToDate" || status.kind === "ready" ? "success" : "muted");

  /** Checks when asked, and says how it went: the row changing isn't heard. */
  async function checkNow() {
    speak(describe(await updates.check()));
  }

  function setAuto(on: boolean) {
    prefs.autoUpdate = on;
    if (on) void updates.check();
  }

  function setWait(value: string) {
    prefs.updateWait = Number(value) as UpdateWait;
    void updates.check();
  }
</script>

<FieldGroup title={t("settings.updates")}>
  <StatusRow icon={iconOf(status)} {tone} spin={busy}>
    {describe(status)}
    {#if status.kind === "failed"}<span class="mt-0.5 block text-xs break-words text-faint">{status.error}</span>{/if}
    {#snippet action()}
      {#if status.kind === "available"}
        <Button onclick={() => void updates.installNow()}>{t("settings.installNow")}</Button>
      {:else if status.kind === "ready"}
        <Button onclick={() => void updates.restart()}>{t("settings.restartToUpdate")}</Button>
      {:else if !busy}
        <Button variant="quiet" icon="refresh" onclick={checkNow}>
          {status.kind === "failed" ? t("settings.tryAgain") : t("settings.checkNow")}
        </Button>
      {/if}
    {/snippet}
  </StatusRow>
  <FieldRow label={t("settings.autoUpdate")} note={t("settings.autoUpdateNote")}>
    <Switch label={t("settings.autoUpdate")} checked={prefs.autoUpdate} onchange={setAuto} />
  </FieldRow>
  {#if prefs.autoUpdate}
    <FieldRow label={t("settings.updateWait")} note={t("settings.updateWaitNote")}>
      <Select label={t("settings.updateWait")} value={String(prefs.updateWait)} options={waits} onchange={setWait} />
    </FieldRow>
  {/if}
</FieldGroup>
