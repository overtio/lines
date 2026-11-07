<script lang="ts">
  // A request's response, under it in the note: its status, how long it took and its size, then its
  // body (formatted and highlighted when it's JSON or XML, shown when it's an image) or its headers.
  import { highlightCode } from "@lezer/highlight";
  import { speak } from "../../lib/a11y";
  import IconButton from "../../lib/components/ui/IconButton.svelte";
  import Segmented from "../../lib/components/ui/Segmented.svelte";
  import { formatSize } from "../../lib/editor/attachments";
  import { codeLanguage } from "../../lib/editor/codeLanguages";
  import { highlightStyle } from "../../lib/editor/setup";
  import { locale, t } from "../../lib/i18n/index.svelte";
  import { copyText } from "../../lib/platform";
  import type { Exchange, Received } from "./send.svelte";

  let {
    exchange,
    close,
    addToNote,
  }: {
    exchange: Exchange;
    close: () => void;
    /** Writes the body into the note as a code block, where that's possible (Markdown notes). */
    addToNote?: (text: string, language: string) => void;
  } = $props();

  /** As much of a body as is shown; Copy copies all of it. */
  const SHOWN = 200_000;
  /** As much as is highlighted: every token is an element, which slows the note down. */
  const HIGHLIGHTED = 50_000;

  let tab = $state<"body" | "headers">("body");
  const received = $derived(exchange.received);

  /** The body as it shows: JSON indented, and the language it's highlighted as. */
  function readable(response: Received): { text: string; language: string } {
    const { text, type } = response;
    if (/json/.test(type) || (!type && /^\s*[[{]/.test(text))) {
      try {
        return { text: JSON.stringify(JSON.parse(text), null, 2), language: "json" };
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

  /** Draws `text` into the element, then highlights it once its language has loaded. */
  function highlighted(node: HTMLElement, shown: { text: string; language: string }) {
    let drawing = 0;
    const draw = ({ text, language }: { text: string; language: string }) => {
      const run = ++drawing;
      node.textContent = text;
      const found = language && text.length <= HIGHLIGHTED ? codeLanguage(language) : null;
      void found?.load().then((support) => {
        if (run !== drawing) return;
        const parts = document.createDocumentFragment();
        highlightCode(
          text,
          support.language.parser.parse(text),
          highlightStyle,
          (piece, classes) => {
            if (!classes) return parts.append(piece);
            const span = document.createElement("span");
            span.className = classes;
            span.textContent = piece;
            parts.append(span);
          },
          () => parts.append("\n"),
        );
        node.replaceChildren(parts);
      });
    };
    draw(shown);
    return {
      update: draw,
      destroy: () => void drawing++,
    };
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
      {/if}
      <span class="min-w-0 truncate font-mono text-[12px] text-faint" title={exchange.asked.url}>{exchange.asked.method} {exchange.asked.url}</span>
    </div>
    {#if received}
      <Segmented
        class="shrink-0"
        label={t("http.show")}
        value={tab}
        onselect={(id) => (tab = id)}
        options={[
          { id: "body", label: t("http.body") },
          { id: "headers", label: t("http.headers", { count: received.headers.length }) },
        ]}
      />
      <IconButton icon="copy" iconSize={15} label={tab === "headers" ? t("http.copyHeaders") : t("http.copyBody")} onclick={copy} />
      {#if addToNote && body && body.text.length <= SHOWN && tab === "body"}
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
    {#if tab === "headers"}
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
        <pre class="max-h-[min(420px,60vh)] overflow-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all select-text" use:highlighted={{ text: body.text.slice(0, SHOWN), language: body.language }}></pre>
        {#if body.text.length > SHOWN}
          <p class="border-t border-line px-3 py-2 text-muted">{t("http.cut", { size: formatSize(SHOWN) })}</p>
        {/if}
      {:else}
        <p class="px-3 py-2.5 text-muted">{t("http.empty")}</p>
      {/if}
    {:else}
      <p class="px-3 py-2.5 text-muted">{t("http.binary", { type: received.type || t("http.unknownType") })}</p>
    {/if}
  {/if}
</section>
