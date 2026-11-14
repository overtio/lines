<script lang="ts" module>
  import { SvelteSet } from "svelte/reactivity";

  /** Which rows of feeds have their subscriptions folded away, as the sidebar was left. */
  const folded = new SvelteSet<string>();

  /** A row renamed (a stream's, by its key) stays folded if it was. */
  export function refold(from: string, to: string) {
    if (folded.delete(from)) folded.add(to);
  }
</script>

<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import { speak } from "../a11y";
  import { dismissAll, feedError, feedRowLabel, feeds, type FeedsFilter, type Subscription } from "../feeds/feeds.svelte";
  import type { FeedGroup } from "../feeds/groups";
  import { streamKey } from "../feeds/streams";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { longPress } from "../longPress";
  import { coverOf } from "../library/text";
  import { arrivedURL } from "../notes/attachments";
  import { notes } from "../notes/store.svelte";
  import { panes } from "../panes.svelte";
  import { plugins } from "../plugins/registry.svelte";
  import type { Filter } from "../notes/types";
  import { copyText } from "../platform";
  import { menuPoint } from "../popover";
  import type { RowSize } from "../sidebarLayout.svelte";
  import { type MenuItem, menuSections, ui } from "../ui.svelte";
  import { fitPicture, TONE_BACKING } from "./fitPicture";
  import { followPointer } from "./followPointer";
  import SidebarRow from "./SidebarRow.svelte";

  // A row of the Library's feeds: a stream's posts, a kind of feed's (RSS, Atom, podcasts'), or
  // every feed's, and under it each of its feeds with its unread posts counted, as the tag tree nests
  // tags. A feed that couldn't be fetched says why when pointed at. A feed dragged onto a stream's row
  // goes in that stream (noteDrops.ts). The row's own menu is the sidebar's (`onmenu`), which adds
  // sizing and hiding it.

  let {
    group,
    stream,
    subscriptions,
    unread,
    size = "standard",
    marked = false,
    onchoose,
    onmenu,
    reorder,
  }: {
    /** Its kind of feed, or null for every feed (or a stream's). */
    group: FeedGroup | null;
    /** Its stream's name, if it's a stream's (feeds/streams.ts). */
    stream?: string;
    subscriptions: Subscription[];
    unread: number;
    size?: RowSize;
    marked?: boolean;
    onchoose: (filter: Filter) => void;
    onmenu: (label: string, items: MenuItem[], x: number, y: number) => void;
    reorder: Attachment<HTMLElement>;
  } = $props();

  /** The subscription whose menu is open, outlined like a right-clicked note. */
  let menuFor = $state<string | null>(null);

  const key = $derived(stream ? `stream:${streamKey(stream)}` : (group ?? "all"));
  const label = $derived(stream ?? feedRowLabel(group));
  const filter = $derived(notes.filter.kind === "feeds" ? notes.filter : null);
  const shown = $derived(!folded.has(key) && subscriptions.length > 0);
  /** What the row lists. */
  const own = $derived<FeedsFilter>(stream ? { kind: "feeds", stream } : group ? { kind: "feeds", group } : { kind: "feeds" });
  const active = $derived(!!filter && !filter.feed && filter.group === own.group && streamKey(filter.stream ?? "") === streamKey(stream ?? ""));
  /** What a feed dropped on a stream's row is put in (noteDrops.ts). */
  const drop = $derived(stream && `stream:${stream}`);
  const urls = () => subscriptions.map(({ url }) => url);

  function readAll(urls: string[]) {
    feeds.readAll(urls);
    speak(t("feeds.didReadAll"));
  }

  function rowMenu(x: number, y: number) {
    const bare = feeds.withoutPictures(urls());
    onmenu(label, [
      { label: t("feeds.refresh"), icon: "refresh", run: () => feeds.refresh(urls()) },
      { label: t("feeds.readAll"), icon: "check-check", run: () => readAll(urls()) },
      { label: t("feeds.dismissAll"), icon: "archive", run: () => dismissAll(urls()) },
      { label: t("feeds.showDismissed"), icon: "eye", run: () => onchoose({ ...own, dismissed: true }) },
      // Its sites' feeds subscribed to without a picture (made before lines gave them their sites' icons) given theirs.
      ...(bare.length ? [{ label: t("feeds.getPictures"), icon: "image" as const, run: () => void getPictures(bare) }] : []),
      "separator",
      ...(stream
        ? [
            { label: t("feeds.streams.renameItem"), icon: "pencil" as const, run: () => (ui.streamPrompt = { x, y, rename: stream }) },
            { label: t("feeds.streams.delete"), icon: "trash" as const, danger: true, run: () => deleteStream(stream) },
          ]
        : [{ label: t("feeds.subscribe"), icon: "plus" as const, run: () => (ui.subscribePrompt = { x, y }) }]),
    ], x, y);
  }

  /** A stream deleted: its feeds stay subscribed. */
  function deleteStream(name: string) {
    feeds.deleteStream(name);
    speak(t("feeds.streams.deleted", { name }));
  }

  /** The menu's items for a feed's streams: a menu of those it isn't in (and a new one), and taking it out of each it is. */
  function streamItems({ url, title, streams }: Subscription, x: number, y: number): Exclude<MenuItem, "separator">[] {
    const others = feeds.streams.filter(({ name }) => !streams.some((each) => streamKey(each) === streamKey(name)));
    const add = (name: string) => {
      feeds.addToStream(url, name);
      speak(t("feeds.streams.added", { title, name }));
    };
    return [
      {
        label: t("feeds.streams.addTo"),
        icon: "waves",
        items: [
          ...others.map(({ name }): MenuItem => ({ label: name, icon: "waves", run: () => add(name) })),
          ...(others.length ? ["separator" as const] : []),
          { label: t("feeds.streams.new"), icon: "plus", run: () => (ui.streamPrompt = { x, y, feed: url }) },
        ],
      },
      ...streams.map((name) => ({
        label: t("feeds.streams.removeFrom", { name }),
        icon: "minus" as const,
        run: () => {
          feeds.removeFromStream(url, name);
          speak(t("feeds.streams.removed", { title, name }));
        },
      })),
    ];
  }

  /** Whether a feed's row was just dragged, so the click that ends it doesn't choose it. */
  let dragged = false;

  /**
   * A feed's row dragged with a mouse or pen, as its note, followed here (panes.svelte.ts): onto a
   * stream's row it goes in that stream, onto a tag's it's tagged, as a note dragged from the list is.
   */
  function dragFeed(event: PointerEvent, note: string) {
    if (event.button !== 0 || event.pointerType === "touch") return;
    const done = () => setTimeout(() => (dragged = false));
    followPointer(event, {
      move: ({ clientX: x, clientY: y }, first) => {
        if (first) {
          dragged = true;
          panes.startDrag("note", note);
        }
        panes.follow(x, y);
      },
      drop: () => {
        panes.drop();
        done();
      },
      cancel: () => {
        panes.endDrag();
        done();
      },
    });
  }

  function subscriptionMenu(subscription: Subscription, x: number, y: number) {
    const { url, note, title } = subscription;
    menuFor = url;
    ui.openMenu({
      x,
      y,
      label: title,
      items: menuSections(
        [
          { label: t("feeds.refreshOne"), icon: "refresh", run: () => feeds.refresh([url]) },
          { label: t("feeds.readAll"), icon: "check-check", run: () => readAll([url]) },
          { label: t("feeds.dismissAll"), icon: "archive", run: () => dismissAll([url]) },
          { label: t("feeds.showDismissed"), icon: "eye", run: () => onchoose({ kind: "feeds", feed: url, dismissed: true }) },
        ],
        streamItems(subscription, x, y),
        [
          { label: t("feeds.openNote"), icon: "file-text", run: () => notes.show(note) },
          { label: t("feeds.copyFeedLink"), icon: "link", run: () => void copyText(url).then(() => speak(t("list.copied"))) },
          // Asked for, as a subscription's picture is only had when it's made: one taken out of its note stays out.
          ...(pictured(note) ? [] : [{ label: t("feeds.getPicture"), icon: "image" as const, run: () => void getPicture(url, title) }]),
        ],
        // Its notes are the subscription: to the Trash with every one, which ⌘Z (or Restore) undoes.
        [{ label: t("feeds.unsubscribe"), icon: "trash", danger: true, run: () => {
          notes.trashMany(feeds.notesOf(url));
          if (filter?.feed === url) onchoose(own);
          speak(t("feeds.unsubscribed", { title }));
        } }],
      ),
      onclose: () => (menuFor = null),
    });
  }

  const pictured = (note: string) => !!coverOf(notes.get(note)?.note.body ?? "");

  async function getPictures(urls: string[]) {
    speak(t("feeds.gotPictures", { count: await feeds.givePictures(urls) }));
  }

  async function getPicture(url: string, title: string) {
    speak(t((await feeds.givePicture(url)) ? "feeds.gotPicture" : "feeds.noPicture", { title }));
  }

  function oncontextmenu(event: MouseEvent, open: (x: number, y: number) => void, opened: boolean) {
    event.preventDefault();
    // Android also fires this after a long press, when the menu is already up.
    if (opened) return;
    const { x, y } = menuPoint(event);
    open(x, y);
  }
