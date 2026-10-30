/** The note list and its rows: search, swipe actions, the note menu, tags in the sidebar's tree, dates. */
export default {
  // A note with nothing written yet, as the list (and its window, and its exported file) names it.
  "list.untitled": "Untitled",
  "list.showSidebar": "Show sidebar",
  "list.newNote": "New note",
  // {key} is the keyboard shortcut, like ⌘N.
  "list.newNoteWithKey": "New note ({key})",
  // In the search field until something's typed.
  "list.search": "Search",
  "list.searchLabel": "Search notes",
  "list.clearSearch": "Clear search",
  // Said by screen readers while searching.
  "list.results": "{count, plural, =0 {No results} one {# result} other {# results}}",
  "list.trashHint": "Notes in the Trash can be restored.",
  "list.emptyTrash": "Empty Trash",
  "list.trashEmptied": "Trash emptied",
  "list.noMatches": "No notes match “{query}”.",
  "list.trashIsEmpty": "Trash is empty.",
  "list.noNotes": "No notes yet.",
  // Under a row as it's swiped aside: short, about 10 characters fit.
  "list.swipeRestore": "Restore",
  "list.swipePin": "Pin",
  "list.swipeUnpin": "Unpin",
  "list.swipeDelete": "Delete",
  "list.swipeTrash": "Trash",
  // A note's menu (right-click or long press).
  "list.restore": "Restore",
  "list.pin": "Pin to Top",
  "list.unpin": "Unpin",
  "list.deleteForever": "Delete Forever",
  "list.trash": "Move to Trash",
  "list.float": "Open in Floating Window",
  "list.unfloat": "Close Floating Window",
  "list.addIcon": "Add Icon…",
  "list.changeIcon": "Change Icon…",
  "list.lock": "Lock Note",
  "list.lockNow": "Lock Now",
  "list.removeLock": "Remove Lock",
  "list.copyText": "Copy Text",
  // What a row says about its note besides the title and date.
  "list.pinned": "Pinned",
  "list.lockedNote": "Locked note",
  "list.lockedNoteOpen": "Locked note, open",
  // Said by screen readers after acting on a note.
  "list.didUnpin": "Unpinned",
  "list.didTrash": "Moved to Trash",
  "list.didRestore": "Restored",
  "list.didDelete": "Deleted forever",
  "list.copied": "Copied",
  // Several notes picked in the list (⌘-click, ⇧-click, ⌘A), and acting on them together.
  "list.pickedCount": "{count, plural, one {# note selected} other {# notes selected}}",
  // Said after a row's title by screen readers, when it's among the notes picked.
  "list.picked": "Selected",
  // The menu of the picked notes: its name.
  "list.pickedMenu": "{count, plural, one {# note} other {# notes}}",
  "list.addTag": "Add Tag…",
  "list.clearPicks": "Clear selection",
  "list.pickedActions": "Selected notes",
  "list.didTrashMany": "{count, plural, one {# note moved to the Trash} other {# notes moved to the Trash}}",
  "list.didRestoreMany": "{count, plural, one {# note restored} other {# notes restored}}",
  "list.didDeleteMany": "{count, plural, one {# note deleted forever} other {# notes deleted forever}}",
  "list.didPinMany": "{count, plural, one {# note pinned} other {# notes pinned}}",
  "list.didUnpinMany": "{count, plural, one {# note unpinned} other {# notes unpinned}}",
  // Adding a tag to the picked notes: a small box with the tag's name.
  "list.tagFor": "{count, plural, one {Add a tag to # note} other {Add a tag to # notes}}",
  "list.tagAdd": "Add",
  "list.tagged": "{count, plural, =0 {They all have #{tag} already} one {Added #{tag} to # note} other {Added #{tag} to # notes}}",
  "list.taggedLocked": "Locked notes keep their tags.",
  // A tag being renamed in the sidebar.
  "list.tagName": "Tag name",
  // The button that shows or hides the tags nested in {tag}.
  "list.nestedTags": "Tags in {tag}",
  // An export's file name, without .zip; {date} is like 2026-10-29.
  "list.exportName": "lines-notes-{date}",
  // The folder trashed notes go in, in an export.
  "list.trashFolder": "Trash",
};
