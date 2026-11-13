<script lang="ts">
  import { speak } from "../a11y";
  import { feedError, feeds, type Subscription } from "../feeds/feeds.svelte";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { longPress } from "../longPress";
  import { coverOf } from "../library/text";
  import { attachmentURL } from "../notes/attachments";
  import { notes } from "../notes/store.svelte";
  import { plugins } from "../plugins/registry.svelte";
  import type { Filter } from "../notes/types";
  import { copyText } from "../platform";
  import { menuPoint } from "../popover";
  import { type MenuItem, menuSections, ui } from "../ui.svelte";
  import SidebarRow from "./SidebarRow.svelte";

  // The Library's Feeds: every feed's posts, and under it, each feed subscribed to with its unread
  // posts counted, as the tag tree nests tags. A feed that couldn't be fetched says why when pointed at.

  let { onchoose }: { onchoose: (filter: Filter) => void } = $props();

  let open = $state(true);
  /** The row whose menu is open, outlined like a right-clicked note. */
  let menuFor = $state<string | null>(null);

  const filter = $derived(notes.filter.kind === "feeds" ? notes.filter : null);

  function readAll(feed?: string) {
    feeds.readAll(feed);
    speak(t("feeds.didReadAll"));
  }

  function showMenu(key: string, label: string, items: MenuItem[], x: number, y: number) {
    menuFor = key;
    ui.openMenu({ x, y, label, items, onclose: () => (menuFor = null) });
  }

  function feedsMenu(x: number, y: number) {
    showMenu("feeds", t("feeds.title"), [
      { label: t("feeds.refresh"), icon: "refresh", run: () => feeds.refresh() },
      { label: t("feeds.readAll"), icon: "check-check", run: () => readAll() },
      "separator",
      { label: t("feeds.subscribe"), icon: "plus", run: () => (ui.subscribePrompt = { x, y }) },
    ], x, y);
  }

  function subscriptionMenu({ url, note, title }: Subscription, x: number, y: number) {
    showMenu(url, title, menuSections(
      [
        { label: t("feeds.refreshOne"), icon: "refresh", run: () => feeds.refresh([url]) },
        { label: t("feeds.readAll"), icon: "check-check", run: () => readAll(url) },
      ],
      [
        { label: t("feeds.openNote"), icon: "file-text", run: () => notes.show(note) },
        { label: t("feeds.copyFeedLink"), icon: "link", run: () => void copyText(url).then(() => speak(t("list.copied"))) },
      ],
      // Its note is the subscription: to the Trash with it, which ⌘Z (or Restore) undoes.
      [{ label: t("feeds.unsubscribe"), icon: "trash", danger: true, run: () => {
        notes.trashMany([note]);
        if (filter?.feed === url) onchoose({ kind: "feeds" });
        speak(t("feeds.unsubscribed", { title }));
      } }],
    ), x, y);
  }

  function oncontextmenu(event: MouseEvent, key: string, open: (x: number, y: number) => void) {
    event.preventDefault();
    // Android also fires this after a long press, when the menu is already up.
    if (menuFor === key) return;
    const { x, y } = menuPoint(event);
    open(x, y);
  }
</script>

<li>
  <div class="relative">
    <SidebarRow
      class={feeds.subscriptions.length ? "pr-[30px] coarse:pr-12" : undefined}
      icon="rss"
      label={t("feeds.title")}
      count={feeds.totalUnread}
      active={!!filter && !filter.feed}
      marked={menuFor === "feeds"}
      aria-label={feeds.totalUnread ? t("feeds.titleWithUnread", { count: feeds.totalUnread }) : undefined}
      onclick={() => onchoose({ kind: "feeds" })}
      oncontextmenu={(event) => oncontextmenu(event, "feeds", feedsMenu)}
      {@attach longPress(feedsMenu)}
    />
    {#if feeds.subscriptions.length}
      <button
        class={[
          "absolute top-1/2 right-1 -mt-3 grid size-6 place-items-center rounded-sm text-faint transition-[rotate,background-color] hover:bg-hover hover:text-muted coarse:right-0 coarse:-mt-[22px] coarse:size-11",
          open && "rotate-90",
        ]}
        onclick={() => (open = !open)}
        aria-label={t("feeds.showSubscriptions")}
        title={t("feeds.showSubscriptions")}
        aria-expanded={open}
        aria-controls="feeds-subscriptions"
      >
        <Icon name="chevron-right" size={14} />
      </button>
    {/if}
  </div>
  {#if open && feeds.subscriptions.length}
    <ul id="feeds-subscriptions" class="mt-0.5 grid gap-y-0.5" aria-label={t("feeds.subscriptions")}>
      {#each feeds.subscriptions as subscription (subscription.url)}
        {@const { url, title, note } = subscription}
        {@const error = feeds.records.get(url)?.error}
        {@const unread = feeds.unread.get(url) ?? 0}
        {@const entry = notes.get(note)}
        {@const cover = entry && coverOf(entry.note.body)}
        <li class="pl-3.5">
          <!-- Its artwork, or its kind's icon; a feed that failed, a quiet mark there instead, and why, said and shown on pointing at it. -->
          {#snippet artwork()}
            {#await attachmentURL(cover!) then src}
              {#if src}<img class="size-4 shrink-0 rounded-[3px] object-cover" {src} alt="" draggable="false" />{:else}<Icon name="rss" size={16} strokeWidth={1.75} class="shrink-0 text-muted" />{/if}
            {/await}
          {/snippet}
          <SidebarRow
            icon={error ? "circle-alert" : (entry && plugins.libraryKind(entry.meta.type)?.icon) || "rss"}
            iconClass={error ? "shrink-0 text-faint" : undefined}
            picture={cover && !error ? artwork : undefined}
            label={title || url}
            count={unread}
            active={filter?.feed === url}
            marked={menuFor === url}
            title={error ? feedError(error) : undefined}
            aria-label={[title || url, unread ? t("feeds.unreadCount", { count: unread }) : "", error ? feedError(error) : ""].filter(Boolean).join(", ")}
            onclick={() => onchoose({ kind: "feeds", feed: url })}
            oncontextmenu={(event) => oncontextmenu(event, url, (x, y) => subscriptionMenu(subscription, x, y))}
            {@attach longPress((x, y) => subscriptionMenu(subscription, x, y))}
          />
        </li>
      {/each}
    </ul>
  {/if}
</li>
