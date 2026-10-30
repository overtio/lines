import { WidgetType } from "@codemirror/view";

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

/** GitHub's mark (Octicons, MIT). */
const MARK =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>';

/**
 * A GitHub link drawn short, as a link like any other (⌘-click opens it). With `text` empty it's
 * only the mark, put in front of a link that has text of its own.
 */
export function githubLink(href: string, text: string) {
  const el = document.createElement("span");
  el.className = text ? "cm-lp-link cm-lp-github" : "cm-lp-link cm-lp-github-mark";
  el.dataset.href = href;
  el.title = href;
  el.innerHTML = MARK;
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
