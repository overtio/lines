<script lang="ts">
  // A request's response, under it in the note: its status, how long it took and its size, then its
  // body (JSON indented, highlighted in an editor of its own, body.ts; an image shown), its headers,
  // or, for a Hurl entry, its checks: each passed or not, with what the response had.
  import { speak } from "../../lib/a11y";
  import IconButton from "../../lib/components/ui/IconButton.svelte";
  import Icon from "../../lib/icons/Icon.svelte";
  import Segmented from "../../lib/components/ui/Segmented.svelte";
  import { formatSize } from "../../lib/editor/attachments";
  import { locale, t } from "../../lib/i18n/index.svelte";
  import { copyText } from "../../lib/platform";
  import { bodyView, type Shown } from "./body";
  import { indentJson } from "./json";
  import type { Exchange, Received } from "./send.svelte";

  let {
    exchange,
    close,
    addToNote,
    follow,
  }: {
    exchange: Exchange;
    close: () => void;
    /** Writes the body into the note as a code block, where that's possible (Markdown notes). */
    addToNote?: (text: string, language: string) => void;
    /** Adds a request to an address in the body to the note, and sends it, where that's possible. */
    follow?: (url: string) => void;
  } = $props();

  /** As much of a body as can be added to the note: more would make a note too slow to work in. */
  const ADDABLE = 200_000;

  type Tab = "body" | "headers" | "checks";
  /** The tab chosen; until one is, Checks if one failed, else Body. */
  let chosen = $state<Tab | null>(null);
  const received = $derived(exchange.received);
  const checks = $derived(exchange.checks);
  const failed = $derived(checks?.filter((each) => !each.ok).length ?? 0);
  const tab = $derived<Tab>(chosen ?? (failed ? "checks" : "body"));

  /** The body as it shows: JSON indented, and the language it's highlighted as. */
  function readable(response: Received): Shown {
    const { text, type } = response;
    if (/json/.test(type) || (!type && /^\s*[[{]/.test(text))) {
      try {
        return { text: indentJson(text), language: "json" };
      } catch {
        // Not JSON after all: as it came.
      }
    }
    if (/html/.test(type)) return { text, language: "html" };
    if (/xml|svg/.test(type)) return { text, language: "xml" };
    return { text, language: "" };
  }

  const body = $derived(received?.isText ? readable(received) : null);
  const image = $derived(received?.type.startsWith("image/") ? URL.createObjectURL(new Blob([received.bytes.slice()], { type: received.type })) : null);
  $effect(() => {
    const url = image;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  });

  const tone = $derived(!received ? "" : received.status >= 400 ? "text-danger" : received.status < 300 ? "text-success" : "text-accent");

  const milliseconds = new Intl.NumberFormat(locale, { style: "unit", unit: "millisecond", unitDisplay: "short", maximumFractionDigits: 0 });
  const seconds = new Intl.NumberFormat(locale, { style: "unit", unit: "second", unitDisplay: "short", maximumFractionDigits: 1 });
  const duration = (ms: number) => (ms < 1000 ? milliseconds.format(ms) : seconds.format(ms / 1000));

  const headerText = (response: Received) => response.headers.map(([name, value]) => `${name}: ${value}`).join("\n");

  function copy() {
    if (!received) return;
    void copyText(tab === "headers" ? headerText(received) : (body?.text ?? received.text));
    speak(t("editor.copied"));
  }

</script>

<section class="cm-http-response-panel my-1.5 overflow-hidden rounded-lg border border-line bg-panel font-ui text-[13px] leading-normal whitespace-normal text-fg" aria-label={t("http.response")}>
  <header class="flex min-h-10 items-center gap-3 border-b border-line py-1 pr-1 pl-3">
    <div class="flex min-w-0 flex-1 items-center gap-3" aria-live="polite">
      {#if exchange.state === "sending"}
        <span class="text-muted">{t("http.sending")}</span>
      {:else if exchange.state === "failed"}
        <span class="shrink-0 font-semibold text-danger">{t("http.noResponse")}</span>
      {:else if received}
        <span class="shrink-0 font-semibold tabular-nums {tone}">{received.status} {received.statusText}</span>
        <span class="shrink-0 text-muted tabular-nums">{duration(received.time)}</span>
        <span class="shrink-0 text-muted tabular-nums">{formatSize(received.bytes.length)}</span>
        {#if checks?.length}
          <span class={["shrink-0 font-medium", failed ? "text-danger" : "text-success"]}>
            {failed ? t("hurl.failedShort", { failed: String(failed) }) : t("hurl.passed", { count: checks.length })}
          </span>
        {/if}
      {/if}
      <span class="min-w-0 truncate font-mono text-[12px] text-faint" title={exchange.shownUrl}>{exchange.asked.method} {exchange.shownUrl}</span>
    </div>
    {#if received}
      <Segmented
        class="shrink-0"
        label={t("http.show")}
        value={tab}
        onselect={(id) => (chosen = id)}
        options={[
          { id: "body", label: t("http.body") },
          { id: "headers", label: t("http.headers", { count: received.headers.length }) },
          ...(checks?.length ? [{ id: "checks" as const, label: t("hurl.checks", { count: String(checks.length) }) }] : []),
        ]}
      />
      {#if tab !== "checks"}
        <IconButton icon="copy" iconSize={15} label={tab === "headers" ? t("http.copyHeaders") : t("http.copyBody")} onclick={copy} />
      {/if}
      {#if addToNote && body && body.text.length <= ADDABLE && tab === "body"}
        <IconButton icon="plus" iconSize={15} label={t("http.addToNote")} onclick={() => addToNote(body.text, body.language)} />
      {/if}
    {/if}
    {#if exchange.state === "sending"}
      <IconButton icon="x" iconSize={15} label={t("http.cancel")} onclick={() => exchange.cancel()} />
    {:else}
      <IconButton icon="x" iconSize={15} label={t("http.close")} onclick={close} />
    {/if}
  </header>
  {#if exchange.state === "failed"}
    <p class="px-3 py-2.5 text-danger">{exchange.error}</p>
  {:else if received}
    {#if tab === "checks" && checks}
      <ul class="m-0 max-h-[min(420px,60vh)] list-none overflow-auto px-3 py-2">
        {#each checks as each, index (index)}
          <li class="flex items-start gap-2 py-1">
            <span class={["mt-px shrink-0", each.ok ? "text-success" : "text-danger"]} aria-label={each.ok ? t("hurl.ok") : t("hurl.notOk")}>
              <Icon name={each.ok ? "check" : "x"} size={14} strokeWidth={2.5} />
            </span>
            <span class="min-w-0">
              <code class="font-mono text-[12px] break-all select-text">{each.text}</code>
              {#if each.actual}<span class="block text-[12px] break-all text-muted select-text">{t("hurl.check.had", { value: each.actual })}</span>{/if}
            </span>
          </li>
        {/each}
      </ul>
    {:else if tab === "headers"}
      <dl class="grid max-h-[min(420px,60vh)] grid-cols-[auto_1fr] gap-x-4 gap-y-1 overflow-auto px-3 py-2.5 font-mono text-[12px]">
        {#each received.headers as [name, value], index (index)}
          <dt class="text-muted">{name}</dt>
          <dd class="min-w-0 break-all select-text">{value}</dd>
        {/each}
      </dl>
    {:else if image}
      <div class="grid max-h-[min(420px,60vh)] place-items-center overflow-auto p-3">
        <img src={image} alt={t("http.image")} class="max-w-full" />
      </div>
    {:else if body}
      {#if body.text}
        <div class="cm-http-body" use:bodyView={{ ...body, follow }}></div>
      {:else}
        <p class="px-3 py-2.5 text-muted">{t("http.empty")}</p>
      {/if}
    {:else}
      <p class="px-3 py-2.5 text-muted">{t("http.binary", { type: received.type || t("http.unknownType") })}</p>
    {/if}
  {/if}
</section>
