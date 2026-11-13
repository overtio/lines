import { untrack } from "svelte";
import { t } from "../i18n/index.svelte";
import { propertyOf } from "../notes/properties";
import { isClosed, notes } from "../notes/store.svelte";
import { prefs } from "../prefs.svelte";
import { fetchFeed, FetchError, type Validators } from "./fetch";
import { findFeed, type Found } from "./find";
import { readOpml, writeOpml } from "./opml";
import { isFeed, NotAFeed, readFeed, type Feed } from "./parse";
import { merge, newestFirst, type FeedRecord, type KeptPost } from "./posts";
import { feedStorage, storageKey } from "./storage";

/*
 * Feeds subscribed to, and their posts. A subscription is a note with a `feed:` property, so it
 * syncs as notes do; its posts are fetched in the main window (at start, then as often as
 * Settings → Library says, or when asked) and kept on this device (storage.ts), with which were read.
 */

/** A feed subscribed to. */
export interface Subscription {
  /** The feed's address, as its note's `feed:` says. */
  url: string;
  /** The note subscribing to it (the one edited last, if several do). */
  note: string;
  title: string;
}

/** A post, with the feed it's from. */
export interface Row {
  feed: string;
  post: KeptPost;
}

/** How many feeds are fetched at once (never two from one site). */
const AT_ONCE = 3;
/** A subscription made by hand is fetched once its `feed:` has been left alone this long. */
const SETTLE = 2000;

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** A note's feed, if it's a subscription: its `feed:` property, a link to the web. */
function feedOf(properties: Parameters<typeof propertyOf>[0]): string | null {
  const value = propertyOf(properties, "feed")?.value.trim();
  return value && /^https?:\/\/\S+$/i.test(value) ? value : null;
}

/** Every subscription as one line each, so typing that changes none leaves it the same and nothing below redraws. */
function signature() {
  const found = new Map<string, { note: string; title: string; updated: number }>();
  for (const { note, meta } of notes.entries) {
    if (note.trashed) continue;
    const url = feedOf(meta.properties);
    const other = url ? found.get(url) : undefined;
    if (url && (!other || note.updatedAt > other.updated)) found.set(url, { note: note.id, title: meta.title, updated: note.updatedAt });
  }
  return [...found].map(([url, { note, title }]) => `${url}\t${note}\t${title}`).join("\n");
}

class Feeds {
  /** What's kept of each feed, by its address. */
  records = $state.raw(new Map<string, FeedRecord>());
  loaded = $state(false);
  /** The feeds being fetched now. */
  fetching = $state.raw(new Set<string>());
  /** The post open in the note's place. */
  open = $state<{ feed: string; id: string } | null>(null);

  #signature = $derived(signature());

  /** The feeds subscribed to, by title. */
  subscriptions = $derived<Subscription[]>(
    this.#signature
      ? this.#signature
          .split("\n")
          .map((line) => {
            const [url, note, title] = line.split("\t");
            return { url, note, title };
          })
          .sort((a, b) => a.title.localeCompare(b.title))
      : [],
  );

  #subscribed = $derived(new Set(this.subscriptions.map((subscription) => subscription.url)));

