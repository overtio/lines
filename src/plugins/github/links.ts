/*
 * How links to GitHub read in short, the way GitHub writes them: owner/repo, owner/repo#123,
 * owner/repo@1a2b3c4.
 */

/** The first part of github.com paths that are GitHub's own pages rather than a user or organization. */
const RESERVED = new Set([
  "about", "apps", "codespaces", "collections", "contact", "customer-stories", "dashboard", "enterprise",
  "explore", "features", "issues", "join", "login", "logout", "marketplace", "new", "notifications",
  "organizations", "orgs", "pricing", "pulls", "search", "security", "settings", "site", "sponsors",
  "stars", "team", "topics", "trending", "user-attachments", "users",
]);

/** How a GitHub URL reads in short, or null for anything else. */
export function githubText(url: URL): string | null {
  if (!/^(www\.)?github\.com$/i.test(url.hostname)) return null;
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
