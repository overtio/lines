import { speak } from "../a11y";
import { t } from "../i18n/index.svelte";
import { setProperties, typeLabel } from "./properties";
import { isClosed, notes } from "./store.svelte";

/*
 * A note dragged from the list onto a row of the sidebar (panes.svelte.ts follows the drag): onto a
 * tag, it's tagged; onto a type, it's one of that type; onto the Inbox or the Trash, it goes there.
 * The rows say what they are as `data-note-drop`: `tag:work/meetings`, `type:person`, `place:inbox`,
 * `place:trash`.
 */

/** Whether the note can be dropped there: what it'd do it hasn't done already, and can do (a locked note's text, or properties outside Markdown, can't be changed). */
export function canDrop(target: string, id: string): boolean {
  const entry = notes.get(id);
  if (!entry) return false;
  const { note, meta } = entry;
  const [kind, name] = [target.slice(0, target.indexOf(":")), target.slice(target.indexOf(":") + 1)];
  if (kind === "place") return name === "inbox" ? !note.inbox && !note.trashed : !note.trashed;
  if (isClosed(note) || note.trashed) return false;
  if (kind === "tag") return !meta.tags.includes(name);
  return kind === "type" && !note.format && meta.type !== name;
}

/** Does what dropping the note there does, and says so. */
export function dropNote(target: string, id: string) {
  const entry = notes.get(id);
  if (!entry || !canDrop(target, id)) return;
  const name = target.slice(target.indexOf(":") + 1);
  if (target.startsWith("tag:")) {
    speak(t("list.tagged", { count: notes.addTag([id], name), tag: name }));
  } else if (target.startsWith("type:")) {
    notes.edit(id, setProperties(entry.note.body, { type: name }));
    speak(t("list.didType", { type: typeLabel(name) }));
  } else if (name === "inbox") {
    notes.setInbox([id], true);
    speak(t("list.didInbox"));
  } else {
    notes.trash(id);
    speak(t("list.didTrash"));
  }
}
