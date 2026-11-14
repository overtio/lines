import { deleteMarkupBackward, insertNewlineContinueMarkupCommand } from "@codemirror/lang-markdown";
import { keymap } from "@codemirror/view";

/**
 * Markdown's Enter, CodeMirror's: it continues a list or a quote, and on an empty item ends the list
 * (a nested one moves out a level), its second item too (rather than putting a blank line before it).
 */
export const continueMarkup = insertNewlineContinueMarkupCommand({ nonTightLists: false });

/** Markdown's Enter and Backspace. */
export const markdownKeymap = keymap.of([
  { key: "Enter", run: continueMarkup },
  { key: "Backspace", run: deleteMarkupBackward },
]);
