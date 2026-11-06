<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { prefs } from "../prefs.svelte";
  import Button from "./ui/Button.svelte";

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

<div class="flex h-full flex-col items-center justify-center gap-2 bg-surface text-faint" data-tauri-drag-region>
  <Icon name="lock" size={22} strokeWidth={1.75} />
  <p class="m-0 text-sm text-muted">{t("lock.screen.title")}</p>
  <Button variant="quiet" onclick={showMain}>{t("lock.floating.unlock")}</Button>
</div>
