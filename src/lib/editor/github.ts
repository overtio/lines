import { WidgetType } from "@codemirror/view";
import { GITHUB_MARK } from "../release";

/*
 * Links to GitHub are drawn short, the way GitHub writes them: owner/repo, owner/repo#123,
 * owner/repo@1a2b3c4, with GitHub's mark in front. The note keeps the full URL; it shows again
 * while the cursor is on the link.
 */

/** The first part of github.com paths that are GitHub's own pages rather than a user or organization. */
const RESERVED = new Set([
  "about", "apps", "codespaces", "collections", "contact", "customer-stories", "dashboard", "enterprise",
  "explore", "features", "issues", "join", "login", "logout", "marketplace", "new", "notifications",
  "organizations", "orgs", "pricing", "pulls", "search", "security", "settings", "site", "sponsors",
  "stars", "team", "topics", "trending", "user-attachments", "users",
]);

/** How a GitHub URL reads in short, or null for anything else. */
export function githubText(href: string): string | null {
  let url: URL;
  try {
    url = new URL(/^www\./i.test(href) ? `https://${href}` : href);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || !/^(www\.)?github\.com$/i.test(url.hostname)) return null;
  let parts: string[];
  try {
    parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
  const [owner, name, section, ...rest] = parts;
  if (!owner || RESERVED.has(owner.toLowerCase())) return null;
  if (!name) return `@${owner}`;
  const repo = `${owner}/${name.replace(/\.git$/, "")}`;
  if (!section) return repo;
  const number = /^\d+$/.test(rest[0] ?? "") ? rest[0] : null;
  if ((section === "issues" || section === "pull" || section === "discussions") && number) {
    // A commit within a pull request reads as the commit.
    if (section === "pull" && rest[1] === "commits" && rest[2]) return `${repo}@${rest[2].slice(0, 7)}`;
    return `${repo}#${number}`;
  }
  if (section === "commit" && rest[0]) return `${repo}@${rest[0].slice(0, 7)}`;
  if (section === "releases" && rest[0] === "tag" && rest[1]) return `${repo}@${rest[1]}`;
  if (section === "compare" && rest[0]) return `${repo}@${rest.join("/")}`;
  if ((section === "blob" || section === "tree") && rest[0]) {
    if (rest.length === 1) return `${repo}@${rest[0]}`;
    // A file or folder by its name, with the lines picked out (#L10 or #L10-L20).
    const lines = /^#L(\d+)(?:-L(\d+))?$/.exec(url.hash);
    const at = lines ? `:${lines[1]}${lines[2] ? `-${lines[2]}` : ""}` : "";
    return `${repo} › ${rest[rest.length - 1]}${at}`;
  }
  return `${repo} › ${[section, ...rest].join("/")}`;
}


/**
 * A GitHub link drawn short, as a link like any other (⌘-click opens it). With `text` empty it's
 * only the mark, put in front of a link that has text of its own.
 */
export function githubLink(href: string, text: string) {
  const el = document.createElement("span");
  el.className = text ? "cm-lp-link cm-lp-github" : "cm-lp-link cm-lp-github-mark";
  el.dataset.href = href;
  el.title = href;
  el.innerHTML = GITHUB_MARK;
  if (text) el.append(text);
  return el;
}

export class GitHubWidget extends WidgetType {
  constructor(readonly href: string, readonly text: string) {
    super();
  }
  eq(other: GitHubWidget) {
    return other.href === this.href && other.text === this.text;
  }
  toDOM() {
    return githubLink(this.href, this.text);
  }
  // A click puts the cursor here, which shows the URL; ⌘-click opens it.
  ignoreEvent() {
    return false;
  }
}
