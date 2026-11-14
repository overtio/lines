import type { Exported, ExportedFile } from "../../lib/imports/exported";
import { baseOf, folderOf, normalized } from "../../lib/imports/markdown";
import { type Source, type SourceNote, Tally } from "../../lib/imports/notes";
import { computeMeta } from "../../lib/notes/parse";
import { nameOf } from "../../lib/notes/properties";
import { translate } from "./markdown";

/*
 * What Bear exported, read (docs/importing.md#bear): its backup (`.bear2bk`, a ZIP of a TextBundle
 * for each note: `text.markdown`, `info.json` with Bear's id, dates, pin and whether it's archived or
 * in the trash, and `assets/`), TextBundles or TextPacks, or Markdown files with their attachments
 * in folders beside them. Each note is titled by its first line, as in Bear and lines alike.
 */

/** What Bear keeps of a note in its TextBundle's info.json. */
interface BearInfo {
  uniqueIdentifier?: string;
  creationDate?: string | number;
  modificationDate?: string | number;
  pinned?: number | boolean;
  archived?: number | boolean;
  trashed?: number | boolean;
  encrypted?: number | boolean;
}

const lower = (path: string) => path.toLowerCase();
const TEXT = /(?:^|\/)text\.(?:markdown|md|txt)$/i;
const NOTE = /\.(?:md|markdown|txt)$/i;
/** Bear's own files in a backup, beside the notes. */
const BEARS = /(?:^|\/)(?:info|tags|backup)\.json$|(?:^|\/)\.DS_Store$/;

/** A date Bear wrote, as text or seconds. */
function dateOf(value: string | number | undefined) {
  const time = typeof value === "number" ? value * 1000 : value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : undefined;
}

/** A note as found, before it's translated: its text, where its links lead from, and what Bear knows of it. */
interface Found {
  id: string;
  name: string;
  text: string;
  /** The folder its links to files lead from: its TextBundle's, or its file's. */
  folder: string;
  bundled: boolean;
  info: BearInfo;
  file: ExportedFile;
}

export async function readBear({ name: exported, files }: Exported): Promise<Source> {
  const byPath = new Map(files.map((file) => [lower(file.path), file]));
  // A TextBundle is a folder with an info.json and the note's text.
  const bundles = new Set(files.filter((file) => TEXT.test(file.path) && byPath.has(lower(`${folderOf(file.path) ? `${folderOf(file.path)}/` : ""}info.json`))).map((file) => folderOf(file.path)));
  /** The TextBundle a file's in, if it's in one. */
  const bundleOf = (path: string) => {
    for (let folder = folderOf(path); ; folder = folderOf(folder)) {
      if (bundles.has(folder)) return folder;
      if (!folder) return null;
    }
  };
  const report = new Tally();
  const found: Found[] = [];
  for (const file of files) {
    const bundle = TEXT.test(file.path) && bundles.has(folderOf(file.path)) ? folderOf(file.path) : null;
    if (bundle === null && (!NOTE.test(file.path) || bundleOf(file.path) !== null)) continue;
    let info: BearInfo = {};
    if (bundle !== null) {
      try {
        info = JSON.parse((await byPath.get(lower(`${bundle ? `${bundle}/` : ""}info.json`))!.text()) || "{}")["net.shinyfrog.bear"] ?? {};
      } catch {
        // Not what Bear writes: a TextBundle from another app, as it is.
      }
    }
    const fallback = baseOf(bundle ?? file.path).replace(/\.(?:textbundle|md|markdown|txt)$/i, "");
    if (info.encrypted) {
      report.add("import.report.locked", fallback);
      continue;
    }
    const text = await file.text();
    found.push({
      id: info.uniqueIdentifier ?? bundle ?? file.path,
      name: computeMeta(text).title || fallback,
      text,
      folder: bundle ?? folderOf(file.path),
      bundled: bundle !== null,
      info,
      file,
    });
  }

  const byTitle = new Map<string, string>();
  for (const { name } of found) if (!byTitle.has(nameOf(name))) byTitle.set(nameOf(name), name);
  const byId = new Map(found.map(({ id, name }) => [id, name]));
  const attachments: ExportedFile[] = [];
  const shown = new Map<ExportedFile, number>();
  const notes: SourceNote[] = found.map(({ id, name, text, folder, bundled, info, file }) => {
    const body = translate(
      text,
      {
        report,
        note: (by) => ("id" in by ? byId.get(by.id) : byTitle.get(nameOf(by.title))) ?? null,
        file(path) {
          const target = byPath.get(lower(normalized(`${folder}/${path}`)));
          if (!target || TEXT.test(target.path) || NOTE.test(target.path)) return null;
          if (!shown.has(target)) shown.set(target, attachments.push(target) - 1);
          return { index: shown.get(target)!, name: baseOf(target.path) };
        },
      },
      name,
    );
    const archived = !!info.archived;
    if (archived) report.add("import.report.archived", name);
    return {
      id,
      name,
      body: `${body.trimEnd()}\n`,
      // Bear has tags rather than folders; Markdown exported into folders keeps them.
      folders: bundled || !folder ? [] : folder.split("/"),
      tags: archived ? ["archived"] : [],
      created: dateOf(info.creationDate) ?? file.modified,
      updated: dateOf(info.modificationDate) ?? file.modified,
      pinned: !!info.pinned,
      trashed: !!info.trashed,
    };
  });
  for (const file of files) {
    if (shown.has(file) || BEARS.test(file.path) || TEXT.test(file.path) || NOTE.test(file.path)) continue;
    report.add("import.report.unused", file.path);
  }
  // Bear's ids are its own everywhere; a Markdown export's notes have only their paths.
  return { name: exported, local: found.some(({ info }) => !info.uniqueIdentifier), notes, attachments, report };
}
