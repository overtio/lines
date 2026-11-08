<script lang="ts">
  import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
  import { Dialog } from "bits-ui";
  import { onDestroy, onMount, tick } from "svelte";
  import { on } from "svelte/events";
  import { MediaQuery } from "svelte/reactivity";
  import Icon from "../icons/Icon.svelte";
  import { speak } from "../a11y";
  import { locale, t } from "../i18n/index.svelte";
  import { formatKeys, speakKeys, system } from "../shortcuts";
  import Button from "./ui/Button.svelte";

  /*
   * Excalidraw, full-window, on a drawing (editor/drawings.ts), or on a copy of a Mermaid diagram.
   * It's a React component: React and Excalidraw load the first time a drawing is opened. Save, at
   * the canvas's top right, saves what's drawn as an SVG with its scene inside; leaving any other
   * way, with something changed, asks first.
   */

  let {
    scene,
    mermaid = null,
    onsave,
    onclose,
  }: {
    scene: Blob | null;
    /** Mermaid code to start from, turned into shapes. */
    mermaid?: string | null;
    onsave: (svg: Blob) => Promise<void>;
    onclose: () => void;
  } = $props();

  type Excalidraw = typeof import("@excalidraw/excalidraw");

  let content = $state<HTMLElement | null>(null);
  let host: HTMLElement;
  /** Save and Cancel: over the canvas, then in Excalidraw's top right once it's shown. */
  let actions = $state<HTMLElement>()!;
  /** The place Excalidraw keeps at its top right, while it's shown. */
  let slot = $state.raw<HTMLElement | null>(null);
  /** Excalidraw's phone layout, whose top row is its tools. */
  let phone = $state(false);
  /** Too narrow for Excalidraw's toolbar with Save and Cancel beside it. */
  const narrow = new MediaQuery("max-width: 819px");
  /** Save and Cancel in a row above the canvas instead. */
  const compact = $derived(phone || narrow.current);

  $effect(() => {
    if (!actions || !content) return;
    if (slot && !compact) slot.append(actions);
    else if (actions.parentElement !== content) content.prepend(actions);
  });
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let status = $state<"loading" | "ready" | "failed" | "saving">("loading");
  let error = $state("");
  let confirming = $state(false);
  let lib: Excalidraw | null = null;
  let api: ExcalidrawImperativeAPI | null = null;
  let unmountReact: (() => void) | null = null;
  /** The scene's version when it opened, and whether it has changed since. */
  let start: number | null = null;
  let changed = false;

  /** ⌘S (Ctrl+S): Excalidraw keeps ⌘↩ for editing a line's points. */
  const SAVE_KEYS = "Mod-s";
  const dark = document.documentElement.dataset.scheme === "dark";
  /** Excalidraw's names for the app's languages. */
  const LANGUAGES: Record<string, string> = { es: "es-ES", fr: "fr-FR" };
  /** A drawing with no background of its own, which shows the note's (or Excalidraw's white before). */
  const CLEAR = new Set(["transparent", "#ffffff"]);

  /**
   * The theme's accent, for what Excalidraw draws on its canvas (the selection), which it can't
   * read from CSS as it's drawn. In dark themes the canvas is drawn through Excalidraw's filter,
   * invert(93%) hue-rotate(180deg), so this is the color that comes out as the accent through it.
   */
  function selectionColor() {
    const probe = document.createElement("span");
    probe.style.color = "var(--accent)";
    host.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
    if (numbers.length < 3) return "";
    // rgb() is 0–255; color(srgb …), from a mixed accent, is 0–1.
    const rgb = numbers.slice(0, 3).map((n) => (value.startsWith("color(") ? n : n / 255));
    if (!dark) return `rgb(${rgb.map((c) => Math.round(c * 255)).join(", ")})`;
    // hue-rotate(180deg) is its own inverse; invert(93%) is c → 0.93 − 0.86c.
    const [r, g, b] = rgb;
    const rotated = [
      -0.574 * r + 1.43 * g + 0.144 * b,
      0.426 * r + 0.43 * g + 0.144 * b,
      0.426 * r + 1.43 * g - 0.856 * b,
    ];
    const before = rotated.map((c) => Math.round(Math.min(1, Math.max(0, (0.93 - c) / 0.86)) * 255));
    return `rgb(${before.join(", ")})`;
  }

  /*
   * Excalidraw puts its own dialogs (Clear canvas, say) straight in the page, outside this one, so
   * this one doesn't hold focus in or close on a press outside it; the app behind is made inert
   * instead, as it is behind any dialog.
   */
  const app = document.getElementById("app");

  onMount(() => {
    if (app) app.inert = true;
    void load();
  });

  onDestroy(() => {
    unmountReact?.();
    actions?.remove();
    if (app) app.inert = false;
    if (opener?.isConnected) opener.focus();
  });

  async function load() {
    try {
      // Its fonts are served with the app (vite.config.ts), not from its CDN.
      window.EXCALIDRAW_ASSET_PATH = new URL(`${import.meta.env.BASE_URL}excalidraw/`, location.href).href;
      const [react, client, excalidraw] = await Promise.all([
        import("react"),
        import("react-dom/client"),
        import("@excalidraw/excalidraw"),
        import("@excalidraw/excalidraw/index.css"),
      ]);
      lib = excalidraw;
      const initialData = scene ? await excalidraw.loadFromBlob(scene, null, null) : mermaid ? await fromMermaid(excalidraw, mermaid) : null;
      // Drawn on the note's own background, as it's shown in the note, unless it has one of its own.
      const background = initialData?.appState.viewBackgroundColor?.toLowerCase();
      const viewBackgroundColor = !background || CLEAR.has(background) ? "transparent" : background;
      host.style.setProperty("--drawing-selection", selectionColor());
      const root = client.createRoot(host);
      unmountReact = () => root.unmount();
      const { MainMenu } = excalidraw;
      // Its menu without its links (GitHub, X, Discord) or help: find, clear, and the canvas's color.
      const menu = react.createElement(
        MainMenu,
        null,
        react.createElement(MainMenu.DefaultItems.SearchMenu),
        react.createElement(MainMenu.DefaultItems.ClearCanvas),
        react.createElement(MainMenu.Separator),
        react.createElement(MainMenu.DefaultItems.ChangeCanvasBackground),
      );
      root.render(
        react.createElement(
          excalidraw.Excalidraw,
          {
            initialData: {
              ...initialData,
              appState: { ...initialData?.appState, viewBackgroundColor },
              scrollToContent: !!initialData,
            },
            excalidrawAPI: (value) => (api = value),
            theme: dark ? "dark" : "light",
            langCode: LANGUAGES[locale.split("-")[0]] ?? "en",
            autoFocus: true,
            // Saving, opening and exporting files are lines' to do, and the theme is the app's.
            // Pictures go in the note rather than in a drawing.
            UIOptions: {
              canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false, toggleTheme: null },
              tools: { image: false },
            },
            // Save and Cancel go where Excalidraw keeps room for them.
            renderTopRightUI: (isMobile) => {
              phone = isMobile;
              return isMobile ? null : react.createElement("div", { className: "lines-drawing-actions", ref: place });
            },
            onChange: (elements) => {
              const version = excalidraw.getSceneVersion(elements);
              start ??= version;
              changed = version !== start;
            },
          },
          menu,
        ),
      );
      status = "ready";
    } catch (cause) {
      console.error("lines: couldn't load Excalidraw", cause);
      status = "failed";
      error =
        cause instanceof DiagramError
          ? t("editor.drawing.mermaidFailed", { error: cause.message })
          : t("editor.drawing.loadFailed");
      speak(error);
    }
  }

  /** Excalidraw's top right, shown or taken away (with Save and Cancel, if they're in it). */
  function place(element: HTMLElement | null) {
    slot = element;
  }

  /** Mermaid code that couldn't be read, with where and why. */
  class DiagramError extends Error {}

  /**
   * A Mermaid diagram as Excalidraw shapes: flowcharts as boxes and arrows to move and restyle,
   * sequence and class diagrams more simply, and other kinds as a picture of the diagram.
   */
  async function fromMermaid(excalidraw: Excalidraw, source: string) {
    const { parseMermaidToExcalidraw } = await import("@excalidraw/mermaid-to-excalidraw");
    let parsed: Awaited<ReturnType<typeof parseMermaidToExcalidraw>>;
    try {
      parsed = await parseMermaidToExcalidraw(source, { themeVariables: { fontSize: "20px" } });
    } catch (cause) {
      // Where the error is, without Mermaid's list of every token it would have accepted.
      throw new DiagramError(String(cause instanceof Error ? cause.message : cause).split("\n")[0]);
    }
    const { elements, files } = parsed;
    return {
      elements: excalidraw.convertToExcalidrawElements(elements, { regenerateIds: true }),
      files: files ?? {},
      appState: { viewBackgroundColor: "transparent" },
    };
  }

  /** Saves the drawing into the note and closes; a blank or unchanged one just closes. */
  async function save() {
    if (status !== "ready" || !api || !lib) return leave();
    const elements = api.getSceneElements();
    if (!elements.length || (scene && !changed)) return leave();
    status = "saving";
    try {
      const appState = api.getAppState();
      const svg = await lib.exportToSvg({
        elements,
        files: api.getFiles(),
        appState: {
          ...appState,
          // Clear behind it, so it sits on the note in any theme, unless a background was chosen.
          exportBackground: !CLEAR.has(appState.viewBackgroundColor.toLowerCase()),
          exportEmbedScene: true,
          exportWithDarkMode: false,
          // Its own size: it's drawn sharp at any size anyway.
          exportScale: 1,
        },
        exportPadding: 16,
      });
      await onsave(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
      leave();
    } catch (cause) {
      console.error("lines: couldn't save the drawing", cause);
      status = "ready";
      error = t("editor.drawing.saveFailed");
      speak(error);
    }
  }

  const leave = () => onclose();

  /** Cancel, or Escape outside the canvas: closes, after asking if anything changed. */
  function cancel() {
    if (!changed) return leave();
    confirming = true;
    speak(t("editor.drawing.discardQuestion"));
  }

  async function keepEditing() {
    confirming = false;
    await tick();
    host.querySelector<HTMLElement>(".excalidraw-container, canvas")?.focus();
  }

  function onkeydowncapture(event: KeyboardEvent) {
    // ⌘S (Ctrl+S) is Save, wherever the focus is.
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      event.stopPropagation();
      void save();
      return;
    }
    if (event.key !== "Escape") return;
    // Escape in the canvas is Excalidraw's (to stop editing text, or deselect), not a way out.
    const target = event.target as Node;
    if (host.contains(target) && !actions.contains(target)) return;
    event.preventDefault();
    cancel();
  }

  /** Excalidraw's single-key tools aren't the app's shortcuts too. */
  const onkeydown = (event: KeyboardEvent) => event.stopPropagation();

  /** An island like Excalidraw's undo and redo: flat, with its ring in the canvas's color. */
  const island = "pointer-events-auto flex items-center rounded-md bg-panel [box-shadow:0_0_0_1px_var(--color-surface-lowest,var(--bg))]";
  const tool = "grid size-9 place-items-center rounded-md transition-colors enabled:hover:bg-hover disabled:opacity-45";
