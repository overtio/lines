import type { Attachment } from "svelte/attachments";

/*
 * A pane's content is made once (App.svelte) and shown in its place in the layout (Panes.svelte),
 * so a note's editor, with its undo history, stays as the layout around it changes. Each is made in
 * a wrapper of its own that stays where it's made, out of sight (`data-pane-wrapper`), so Svelte
 * never finds one in a place when it adds or takes another away. Whichever of content and place is
 * there second brings the content into its place; the place gone, the content goes back into its
 * wrapper until it has a place again, or, if its wrapper's gone too, with it.
 */

const find = (attribute: string, pane: string) => document.querySelector<HTMLElement>(`[${attribute}="${CSS.escape(pane)}"]`);

/** On a pane's content, inside its wrapper: into its place, if that's there already; gone with its wrapper. */
export const paneContent =
  (pane: string): Attachment<HTMLElement> =>
  (content) => {
    content.dataset.paneContent = pane;
    const place = find("data-pane-place", pane);
    if (place && !place.contains(content)) place.append(content);
    return () => content.remove();
  };

/** On a pane's place in the layout: its content brought in, if that's there already, and each content in it sent back when the place goes. */
export const panePlace =
  (pane: string): Attachment<HTMLElement> =>
  (place) => {
    place.dataset.panePlace = pane;
    const content = find("data-pane-content", pane);
    if (content && !place.contains(content)) place.append(content);
    return () => {
      for (const shown of place.querySelectorAll<HTMLElement>(":scope > [data-pane-content]")) {
        const wrapper = find("data-pane-wrapper", shown.dataset.paneContent!);
        if (wrapper) wrapper.append(shown);
        else shown.remove();
      }
    };
  };
