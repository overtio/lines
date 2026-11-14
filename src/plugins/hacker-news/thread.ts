import { htmlToText } from "../../lib/feeds/text";
import { getJson, LookupError } from "../../lib/library/web";
import { withTimeout } from "../../lib/pacing";
import type { Discussion, DiscussionComment, TextBlock } from "../../lib/plugins/types";

/*
 * A story's discussion on Hacker News, from two of its APIs at once, each sent only the story's id:
 * Algolia's copy of the whole thread, in one answer, and the official API's story itself
 * (Firebase's), for the order Hacker News ranks its first comments in and how many it counts.
 * Algolia has replies oldest first, and leaves out comments deleted or taken down with every reply
 * under them; the count says how many that is. Asking the official API for every comment instead,
 * one request each, takes 30 seconds and more for a big thread. What either answers is checked
 * before it's used: a comment that isn't one is left out.
 */

/** How long the official API is waited for: the thread reads without what it adds. */
const RANKING_WAIT = 2000;

/** Comment text's links are to Hacker News' own pages where they're relative (`item?id=…`). */
const BASE = "https://news.ycombinator.com/";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Hacker News' quotes are paragraphs that start with `>`, which it shows as they're written. */
const quoted = (blocks: TextBlock[]): TextBlock[] =>
  blocks.map((block) => {
    const [first, ...rest] = block.spans;
    if (block.kind !== "paragraph" || !first?.text.startsWith(">")) return block;
    return { kind: "quote", spans: [{ ...first, text: first.text.replace(/^>\s*/, "") }, ...rest] };
  });

/** A comment as Algolia keeps it, and the replies to it; null for anything that isn't one. */
function comment(item: unknown): DiscussionComment | null {
  if (!isRecord(item) || item.type !== "comment" || (typeof item.id !== "number" && typeof item.id !== "string")) return null;
  const time = Number(item.created_at_i) * 1000;
  return {
    id: String(item.id),
    author: typeof item.author === "string" ? item.author : "",
    time: Number.isFinite(time) ? time : undefined,
    text: typeof item.text === "string" ? quoted(htmlToText(item.text, BASE)) : [],
    replies: repliesOf(item),
  };
}

const repliesOf = (item: Record<string, unknown>) =>
  Array.isArray(item.children) ? item.children.map(comment).filter((reply): reply is DiscussionComment => reply !== null) : [];

/**
 * A story's thread from Algolia's answer, its first comments in the order the official API's story
 * ranks them, where that came, and how many comments Hacker News counts. Rejects anything but a
 * story's (a comment's, say): its author isn't who posted the story.
 */
export function readThread(item: unknown, story?: unknown): Discussion {
  if (!isRecord(item) || (item.type !== "story" && item.type !== "poll")) throw new LookupError("Not a story's comments");
  const comments = repliesOf(item);
  const kids = isRecord(story) && Array.isArray(story.kids) ? story.kids : [];
  const rank = new Map(kids.map((id, index) => [String(id), index]));
  // Those it doesn't rank (none, if it didn't answer) after those it does, in their own order.
  const place = (each: DiscussionComment) => rank.get(each.id) ?? rank.size;
  comments.sort((a, b) => place(a) - place(b));
  return { author: typeof item.author === "string" ? item.author : undefined, count: countOf(story), comments };
}

const countOf = (story: unknown) => (isRecord(story) && typeof story.descendants === "number" ? story.descendants : undefined);

export async function loadThread(id: string, signal: AbortSignal): Promise<Discussion> {
  const [item, story] = await Promise.all([
    getJson<unknown>(`https://hn.algolia.com/api/v1/items/${id}`, signal),
    getJson<unknown>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, withTimeout(signal, RANKING_WAIT)).catch(() => null),
  ]);
  // Not in Algolia's copy yet (a story posted a moment ago): none to show, but how many there are.
  return item ? readThread(item, story) : { comments: [], count: countOf(story) };
}