</script>

<Dialog.Root open>
  <Dialog.Portal>
    <Dialog.Content
      bind:ref={content}
      trapFocus={false}
      preventScroll={false}
      interactOutsideBehavior="ignore"
      escapeKeydownBehavior="ignore"
      onCloseAutoFocus={(event) => event.preventDefault()}
      {onkeydowncapture}
      class="drawing-editor fixed inset-0 z-50 flex flex-col bg-bg text-fg outline-none {compact ? 'compact' : ''}"
    >
      <Dialog.Title class="sr-only">{t("editor.drawing.title")}</Dialog.Title>
      <Dialog.Description class="sr-only">{t("editor.drawing.hint", { keys: formatKeys(SAVE_KEYS, system) })}</Dialog.Description>
      <!-- Its keys are its own, not Excalidraw's, though it's shown inside Excalidraw: heard on the
           element itself, as Excalidraw's are, rather than delegated to the app's root. Over the
           canvas until Excalidraw is shown, then in its top right; on a phone, a row above it. -->
      <div
        class={compact
          ? "actions-row relative border-b border-line bg-panel px-2.5 pt-[max(6px,env(safe-area-inset-top))] pb-1.5"
          : slot
            ? "relative"
            : "absolute top-[max(16px,env(safe-area-inset-top))] right-4 z-1"}
        bind:this={actions}
        {@attach (node) => on(node, "keydown", onkeydown)}
      >
        <div class={compact ? "pointer-events-auto flex items-center justify-between" : island}>
          <button class={[tool, "text-muted enabled:hover:text-fg"]} onclick={cancel} title={t("editor.drawing.cancel")} aria-label={t("editor.drawing.cancel")}>
            <Icon name="x" size={18} />
          </button>
          <button
            class={[tool, "text-accent"]}
            onclick={save}
            disabled={status === "loading" || status === "saving"}
            title={`${t("editor.drawing.save")} (${formatKeys(SAVE_KEYS, system)})`}
            aria-label={t("editor.drawing.save")}
            aria-keyshortcuts={speakKeys(SAVE_KEYS, system)}
          >
            <Icon name="check" size={18} />
          </button>
        </div>
        {#if confirming}
          <!-- Below Save and Cancel, so Excalidraw's top bar keeps its size; set off from the drawing it's over. -->
          <div
            class={[
              island,
              "absolute top-[calc(100%+8px)] w-max max-w-[min(340px,calc(100vw-32px))] flex-wrap justify-end gap-1 rounded-xl p-2.5 [box-shadow:var(--card-shadow),0_0_0_1px_var(--card-border)]",
              compact ? "right-2.5" : "right-0",
            ]}
            role="group"
            aria-labelledby="drawing-editor-question"
          >
            <span class="basis-full px-1 pb-1.5 text-sm font-[550]" id="drawing-editor-question">{t("editor.drawing.discardQuestion")}</span>
            <Button variant="danger" onclick={leave}>{t("editor.drawing.discard")}</Button>
            <Button variant="primary" onclick={keepEditing} {@attach (button) => button.focus()}>{t("editor.drawing.keepEditing")}</Button>
          </div>
        {/if}
      </div>

      {#if status === "loading" || error}
        <div class="px-5 py-2.5 text-sm text-muted" role="status">
          {status === "loading" ? t("editor.drawing.loading") : error}
        </div>
      {/if}
      <div class="canvas relative min-h-0 flex-1" bind:this={host}></div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  /*
   * Excalidraw in the app's theme rather than its own purple and greys: its toolbars, menus and
   * dialogs take the theme's surfaces, text, borders, accent and font. Its own dark colors are on
   * .excalidraw.theme--dark, which this outranks, and the theme's tokens already change with it.
   * What's drawn keeps its colors, as the note shows them. Its dialogs are outside the canvas, in
   * the page.
   */
  .canvas :global(.excalidraw),
  :global(body > .excalidraw.excalidraw-modal-container) {
    --ui-font: var(--font-ui);
    --color-primary: var(--accent);
    --color-primary-darker: color-mix(in srgb, var(--accent) 88%, var(--ink));
    --color-primary-darkest: color-mix(in srgb, var(--accent) 76%, var(--ink));
    --color-primary-hover: var(--color-primary-darker);
    --color-primary-light: color-mix(in srgb, var(--accent) 16%, var(--bg-elevated));
    --color-primary-light-darker: color-mix(in srgb, var(--accent) 24%, var(--bg-elevated));
    --color-brand-hover: var(--color-primary-darker);
    --color-brand-active: var(--color-primary-darkest);
    --color-surface-primary-container: color-mix(in srgb, var(--accent) 18%, var(--bg-elevated));
    --color-on-primary-container: color-mix(in srgb, var(--accent) 55%, var(--text));
    --color-selection: var(--drawing-selection, var(--accent));
    --color-surface-lowest: var(--bg);
    --color-surface-low: color-mix(in srgb, var(--ink) 3%, var(--bg-elevated));
    --color-surface-mid: color-mix(in srgb, var(--ink) 5%, var(--bg-elevated));
    --color-surface-high: color-mix(in srgb, var(--ink) 8%, var(--bg-elevated));
    --color-on-surface: var(--text);
    --text-primary-color: var(--text);
    --island-bg-color: var(--bg-elevated);
    --sidebar-bg-color: var(--bg-elevated);
    --popup-bg-color: var(--bg-elevated);
    --popup-secondary-bg-color: var(--color-surface-mid);
    --popup-text-color: var(--text);
    --default-bg-color: var(--bg);
    --input-bg-color: var(--bg);
    --input-border-color: var(--border);
    --input-hover-bg-color: var(--color-surface-low);
    --input-label-color: var(--text-muted);
    --default-border-color: var(--border);
    --dialog-border-color: var(--border);
    --sidebar-border-color: var(--border);
    --keybinding-color: var(--text-faint);
    --link-color: var(--accent);
    --focus-highlight-color: var(--accent-soft);
    --select-highlight-color: var(--accent);
    --scrollbar-thumb: var(--scrollbar);
    --scrollbar-thumb-hover: color-mix(in srgb, var(--ink) 30%, transparent);
    --color-slider-track: color-mix(in srgb, var(--accent) 30%, var(--bg-elevated));
    --color-slider-thumb: var(--text);
    --overlay-bg-color: color-mix(in srgb, var(--bg) 85%, transparent);
    --shadow-island: var(--card-shadow), 0 0 0 1px var(--card-border);
  }

  /*
   * Its help button and its library of shapes (whose browser is excalidraw.com's) aren't part of
   * lines; Excalidraw has no option to leave them out.
   */
  .canvas :global(.excalidraw .help-icon),
  .canvas :global(.excalidraw .default-sidebar-trigger) {
    display: none;
  }

  /*
   * In the Mac app the window's traffic lights are over the top left corner, so what's there starts
   * past them, where the app's own title bars do (app.css): Excalidraw's menu, or Cancel in the row
   * above the canvas in a narrow window.
   */
  :global(:root[data-platform="mac-app"] .drawing-editor:not(.compact)) .canvas :global(.excalidraw .App-menu_top__left) {
    margin-left: 76px;
  }

  :global(:root[data-platform="mac-app"]) .actions-row {
    padding-left: 92px;
  }
</style>
