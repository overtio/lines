<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { prefs } from "../prefs.svelte";

  /** A floating note while lines is locked: nothing of the note shows until the main window is unlocked. */

  const win = getCurrentWindow();
  document.title = t("lock.floating.title");
  void win.setTitle(t("lock.floating.title"));
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
  <p>{t("lock.screen.title")}</p>
  <button type="button" class="text-button" onclick={showMain}>{t("lock.floating.unlock")}</button>
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
