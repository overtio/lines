<script lang="ts">
  import { Dialog, DropdownMenu } from "bits-ui";
  import { onDestroy, onMount, untrack } from "svelte";
  import { speak } from "../a11y";
  import { t } from "../i18n/index.svelte";
  import { fileName } from "../notes/export";
  import type { Entry } from "../notes/store.svelte";
  import { canPrint, isApple, revealFile, saveFile } from "../platform";
  import { plugins } from "../plugins/registry.svelte";
  import type { TypesetResult } from "../plugins/types";
  import { prefs, type Paper } from "../prefs.svelte";
  import { pagesToPng } from "../print/images";
  import { paginate, PAPERS } from "../print/pages";
  import { Parts } from "../print/parts";
  import { zip } from "../zip";
  import "../print/print.css";
  import Button from "./ui/Button.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import Segmented from "./ui/Segmented.svelte";
  import { floating } from "./ui/styles";

  /*
   * A note as a PDF: laid out on pages by lines, as its language's plugin prints it (print/), or
   * typeset by a typesetter plugin for its language (TeX, for a LaTeX note). lines' pages print as
   * they show, through the system's print dialog, which saves PDFs too; a typesetter's PDF is
   * saved as it is. lines' pages also save as PNG images (print/images.ts): the whole note as one,
   * or one per page.
   */

  let {
    entry,
    action,
    onclose,
  }: {
    entry: Entry;
    /** What to go straight on to once it's ready: printing, exporting the PDF, or offering PNG images. */
    action?: "print" | "export" | "png";
    onclose: () => void;
  } = $props();

  let measure = $state<HTMLElement>();
  let pagesEl = $state<HTMLElement>();
  let scroller = $state<HTMLElement>();
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  // A snapshot of the note when the preview opened.
  const { note } = untrack(() => entry);
  const title = untrack(() => entry.meta.title) || t("list.untitled");
  const language = plugins.language(note.format);
  /** Typesetters for its language, besides lines' own pages. */
  const typesetters = untrack(() => plugins.typesettersFor(language.id));
  const filename = fileName(title);

  // Printing and images use lines' pages, so asking for either starts there.
  let typesetter = $state(untrack(() => (action === "print" || action === "png" ? "lines" : prefs.typesetter)));
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
  let pngMenu = $state(false);
  let imaging = $state(false);
  let imageFailed = $state(false);

  /** A style that sets the printed page's size, while the preview is open. */
  const pageStyle = document.createElement("style");

  onMount(() => {
    document.head.append(pageStyle);
    addEventListener("beforeprint", beforePrint);
    addEventListener("afterprint", afterPrint);
  });

  $effect(() => {
    if (!scroller) return;
    const observer = new ResizeObserver(fit);
    observer.observe(scroller);
    return () => observer.disconnect();
  });

  onDestroy(() => {
    parts?.destroy();
    pageStyle.remove();
    removeEventListener("beforeprint", beforePrint);
    removeEventListener("afterprint", afterPrint);
    if (typesetting.state === "done") URL.revokeObjectURL(typesetting.url);
    if (opener?.isConnected) opener.focus();
  });

  // Lays out lines' pages the first time they're wanted, and again for other paper.
  $effect(() => {
    const paper = prefs.paper;
    if (using !== "lines" || !measure || !pagesEl) return;
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

  let exportWhenReady = untrack(() => action === "print" || action === "export");

  async function layOut(paper: Paper) {
    if (!measure || !pagesEl) return;
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
    if (first && exportWhenReady) {
      exportWhenReady = false;
      exportPdf();
    }
    if (first && action === "png") pngMenu = true;
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
    if (exportWhenReady) {
      exportWhenReady = false;
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

  /**
   * Saves lines' pages as PNG images: the whole note as one tall image, or each page as one (in a
   * ZIP when there are several).
   */
  async function savePng(whole: boolean) {
    if (!doc || !measure || !pagesEl || imaging) return;
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
      exportPdf();
    }
  }

  const papers = [
    { id: "a4" as const, label: t("print.a4") },
    { id: "letter" as const, label: t("print.letter") },
  ];
  const typesetterOptions = [{ id: "lines", label: t("print.lines") }, ...typesetters.map(({ id, name }) => ({ id, label: name }))];

  const ready = $derived(using !== "lines" ? typesetting.state === "done" : laidOut && canPrint);

  const pngItem =
    "flex w-full cursor-default flex-col items-start gap-0.5 rounded-sm px-2.5 py-[7px] text-left outline-none select-none data-highlighted:bg-active";
</script>

{#snippet savedMessage(file: { path: string | null; filename: string })}
  {file.path ? t("print.savedTo", { path: file.path }) : t("print.downloaded", { filename: file.filename })}
  {#if file.path}
    <Button variant="quiet" onclick={() => void revealFile(file.path!)}>{isApple ? t("settings.showInFinder") : t("settings.showInFolder")}</Button>
  {/if}
{/snippet}

<Dialog.Root open onOpenChange={(open) => !open && onclose()}>
  <Dialog.Portal>
    <!-- Straight in the page, so printing can show the pages alone (the styles below, and print.css). -->
    <Dialog.Content
      onCloseAutoFocus={(event) => event.preventDefault()}
      {onkeydown}
      class="pdf-preview fixed inset-0 z-50 flex flex-col bg-sidebar text-fg outline-none print:static print:block print:bg-transparent"
    >
      <!-- A title row as tall as the window's, which the Mac app's traffic lights sit on (app.css). -->
      <header
        class="titlebar flex min-h-(--titlebar-h) flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-b border-line bg-panel pt-[max(8px,env(safe-area-inset-top))] pr-3 pb-2 pl-5 print:hidden"
        data-tauri-drag-region
      >
        <div class="flex min-w-0 items-baseline gap-2.5" data-tauri-drag-region>
          <Dialog.Title class="m-0 text-md font-[650] whitespace-nowrap">{t("print.title")}</Dialog.Title>
          <span class="truncate text-sm text-muted">{title}</span>
        </div>
        <div class="flex flex-wrap items-center gap-x-3.5 gap-y-2">
          {#if typesetters.length}
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted" aria-hidden="true">{t("print.typesetter")}</span>
              <Segmented label={t("print.typesetter")} options={typesetterOptions} value={using} onselect={(id) => (typesetter = prefs.typesetter = id)} />
            </div>
          {/if}
          {#if using === "lines"}
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted" aria-hidden="true">{t("print.paper")}</span>
              <Segmented label={t("print.paper")} options={papers} value={prefs.paper} onselect={(id) => (prefs.paper = id)} />
            </div>
            <DropdownMenu.Root bind:open={pngMenu}>
              <DropdownMenu.Trigger disabled={!laidOut || imaging}>
                {#snippet child({ props })}
                  <Button {...props} icon="image">{t("print.png")}</Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8} aria-label={t("print.png")} class="{floating} min-w-[220px] p-[5px]">
                  <DropdownMenu.Item class={pngItem} onSelect={() => void savePng(true)}>
                    <span class="text-sm font-[550]">{t("print.pngWhole")}</span>
                    <span class="text-xs text-muted">{t("print.pngWholeHint")}</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item class={pngItem} onSelect={() => void savePng(false)}>
                    <span class="text-sm font-[550]">{t("print.pngPages")}</span>
                    <span class="text-xs text-muted">{t("print.pngPagesHint", { count })}</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          {/if}
          {#if using === "lines" ? canPrint : true}
            <Button
              variant="primary"
              icon={using === "lines" ? "printer" : "download"}
              disabled={!ready}
              onclick={exportPdf}
              title={using === "lines" ? t("print.printHint") : undefined}
            >
              {using === "lines" ? t("print.print") : t("print.savePdf")}
            </Button>
          {/if}
          <IconButton icon="x" label={t("print.close")} onclick={onclose} />
        </div>
      </header>

      <div class="flex min-h-[34px] flex-wrap items-center gap-x-2 gap-y-1 px-5 py-1.5 text-xs text-muted print:hidden" role="status">
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
            {t("print.pages", { count })}{#if canPrint}<span class="text-faint"> · {t("print.printHint")}</span>{/if}
          {/if}
        {:else if typesetting.state === "downloading"}
          {t("print.downloading", { name: external!.name, percent: typesetting.percent })}
          {#if external?.download}<span class="text-faint">{external.download}</span>{/if}
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

      <div class="relative flex min-h-0 flex-1 flex-col overflow-auto overscroll-contain print:block print:overflow-visible" bind:this={scroller}>
        <!-- lines' pages, laid out by print/pages.ts; printed one to a sheet. -->
        <div
          class={[
            "pages flex-col items-center gap-5 px-4 pt-2 pb-10 print:block print:p-0 print:[zoom:1]!",
            using === "lines" ? "flex" : "hidden",
          ]}
          bind:this={pagesEl}
          style:zoom
        ></div>

        {#if external}
          {@const name = external.name}
          {#if typesetting.state === "done"}
            <!-- Reachable with Tab, to scroll it from the keyboard: the focus trap only counts what has a tabindex. -->
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <iframe class="min-h-0 w-full flex-1 border-0 bg-sidebar" tabindex="0" src={typesetting.url} title={t("print.pdfFrame", { title, name })}></iframe>
          {:else if typesetting.state === "downloading"}
            <div class="mx-auto my-12 w-full max-w-[560px] px-5">
              <progress class="w-full accent-accent" max="100" value={typesetting.percent} aria-label={t("print.downloading", { name, percent: typesetting.percent })}></progress>
            </div>
          {:else if typesetting.state === "missing"}
            <p class="mx-auto my-12 max-w-[560px] px-5 text-center text-base text-muted">{t("print.typesetterMissing", { name })}</p>
          {:else if typesetting.state === "failed"}
            <div class="mx-auto my-12 max-w-[560px] px-5 text-base text-fg">
              {#if typesetting.result.starting}
                <p>{t("print.typesetterOffline", { name })}</p>
              {:else}
                <p><strong>{typesetting.result.line ? t("print.typesetErrorAt", { name, line: typesetting.result.line }) : t("print.typesetError", { name })}</strong></p>
                <pre class="overflow-auto rounded-md bg-input px-3 py-2.5 font-mono text-xs whitespace-pre-wrap">{typesetting.result.error}</pre>
                <details>
                  <summary class="cursor-pointer text-sm text-muted">{t("print.log", { name })}</summary>
                  <pre class="max-h-[40vh] overflow-auto rounded-md bg-input px-3 py-2.5 font-mono text-xs whitespace-pre-wrap">{typesetting.result.log}</pre>
                </details>
              {/if}
              <Button variant="quiet" onclick={retry}>{t("print.retry")}</Button>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Where the document is laid out before it's cut into pages. -->
      <div class="print-measure print:hidden" bind:this={measure} aria-hidden="true"></div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  .pages > :global(.print-page) {
    box-shadow:
      0 0 0 1px rgb(0 0 0 / 0.08),
      0 2px 12px rgb(0 0 0 / 0.12);
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

    .pages > :global(.print-page) {
      box-shadow: none;
      break-after: page;
    }

    .pages > :global(.print-page:last-child) {
      break-after: auto;
    }
  }
</style>