  /** Every post of the feeds subscribed to, newest first. */
  #all = $derived.by(() => {
    const rows: Row[] = [];
    for (const url of this.#subscribed) for (const post of this.records.get(url)?.posts ?? []) rows.push({ feed: url, post });
    return rows.sort((a, b) => newestFirst(a.post, b.post));
  });

  /** How many posts each feed has unread, by its address. */
  unread = $derived(new Map([...this.#subscribed].map((url) => [url, this.records.get(url)?.posts.filter((post) => !post.read).length ?? 0])));

  totalUnread = $derived([...this.unread.values()].reduce((sum, count) => sum + count, 0));

  /** The open post, with its feed. */
  openRow = $derived.by((): Row | null => {
    const open = this.open;
    const post = open && this.records.get(open.feed)?.posts.find((each) => each.id === open.id);
    return post ? { feed: open.feed, post } : null;
  });

  /** Fetches waiting their turn. */
  #queue: string[] = [];
  /** Each feed's write under way, so they land in order. */
  #writes = new Map<string, Promise<void>>();

  /** The posts of one feed, or of all, newest first. */
  posts(feed?: string): Row[] {
    if (!feed) return this.#all;
    return (this.records.get(feed)?.posts ?? []).map((post) => ({ feed, post }));
  }

  subscription(url: string) {
    return this.subscriptions.find((subscription) => subscription.url === url);
  }

  /**
   * Reads what's kept, letting go of the feeds no note subscribes to any more (a trashed one still
   * keeps its); unless a locked note is closed, which may be one that does.
   */
  async load() {
    let kept = await feedStorage.all();
    if (!notes.entries.some(({ note }) => isClosed(note))) {
      const noted = new Set(notes.entries.map(({ meta }) => feedOf(meta.properties)));
      await Promise.all(kept.filter((record) => !noted.has(record.url)).map((record) => feedStorage.delete(record)));
      kept = kept.filter((record) => noted.has(record.url));
    }
    this.records = new Map(kept.map((record) => [record.url, record]));
    this.loaded = true;
  }

  /**
   * In the main window, once notes are loaded: fetches the feeds due, then again as often as
   * Settings says, and new subscriptions once their link is typed in.
   */
  async start() {
    await this.load();
    $effect.root(() => {
      $effect(() => {
        const minutes = prefs.feedRefresh;
        if (!minutes) return;
        untrack(() => this.refresh(this.#due(minutes)));
        const timer = setInterval(() => this.refresh(this.#due(minutes)), minutes * 60_000);
        return () => clearInterval(timer);
      });
      $effect(() => {
        const fresh = [...this.#subscribed].filter((url) => !untrack(() => this.records.has(url) || this.fetching.has(url)));
        if (!fresh.length || !prefs.feedRefresh) return;
        // Still subscribed to (a link typed in has settled), and not fetched since.
        const timer = setTimeout(() => this.refresh(fresh.filter((url) => this.#subscribed.has(url) && !this.records.has(url))), SETTLE);
        return () => clearTimeout(timer);
      });
    });
  }

  /** The feeds not fetched within the last `minutes`, nor asked to wait. */
  #due(minutes: number) {
    const now = Date.now();
    return this.subscriptions
      .map(({ url }) => url)
      .filter((url) => {
        const record = this.records.get(url);
        return !record?.checked || (now - record.checked >= minutes * 60_000 - 30_000 && !(record.retryAt && record.retryAt > now));
      });
  }

  /** Fetches these feeds (every one subscribed to, if none are named), a few at a time. */
  refresh(urls: string[] = this.subscriptions.map(({ url }) => url)) {
    for (const url of urls) if (!this.#queue.includes(url) && !this.fetching.has(url)) this.#queue.push(url);
    this.#next();
  }

  #next() {
    while (this.fetching.size < AT_ONCE) {
      const busy = new Set([...this.fetching].map(hostOf));
      const index = this.#queue.findIndex((url) => !busy.has(hostOf(url)));
      if (index < 0) return;
      const [url] = this.#queue.splice(index, 1);
      this.fetching = new Set([...this.fetching, url]);
      void this.#fetch(url).finally(() => {
        const fetching = new Set(this.fetching);
        fetching.delete(url);
        this.fetching = fetching;
        this.#next();
      });
    }
  }

  async #fetch(url: string) {
    const record = this.records.get(url);
    if (record?.retryAt && record.retryAt > Date.now()) return;
    try {
      const response = await fetchFeed(url, record ?? {});
      if (!response.changed) return this.#update(url, { checked: Date.now(), error: undefined, retryAt: undefined });
      if (!isFeed(response.text)) throw new NotAFeed(url);
      await this.take(url, readFeed(response.text, response.url), response.validators);
    } catch (error) {
      console.warn(`lines: couldn't fetch the feed ${url}`, error);
      const reason = error instanceof NotAFeed ? "not a feed" : error instanceof Error ? error.message : String(error);
      this.#update(url, { checked: Date.now(), error: reason, retryAt: error instanceof FetchError ? error.retryAt : undefined });
    }
  }

  /** Keeps a feed as it was just fetched: its posts merged with those kept, which were read staying read. */
  async take(url: string, feed: Feed, validators: Validators) {
    const fetched = await Promise.all(feed.posts.map(async (post) => ({ ...post, key: await storageKey(`${url}\n${post.id}`) })));
    const { posts: _, ...rest } = feed;
    // With the posts as they're kept now: any read since the fetch began stay read.
    const { posts, changed, dropped } = merge(this.records.get(url)?.posts ?? [], fetched, Date.now());
    await feedStorage.putContents(changed.map(({ key, html }) => ({ id: key, html })));
    this.#set(url, { ...rest, url, posts, ...validators, checked: Date.now(), error: undefined, retryAt: undefined });
    await feedStorage.deleteContents(dropped);
  }

  /** Changes what's kept of a feed (one not kept yet only once it's been fetched). */
  #update(url: string, change: Partial<FeedRecord>) {
    const record = this.records.get(url) ?? { url, title: this.subscription(url)?.title ?? url, posts: [] };
    this.#set(url, { ...record, ...change });
  }

  #set(url: string, record: FeedRecord) {
    this.records = new Map(this.records).set(url, record);
    // Each write takes the record as it is by then, so the last one written is the latest.
    const write = (this.#writes.get(url) ?? Promise.resolve()).then(() => feedStorage.put(this.records.get(url)!)).catch((error) => console.error(`lines: couldn't keep the feed ${url}`, error));
    this.#writes.set(url, write);
  }

  /** Marks these posts of a feed read, or unread. */
  setRead(feed: string, ids: string[], read = true) {
    const record = this.records.get(feed);
    const marking = new Set(ids);
    if (!record?.posts.some((post) => marking.has(post.id) && post.read !== read)) return;
    this.#set(feed, { ...record, posts: record.posts.map((post) => (marking.has(post.id) ? { ...post, read } : post)) });
  }

  /** Marks every post of a feed (or of all of them) read. */
  readAll(feed?: string) {
    for (const url of feed ? [feed] : this.#subscribed) {
      const posts = this.records.get(url)?.posts ?? [];
      this.setRead(url, posts.filter((post) => !post.read).map((post) => post.id));
    }
  }

  /** Opens a post in the note's place, and marks it read. */
  show(feed: string, id: string) {
    notes.select(null);
    this.open = { feed, id };
    this.setRead(feed, [id]);
  }

  /** A post's content, as HTML. */
  content(post: KeptPost) {
    return feedStorage.content(post.key);
  }

  /**
   * Subscribes to the feed `input` means (its link, its site's, its page on Apple Podcasts): a note
   * for it, with its posts kept from the fetch that found it. A feed already subscribed to isn't
   * again. Returns the feed's address.
   */
  async subscribe(input: string, signal?: AbortSignal): Promise<string> {
    const found = await findFeed(input, signal);
    if (!this.#subscribed.has(found.url)) await this.#add(found);
    return found.url;
  }

  /** A note for a feed found, with its posts kept from the fetch that found it. */
  async #add(found: Found) {
    await this.take(found.url, found.feed, found.validators);
    const now = Date.now();
    await notes.insert({ id: crypto.randomUUID(), body: subscriptionNote(found), createdAt: now, updatedAt: now, pinned: false, trashed: false });
  }

  /**
   * Subscribes to the feeds an OPML file lists that aren't already, a few at a time: each fetched
   * for what it says of itself, or, where it can't be, a note of what the file says of it. How many
   * were added.
   */
  async importOpml(text: string): Promise<number> {
    const outlines = readOpml(text).filter(({ url }) => !this.#subscribed.has(url));
    let done = 0;
    const next = async (): Promise<void> => {
      const outline = outlines.shift();
      if (!outline) return;
      try {
        const response = await fetchFeed(outline.url);
        if (!response.changed || !isFeed(response.text)) throw new NotAFeed(outline.url);
        await this.#add({ url: outline.url, feed: readFeed(response.text, response.url), validators: response.validators });
      } catch {
        const now = Date.now();
        const feed = { title: outline.title || outline.url, link: outline.site, posts: [] };
        await notes.insert({ id: crypto.randomUUID(), body: subscriptionNote({ url: outline.url, feed, validators: {} }), createdAt: now, updatedAt: now, pinned: false, trashed: false });
      }
      done++;
      return next();
    };
    await Promise.all(Array.from({ length: AT_ONCE }, next));
    return done;
  }

  /** Every feed subscribed to, as an OPML file other readers take. */
  exportOpml(): string {
    const outlines = this.subscriptions.map(({ url, note, title }) => {
      const site = propertyOf(notes.get(note)?.meta.properties ?? [], "link")?.value.trim();
      return { url, title, ...(site && /^https?:\/\//i.test(site) && { site }) };
    });
    return writeOpml(t("feeds.opmlTitle"), outlines);
  }

  /** Writes what's kept again, encrypted or not as the app lock now says. */
  async rewrite() {
    await Promise.all(this.#writes.values());
    await feedStorage.rewrite();
  }
}

/** Why a feed couldn't be fetched (a FetchError's message), as people read it. */
export function feedError(reason: string): string {
  const status = /^HTTP (\d+)$/.exec(reason)?.[1];
  if (status) return t("feeds.errorStatus", { status });
  switch (reason) {
    case "blocked":
      return t("feeds.errorBlocked");
    case "timeout":
      return t("feeds.errorTimeout");
    case "too big":
      return t("feeds.errorTooBig");
    case "not a feed":
      return t("feeds.errorNotFeed");
    default:
      return t("feeds.errorOther", { error: reason });
  }
}

/** A subscription's note: a podcast's or a site's, with its feed. */
function subscriptionNote({ url, feed }: Found) {
  const type = feed.posts.some((post) => post.audio) ? "podcast" : "feed";
  const properties = [`type: ${type}`, feed.author && `author: ${feed.author}`, `feed: ${url}`, feed.link && `link: ${feed.link}`].filter(Boolean);
  return ["---", ...properties, "---", `# ${feed.title}`, ...(feed.description ? ["", feed.description] : [])].join("\n");
}

export const feeds = new Feeds();
