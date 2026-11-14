import { untrack } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import { speak } from "../a11y";
import { t } from "../i18n/index.svelte";
import { lookUp } from "../library/lookup";
import { coverOfItem, libraryNote } from "../library/note";
import { clock, coverOf, known, withCover } from "../library/text";
import { putAttachment } from "../notes/attachments";
import { dayOf } from "../notes/calendar";
import { propertyOf } from "../notes/properties";
import { isClosed, notes } from "../notes/store.svelte";
import { plugins } from "../plugins/registry.svelte";
import type { LibraryItem } from "../plugins/types";
import { prefs } from "../prefs.svelte";
import { fetchFeed, FetchError, type Validators } from "./fetch";
import { findFeed, linkOf, NoFeed } from "./find";
import { FEED_GROUPS, type FeedGroup, groupOf } from "./groups";
import { readOpml, writeOpml } from "./opml";
import { plainText } from "./markdown";
import { feedItem } from "./item";
import { isFeed, NotAFeed, readFeed, type Feed } from "./parse";
import { backoff, DAY, merge, newestFirst, type FeedRecord, type KeptPost } from "./posts";
import { feedStorage } from "./storage";

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

/** The library source of feeds' own links (src/plugins/feeds). */
export const FEED_SOURCE = "feeds";

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

