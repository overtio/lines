import { DAY, fingerprint, type KeptPost } from "./posts";

/*
 * What was done with feeds' posts, as every device has it: read or unread, dismissed (done with,
 * or not interesting) or restored, and Dismiss All. Synced as a small file for each feed in a
 * folder beside the notes, `feeds/` (docs/sync.md), so a mark sends only its feed's file. Each mark
 * says when it was made, so two devices' merge field by field, the later winning, and each device
 * applies them to the posts it keeps.
 *
 * A mark is kept while its post is in its feed, so a device new to it (or whose storage was
 * cleared) shows a post dismissed long ago as dismissed. It's let go once its post has been gone
 * from the feed for a while, as fetched (`listed`, the latest any device saw it there), which
 * devices fetching the same feed agree on. Dismiss All is a watermark, rather than a mark a post.
 */

/** The folder beside the notes the marks are in, a file for each feed (`shardOf`). */
export const MARKS_DIR = "feeds/";

/** Why a post was dismissed: done with it, or not interesting (what a filter that learns would learn from). */
export type Dismissal = "done" | "uninteresting";

/** When each was last done to a post, in milliseconds: the latest of read and unread says which it is, as the latest of dismissing and restoring does. */
export interface Mark {
  read?: number;
  unread?: number;
  done?: number;
  uninteresting?: number;
  restored?: number;
  /** When a fetch last had its post in the feed, by any device's account (said again a week at a time): while it's recent, the mark's needed. */
  listed?: number;
}

export type MarkField = Exclude<keyof Mark, "listed">;
const FIELDS: MarkField[] = ["read", "unread", "done", "uninteresting", "restored"];
const ALL: (keyof Mark)[] = [...FIELDS, "listed"];

/** Dismiss All: every post published before `before` is dismissed as of `at`, but one marked since. */
export interface Cleared {
  before: number;
  at: number;
}

/** What was done with one feed's posts: each one's marks, by its key (`markKey`), and Dismiss All's. */
export interface FeedMarks {
  posts: Record<string, Mark>;
  cleared?: Cleared;
}

/** Each feed's marks, by its address. */
export type Marks = Record<string, FeedMarks>;

/** How long a mark is kept once its post is no longer in its feed. */
export const GONE_FOR = 14 * DAY;
/** How old a mark's `listed` gets before a fetch that has its post says so again, so a fetch doesn't rewrite every mark. */
export const LISTED_EVERY = 7 * DAY;
/**
 * Dismiss All's watermark is this long before it: posts published since are marked one by one, as
 * an aggregator's (Hacker News') can be listed a while after they're published.
 */
export const CLEAR_MARGIN = 3 * DAY;

/**
 * The key a post's marks are under: a short fingerprint of its id, the same on every device that
 * reads the feed. It hides nothing: a post's id is usually its public link or guid, so with
 * encryption off, anyone who can read the synced folder can tell which posts were read and dismissed.
 */
export const markKey = (id: string) => fingerprint(id);

/** The file a feed's marks are synced in, in MARKS_DIR: named by a fingerprint of its address, so feeds that share one share the file. */
export const shardOf = (feed: string) => `${fingerprint(feed)}.json`;

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

/** A post's marks with its feed's Dismiss All counted in, if it was published before its watermark. */
export function withCleared(mark: Mark | undefined, date: number | undefined, cleared: Cleared | undefined): Mark | undefined {
  if (!cleared || date === undefined || date >= cleared.before) return mark;
  return { ...mark, done: Math.max(mark?.done ?? 0, cleared.at) };
}

/** When anything was last marked in a feed: what a mark made after is later than, whatever this device's clock says. */
export function latestOf(marks: FeedMarks | undefined): number {
  let at = marks?.cleared?.at ?? 0;
  for (const mark of Object.values(marks?.posts ?? {})) for (const field of FIELDS) at = Math.max(at, mark[field] ?? 0);
  return at;
}

/** A mark with `fields` done now: later than anything marked in its feed (`floor`, `latestOf`), so it wins wherever it's merged, whatever another device's clock said. */
export function marked(mark: Mark | undefined, fields: MarkField[], floor: number, now = Date.now()): Mark {
  const at = Math.max(now, floor + 1);
  return { ...mark, ...Object.fromEntries(fields.map((field) => [field, at])), listed: Math.max(mark?.listed ?? 0, now) };
}

