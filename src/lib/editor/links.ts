import type { EditorView } from "@codemirror/view";
import { speak } from "../a11y";
import { t } from "../i18n/index.svelte";
import { attachmentName, openAttachment } from "../notes/attachments";
import { isLocal } from "../notes/localLinks";
import { coarsePointer, copyText, isApple, openExternal } from "../platform";
import { type LinkAction, prefs } from "../prefs.svelte";
import { tabs } from "../tabs.svelte";
import { windowLabel } from "../windows/channel";
import { canFloat, openFloating } from "../windows/floating";
import { openLocal } from "./localLinks";
import { openNote, openTag, openType } from "./objects";

/*
 * Following what a note links to: web pages, attached files and folders and files on this computer, tags, and mentions of notes. A
 * click, ⌘-click (Ctrl-click) and ⌘⇧-click on each do what Settings → Editor → Links says. A tap
 * while not typing opens, whatever a click is set to, as a touch screen has no other way; ⌥↵
 * opens what the cursor is on (openAtCursor in livePreview.ts).
 */

type Link =
  | { kind: "web"; element: HTMLElement; href: string; text: string }
  | { kind: "tag"; element: HTMLElement; tag: string }
  | { kind: "mention"; element: HTMLElement; note?: string; type?: string };

function linkAt(target: HTMLElement): Link | null {
  const mention = target.closest<HTMLElement>(".cm-lp-mention");
  if (mention?.dataset.note || mention?.dataset.type) return { kind: "mention", element: mention, note: mention.dataset.note, type: mention.dataset.type };
  const tag = target.closest<HTMLElement>(".cm-lp-tag");
  if (tag?.dataset.tag) return { kind: "tag", element: tag, tag: tag.dataset.tag };
  const web = target.closest<HTMLElement>(".cm-lp-link");
  if (web?.dataset.href) return { kind: "web", element: web, href: web.dataset.href, text: web.textContent ?? "" };
  return null;
}

/** The link under a mousedown and what this click on it does, unless that's only to put the cursor there. */
function clicked(event: MouseEvent, view: EditorView): { link: Link; action: LinkAction } | null {
  if (event.button !== 0) return null;
  const link = linkAt(event.target as HTMLElement);
  if (!link) return null;
  const modified = isApple ? event.metaKey : event.ctrlKey;
  // ⇧-click alone extends the selection, as on any text.
  let action: LinkAction = modified ? prefs.links[link.kind][event.shiftKey ? "modShiftClick" : "modClick"] : event.shiftKey ? "edit" : prefs.links[link.kind].click;
  if (action === "edit" && coarsePointer.matches && !view.hasFocus) action = "open";
  return action === "edit" ? null : { link, action };
}

/** Whether a mousedown follows the link under it, rather than putting the cursor there. */
export const followsLink = (event: MouseEvent, view: EditorView) => !!clicked(event, view);

/** Follows the link under a mousedown, if this click on it does; then the cursor stays where it was. */
export function followClick(event: MouseEvent, view: EditorView): boolean {
  const found = clicked(event, view);
  if (!found) return false;
  follow(found.link, found.action);
  event.preventDefault();
  return true;
}

/** Opens a link's address: an attached file in its app, a folder or file on this computer in Finder or its app, anything else in the browser. */
export function openHref(href: string, text: string, element?: HTMLElement) {
  if (isLocal(href)) return void openLocal(href, element);
  const name = attachmentName(href);
  void (name ? openAttachment(name, text || name) : openExternal(href));
}

function follow(link: Link, action: LinkAction) {
  if (link.kind === "web") {
    if (action === "copy") copyAddress(link.href, link.element);
    else openHref(link.href, link.text, link.element);
  } else if (link.kind === "tag") openTag(link.tag);
  else if (link.note) openNoteAs(link.note, action);
  else if (link.type) openType(link.type);
}

/** Opens a mentioned note as chosen: here, in a tab (the main window's, while tabs are on), or floating. */
function openNoteAs(id: string, action: LinkAction) {
  if (action === "window" && canFloat) return void openFloating(id);
  const inMain = !windowLabel().startsWith("note-");
  if ((action === "newTab" || action === "backgroundTab") && inMain && tabs.shown) return tabs.open(id, action === "newTab");
  openNote(id);
}

/**
 * Copies a link's address, which glows a moment to say so: an animation rather than a class, as
 * CodeMirror draws again anything in the note whose attributes change.
 */
function copyAddress(href: string, element: HTMLElement) {
  void copyText(href);
  speak(t("editor.copied"));
  const glow = getComputedStyle(element).getPropertyValue("--selection");
  element.animate([{ backgroundColor: glow, borderRadius: "3px" }, { backgroundColor: "transparent", borderRadius: "3px" }], { duration: 800, easing: "ease-out" });
}
