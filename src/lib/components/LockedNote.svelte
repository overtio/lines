<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import Icon from "../icons/Icon.svelte";
  import { prefs } from "../prefs.svelte";

  /** A floating note while lines is locked: nothing of the note shows until the main window is unlocked. */

  const win = getCurrentWindow();
  document.title = "Locked";
  void win.setTitle("Locked");
  // Hidden until drawn, as floating notes are.
  void prefs.windowReady.then(() => win.show());

  async function showMain() {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const main = await WebviewWindow.getByLabel("main");
    await main?.unminimize();
    await main?.setFocus();
  }
</script>

<div class="locked" data-tauri-drag-region>
  <Icon name="lock" size={22} strokeWidth={1.75} />
  <p>lines is locked</p>
  <button type="button" class="text-button" onclick={showMain}>Unlock…</button>
</div>

<style>
  .locked {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    background: var(--surface);
    color: var(--text-faint);
  }

  p {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
  }
</style>
