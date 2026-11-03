<script lang="ts">
  import { onDestroy, onMount, untrack } from "svelte";
  import Icon from "../icons/Icon.svelte";
  import { speak } from "../a11y";
  import { t } from "../i18n/index.svelte";
  import type { Entry } from "../notes/store.svelte";
  import { isApple, isDesktopApp, isTauri, revealFile, saveFile } from "../platform";
  import { plugins } from "../plugins/registry.svelte";
  import type { TypesetResult } from "../plugins/types";
  import { prefs, type Paper } from "../prefs.svelte";
  import { pagesToPng } from "../print/images";
  import { paginate, PAPERS } from "../print/pages";
  import { Parts } from "../print/parts";
  import { placeAt } from "../popover";
  import { zip } from "../zip";
  import "../print/print.css";
  import Segmented from "./Segmented.svelte";

  /*
   * A note as a PDF: laid out on pages by lines, as its language's plugin prints it (print/), or
   * typeset by a typesetter plugin for its language (TeX, for a LaTeX note). lines' pages print as
   * they show, through the system's print dialog, which saves PDFs too; a typesetter's PDF is
   * saved as it is. lines' pages also save as PNG images (print/images.ts): the whole note as one,
   * or one per page.
   */

  let {
    entry,
    save = false,
    png = false,
    onclose,
  }: { entry: Entry; save?: boolean; png?: boolean; onclose: () => void } = $props();

  let dialog: HTMLDialogElement;
  let measure: HTMLElement;
  let pagesEl: HTMLElement = $state()!;
  let scroller: HTMLElement = $state()!;
  let opener: HTMLElement | null = null;

  // A snapshot of the note when the preview opened.
  const { note } = untrack(() => entry);
  const title = untrack(() => entry.meta.title) || t("list.untitled");
  const language = plugins.language(note.format);
  /** Typesetters for its language, besides lines' own pages. */
  const typesetters = untrack(() => plugins.typesettersFor(language.id));
  const filename = title.replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 80) || t("list.untitled");
  /** The system print dialog: in browsers, and in the desktop apps (not on iPhone or iPad). */
  const canPrint = !isTauri || isDesktopApp;

  // Images are lines' pages, so asking for them starts there.
  let typesetter = $state(untrack(() => (png ? "lines" : prefs.typesetter)));
  /** The typesetter making the PDF, if it isn't lines. */
  const external = $derived(typesetters.find((each) => each.id === typesetter));
  const using = $derived(external?.id ?? "lines");

  // lines' own pages.
  let parts: Parts | null = null;
  let doc: HTMLElement | null = null;
  let laidOut = $state(false);
  let count = $state(0);
  let zoom = $state(1);

  // A typesetter's PDF.
  let typesetting = $state<
    | { state: "idle" | "missing" | "compiling" }
    | { state: "downloading"; percent: number }
    | { state: "done"; pdf: Uint8Array<ArrayBuffer>; url: string }
    | { state: "failed"; result: Extract<TypesetResult, { ok: false }> }
  >({ state: "idle" });
  let saved = $state<{ path: string | null; filename: string } | null>(null);

  // PNG images of lines' pages.
  let pngMenu: HTMLElement = $state()!;
  let pngButton: HTMLButtonElement = $state()!;
  let imaging = $state(false);
  let imageFailed = $state(false);

  /** A style that sets the printed page's size, while the preview is open. */
  const pageStyle = document.createElement("style");

  onMount(() => {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Straight in the page, so printing can show the pages alone (print.css).
    document.body.append(dialog);
    document.head.append(pageStyle);
    dialog.showModal();
    addEventListener("beforeprint", beforePrint);
    addEventListener("afterprint", afterPrint);
    const observer = new ResizeObserver(fit);
    observer.observe(scroller);
    return () => observer.disconnect();
  });

  onDestroy(() => {
    parts?.destroy();
    pageStyle.remove();
    dialog?.remove();
    removeEventListener("beforeprint", beforePrint);
    removeEventListener("afterprint", afterPrint);
    if (typesetting.state === "done") URL.revokeObjectURL(typesetting.url);
    if (opener?.isConnected) opener.focus();
  });

  // Lays out lines' pages the first time they're wanted, and again for other paper.
  $effect(() => {
    const paper = prefs.paper;
    if (using !== "lines") return;
    untrack(() => void layOut(paper));
  });

  // Typesets with the typesetter when it's chosen, once.
  $effect(() => {
    if (using === "lines") return;
    untrack(() => {
      if (typesetting.state === "idle") void typeset();
    });
  });

  $effect(() => {
    const { width, height } = PAPERS[prefs.paper];
    pageStyle.textContent = `@page { size: ${width}mm ${height}mm; margin: 0; }`;
  });

  let saveWhenReady = untrack(() => save);

  async function layOut(paper: Paper) {
    if (!doc) {
      parts = new Parts();
      doc = language.print(note.body, parts);
      measure.replaceChildren(doc);
      // Laid out once in the page before waiting, so the fonts it uses start loading.
      void doc.offsetHeight;
      await parts.ready();
    }
    const pages = paginate(doc, measure, paper);
    pages.forEach((page, i) => {
      page.setAttribute("role", "group");
      page.setAttribute("aria-label", t("print.page", { page: i + 1, count: pages.length }));
    });
    pagesEl.replaceChildren(...pages);
    count = pages.length;
    const first = !laidOut;
    laidOut = true;
    fit();
    if (first) speak(t("print.ready", { count }));
    if (first && saveWhenReady) {
      saveWhenReady = false;
      exportPdf();
    }
    if (first && png) pngMenu?.showPopover();
  }

  async function typeset() {
    const by = external;
    if (!by) return;
    const name = by.name;
    if (!(await by.available())) return void (typesetting = { state: "missing" });
    typesetting = { state: "compiling" };
    const result = await by.typeset(note.body, (progress) => {
      typesetting = progress.phase === "download" ? { state: "downloading", percent: Math.round(progress.percent ?? 0) } : { state: "compiling" };
    });
    if (!result.ok) {
      typesetting = { state: "failed", result };
      speak(result.line ? t("print.typesetErrorAt", { name, line: result.line }) : t("print.typesetError", { name }));
      return;
    }
    const pdf = new Uint8Array(result.pdf);
    typesetting = { state: "done", pdf, url: URL.createObjectURL(new Blob([pdf], { type: "application/pdf" })) };
    speak(t("print.typesetReady", { name }));
    if (saveWhenReady) {
      saveWhenReady = false;
      exportPdf();
    }
  }

  function retry() {
    typesetting = { state: "idle" };
    void typeset();
  }

  /** Pages shrink to fit a narrow window; they print full size. */
  function fit() {
    if (!scroller) return;
    const pageWidth = (PAPERS[prefs.paper].width / 25.4) * 96;
    zoom = Math.min(1, (scroller.clientWidth - 32) / pageWidth);
  }

  /** Prints lines' pages, or saves the typesetter's PDF. */
  function exportPdf() {
    if (using !== "lines") {
      if (typesetting.state !== "done") return;
      void saveFile(`${filename}.pdf`, typesetting.pdf, "application/pdf").then((path) => {
        saved = { path, filename: `${filename}.pdf` };
        speak(path ? t("print.savedTo", { path }) : t("print.downloaded", { filename: `${filename}.pdf` }));
      });
    } else if (laidOut && canPrint) window.print();
  }

  /** Under its button, right-aligned. */
  function placeMenu(event: ToggleEvent) {
    if (event.newState !== "open") return;
    const rect = pngButton.getBoundingClientRect();
    placeAt(pngMenu, rect.right, rect.bottom + 6, "end");
  }

  /**
   * Saves lines' pages as PNG images: the whole note as one tall image, or each page as one (in a
   * ZIP when there are several).
   */
  async function savePng(whole: boolean) {
    pngMenu.hidePopover();
    if (!doc || imaging) return;
    imaging = true;
    imageFailed = false;
    saved = null;
    try {
      const pages = whole ? paginate(doc, measure, prefs.paper, true) : ([...pagesEl.children] as HTMLElement[]);
      const images = await pagesToPng(pages);
      const modified = new Date();
      const [name, data, type] =
        images.length === 1
          ? [`${filename}.png`, images[0], "image/png"]
          : [`${filename}.zip`, zip(images.map((data, i) => ({ name: `${filename} ${i + 1}.png`, data, modified }))), "application/zip"];
      const path = await saveFile(name, data, type);
      saved = { path, filename: name };
      speak(path ? t("print.savedTo", { path }) : t("print.downloaded", { filename: name }));
    } catch (error) {
      console.error("lines: couldn't make the images", error);
      imageFailed = true;
      speak(t("print.imagesFailed"));
    } finally {
      imaging = false;
    }
  }

  // The browser names the PDF it saves after the page's title.
  let pageTitle = "";
  function beforePrint() {
    pageTitle = document.title;
    document.title = filename;
  }

  function afterPrint() {
    if (pageTitle) document.title = pageTitle;
    pageTitle = "";
  }

  function onkeydown(event: KeyboardEvent) {
    // ⌘P (Ctrl+P) here prints or saves, rather than the browser printing the window.
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "p") {
      event.preventDefault();
      event.stopPropagation();
      return exportPdf();
    }
    if (event.key !== "Tab") return;
    // Tab stays inside the preview, as in Settings.
    const stops = [...dialog.querySelectorAll<HTMLElement>("button, a[href], iframe, summary, [tabindex]")].filter(
      (element) => element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled && element.getClientRects().length > 0,
    );
    const first = stops[0];
    const last = stops.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const papers = [
    { id: "a4" as const, label: t("print.a4") },
    { id: "letter" as const, label: t("print.letter") },
  ];
  const typesetterOptions = [{ id: "lines", label: t("print.lines") }, ...typesetters.map(({ id, name }) => ({ id, label: name }))];

  const ready = $derived(using !== "lines" ? typesetting.state === "done" : laidOut && canPrint);
