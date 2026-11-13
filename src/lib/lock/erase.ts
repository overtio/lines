import { FEEDS_DB } from "../feeds/storage";
import { isMacApp } from "../platform";

/**
 * For a forgotten passphrase: deletes everything the app lock protects on this device (notes,
 * attachments, feeds' posts, sync settings) and the lock itself, then starts over. Preferences
 * stay; the locked notes' password goes with the notes.
 */
export async function eraseThisDevice() {
  for (const name of ["lines", FEEDS_DB]) {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      // Another window still has it open; it goes once that one closes.
      request.onblocked = () => resolve();
    });
  }
  for (const key of ["lines.lock", "lines.sync", "lines.sync.leftovers", "lines.floating", "lines.lockedNotes"]) localStorage.removeItem(key);
  if (isMacApp) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("touch_id_forget").catch(() => {});
    await invoke("touch_id_forget", { which: "notes" }).catch(() => {});
  }
  location.reload();
}