/** When a mark was last made, or its post last listed. */
const lastOf = (mark: Mark) => Math.max(...ALL.map((field) => mark[field] ?? 0));

/** The later of two Dismiss Alls. */
const laterCleared = (here: Cleared | undefined, there: Cleared | undefined) =>
  !there || (here && (here.at > there.at || (here.at === there.at && here.before >= there.before))) ? here : there;

/**
 * Two devices' marks of a feed as one: each post's field by field, the later winning (and the
 * latest it was listed); and the later Dismiss All. The same object as `here` if nothing's new to it.
 */
export function mergeFeed(here: FeedMarks | undefined, there: FeedMarks): FeedMarks {
  const own = here?.posts ?? {};
  let posts: Record<string, Mark> | undefined;
  for (const [key, mark] of Object.entries(there.posts)) {
    const mine = own[key];
    const later = ALL.filter((field) => {
      const at = mark[field];
      const before = mine?.[field];
      return at !== undefined && (before === undefined || at > before);
    });
    if (!later.length) continue;
    posts ??= { ...own };
    posts[key] = { ...mine, ...Object.fromEntries(later.map((field) => [field, mark[field]])) };
  }
  const cleared = laterCleared(here?.cleared, there.cleared);
  if (here && !posts && cleared === here.cleared) return here;
  return { posts: posts ?? own, ...(cleared && { cleared }) };
}

/**
 * A feed's marks without those no longer needed: whose post wasn't in the feed as this device last
 * fetched it (`listing`, by key, at `fetchedAt`), nor, by any device's account, in the GONE_FOR
 * before. Those in the listing are said to be listed then, if they hadn't been for LISTED_EVERY.
 * The same object if nothing changed.
 */
export function tidyFeed(marks: FeedMarks, listing: Set<string>, fetchedAt: number): FeedMarks {
  let changed = false;
  const posts: Record<string, Mark> = {};
  for (const [key, mark] of Object.entries(marks.posts)) {
    if (listing.has(key)) {
      const stale = (mark.listed ?? 0) < fetchedAt - LISTED_EVERY;
      posts[key] = stale ? { ...mark, listed: fetchedAt } : mark;
      changed ||= stale;
    } else if (lastOf(mark) >= fetchedAt - GONE_FOR) posts[key] = mark;
    else changed = true;
  }
  return changed ? { posts, ...(marks.cleared && { cleared: marks.cleared }) } : marks;
}

/** A post back in its list. */
export function withoutDismissal(post: KeptPost): KeptPost {
  const { dismissed: _, ...rest } = post;
  return rest;
}

/** A feed's posts as its marks make them; the same array if none changed. */
export function applyMarks(posts: KeptPost[], marks: FeedMarks | undefined): KeptPost[] {
  if (!marks) return posts;
  let changed = false;
  const applied = posts.map((post) => {
    const mark = withCleared(marks.posts[markKey(post.id)], post.date, marks.cleared);
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

/** What a file's object says of a feed's marks, but what isn't a time. */
function readFeed(value: unknown): FeedMarks {
  const posts: Record<string, Mark> = {};
  for (const [key, mark] of entries((value as { posts?: unknown })?.posts)) {
    const read: Mark = Object.fromEntries(entries(mark).filter(([field, at]) => ALL.includes(field as keyof Mark) && Number.isFinite(at)));
    if (Object.keys(read).length) posts[key] = read;
  }
  const { before, at } = ((value as { cleared?: Partial<Cleared> })?.cleared ?? {}) as Partial<Cleared>;
  return { posts, ...(Number.isFinite(before) && Number.isFinite(at) && { cleared: { before: before!, at: at! } }) };
}

/** A file of marks as written (`writeShard`): its feeds' (normally one), or none if it can't be read. */
export function readShard(text: string): Marks {
  try {
    return Object.fromEntries(entries(JSON.parse(text)?.feeds).map(([feed, value]) => [feed, readFeed(value)]));
  } catch {
    return {};
  }
}

/** As a file: feeds and posts in order, so the same marks always read the same; on one line, short. */
export function writeShard(marks: Marks): string {
  const sorted = <T>(record: Record<string, T>) => Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));
  const feeds = Object.fromEntries(
    Object.keys(marks)
      .sort()
      .map((feed) => [feed, { ...(marks[feed].cleared && { cleared: marks[feed].cleared }), posts: sorted(marks[feed].posts) }]),
  );
  return JSON.stringify({ format: "lines-feed-marks", version: 1, feeds }) + "\n";
}
