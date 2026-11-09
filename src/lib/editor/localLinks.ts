import { Decoration, WidgetType } from "@codemirror/view";
import { mount, unmount } from "svelte";
import { speak } from "../a11y";
import { t } from "../i18n/index.svelte";
import Icon from "../icons/Icon.svelte";
import { isFolder, isLocal, nameOf, pathOf } from "../notes/localLinks";
import { copyText, openPath } from "../platform";

/*
 * Links to folders and files on this computer in a note (notes/localLinks.ts), as livePreview.ts
 * and LaTeX's editor draw them: a folder's or a file's icon in front, the path shown on pointing at
 * them. Followed (links.ts), they open in Finder (a file in its app) in the desktop apps; a page
 * can't open them, so there their path is copied instead. Dropping a folder or /folder makes one
 * (attachments.ts).
 */

const icons = new WeakMap<HTMLElement, ReturnType<typeof mount>>();

class LocalLinkWidget extends WidgetType {
  constructor(readonly folder: boolean) {
    super();
  }
  eq(other: LocalLinkWidget) {
    return other.folder === this.folder;
  }
  toDOM() {
    const dom = document.createElement("span");
    dom.className = "cm-lp-local-icon";
    icons.set(dom, mount(Icon, { target: dom, props: { name: this.folder ? "folder" : "file-text", size: 14, strokeWidth: 2 } }));
    const spoken = document.createElement("span");
    spoken.className = "sr-only";
    spoken.textContent = t(this.folder ? "editor.localFolder" : "editor.localFile");
    dom.append(spoken);
    return dom;
  }
  destroy(dom: HTMLElement) {
    const icon = icons.get(dom);
    if (icon) void unmount(icon);
  }
  // A click puts the cursor here, which shows the link's address.
  ignoreEvent() {
    return false;
  }
}

const folderIcon = Decoration.widget({ widget: new LocalLinkWidget(true), side: -1 });
const fileIcon = Decoration.widget({ widget: new LocalLinkWidget(false), side: -1 });

/** The icon in front of a link's text, if it leads somewhere on this computer. */
export const localIcon = (href: string) => (isLocal(href) ? (isFolder(href) ? folderIcon : fileIcon) : null);

/** A link's attributes: where it leads, and for one to this computer, its path to show on pointing at it. */
export const linkAttributes = (href: string): Record<string, string> => (isLocal(href) ? { "data-href": href, title: pathOf(href) ?? href } : { "data-href": href });

/**
 * Opens a link to something on this computer: in the desktop apps, in Finder or its app, or says
 * it isn't there any more; elsewhere, copies its path, the link glowing to say so.
 */
export async function openLocal(href: string, element?: HTMLElement) {
  const path = pathOf(href);
  if (!path) return;
  const name = nameOf(path);
  const opened = await openPath(path);
  if (opened === "missing" || opened === "failed") {
    speak(t(opened === "missing" ? "editor.localMissing" : "editor.localFailed", { name }));
    element?.animate([{ backgroundColor: "color-mix(in srgb, var(--danger) 25%, transparent)", borderRadius: "3px" }, { backgroundColor: "transparent", borderRadius: "3px" }], { duration: 900, easing: "ease-out" });
  } else if (opened === "unavailable") {
    void copyText(path);
    speak(t("editor.localCopied", { name }));
    element?.animate([{ backgroundColor: "var(--selection)", borderRadius: "3px" }, { backgroundColor: "transparent", borderRadius: "3px" }], { duration: 800, easing: "ease-out" });
  }
}
