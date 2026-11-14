import type { Discussion, DiscussionComment } from "../plugins/types";

/*
 * A discussion as the reader shows it (Discussion.svelte): every comment in the order it's read,
 * each knowing what it answers, how deep it is, how many replies are under it, whether it's folded
 * and whether the keyboard is on it; and which comment the keys go to from another, past those
 * folded away.
 */

export class ThreadComment {
  folded = $state(false);
  /** The keyboard's on it: Tab comes back to it, and the arrow keys go from it. */
  current = $state(false);
  replies: ThreadComment[] = [];
  /** Where the replies under it end in the thread's order. */
  end = 0;

  constructor(
    readonly comment: DiscussionComment,
    readonly parent: ThreadComment | null,
    readonly depth: number,
    readonly index: number,
  ) {}

  /** How many replies are under it, at every depth. */
  get size() {
    return this.end - this.index - 1;
  }
}

export class Thread {
  /** Every comment, each before its replies. */
  readonly all: ThreadComment[] = [];
  /** The first comments, which aren't replies. */
  readonly top: ThreadComment[];

  constructor(readonly discussion: Discussion) {
    this.top = discussion.comments.map((comment) => this.#add(comment, null, 0));
  }

  #add(comment: DiscussionComment, parent: ThreadComment | null, depth: number): ThreadComment {
    const entry = new ThreadComment(comment, parent, depth, this.all.length);
    this.all.push(entry);
    entry.replies = comment.replies.map((reply) => this.#add(reply, entry, depth + 1));
    entry.end = this.all.length;
    return entry;
  }

  /** The comment shown for one: itself, or the outermost one folded around it. */
  shown(entry: ThreadComment): ThreadComment {
    let shown = entry;
    for (let up = entry.parent; up; up = up.parent) if (up.folded) shown = up;
    return shown;
  }

  /** The comment shown after one: its first reply, or the next after its replies. */
  next(entry: ThreadComment): ThreadComment | undefined {
    return this.all[!entry.folded && entry.replies.length ? entry.index + 1 : entry.end];
  }

  /** The comment shown before one. */
  previous(entry: ThreadComment): ThreadComment | undefined {
    const before = this.all[entry.index - 1];
    return before && this.shown(before);
  }

  /** The last comment shown. */
  last(): ThreadComment | undefined {
    const last = this.all.at(-1);
    return last && this.shown(last);
  }
}
