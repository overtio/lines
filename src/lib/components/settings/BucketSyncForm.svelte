<script lang="ts" module>
  import type { BucketConfig } from "../../sync/providers";

  const empty: BucketConfig = {
    kind: "bucket",
    provider: "r2",
    endpoint: "",
    region: "",
    bucket: "",
    prefix: "lines/",
    accessKeyId: "",
    secretAccessKey: "",
  };

  /** What's typed so far, kept while Settings switches tabs or sync methods. */
  let draft = $state<BucketConfig | null>(null);
</script>

<!-- Connect to an S3-compatible bucket (R2, B2, S3, MinIO…). -->
<script lang="ts">
  import { t } from "../../i18n/index.svelte";
  import { isTauri } from "../../platform";
  import { sync } from "../../sync/engine.svelte";
  import { inferRegion, isFolder, PROVIDERS, type ProviderId } from "../../sync/providers";
  import { closeSettings } from "../../windows/settings.svelte";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import TextField from "../ui/TextField.svelte";
  import CardBlock from "./CardBlock.svelte";

  const connected = $derived(!!sync.config && !isFolder(sync.config));
  draft ??= { ...(sync.config && !isFolder(sync.config) ? sync.config : empty) };
  const form = draft;
  let testing = $state(false);
  let saving = $state(false);
  let message = $state<{ ok: boolean; text: string } | null>(null);
  const id = $props.id();

  /** A message's words before and after a placeholder that's shown as code. */
  const around = (text: string) => text.split("\u0000");
  const [corsBefore, corsAfter] = around(t("sync.bucket.corsTitle", { origin: "\u0000" }));
  const [docsBefore, docsAfter] = around(t("sync.bucket.corsHelp", { file: "\u0000" }));

  const corsRule = JSON.stringify(
    [
      {
        AllowedOrigins: [location.origin],
        AllowedMethods: ["GET", "PUT", "DELETE", "HEAD"],
        AllowedHeaders: ["*"],
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 3600,
      },
    ],
    null,
    2,
  );

  /** A field with its name over it. */
  const field = "flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-muted";

  const providers = Object.entries(PROVIDERS).map(([id, p]) => ({ id: id as ProviderId, label: p.name }));
  const provider = $derived(PROVIDERS[form.provider]);
  const complete = $derived(
    [form.endpoint, form.bucket, form.accessKeyId, form.secretAccessKey].every((field) => field.trim()),
  );

  function choose(id: ProviderId) {
    form.provider = id;
    form.region = "";
    message = null;
  }

  const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

  async function test() {
    testing = true;
    message = null;
    try {
      await sync.test($state.snapshot(form));
      message = { ok: true, text: t("sync.bucket.works") };
    } catch (error) {
      message = { ok: false, text: describe(error) };
    } finally {
      testing = false;
    }
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    saving = true;
    message = null;
    try {
      await sync.test($state.snapshot(form));
      await sync.configure($state.snapshot(form));
      void closeSettings();
    } catch (error) {
      message = { ok: false, text: describe(error) };
    } finally {
      saving = false;
    }
  }

  async function disconnect() {
    saving = true;
    message = null;
    try {
      await sync.configure(null);
      Object.assign(form, empty);
    } catch (error) {
      message = { ok: false, text: describe(error) };
    } finally {
      saving = false;
    }
  }
</script>

<CardBlock>
  <form class="flex flex-col gap-3" onsubmit={save}>
    <Segmented label={t("sync.bucket.provider")} options={providers} value={form.provider} onselect={choose} />
    <p class="m-0 text-xs leading-normal text-muted" id="{id}-help">{provider.help}</p>

    <label class={field}>
      {t("sync.bucket.endpoint")}
      <TextField
        bind:value={form.endpoint}
        placeholder={provider.endpoint}
        required
        autocomplete="off"
        spellcheck="false"
        aria-describedby="{id}-help"
      />
    </label>

    <div class="flex gap-3">
      <label class={field}>
        {t("sync.bucket.bucket")}
        <TextField bind:value={form.bucket} placeholder={t("sync.bucket.bucketExample")} required autocomplete="off" spellcheck="false" />
      </label>
      <label class={field}>
        {t("sync.bucket.folder")}
        <TextField bind:value={form.prefix} placeholder="lines/" autocomplete="off" spellcheck="false" />
      </label>
    </div>

    {#if form.provider === "other" || form.provider === "s3"}
      <label class={field}>
        {t("sync.bucket.region")}
        <TextField bind:value={form.region} placeholder={inferRegion(form.provider, form.endpoint)} autocomplete="off" spellcheck="false" />
      </label>
    {/if}

    <label class={field}>
      {t("sync.bucket.accessKeyId")}
      <TextField bind:value={form.accessKeyId} required autocomplete="off" spellcheck="false" />
    </label>
    <label class={field}>
      {t("sync.bucket.secretAccessKey")}
      <TextField bind:value={form.secretAccessKey} type="password" required autocomplete="off" aria-describedby="{id}-keys" />
    </label>

    <p class="m-0 text-xs leading-normal text-muted" id="{id}-keys">{isTauri ? t("sync.bucket.keysApp") : t("sync.bucket.keysBrowser")}</p>

    {#if !isTauri}
      <details class="text-xs leading-normal text-muted">
        <summary>{corsBefore}<code class="font-mono">{location.origin}</code>{corsAfter}</summary>
        <pre class="my-2 overflow-x-auto rounded-md bg-code px-3 py-2.5 font-mono text-2xs">{corsRule}</pre>
        <p class="m-0">{docsBefore}<code class="font-mono">docs/sync.md</code>{docsAfter}</p>
      </details>
    {/if}

    {#if message}
      <Callout tone={message.ok ? "success" : "danger"}>{message.text}</Callout>
    {/if}

    <div class="flex flex-wrap items-center gap-1.5">
      {#if connected}
        <Button variant="danger" class="-ml-2.5" onclick={disconnect} disabled={saving}>{t("sync.disconnect")}</Button>
      {/if}
      <Button variant="quiet" class="ml-auto" onclick={test} disabled={!complete || testing || saving} aria-busy={testing}>
        {testing ? t("sync.bucket.testing") : t("sync.bucket.test")}
      </Button>
      <Button type="submit" variant="primary" disabled={!complete || saving} aria-busy={saving}>
        {saving ? t("sync.connecting") : connected ? t("sync.save") : t("sync.connect")}
      </Button>
    </div>
  </form>
</CardBlock>
