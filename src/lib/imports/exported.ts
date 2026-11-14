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

/** The files of each ZIP chosen, by their paths in it. */
async function unzipped(zip: File): Promise<ExportedFile[]> {
  const entries = zipEntries(new Uint8Array(await zip.arrayBuffer()));
  return [...entries]
    .filter(([path]) => !path.startsWith("__MACOSX/"))
    .map(([path, entry]) => ({
      path,
      size: entry.size,
      modified: entry.modified,
      text: async () => textOf(await entry.read()),
      file: async () => typed(new Blob([await entry.read()]), path),
    }));
}

/**
 * The export in the files chosen: a folder's (from a picker of folders, each file knowing its path
 * in it), or one or more ZIPs, unpacked. A top folder they all share is the export's name, and
 * taken off their paths.
 */
export async function exportedFrom(chosen: File[]): Promise<Exported> {
  const files: ExportedFile[] = [];
  for (const file of chosen) {
    if (/\.zip$/i.test(file.name)) files.push(...(await unzipped(file)));
    else {
      const path = file.webkitRelativePath || file.name;
      files.push({ path, size: file.size, modified: file.lastModified || undefined, text: async () => textOf(new Uint8Array(await file.arrayBuffer())), file: async () => typed(file, path) });
    }
  }
  const top = files[0]?.path.split("/")[0];
  const shared = top && files.every((file) => file.path.startsWith(`${top}/`));
  const zip = chosen.length === 1 && /\.zip$/i.test(chosen[0].name) ? chosen[0].name.replace(/\.zip$/i, "") : "";
  return {
    name: shared ? top : zip || (chosen[0]?.name ?? ""),
    files: shared ? files.map((file) => ({ ...file, path: file.path.slice(top.length + 1) })) : files,
  };
}
