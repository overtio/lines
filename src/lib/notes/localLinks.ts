/*
 * Links to folders and files on this computer: a Markdown link to a file URL, as other apps write
 * them, `[Projects](file:///Users/me/Projects/)`, a folder's ending in `/`. Made by dropping a
 * folder from Finder into a note, or with /folder (editor/localLinks.ts), and opened in Finder (a
 * file in its own app).
 */

/** Whether `href` is a link to something on this computer. */
export const isLocal = (href: string) => /^file:\/\//i.test(href);

/** Whether `href` is a link to a folder on this computer. */
export const isFolder = (href: string) => isLocal(href) && href.endsWith("/");

/** The path a file URL links to (`/Users/me/My Projects`, `C:\Users\me` on Windows), or null if it isn't one. */
export function pathOf(href: string): string | null {
  if (!isLocal(href)) return null;
  let path: string;
  try {
    path = decodeURIComponent(href.replace(/^file:\/\/(localhost)?/i, ""));
  } catch {
    return null;
  }
  // A drive's letter: /C:/Users → C:\Users.
  if (/^\/[a-z]:\//i.test(path)) path = path.slice(1).replaceAll("/", "\\");
  const trimmed = path.length > 1 ? path.replace(/[\\/]+$/, "") : path;
  return trimmed || null;
}

/** A link to `path`, a folder's ending in `/`, its parts escaped as a URL needs (spaces, `#`, `%`, brackets). */
export function linkTo(path: string, folder: boolean) {
  const parts = path.replaceAll("\\", "/").replace(/\/+$/, "").split("/");
  // Brackets too, which would end the link's address in Markdown.
  const encode = (part: string) => encodeURIComponent(part).replace(/[()]/g, (bracket) => `%${bracket.charCodeAt(0).toString(16).toUpperCase()}`);
  const encoded = parts.map((part, i) => (i === 0 && /^[a-z]:$/i.test(part) ? part : encode(part))).join("/");
  // A Windows path starts with its drive, which a URL puts after a slash.
  const absolute = encoded.startsWith("/") ? encoded : `/${encoded}`;
  if (absolute === "/") return "file:///";
  return `file://${absolute}${folder ? "/" : ""}`;
}

/** What a folder or file is called: the last part of its path. */
export const nameOf = (path: string) => path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
