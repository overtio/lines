import { zip, type ZipEntry } from "../zip";
import { ATTACHMENT_PATH, getAttachment, referencedAttachments } from "./attachments";
import { isClosed, type Entry } from "./store.svelte";

/** A title made safe as a file name on every system: "Trip: Rome/Paris?" → "Trip - Rome-Paris". */
function fileName(title: string) {
  const safe = title
    .replace(/[\\/]+/g, "-")
    .replace(/\s*:\s*/g, " - ")
    .replace(/[*?"<>|\u0000-\u001f]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[.\s-]+|[.\s-]+$/g, "")
    .slice(0, 100)
    .trim();
  return safe || "Untitled";
}

/**
 * Every note as its own Markdown file, exactly as written, in a .zip. Files are named after
 * their titles (with a number when two match) and keep the note's last-edited time.
 * Trashed notes, if included, go in a Trash folder. The images and files they attach go in an attachments
 * folder, and the links to them in notes outside Trash are changed to point there.
 *
 * Locked notes go in only while they're open, as plain Markdown like the rest.
 */
export async function exportNotes(entries: Entry[], includeTrash: boolean) {
  const taken = new Set<string>();
  const included = entries.filter((e) => includeTrash || !e.note.trashed);
  const locked = included.filter((e) => isClosed(e.note)).length;
  const files = included
    .filter((e) => !isClosed(e.note))
    // Oldest first, so when titles repeat the original keeps the plain name.
    .sort((a, b) => a.note.createdAt - b.note.createdAt)
    .map(({ note, meta }) => {
      const folder = note.trashed ? "Trash/" : "";
      const base = fileName(meta.title);
      let name = `${folder}${base}.md`;
      for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${folder}${base} ${n}.md`;
      taken.add(name.toLowerCase());
      const body = note.trashed ? note.body : note.body.replaceAll(`](${ATTACHMENT_PATH}`, "](attachments/");
      return { name, data: body, modified: new Date(note.updatedAt), source: note.body };
    });
  const attachments: ZipEntry[] = [];
  for (const name of referencedAttachments(files.map((file) => file.source))) {
    const data = await getAttachment(name);
    if (data) attachments.push({ name: `attachments/${name}`, data: new Uint8Array(await data.arrayBuffer()), modified: new Date() });
  }
  const now = new Date();
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
  return { filename: `lines-notes-${date}.zip`, data: zip([...files, ...attachments]), count: files.length, locked };
}
