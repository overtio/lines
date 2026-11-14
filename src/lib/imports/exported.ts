import { attachmentType } from "../notes/attachments";
import { zipEntries } from "../zip";

/*
 * What another app exported, as chosen to import: a folder (an Obsidian vault), or a ZIP of one.
 * Its files are read only when asked for, so a vault of thousands of pictures is quick to look
 * through, and its text is only ever read as text.
 */

/** A file of an export: where it is in it, and what it holds, read when asked. */
export interface ExportedFile {
  /** Its path from the export's top, with `/`: `Projects/Plan.md`. */
  path: string;
  size: number;
  /** When it was last changed (ms), where the export says. */
  modified?: number;
  /** Its text, as UTF-8, with Unix line endings. */
  text(): Promise<string>;
  /** Itself, named and typed by its extension, to keep as an attachment. */
  file(): Promise<File>;
}

export interface Exported {
  /** What the export is called: the folder's name, or the ZIP's. */
  name: string;
  files: ExportedFile[];
}

const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** A file's text as a note's is kept: without a byte order mark, and with Unix line endings. */
export const textOf = (bytes: Uint8Array) => new TextDecoder().decode(bytes).replace(/^﻿/, "").replace(/\r\n?/g, "\n");

const typed = (blob: Blob, path: string) => new File([blob], nameOf(path), { type: attachmentType(path) });

/** ZIPs, by the names apps give theirs too: Bear's backups (.bear2bk), TextPacks. */
const ZIP = /\.(?:zip|bear2bk|textpack)$/i;

/**
 * The files of a ZIP, by their paths in it. A ZIP of nothing but ZIPs (Notion splits a large export
 * so) is the files of those, unpacked in turn.
 */
async function unzipped(data: Uint8Array<ArrayBuffer>): Promise<ExportedFile[]> {
  const entries = [...zipEntries(data)].filter(([path]) => !path.startsWith("__MACOSX/"));
  if (entries.length && entries.every(([path]) => /\.zip$/i.test(path))) {
    return (await Promise.all(entries.map(async ([, entry]) => unzipped(await entry.read())))).flat();
  }
  return entries.map(([path, entry]) => ({
    path,
    size: entry.size,
    modified: entry.modified,
    text: async () => textOf(await entry.read()),
    file: async () => typed(new Blob([await entry.read()]), path),
  }));
}

/** Files with the folder they all share, if they do, as their name and taken off their paths; or `name`. */
function rooted(name: string, files: ExportedFile[]): Exported {
  const top = files[0]?.path.split("/")[0];
  const shared = !!top && files.every((file) => file.path.startsWith(`${top}/`));
  return shared ? { name: top, files: files.map((file) => ({ ...file, path: file.path.slice(top.length + 1) })) } : { name, files };
}

/**
 * The export in the files chosen: a folder's (from a picker of folders, each file knowing its path
 * in it), or a ZIP, unpacked; a folder they all share is its name. Of several ZIPs, each is a folder
 * of the export named after it.
 */
export async function exportedFrom(chosen: File[]): Promise<Exported> {
  const zips = chosen.filter((file) => ZIP.test(file.name));
  const loose = chosen.filter((file) => !ZIP.test(file.name));
  const parts = await Promise.all(zips.map(async (zip) => rooted(zip.name.replace(ZIP, ""), await unzipped(new Uint8Array(await zip.arrayBuffer())))));
  if (loose.length) {
    const files = loose.map((file): ExportedFile => {
      const path = file.webkitRelativePath || file.name;
      return { path, size: file.size, modified: file.lastModified || undefined, text: async () => textOf(new Uint8Array(await file.arrayBuffer())), file: async () => typed(file, path) };
    });
    parts.push(rooted(loose[0].name, files));
  }
  if (parts.length === 1) return parts[0];
  return { name: parts[0]?.name ?? "", files: parts.flatMap((part) => part.files.map((file) => ({ ...file, path: `${part.name}/${file.path}` }))) };
}
