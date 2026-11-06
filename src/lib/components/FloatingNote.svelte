<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import Editor from "../editor/Editor.svelte";
  import { t } from "../i18n/index.svelte";
  import { isClosed, notes } from "../notes/store.svelte";
  import LockedNoteView from "./LockedNoteView.svelte";
  import PicturePicker from "./PicturePicker.svelte";
  import { prefs } from "../prefs.svelte";
  import { announce } from "../windows/channel";
  import { saveFloatingState } from "../windows/floating";

  /** One note in its own small window, kept above everything else. */
  let { id }: { id: string } = $props();

  const win = getCurrentWindow();
  const entry = $derived(notes.get(id));
  const title = $derived(entry?.meta.title || t("list.untitled"));
  const closed = $derived(!!entry && isClosed(entry.note));

  // Let the main window know, so its float button shows this note as floating.
  $effect(() => {
    void announce({ type: "floating", id, open: true });
  });

  $effect(() => {
    document.title = title;
    void win.setTitle(title);
  });

  // Remember where it sits, and that it was closed on purpose (rather than by quitting).
  $effect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const remember = async () => {
      const factor = await win.scaleFactor();
      const position = (await win.outerPosition()).toLogical(factor);
      const size = (await win.innerSize()).toLogical(factor);
      saveFloatingState(id, { x: position.x, y: position.y, width: size.width, height: size.height });
    };
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(remember, 300);
    };
    const stops = [
      win.onMoved(soon),
      win.onResized(soon),
      win.onCloseRequested(async () => {
        saveFloatingState(id, { open: false });
        void announce({ type: "floating", id, open: false });
        // Finish saving before the window goes away.
        await notes.flush();
      }),
    ];
    return () => {
      clearTimeout(timer);
      for (const stop of stops) void stop.then((unlisten) => unlisten());
    };
  });

  // If the note is trashed or deleted (here or anywhere else), the window has nothing to show.
  $effect(() => {
    if (notes.ready && (!entry || entry.note.trashed)) {
      saveFloatingState(id, { open: false });
      void win.close();
    }
  });

  // The close/minimize/zoom buttons stay out of sight until the pointer nears their corner
  // (unless Settings says to always show them).
  const CORNER = { width: 96, height: 40 };
  let buttonsShown: boolean | null = null;
  let inCorner = false;

  function showButtons(visible: boolean) {
    if (visible === buttonsShown) return;
    buttonsShown = visible;
    void import("@tauri-apps/api/core").then(({ invoke }) => invoke("set_window_buttons", { visible }));
  }

  $effect(() => {
    showButtons(prefs.floatingButtons === "always");
  });

  function onpointermove(event: PointerEvent) {
    inCorner = event.clientX < CORNER.width && event.clientY < CORNER.height;
    if (prefs.floatingButtons === "hover") showButtons(inCorner);
  }

  // Leaving from the corner usually means onto the buttons themselves, which sit above the
  // page; they hide once the pointer is back on the note or the window loses focus.
  function onpointerleave() {
    if (prefs.floatingButtons === "hover" && !inCorner) showButtons(false);
  }

  function onblur() {
    if (prefs.floatingButtons === "hover") showButtons(false);
  }

  // ⌘W closes the floating note (Ctrl+W elsewhere).
  function onkeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "w") {
      event.preventDefault();
      void win.close();
    }
  }

  // Leave events don't reach the window, so this one is on the page itself.
  $effect(() => {
    const page = document.documentElement;
    page.addEventListener("pointerleave", onpointerleave);
    return () => page.removeEventListener("pointerleave", onpointerleave);
  });

  // Onto every desktop, and over full-screen apps if Settings says so (live as that changes).
  let followsDesktops: Promise<unknown> | undefined;
  $effect(() => {
    const overFullscreen = prefs.floatingOverFullscreen;
    const applied = import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke("set_follows_desktops", { overFullscreen }))
      .catch((error) => console.error("lines: couldn't make the note follow desktops", error));
    followsDesktops ??= applied;
  });

  // The window opens hidden, and shows once the note is drawn and the above is in place, so it
  // never flashes white. (Hidden windows get no animation frames, so this can't wait for one.)
  $effect(() => {
    if (!notes.ready) return;
    void Promise.all([followsDesktops, prefs.windowReady]).then(() => win.show());
  });
</script>

<svelte:window {onkeydown} {onpointermove} {onblur} />

<!-- The window's one landmark, so a screen reader can find the note in it. -->
<main class="floating">
  <header data-tauri-drag-region>
    <span class="spacer" data-tauri-drag-region></span>
  </header>

  {#if entry && !entry.note.trashed}
    <div class="editor-host" hidden={closed}>
      <Editor noteId={id} trashed={closed} />
    </div>
    {#if closed}
      <LockedNoteView {entry} compact />
    {/if}
  {/if}
</main>

<PicturePicker />

<style>
  .floating {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface);
    /* A compact editor: the window is the margin. */
    --editor-width: none;
    --editor-pad-x: 20px;
    --editor-pad-top: 4px;
  }

  header {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 36px;
    flex-shrink: 0;
    /* Room for the traffic lights. */
    padding: 0 6px 0 80px;
  }

  .spacer {
    flex: 1;
    align-self: stretch;
  }

  .editor-host {
    flex: 1;
    min-height: 0;
  }
</style>
