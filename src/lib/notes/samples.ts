import { ATTACHMENT_PATH, saveAttachment } from "./attachments";
import type { Note } from "./types";

/*
 * Sets of notes lines can add: the feature tour (the demo website starts with it), example notes
 * written in LaTeX, and the QA notes a tester goes through before a release (qa/README.md). Each is Markdown files (and .tex files,
 * for notes written in LaTeX), loaded only when they're added. `attachment:<file>` links in them point at files in ./samples/, which are
 * saved as attachments as the notes are added.
 */

export type SampleSet = "tour" | "examples" | "qa";

type Files = Record<string, () => Promise<string>>;

const SETS: Record<SampleSet, Files> = {
  tour: import.meta.glob<string>("./tour/*.{md,tex}", { query: "?raw", import: "default" }),
  examples: import.meta.glob<string>("./examples/*.{md,tex}", { query: "?raw", import: "default" }),
  qa: import.meta.glob<string>(["/qa/checklist.md", "/qa/notes/*.{md,tex}"], { query: "?raw", import: "default" }),
};

const ASSETS = import.meta.glob<string>("./samples/*", { query: "?url", import: "default" });

export const sampleCount = (set: SampleSet) => Object.keys(SETS[set]).length;

/** Saves the sample file `name` as an attachment, and returns the link to it. */
async function attach(name: string, saved: Map<string, string>) {
  if (!saved.has(name)) {
    const url = await ASSETS[`./samples/${name}`]?.();
    if (!url) return `attachment:${name}`;
    const blob = await (await fetch(url)).blob();
    saved.set(name, ATTACHMENT_PATH + (await saveAttachment(new File([blob], name, { type: blob.type }))));
  }
  return saved.get(name)!;
}

/** The notes of a set, newest first in the order of their files, ready to add. */
export async function sampleNotes(set: SampleSet): Promise<Note[]> {
  const files = SETS[set];
  // The checklist first, then the notes in the order their names give.
  const paths = Object.keys(files).sort((a, b) => Number(b.endsWith("checklist.md")) - Number(a.endsWith("checklist.md")) || a.localeCompare(b));
  const saved = new Map<string, string>();
  const now = Date.now();
  return Promise.all(
    paths.map(async (path, i) => {
      let body = await files[path]();
      for (const [, name] of [...body.matchAll(/\]\(attachment:([^)\s]+)\)/g)]) {
        body = body.replaceAll(`](attachment:${name})`, `](${await attach(name, saved)})`);
      }
      // A second apart, so the list keeps the files' order.
      const time = now - i * 1000;
      const note: Note = { id: crypto.randomUUID(), body, createdAt: time, updatedAt: time, pinned: false, trashed: false };
      return path.endsWith(".tex") ? { ...note, format: "latex" as const } : note;
    }),
  );
}