</script>

<!-- Dragged, the row goes with its subscriptions (reorder.ts). -->
<li data-reorder-area>
  <div class="relative">
    <SidebarRow
      {size}
      class={subscriptions.length ? "pr-[30px] coarse:pr-12" : undefined}
      icon={stream ? "waves" : "rss"}
      {label}
      count={unread}
      {active}
      marked={marked || (!!drop && panes.rowAt === drop)}
      data-note-drop={drop || undefined}
      aria-label={unread ? `${label}, ${t("feeds.unreadCount", { count: unread })}` : undefined}
      onclick={() => onchoose(own)}
      oncontextmenu={(event) => oncontextmenu(event, rowMenu, marked)}
      {@attach longPress(rowMenu)}
      {@attach reorder}
    />
    {#if subscriptions.length}
      <button
        class={[
          "absolute top-1/2 right-1 -mt-3 grid size-6 place-items-center rounded-sm text-faint transition-[rotate,background-color] hover:bg-hover hover:text-muted coarse:right-0 coarse:-mt-[22px] coarse:size-11",
          shown && "rotate-90",
        ]}
        onclick={() => (folded.has(key) ? folded.delete(key) : folded.add(key))}
        aria-label={group || stream ? t("feeds.showGroup", { group: label }) : t("feeds.showSubscriptions")}
        title={group || stream ? t("feeds.showGroup", { group: label }) : t("feeds.showSubscriptions")}
        aria-expanded={shown}
        aria-controls="feeds-in-{encodeURIComponent(key)}"
      >
        <Icon name="chevron-right" size={14} />
      </button>
    {/if}
  </div>
  {#if shown}
    <ul id="feeds-in-{encodeURIComponent(key)}" class="mt-0.5 grid grid-cols-1 gap-y-0.5" aria-label={label}>
      {#each subscriptions as subscription (subscription.url)}
        {@const { url, title, note } = subscription}
        {@const error = feeds.records.get(url)?.error}
        {@const count = feeds.unread.get(url) ?? 0}
        {@const entry = notes.get(note)}
        {@const cover = entry && coverOf(entry.note.body)}
        {@const glyph = (entry && plugins.libraryKind(entry.meta.type)?.icon) || "rss"}
        <li class="pl-3.5">
          <!-- Its artwork (once it's here), or its kind's icon; a feed that failed, a quiet mark there instead, and why, said and shown on pointing at it. -->
          {#snippet artwork()}
            {#await arrivedURL(cover!)}
              <Icon name={glyph} size={16} strokeWidth={1.75} class="shrink-0 text-muted" />
            {:then src}
              {#if src}<img class="size-4 shrink-0 rounded-[calc(3px*var(--radius-scale))] object-cover {TONE_BACKING}" {src} alt="" draggable="false" {@attach fitPicture} />{:else}<Icon name={glyph} size={16} strokeWidth={1.75} class="shrink-0 text-muted" />{/if}
            {/await}
          {/snippet}
          <SidebarRow
            size={size === "small" ? "small" : "standard"}
            icon={error ? "circle-alert" : glyph}
            iconClass={error ? "shrink-0 text-faint" : undefined}
            picture={cover && !error ? artwork : undefined}
            label={title || url}
            {count}
            active={filter?.feed === url}
            marked={menuFor === url}
            title={error ? feedError(error) : undefined}
            aria-label={[title || url, count ? t("feeds.unreadCount", { count }) : "", error ? feedError(error) : ""].filter(Boolean).join(", ")}
            onclick={() => dragged || onchoose({ kind: "feeds", feed: url })}
            onpointerdown={(event) => dragFeed(event, note)}
            oncontextmenu={(event) => oncontextmenu(event, (x, y) => subscriptionMenu(subscription, x, y), menuFor === url)}
            {@attach longPress((x, y) => subscriptionMenu(subscription, x, y))}
          />
        </li>
      {/each}
    </ul>
  {/if}
</li>
