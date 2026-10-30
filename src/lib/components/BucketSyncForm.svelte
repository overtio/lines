<script lang="ts" module>
  import type { BucketConfig } from "../sync/providers";

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
  import { t } from "../i18n/index.svelte";
  import { isTauri } from "../platform";
  import { sync } from "../sync/engine.svelte";
  import { inferRegion, isFolder, PROVIDERS, type ProviderId } from "../sync/providers";
  import Segmented from "./Segmented.svelte";
  import { closeSettings } from "../windows/settings.svelte";

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

<form onsubmit={save}>
  <Segmented label={t("sync.bucket.provider")} options={providers} value={form.provider} onselect={choose} />
  <p class="prose" id="{id}-help">{provider.help}</p>

  <label>
    <span>{t("sync.bucket.endpoint")}</span>
    <input
      bind:value={form.endpoint}
      placeholder={provider.endpoint}
      required
      autocomplete="off"
      spellcheck="false"
      aria-describedby="{id}-help"
    />
  </label>

  <div class="row">
    <label>
      <span>{t("sync.bucket.bucket")}</span>
      <input bind:value={form.bucket} placeholder={t("sync.bucket.bucketExample")} required autocomplete="off" spellcheck="false" />
    </label>
    <label>
      <span>{t("sync.bucket.folder")}</span>
      <input bind:value={form.prefix} placeholder="lines/" autocomplete="off" spellcheck="false" />
    </label>
  </div>

  {#if form.provider === "other" || form.provider === "s3"}
    <label>
      <span>{t("sync.bucket.region")}</span>
      <input
        bind:value={form.region}
        placeholder={inferRegion(form.provider, form.endpoint)}
        autocomplete="off"
        spellcheck="false"
      />
    </label>
  {/if}

  <label>
    <span>{t("sync.bucket.accessKeyId")}</span>
    <input bind:value={form.accessKeyId} required autocomplete="off" spellcheck="false" />
  </label>
  <label>
    <span>{t("sync.bucket.secretAccessKey")}</span>
    <input bind:value={form.secretAccessKey} type="password" required autocomplete="off" aria-describedby="{id}-keys" />
  </label>

  <p class="note" id="{id}-keys">{isTauri ? t("sync.bucket.keysApp") : t("sync.bucket.keysBrowser")}</p>

  {#if !isTauri}
    <details class="note">
      <summary>{corsBefore}<code>{location.origin}</code>{corsAfter}</summary>
      <pre>{corsRule}</pre>
      <p>{docsBefore}<code>docs/sync.md</code>{docsAfter}</p>
    </details>
  {/if}

  {#if message}
    <p class="message" class:ok={message.ok} role={message.ok ? "status" : "alert"}>{message.text}</p>
  {/if}

  <footer class="form-footer">
    {#if connected}
      <button type="button" class="text-button danger" onclick={disconnect} disabled={saving}>{t("sync.disconnect")}</button>
    {/if}
    <button type="button" class="text-button push" onclick={test} disabled={!complete || testing || saving} aria-busy={testing}>
      {testing ? t("sync.bucket.testing") : t("sync.bucket.test")}
    </button>
    <button type="submit" class="primary" disabled={!complete || saving} aria-busy={saving}>
      {saving ? t("sync.connecting") : connected ? t("sync.save") : t("sync.connect")}
    </button>
  </footer>
</form>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  form .prose {
    margin: 0;
  }

  pre {
    margin: 8px 0;
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--code-bg);
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--text-muted);
    overflow-x: auto;
  }

  code {
    font-family: var(--font-mono);
    font-size: 0.92em;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
    min-width: 0;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .row {
    display: flex;
    gap: 12px;
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

  /* Touch screens: a target a finger can hit (44 px high). */
  @media (pointer: coarse) {
    input {
      height: 44px;
    }
  }
</style>
