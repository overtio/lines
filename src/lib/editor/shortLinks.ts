import { WidgetType } from "@codemirror/view";
import { plugins } from "../plugins/registry.svelte";

/*
 * Links that read short, the way their site writes them, with the site's mark in front: GitHub's
 * owner/repo#12, arXiv's arXiv:1706.03762. Plugins say which (`links`); the note keeps the full
 * URL, which shows again while the cursor is on the link.
 */

/** A link as it reads in short, and the mark that goes in front. */
export interface ShortLink {
  text: string;
  mark: string;
}

/** How `href` reads in short, if a plugin reads it; null for anything else. */
export function shortLink(href: string): ShortLink | null {
  const sites = plugins.links;
  if (!sites.length) return null;
  let url: URL;
  try {
    url = new URL(/^www\./i.test(href) ? `https://${href}` : href);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  for (const site of sites) {
    const text = site.text(url);
    if (text) return { text, mark: site.mark };
  }
  return null;
}

/**
 * A link drawn short, as a link like any other (⌘-click opens it). With `text` empty it's only the
 * mark, put in front of a link that has text of its own.
 */
export function shortLinkElement(href: string, mark: string, text: string) {
  const el = document.createElement("span");
  el.className = text ? "cm-lp-link cm-lp-short-link" : "cm-lp-link cm-lp-short-link-mark";
  el.dataset.href = href;
  el.title = href;
  el.innerHTML = mark;
  if (text) el.append(text);
  return el;
}

export class ShortLinkWidget extends WidgetType {
  constructor(readonly href: string, readonly mark: string, readonly text: string) {
    super();
  }
  eq(other: ShortLinkWidget) {
    return other.href === this.href && other.mark === this.mark && other.text === this.text;
  }
  toDOM() {
    return shortLinkElement(this.href, this.mark, this.text);
  }
  // A click puts the cursor here, which shows the URL; ⌘-click opens it.
  ignoreEvent() {
    return false;
  }
}