</script>

{#snippet savedMessage(file: { path: string | null; filename: string })}
  {file.path ? t("print.savedTo", { path: file.path }) : t("print.downloaded", { filename: file.filename })}
  {#if file.path}
    <button class="text-button" onclick={() => void revealFile(file.path!)}>{isApple ? t("settings.showInFinder") : t("settings.showInFolder")}</button>
  {/if}
{/snippet}

<dialog
  bind:this={dialog}
  class="pdf-preview"
  aria-labelledby="pdf-preview-title"
  onclose={onclose}
  {onkeydown}
>
  <header class="toolbar">
    <div class="heading">
      <h2 id="pdf-preview-title">{t("print.title")}</h2>
      <span class="note-title">{title}</span>
    </div>
    <div class="controls">
      {#if typesetters.length}
        <div class="control">
          <span class="label" aria-hidden="true">{t("print.typesetter")}</span>
          <Segmented label={t("print.typesetter")} options={typesetterOptions} value={using} onselect={(id) => (typesetter = prefs.typesetter = id)} />
        </div>
      {/if}
      {#if using === "lines"}
        <div class="control">
          <span class="label" aria-hidden="true">{t("print.paper")}</span>
          <Segmented label={t("print.paper")} options={papers} value={prefs.paper} onselect={(id) => (prefs.paper = id)} />
        </div>
      {/if}
      {#if using === "lines"}
        <button class="secondary" bind:this={pngButton} popovertarget="png-menu" disabled={!laidOut || imaging}>
          <Icon name="image" size={15} />
          {t("print.png")}
        </button>
        <div id="png-menu" class="png-menu" popover bind:this={pngMenu} ontoggle={placeMenu} role="group" aria-label={t("print.png")}>
          <button onclick={() => void savePng(true)}>
            <span class="item-title">{t("print.pngWhole")}</span>
            <span class="item-hint">{t("print.pngWholeHint")}</span>
          </button>
          <button onclick={() => void savePng(false)}>
            <span class="item-title">{t("print.pngPages")}</span>
            <span class="item-hint">{t("print.pngPagesHint", { count })}</span>
          </button>
        </div>
      {/if}
      {#if using === "lines" ? canPrint : true}
        <button class="primary" disabled={!ready} onclick={exportPdf} title={using === "lines" ? t("print.printHint") : undefined}>
          <Icon name={using === "lines" ? "printer" : "download"} size={15} />
          {using === "lines" ? t("print.print") : t("print.savePdf")}
        </button>
      {/if}
      <button class="icon-button" onclick={() => dialog.close()} aria-label={t("print.close")} title={t("print.close")}>
        <Icon name="x" size={18} />
      </button>
    </div>
  </header>

  <div class="status" role="status">
    {#if using === "lines"}
      {#if !laidOut}
        {t("print.layingOut")}
      {:else if imaging}
        {t("print.makingImages")}
      {:else if imageFailed}
        {t("print.imagesFailed")}
      {:else if saved}
        {@render savedMessage(saved)}
      {:else}
        {t("print.pages", { count })}{#if canPrint}<span class="hint"> · {t("print.printHint")}</span>{/if}
      {/if}
    {:else if typesetting.state === "downloading"}
      {t("print.downloading", { name: external!.name, percent: typesetting.percent })}
      {#if external?.download}<span class="hint">{external.download}</span>{/if}
    {:else if typesetting.state === "compiling"}
      {t("print.compiling", { name: external!.name })}
    {:else if typesetting.state === "done"}
      {#if saved}
        {@render savedMessage(saved)}
      {:else}
        {t("print.typesetReady", { name: external!.name })}
      {/if}
    {/if}
  </div>

  <div class="scroller" bind:this={scroller}>
    <!-- lines' pages, laid out by print/pages.ts. -->
    <div class="pages" bind:this={pagesEl} hidden={using !== "lines"} style:zoom></div>

    {#if external}
      {@const name = external.name}
      {#if typesetting.state === "done"}
        <iframe class="pdf" src={typesetting.url} title={t("print.pdfFrame", { title, name })}></iframe>
      {:else if typesetting.state === "downloading"}
        <div class="message">
          <progress max="100" value={typesetting.percent} aria-label={t("print.downloading", { name, percent: typesetting.percent })}></progress>
        </div>
      {:else if typesetting.state === "missing"}
        <p class="message">{t("print.typesetterMissing", { name })}</p>
      {:else if typesetting.state === "failed"}
        <div class="message failed">
          {#if typesetting.result.starting}
            <p>{t("print.typesetterOffline", { name })}</p>
          {:else}
            <p><strong>{typesetting.result.line ? t("print.typesetErrorAt", { name, line: typesetting.result.line }) : t("print.typesetError", { name })}</strong></p>
            <pre class="error">{typesetting.result.error}</pre>
            <details>
              <summary>{t("print.log", { name })}</summary>
              <pre class="log">{typesetting.result.log}</pre>
            </details>
          {/if}
          <button class="text-button" onclick={retry}>{t("print.retry")}</button>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Where the document is laid out before it's cut into pages. -->
  <div class="print-measure" bind:this={measure} aria-hidden="true"></div>
</dialog>

<style>
  dialog {
    width: 100vw;
    max-width: none;
    height: 100dvh;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: var(--bg-sidebar);
    color: var(--text);
  }

  dialog[open] {
    display: flex;
    flex-direction: column;
  }

  dialog::backdrop {
    background: var(--scrim);
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
    padding: 10px 12px 8px 20px;
    padding-top: max(10px, env(safe-area-inset-top));
    border-bottom: 1px solid var(--border);
    background: var(--bg-elevated);
  }

  .heading {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 650;
    white-space: nowrap;
  }

  .note-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: var(--text-muted);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
  }

  .control {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .label {
    font-size: 12.5px;
    color: var(--text-muted);
  }

  .primary {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 32px;
    padding: 0 14px;
    border-radius: 9px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 13px;
    font-weight: 600;
  }

  .primary:disabled,
  .secondary:disabled {
    opacity: var(--disabled-opacity);
  }

  .secondary {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--bg-elevated);
    color: var(--text);
    font-size: 13px;
    font-weight: 550;
  }

  .png-menu {
    position: fixed;
    inset: auto;
    margin: 0;
    min-width: 220px;
    padding: 5px;
    border: 1px solid var(--border);
    border-radius: 11px;
    background: var(--bg-elevated);
    color: var(--text);
    box-shadow: var(--shadow-menu);
  }

  .png-menu button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    width: 100%;
    padding: 7px 10px;
    border-radius: 7px;
    text-align: left;
  }

  .png-menu button:hover,
  .png-menu button:focus-visible {
    background: var(--hover);
  }

  .item-title {
    font-size: 13px;
    font-weight: 550;
  }

  .item-hint {
    font-size: 12px;
    color: var(--text-muted);
  }

  .status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    min-height: 34px;
    padding: 6px 20px;
    font-size: 12.5px;
    color: var(--text-muted);
  }

  .hint {
    color: var(--text-faint);
  }

  .scroller {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
  }

  .pages {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 8px 16px 40px;
  }

  .pages[hidden] {
    display: none;
  }

  .pages > :global(.print-page) {
    box-shadow:
      0 0 0 1px rgb(0 0 0 / 0.08),
      0 2px 12px rgb(0 0 0 / 0.12);
  }

  .pdf {
    flex: 1;
    width: 100%;
    min-height: 0;
    border: 0;
    background: var(--bg-sidebar);
  }

  .message {
    max-width: 560px;
    margin: 48px auto;
    padding: 0 20px;
    font-size: 14px;
    color: var(--text-muted);
    text-align: center;
  }

  .message progress {
    width: 100%;
    accent-color: var(--accent);
  }

  .failed {
    text-align: left;
    color: var(--text);
  }

  .failed pre {
    overflow: auto;
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--input);
    font-family: var(--font-mono);
    font-size: 12px;
    white-space: pre-wrap;
  }

  .failed .log {
    max-height: 40vh;
  }

  .failed summary {
    cursor: pointer;
    font-size: 13px;
    color: var(--text-muted);
  }

  /* Printing shows the pages alone, each on its own sheet. The page's size is set while the preview is open. */
  @media print {
    :global(html),
    :global(body) {
      height: auto !important;
      overflow: visible !important;
      background: #ffffff !important;
    }

    :global(body > :not(.pdf-preview)) {
      display: none !important;
    }

    dialog,
    dialog[open] {
      position: static;
      display: block;
      width: auto;
      height: auto;
      background: none;
    }

    dialog::backdrop {
      display: none;
    }

    .toolbar,
    .status,
    .print-measure {
      display: none !important;
    }

    .scroller {
      display: block;
      overflow: visible;
    }

    .pages {
      display: block;
      padding: 0;
      zoom: 1 !important;
    }

    .pages > :global(.print-page) {
      box-shadow: none;
      break-after: page;
    }

    .pages > :global(.print-page:last-child) {
      break-after: auto;
    }
  }
</style>
