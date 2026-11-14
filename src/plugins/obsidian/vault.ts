import type { Exported, ExportedFile } from "../../lib/imports/exported";
import { baseOf, folderOf, normalized } from "../../lib/imports/markdown";
import { type Source, type SourceNote, Tally, withTitle } from "../../lib/imports/notes";
import { setProperties } from "../../lib/notes/properties";
import { type Target, translate } from "./markdown";

/*
 * An Obsidian vault, read (docs/importing.md#obsidian): a note for each Markdown file, in Linedown
 * (markdown.ts), its folders kept, the notes bookmarked (or starred) pinned, daily notes dated, and
 * those in the vault's own trash (`.trash`) in lines'. Links lead where Obsidian takes them: a path
 * in the vault, a path from the note's folder, or the shortest path ending in it, so a vault's
 * attachment folder is wherever its settings put it; never into the trash.
 */

const lower = (path: string) => path.toLowerCase();
const isNote = (path: string) => /\.md$/i.test(path);

/** Files by `key`. */
function grouped(files: ExportedFile[], key: (file: ExportedFile) => string) {
  const groups = new Map<string, ExportedFile[]>();
  for (const file of files) {
    const group = groups.get(key(file));
    if (group) group.push(file);
    else groups.set(key(file), [file]);
  }
  return groups;
}

/** The files bookmarked in Obsidian (`bookmarks.json`, or the older `starred.json`), in groups too. */
function bookmarked(json: string): string[] {
  const paths: string[] = [];
  const walk = (items: unknown) => {
    for (const item of Array.isArray(items) ? items : []) {
      if (item?.type === "file" && typeof item.path === "string") paths.push(item.path);
      if (item?.type === "group") walk(item.items);
    }
  };
  try {
    walk(JSON.parse(json)?.items);
  } catch {
    // Not what Obsidian writes: nothing's pinned.
  }
  return paths;
}

/**
 * Reads a daily note's day from its path in the daily notes' folder, as their format (Moment's,
 * `YYYY-MM-DD` by default) names them; null for a format with more than the year, month and day.
 */
function dailyFormat(format: string): RegExp | null {
  let pattern = "";
  for (const token of format.match(/YYYY|MM?|DD?|\[[^\]]*\]|[A-Za-z]+|[^A-Za-z[]+/g) ?? []) {
    if (token === "YYYY") pattern += "(?<year>\\d{4})";
    else if (token === "MM" || token === "M") pattern += "(?<month>\\d{1,2})";
    else if (token === "DD" || token === "D") pattern += "(?<day>\\d{1,2})";
    else if (token.startsWith("[")) pattern += token.slice(1, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (/[A-Za-z]/.test(token)) return null;
    else pattern += token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${pattern}$`);
}

const ISO_DAY = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/;

export async function readVault({ name: vault, files }: Exported): Promise<Source> {
  const config = new Map(files.filter((file) => file.path.startsWith(".obsidian/")).map((file) => [file.path.slice(".obsidian/".length), file]));
  const read = async (file: string) => (await config.get(file)?.text().catch(() => "")) ?? "";
  // The vault's own files, and those in its trash; not its settings, nor other hidden folders (.git).
  const inVault = files.filter((file) => !/(^|\/)\./.test(file.path.replace(/^\.trash\//, "")));
  // What links lead to: not what's in the trash, as in Obsidian.
  const linkable = inVault.filter((file) => !file.path.startsWith(".trash/"));
  const byPath = new Map(linkable.map((file) => [lower(file.path), file]));
  const byName = grouped(linkable, (file) => lower(baseOf(file.path)));

  const pinned = new Set([...bookmarked(await read("bookmarks.json")), ...bookmarked(await read("starred.json"))].map(lower));
  let daily: { folder: string; format: RegExp | null } = { folder: "", format: ISO_DAY };
  try {
    const settings = JSON.parse((await read("daily-notes.json")) || "{}");
    daily = { folder: normalized(settings.folder ?? ""), format: dailyFormat(settings.format || "YYYY-MM-DD") };
  } catch {
    // Obsidian's own defaults.
  }

  /** The file a link to `target` from the note at `from` leads to: by its path in the vault, from the note's folder, or the shortest path ending in it. */
  function find(target: string, from: string): ExportedFile | undefined {
    const path = normalized(target.trim());
    for (const wanted of [`${path}.md`, path]) {
      const exact = byPath.get(lower(wanted)) ?? byPath.get(lower(normalized(`${folderOf(from)}/${wanted}`)));
      if (exact) return exact;
      const ending = (byName.get(lower(baseOf(wanted))) ?? []).filter((file) => lower(`/${file.path}`).endsWith(lower(`/${wanted}`)));
      const near = ending.find((file) => folderOf(file.path) === folderOf(from)) ?? ending.sort((a, b) => a.path.length - b.path.length)[0];
      if (near) return near;
    }
  }

  const report = new Tally();
  const attachments: ExportedFile[] = [];
  const shown = new Map<ExportedFile, number>();
  const notes: SourceNote[] = [];
  const nameOf = (file: ExportedFile) => baseOf(file.path).replace(/\.md$/i, "");
  const vaultNotes = inVault.filter((file) => isNote(file.path));
  for (const file of vaultNotes) {
    const name = nameOf(file);
    const links = {
      report,
      resolve(target: string): Target | null {
        const found = find(target, file.path);
        if (!found) return null;
        if (isNote(found.path)) return { note: nameOf(found) };
        if (!shown.has(found)) shown.set(found, attachments.push(found) - 1);
        return { file: shown.get(found)!, name: baseOf(found.path) };
      },
    };
    const translated = translate(await file.text(), links, name);
    const trashed = file.path.startsWith(".trash/");
    const folder = folderOf(trashed ? file.path.slice(".trash/".length) : file.path);
    const relative = daily.folder ? (file.path.startsWith(`${daily.folder}/`) ? file.path.slice(daily.folder.length + 1) : null) : file.path;
    const day = (relative !== null && daily.format?.exec(relative.replace(/\.md$/i, ""))) || ISO_DAY.exec(name);
    let text = withTitle(name, translated.body, translated.front);
    if (day?.groups && !/^date[ \t]*:/m.test(translated.front)) {
      const { year, month, day: date } = day.groups;
      text = setProperties(text, { date: `${year}-${month.padStart(2, "0")}-${date.padStart(2, "0")}` });
    }
    notes.push({
      id: file.path,
      name,
      body: `${text.trimEnd()}\n`,
      folders: trashed || !folder ? [] : folder.split("/"),
      tags: translated.tags,
      created: translated.created ?? file.modified,
      updated: translated.updated ?? file.modified,
      pinned: pinned.has(lower(file.path)),
      trashed,
    });
  }
  for (const same of grouped(vaultNotes, (file) => lower(nameOf(file))).values()) for (const file of same.length > 1 ? same : []) report.add("import.report.sameName", file.path);
  for (const file of linkable) if (!isNote(file.path) && !shown.has(file)) report.add("import.report.unused", file.path);
  return { name: vault, local: true, notes, attachments, report };
}
