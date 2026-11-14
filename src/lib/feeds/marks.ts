import { DAY, fingerprint, type KeptPost } from "./posts";

/*
 * What was done with feeds' posts, as every device has it: read or unread, dismissed (done with,
 * or not interesting) or restored. Synced as one file, `feeds.json`, beside the notes (docs/sync.md).
 * Each mark says when it was made, so two devices' merge mark by mark, the later winning, and each
 * device applies them to the posts it keeps. A mark is let go a month after it was made: by then
 * every device that syncs has applied it, and keeps its posts as they were left.
 */

export const MARKS_FILE = "feeds.json";

/** Why a post was dismissed: done with it, or not interesting (what a filter that learns would learn from). */
export type Dismissal = "done" | "uninteresting";

/** When each was last done to a post, in milliseconds: the latest of read and unread says which it is, as the latest of dismissing and restoring does. */
export interface Mark {
  read?: number;
  unread?: number;
  done?: number;
  uninteresting?: number;
  restored?: number;
}

export type MarkField = keyof Mark;
const FIELDS: MarkField[] = ["read", "unread", "done", "uninteresting", "restored"];

/** Each feed's marks, by its address, then each post's, by its key (`markKey`). */
export type Marks = Record<string, Record<string, Mark>>;

/** How long a mark is kept after it was made. */
export const MARK_LIFE = 30 * DAY;

/** The key a post's marks are under: a short fingerprint of its id, the same on every device that reads the feed, which says nothing of the post. */
export const markKey = (id: string) => fingerprint(id);

/** The latest of `fields` the mark has. */
function latest<F extends MarkField>(mark: Mark, fields: F[]): F | undefined {
  let found: F | undefined;
  for (const field of fields) {
    const at = mark[field];
    if (at !== undefined && (found === undefined || at > mark[found]!)) found = field;
  }
  return found;
}

/** What a post's marks make it: read or not (dismissing reads it), and dismissed, and why, or not; nothing where they don't say. */
export function stateOf(mark: Mark): { read?: boolean; dismissed?: Dismissal | null } {
  const reading = latest(mark, ["read", "unread", "done", "uninteresting"]);
  const dismissal = latest(mark, ["done", "uninteresting", "restored"]);
  return {
    ...(reading && { read: reading !== "unread" }),
    ...(dismissal && { dismissed: dismissal === "restored" ? null : dismissal }),
  };
}

/** A mark with `fields` done now: later than anything it has, so it wins over that wherever it's merged, whatever another device's clock said. */
export function marked(mark: Mark | undefined, fields: MarkField[], now = Date.now()): Mark {
  const at = Math.max(now, ...FIELDS.map((field) => (mark?.[field] ?? -1) + 1));
  return { ...mark, ...Object.fromEntries(fields.map((field) => [field, at])) };
}

/** When a mark was last made. */
const lastOf = (mark: Mark) => Math.max(...FIELDS.map((field) => mark[field] ?? 0));

/** Two devices' marks as one, field by field, the later winning. A feed whose marks here are unchanged is the same object, to tell which changed. */
export function mergeMarks(here: Marks, there: Marks): Marks {
  const merged = { ...here };
  for (const [feed, posts] of Object.entries(there)) {
    const own = here[feed] ?? {};
    let changed: Record<string, Mark> | undefined;
    for (const [key, mark] of Object.entries(posts)) {
      const mine = own[key];
      const later = FIELDS.filter((field) => {
        const at = mark[field];
        const before = mine?.[field];
        return at !== undefined && (before === undefined || at > before);
      });
      if (!later.length) continue;
      changed ??= { ...own };
      changed[key] = { ...mine, ...Object.fromEntries(later.map((field) => [field, mark[field]])) };
    }
    if (changed) merged[feed] = changed;
  }
  return merged;
}

/** The marks made in the last MARK_LIFE; a feed with none left has none. A feed whose marks are all kept is the same object. */
export function pruneMarks(marks: Marks, now = Date.now()): Marks {
  const pruned: Marks = {};
  for (const [feed, posts] of Object.entries(marks)) {
    const kept = Object.entries(posts).filter(([, mark]) => now - lastOf(mark) < MARK_LIFE);
    if (kept.length === Object.keys(posts).length) pruned[feed] = posts;
    else if (kept.length) pruned[feed] = Object.fromEntries(kept);
  }
  return pruned;
}

/** A post back in its list. */
export function withoutDismissal(post: KeptPost): KeptPost {
  const { dismissed: _, ...rest } = post;
  return rest;
}

/** A feed's posts as its marks make them; the same array if none changed. */
export function applyMarks(posts: KeptPost[], marks: Record<string, Mark> | undefined): KeptPost[] {
  if (!marks) return posts;
  let changed = false;
  const applied = posts.map((post) => {
    const mark = marks[markKey(post.id)];
    if (!mark) return post;
    const { read = post.read, dismissed = post.dismissed ?? null } = stateOf(mark);
    if (read === post.read && dismissed === (post.dismissed ?? null)) return post;
    changed = true;
    return { ...withoutDismissal(post), read, ...(dismissed && { dismissed }) };
  });
  return changed ? applied : posts;
}

/** The entries of `value` if it's an object, else none. */
const entries = (value: unknown): [string, unknown][] => (value && typeof value === "object" ? Object.entries(value) : []);

/** Marks as written (by `writeMarks`), or none if they can't be read; any that aren't times are left out. */
export function readMarks(text: string): Marks {
  try {
    const marks: Marks = {};
    for (const [feed, posts] of entries(JSON.parse(text)?.feeds)) {
      const own: Record<string, Mark> = {};
      for (const [key, mark] of entries(posts)) {
        const read: Mark = Object.fromEntries(entries(mark).filter(([field, at]) => FIELDS.includes(field as MarkField) && Number.isFinite(at)));
        if (Object.keys(read).length) own[key] = read;
      }
      if (Object.keys(own).length) marks[feed] = own;
    }
    return marks;
  } catch {
    return {};
  }
}

/** As a file: feeds and posts in order, so the same marks always read the same; on one line, as it can hold thousands. */
export function writeMarks(marks: Marks): string {
  const sorted = <T>(record: Record<string, T>) => Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));
  const feeds = Object.fromEntries(Object.keys(marks).sort().map((feed) => [feed, sorted(marks[feed])]));
  return JSON.stringify({ format: "lines-feeds", version: 1, feeds }) + "\n";
}
