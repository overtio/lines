import { speak } from "../a11y";
import { t } from "../i18n/index.svelte";
import { ui } from "../ui.svelte";
import { notes } from "./store.svelte";

/*
 * What can be done to the notes picked in the list (⌘-click, ⇧-click, ⌘A) all at once: from their
 * menu, the bar above the list, or the keyboard. Screen readers hear what was done.
 */

const pickedIds = () => notes.pickedEntries.map((entry) => entry.note.id);

/** Pins them all, or unpins them if they all are. */
export function pinPicked() {
  const entries = notes.pickedEntries;
  const pin = entries.some((entry) => !entry.note.pinned);
  notes.setPinned(pickedIds(), pin);
  speak(t(pin ? "list.didPinMany" : "list.didUnpinMany", { count: entries.length }));
}

export function trashPicked() {
  const ids = pickedIds();
  notes.trashMany(ids);
  notes.clearPicks();
  speak(t("list.didTrashMany", { count: ids.length }));
}

export function restorePicked() {
  const ids = pickedIds();
  notes.restoreMany(ids);
  notes.clearPicks();
  speak(t("list.didRestoreMany", { count: ids.length }));
}

export function deletePicked() {
  const ids = pickedIds();
  void notes.deleteForeverMany(ids);
  notes.clearPicks();
  speak(t("list.didDeleteMany", { count: ids.length }));
}

/** Takes them all out of the Inbox (filed), or puts them in it if none is there. */
export function inboxPicked() {
  const entries = notes.pickedEntries;
  const file = entries.some((entry) => entry.note.inbox);
  notes.setInbox(pickedIds(), !file);
  speak(t(file ? "list.didFileMany" : "list.didInboxMany", { count: entries.length }));
}

/** Opens the box to add a tag to them, at a point (or under a button, with `align: "end"`). */
export function tagPicked(x: number, y: number, align?: "start" | "end") {
  ui.tagPrompt = { ids: pickedIds(), x, y, align };
}
