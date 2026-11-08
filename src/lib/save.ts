import { speak } from "./a11y";
import { t } from "./i18n/index.svelte";
import { isDesktopApp, revealFile, saveFile } from "./platform";

/**
 * Saves a file someone asked for (a note as a file, a 3D model to print): downloaded on the web,
 * into Downloads in the apps, and shown in Finder (or the file manager) on a computer, since nothing
 * else shows it happened. Screen readers are told where it went, or that it failed.
 */
export async function saveAndShow(filename: string, write: () => Promise<Uint8Array<ArrayBuffer>>, type: string) {
  try {
    const path = await saveFile(filename, await write(), type);
    speak(path ? t("print.savedTo", { path }) : t("print.downloaded", { filename }));
    if (path && isDesktopApp) await revealFile(path);
  } catch (error) {
    console.error("lines: couldn't save a file", error);
    speak(t("app.saveFailed", { filename }));
  }
}