/** The note (not in the Trash) whose `key` property is `value`: a post saved to the Library, by its link or its sound. */
export const savedWith = (key: string, value: string) => notes.entries.find(({ note, meta }) => !note.trashed && propertyOf(meta.properties, key)?.value.trim() === value);

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
  /** Feeds are on: their plugin is, which makes `feed` a kind of the library's (Settings → Plugins). */
  on = $derived(!!plugins.libraryKind("feed"));
  /** What's kept of each feed, by its address. */
  records = $state.raw(new Map<string, FeedRecord>());
  loaded = $state(false);
  /** The feeds being fetched now. */
  fetching = $state.raw(new Set<string>());
  /** The post open in the note's place. */
  open = $state<{ feed: string; id: string } | null>(null);
  /** The posts being saved to the Library, by key: each saved once, however often it's asked meanwhile. */
  saving = new SvelteMap<string, Promise<string>>();

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

  /** Which group each feed subscribed to is in (groups.ts), by its address. */
  groupOf = $derived(new Map(this.subscriptions.map(({ url, note }) => [url, groupOf(this.records.get(url), notes.get(note)?.meta.type)])));

  /** The groups with feeds in them, in order, each with its subscriptions and how many of their posts are unread. */
  groups = $derived(
    FEED_GROUPS.map((group) => {
      const subscriptions = this.subscriptions.filter(({ url }) => this.groupOf.get(url) === group);
      return { group, subscriptions, unread: subscriptions.reduce((sum, { url }) => sum + (this.unread.get(url) ?? 0), 0) };
    }).filter(({ subscriptions }) => subscriptions.length),
  );

  /** The open post, with its feed. */
  openRow = $derived.by((): Row | null => {
    const open = this.open;
    const post = open && this.records.get(open.feed)?.posts.find((each) => each.id === open.id);
    return post ? { feed: open.feed, post } : null;
  });

  /** Fetches waiting their turn, in order: by feed, whether it was asked for (⟳), which goes even when it was to wait. */
  #queue = new Map<string, boolean>();
  /** What's waiting for each feed queued or being fetched: what it read of it, or null. */
  #waiting = new Map<string, ((feed: Feed | null) => void)[]>();
  /** Each feed's write under way, so they land in order. */
  #writes = new Map<string, Promise<void>>();
  /** Each feed being kept now, by its address: writing everything again (the app lock) waits for them. */
  #taking = new Map<string, Promise<void>>();

  /** The posts of one feed, of one group's, or of all, newest first. */
  posts(feed?: string, group?: FeedGroup): Row[] {
    if (feed) return (this.records.get(feed)?.posts ?? []).map((post) => ({ feed, post }));
    return group ? this.#all.filter((row) => this.groupOf.get(row.feed) === group) : this.#all;
  }

  /** The feeds subscribed to in a group, or all of them. */
  feedsIn(group?: FeedGroup): string[] {
    return this.subscriptions.filter(({ url }) => !group || this.groupOf.get(url) === group).map(({ url }) => url);
  }

  subscription(url: string) {
    return this.subscriptions.find((subscription) => subscription.url === url);
  }

  /** Every note subscribing to a feed, but those in the Trash. */
  notesOf(url: string): string[] {
    return notes.entries.filter(({ note, meta }) => !note.trashed && feedOf(meta.properties) === url).map(({ note }) => note.id);
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
        if (!minutes || !this.on) return;
        untrack(() => this.refreshDue(minutes));
        const timer = setInterval(() => this.refreshDue(minutes), minutes * 60_000);
        return () => clearInterval(timer);
      });
      $effect(() => {
        const fresh = [...this.#subscribed].filter((url) => !untrack(() => this.records.has(url) || this.fetching.has(url)));
        if (!fresh.length || !prefs.feedRefresh || !this.on) return;
        // Still subscribed to (a link typed in has settled), and not fetched since.
        const timer = setTimeout(() => {
          for (const url of fresh) if (this.#subscribed.has(url) && !this.records.has(url)) void this.#request(url);
        }, SETTLE);
        return () => clearTimeout(timer);
      });
    });
  }

  /**
   * Fetches the feeds subscribed to that are due: not fetched within the last `minutes`, and not
   * waiting, as one said to (429, 503), after failing, or gone (410).
   */
  refreshDue(minutes: number = prefs.feedRefresh || 30) {
    const now = Date.now();
    for (const { url } of this.subscriptions) {
      const record = this.records.get(url);
      if (!record?.checked || (!record.gone && !(record.retryAt && record.retryAt > now) && now - record.checked >= minutes * 60_000 - 30_000)) void this.#request(url);
    }
  }

  /** Fetches these feeds (every one subscribed to, if none are named) as they're asked for: even those waiting, or gone. */
  refresh(urls: string[] = this.subscriptions.map(({ url }) => url)) {
    for (const url of urls) void this.#request(url, true);
  }

  /** A feed fetched in its turn, a few at a time and one per site: what it read, or null if nothing changed or it couldn't be. */
  #request(url: string, asked = false): Promise<Feed | null> {
    const read = new Promise<Feed | null>((resolve) => this.#waiting.set(url, [...(this.#waiting.get(url) ?? []), resolve]));
    if (!this.fetching.has(url)) this.#queue.set(url, asked || !!this.#queue.get(url));
    this.#next();
    return read;
  }

  #next() {
    while (this.fetching.size < AT_ONCE) {
      const busy = new Set([...this.fetching].map(hostOf));
      const url = [...this.#queue.keys()].find((each) => !busy.has(hostOf(each)));
      if (url === undefined) return;
      const asked = this.#queue.get(url)!;
      this.#queue.delete(url);
      this.fetching = new Set([...this.fetching, url]);
      void this.#fetch(url, asked).then((feed) => {
        const fetching = new Set(this.fetching);
        fetching.delete(url);
        this.fetching = fetching;
        for (const resolve of this.#waiting.get(url) ?? []) resolve(feed);
        this.#waiting.delete(url);
        this.#next();
      });
    }
  }

  async #fetch(url: string, asked: boolean): Promise<Feed | null> {
    const record = this.records.get(url);
    if (!asked && (record?.gone || (record?.retryAt && record.retryAt > Date.now()))) return null;
    try {
      const response = await fetchFeed(url, record ?? {});
      if (!response.changed) {
        this.#update(url, { checked: Date.now(), error: undefined, failures: 0, retryAt: undefined, gone: false });
        return null;
      }
      if (!isFeed(response.text)) throw new NotAFeed(url);
      const feed = readFeed(response.text, response.url);
      await this.take(url, feed, response.validators);
      return feed;
    } catch (error) {
      // Its site answered, but not with the feed (not to be asked again yet, it'd have said): some can be read another way (YouTube's, from its page).
      const missing = error instanceof NotAFeed || (error instanceof FetchError && !!error.status && error.status !== 429 && !error.retryAt);
      const instead = missing ? await feedInstead(url).catch((reason) => void console.warn(`lines: couldn't read the feed ${url} another way`, reason)) : null;
      if (instead) {
        await this.take(url, instead, {});
        return instead;
      }
      console.warn(`lines: couldn't fetch the feed ${url}`, error);
      const now = Date.now();
      const reason = error instanceof NotAFeed ? "not a feed" : error instanceof Error ? error.message : String(error);
      const failures = (record?.failures ?? 0) + 1;
      // Longer after each failure in a row, or as long as it said if that's longer; a day at most.
      const said = error instanceof FetchError ? (error.retryAt ?? 0) : 0;
      const retryAt = Math.min(now + DAY, Math.max(said, now + backoff(failures, (prefs.feedRefresh || 30) * 60_000)));
      this.#update(url, { checked: now, error: reason, failures, retryAt, gone: error instanceof FetchError && error.status === 410 });
      return null;
    }
  }

  /** Keeps a feed as it was just fetched: its posts merged with those kept, which were read staying read. */
  take(url: string, feed: Feed, validators: Validators): Promise<void> {
    // After the feed's last, so each merges with what the one before kept.
    const taking = (this.#taking.get(url) ?? Promise.resolve()).catch(() => {}).then(() => this.#take(url, feed, validators));
    this.#taking.set(url, taking);
    void taking
      .catch(() => {})
      .finally(() => {
        if (this.#taking.get(url) === taking) this.#taking.delete(url);
      });
    return taking;
  }

  async #take(url: string, feed: Feed, validators: Validators) {
    const { posts, changed, dropped } = merge(this.records.get(url)?.posts ?? [], feed.posts, Date.now());
    await feedStorage.putContents(changed.map(({ key, html }) => ({ id: key, html })));
    // As the posts are now: one opened (or marked) while their content was written stays as it was left.
    const now = this.records.get(url);
    const read = new Map(now?.posts.map((post) => [post.id, post.read]));
    const { posts: _, ...rest } = feed;
    this.#set(url, {
      ...rest,
      id: now?.id ?? crypto.randomUUID(),
      url,
      posts: posts.map((post) => (read.has(post.id) ? { ...post, read: read.get(post.id)! } : post)),
      ...validators,
      checked: Date.now(),
      error: undefined,
      failures: 0,
      retryAt: undefined,
      gone: false,
    });
    await feedStorage.deleteContents(dropped);
  }

  /** Changes what's kept of a feed (one not kept yet only once it's been fetched). */
  #update(url: string, change: Partial<FeedRecord>) {
    const record = this.records.get(url) ?? { id: crypto.randomUUID(), url, title: this.subscription(url)?.title ?? url, posts: [] };
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

  /** Marks every post of these feeds (or of all of them) read. */
  readAll(urls: Iterable<string> = this.#subscribed) {
    for (const url of urls) {
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

  /** The note a post was saved to the Library as, if it was: the one with its link (an episode's, its sound). */
  savedNote({ post }: Row) {
    const [key, value] = post.audio ? ["audio", post.audio.url] : ["link", post.link];
    return value ? savedWith(key, value) : undefined;
  }

  /**
   * Keeps a post in the Library, as a note made as any library note is: an `article`, or an
   * `episode` whose `podcast` mentions its subscription's note; asked again while it's being saved,
   * the same save. Returns the note's id.
   */
  save(row: Row, signal?: AbortSignal): Promise<string> {
    const { key } = row.post;
    let saving = this.saving.get(key);
    if (!saving) {
      saving = this.#save(row, signal).finally(() => this.saving.delete(key));
      this.saving.set(key, saving);
    }
    return saving;
  }

  async #save(row: Row, signal?: AbortSignal): Promise<string> {
    const saved = this.savedNote(row);
    if (saved) return saved.note.id;
    const { feed, post } = row;
    const record = this.records.get(feed);
    const show = this.subscription(feed)?.title || record?.title;
    const published = post.date ? dayOf(post.date) : undefined;
    const html = await this.content(post);
    const channel = notes.get(this.subscription(feed)?.note ?? "");
    if (channel?.meta.type === "channel" && post.link) {
      // A channel's video, kept as a link to it is (its source looks it up), its channel the channel's note.
      const found = await lookUp(post.link, signal ?? new AbortController().signal).catch(() => null);
      const video: LibraryItem =
        found?.type === "video"
          ? found
          : {
              type: "video",
              title: post.title,
              link: post.link,
              properties: known([
                ["channel", show],
                ["published", published],
                ["duration", clock(post.duration)],
              ]),
              cover: post.image,
              description: html ? plainText(html) : post.excerpt,
            };
      const page = propertyOf(channel.meta.properties, "link")?.value.trim();
      return this.#write(page ? { ...video, linked: { ...video.linked, channel: page } } : video, signal);
    }
    const item: LibraryItem = post.audio
      ? {
          type: "episode",
          title: post.title,
          link: post.link,
          properties: known([
            ["podcast", show],
            ["published", published],
            ["duration", clock(post.duration)],
            ["audio", post.audio.url],
            ["transcript", post.transcript?.url],
            ["chapters", post.chapters?.url],
          ]),
          cover: post.image ?? record?.image,
          description: html ? plainText(html) : post.excerpt,
        }
      : {
          type: "article",
          title: post.title,
          link: post.link,
          properties: known([
            ["author", post.author],
            ["site", show],
            ["published", published],
          ]),
          cover: post.image,
          description: html ? plainText(html) : post.excerpt,
        };
    return this.#write(item, signal);
  }

  /** A note for `item`, made as any library note is: its text written, then its cover kept with it. Its id. */
  async #write(item: LibraryItem, signal?: AbortSignal): Promise<string> {
    const note = await libraryNote(item, notes.entries, signal);
    const id = crypto.randomUUID();
    const now = Date.now();
    await notes.insert({ id, body: note.text, createdAt: now, updatedAt: now, pinned: false, trashed: false });
    await note.keep().catch((error) => console.warn("lines: couldn't keep a cover", error));
    return id;
  }

  /**
   * Subscribes to the feed `input` means (its link, its site's, its podcast's page on Apple
   * Podcasts): a note for it, made as any library note is (its artwork kept with it), with its
   * posts kept from the fetch that found it. A feed already subscribed to isn't again. Returns the
   * feed's address.
   */
  async subscribe(input: string, signal = new AbortController().signal): Promise<string> {
    const link = linkOf(input);
    if (!link) throw new NoFeed(input);
    // A subscription of a kind of its own (a YouTube channel), as its source makes it: its feed, or that read another way while it can't be had.
    // Where its source can't say (on the web, which can't read YouTube's pages), the link is a feed's or a page's, as any is.
    const own = await subscriptionOf(link, signal).catch((error) => {
      signal.throwIfAborted();
      console.warn(`lines: couldn't ask what subscribing to ${link} is`, error);
      return null;
    });
    const url = own?.properties.find(([key]) => key === "feed")?.[1];
    if (own && url) {
      if (this.#subscribed.has(url)) return url;
      const found = await findFeed(url, signal).catch(async (error) => {
        const feed = await feedInstead(url, signal).catch(() => null);
        if (!feed) throw error;
        return { url, feed, validators: {} };
      });
      await this.take(url, found.feed, found.validators);
      await this.#write(own, signal);
      return url;
    }
    const found = await findFeed((await namedFeed(link, signal)) ?? link, signal, namedFeed);
    if (this.#subscribed.has(found.url)) return found.url;
    await this.take(found.url, found.feed, found.validators);
    await this.#write(feedItem(found.url, found.feed), signal);
    return found.url;
  }

  /**
   * Gives the notes subscribing to a feed its picture where they have none, when asked (a feed's
   * menu): its artwork, or a site's feed with none its site's icon, as a new subscription's note is
   * made with. Never by itself, so a picture taken out of a note stays out. Whether there was one
   * to give.
   */
  async givePicture(url: string): Promise<boolean> {
    const record = this.records.get(url);
    const cover = record && (await coverOfItem(feedItem(url, record)));
    if (!cover) return false;
    try {
      await putAttachment(cover.name, cover.picture);
    } catch (error) {
      console.warn("lines: couldn't keep a feed's picture", error);
      return false;
    }
    for (const id of this.notesOf(url)) {
      // As the note is now: not one locked or trashed meanwhile (a closed locked note's text isn't there to add to), nor one given a picture.
      const entry = notes.get(id);
      if (!entry || entry.note.locked || entry.note.trashed) continue;
      notes.setText(id, (body) => (coverOf(body) ? body : withCover(body, entry.meta.title, cover)), { keepDate: true });
    }
    return true;
  }

  /** Of `urls`, the sites' feeds whose notes have no picture: a podcast's is its artwork, which it's subscribed with or not. */
  withoutPictures(urls: string[]): string[] {
    return urls.filter((url) =>
      this.notesOf(url).some((id) => {
        const entry = notes.get(id);
        return entry?.meta.type === "feed" && !coverOf(entry.note.body);
      }),
    );
  }

  /** Gives each of `urls` its picture (givePicture), a few at a time, as feeds are fetched. How many had one to give. */
  async givePictures(urls: string[]): Promise<number> {
    const left = [...urls];
    let given = 0;
    const turn = async () => {
      for (let url = left.shift(); url; url = left.shift()) if (await this.givePicture(url)) given++;
    };
    await Promise.all(Array.from({ length: AT_ONCE }, turn));
    return given;
  }

  /**
   * Subscribes to the feeds an OPML file lists that aren't already, each fetched in its turn as
   * feeds are refreshed, for what it says of itself; one that can't be, a note of what the file
   * says of it, and why kept as any feed's that failed. How many were added.
   */
  async importOpml(text: string): Promise<number> {
    const outlines = readOpml(text).filter(({ url }) => !this.#subscribed.has(url));
    await Promise.all(
      outlines.map(async ({ url, title, site }) => {
        const feed = await this.#request(url);
        await this.#write(feedItem(url, feed ?? { title: title || url, link: site, posts: [] }));
      }),
    );
    return outlines.length;
  }

  /** Every feed subscribed to, as an OPML file other readers take. */
  exportOpml(): string {
    const outlines = this.subscriptions.map(({ url, note, title }) => {
      const site = propertyOf(notes.get(note)?.meta.properties ?? [], "link")?.value.trim();
      return { url, title, ...(site && /^https?:\/\//i.test(site) && { site }) };
    });
    return writeOpml(t("feeds.opmlTitle"), outlines);
  }

  /** Writes what's kept again, encrypted or not as the app lock now says, once the feeds being kept are. */
  async rewrite() {
    while (this.#taking.size) await Promise.allSettled(this.#taking.values());
    await Promise.all(this.#writes.values());
    await feedStorage.rewrite();
  }
}

/** A row of feeds' name in the sidebar: its kind's ("RSS Feeds"), or for every feed, "Feeds". */
export const feedRowLabel = (group?: FeedGroup | null) => (group ? t(`feeds.group.${group}` as const) : t("feeds.title"));

/** Why a feed couldn't be fetched (a FetchError's message), as people read it. */
export function feedError(reason: string): string {
  if (reason === "HTTP 410") return t("feeds.errorGone");
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

/** Saves a post to the Library, and says so, or that it couldn't be; once, if it's being saved already. */
export async function savePost(row: Row) {
  if (feeds.saving.has(row.post.key)) return;
  try {
    await feeds.save(row);
    speak(t("feeds.saved", { title: row.post.title }));
  } catch (error) {
    console.error("lines: couldn't save the post", error);
    speak(t("feeds.couldntSave"));
  }
}

/**
 * The feed a library source says a link names, if one does (`LibrarySource.feed`): a podcast's page
 * on Apple Podcasts, someone's sounds on SoundCloud. Only those sources are asked, as a page's
 * every link may be.
 */
export async function namedFeed(link: string, signal = new AbortController().signal): Promise<string | null> {
  const url = new URL(link);
  for (const source of plugins.librarySources) {
    if (!source.feed || !source.recognizes(url)) continue;
    const feed = await source.feed(url, signal).catch(() => null);
    signal.throwIfAborted();
    if (feed) return feed;
  }
  return null;
}

/** What subscribing to `link` makes where a source says it's a subscription of its own (`LibrarySource.subscription`). */
async function subscriptionOf(link: string, signal: AbortSignal): Promise<LibraryItem | null> {
  const url = new URL(link);
  for (const source of plugins.librarySources) {
    if (!source.subscription || !source.recognizes(url)) continue;
    const item = await source.subscription(url, signal);
    signal.throwIfAborted();
    if (item) return item;
  }
  return null;
}

/** A feed read another way where it can't be had itself, if a source knows it (`LibrarySource.feedInstead`): YouTube's, from the channel's page. */
export async function feedInstead(url: string, signal = new AbortController().signal): Promise<Feed | null> {
  const feed = new URL(url);
  for (const source of plugins.librarySources) {
    const read = await source.feedInstead?.(feed, signal);
    if (read) return read;
  }
  return null;
}

export const feeds = new Feeds();
