<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import { speak } from "../a11y";
  import { feeds, type Row, savePost } from "../feeds/feeds.svelte";
  import type { Dismissal } from "../feeds/marks";
  import { formatDate } from "../format";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { clock } from "../library/text";
  import { longPress } from "../longPress";
  import { notes } from "../notes/store.svelte";
  import { postEpisode } from "../player/episodes";
  import { player } from "../player/player.svelte";
  import { copyText, openExternal } from "../platform";
  import { menuPoint } from "../popover";
  import { menuSections, ui } from "../ui.svelte";
  import IconButton from "./ui/IconButton.svelte";

  let {
    row,
    index,
    count,
    top,
    measure,
    selected,
    tabbable,
    now,
    onkeydown,
    ondismiss,
  }: {
    row: Row;
    /** Its place in the list, from 0, of `count`; the list draws only some of its rows. */
    index: number;
    count: number;
    /** Where it's placed when it's drawn apart from the rows around it (the list's ListWindow). */
    top?: number;
    measure: Attachment<HTMLElement>;
    /** It's the post open. */
    selected: boolean;
    tabbable: boolean;
    now: Date;
    onkeydown: (event: KeyboardEvent) => void;
    /** Dismisses it, for this reason, or (`null`) puts it back in the list, once it's dismissed. */
    ondismiss: (why: Dismissal | null) => void;
  } = $props();

  const post = $derived(row.post);
  const source = $derived(feeds.subscription(row.feed)?.title ?? feeds.records.get(row.feed)?.title ?? "");
  let menuOpen = $state(false);

  /** An episode's: whether it's the one playing, and how far it was listened to. */
  const episode = $derived(postEpisode(row));
  const playing = $derived(!!episode && player.isPlaying(episode.key));
  const position = $derived(episode && player.positionOf(episode.key));
  /** What's left of one begun, as a player shows it. */
  const left = $derived(position?.at ? clock((position.duration ?? post.duration ?? 0) - position.at) : undefined);

  function setRead(read: boolean) {
    feeds.setRead(row.feed, [post.id], read);
    speak(t(read ? "feeds.didRead" : "feeds.didUnread"));
  }

  function showMenu(x: number, y: number) {
    menuOpen = true;
    const link = post.link;
    const saved = feeds.savedNote(row);
    ui.openMenu({
      x,
      y,
      label: post.title,
      items: menuSections(
        episode
          ? [
              { label: playing ? t("player.pauseEpisode") : t("player.playEpisode"), icon: playing ? "pause" : "play", run: () => player.toggle(episode) },
              position?.played
                ? { label: t("player.markUnplayed"), icon: "circle-dot", run: () => player.setPlayed(episode.key, false) }
                : { label: t("player.markPlayed"), icon: "check", run: () => player.setPlayed(episode.key, true) },
            ]
          : [],
        [
          post.read ? { label: t("feeds.markUnread"), icon: "circle-dot", run: () => setRead(false) } : { label: t("feeds.markRead"), icon: "check", run: () => setRead(true) },
          saved ? { label: t("feeds.openSaved"), icon: "bookmark", run: () => notes.show(saved.note.id) } : { label: t("feeds.save"), icon: "bookmark-plus", run: () => void savePost(row) },
        ],
        post.dismissed
          ? [{ label: t("feeds.restore"), icon: "restore", run: () => ondismiss(null) }]
          : [
              { label: t("feeds.dismiss"), icon: "archive", run: () => ondismiss("done") },
              { label: t("feeds.uninteresting"), icon: "thumbs-down", run: () => ondismiss("uninteresting") },
            ],
        link
          ? [
              { label: t("feeds.openInBrowser"), icon: "external-link", run: () => void openExternal(link) },
              { label: t("feeds.copyLink"), icon: "link", run: () => void copyText(link).then(() => speak(t("list.copied"))) },
            ]
          : [],
      ),
      onclose: () => (menuOpen = false),
    });
  }

  function oncontextmenu(event: MouseEvent) {
    event.preventDefault();
    if (menuOpen) return;
    const { x, y } = menuPoint(event);
    showMenu(x, y);
  }
</script>

<!-- As a note's row (NoteRow.svelte), and in the list's dividers the same way. Screen readers hear its
     title, whether it's unread, where it's from and when; its excerpt after a pause. -->
<li class={[top === undefined ? "relative" : "absolute inset-x-3", menuOpen && "menu-target"]} style:top={top === undefined ? undefined : `${top}px`} aria-posinset={index + 1} aria-setsize={count}>
  <div class="group/post relative">
    <button
      class={[
        "item ui-note-row relative flex w-full flex-col gap-[3px] rounded-lg bg-[image:linear-gradient(var(--layer),var(--layer))] pt-3 pr-3 pb-[11px] pl-[22px] text-left text-fg select-none [-webkit-touch-callout:none]",
        selected ? "selected [--layer:var(--active)]" : "[--layer:transparent] group-hover/post:[--layer:var(--hover)]",
        menuOpen && "inset-ring-2 inset-ring-accent",
      ]}
      data-post={post.key}
      tabindex={tabbable ? 0 : -1}
      aria-current={selected}
      aria-describedby={post.excerpt ? `excerpt-${post.key}` : undefined}
      onclick={(event) => {
        // WebKit doesn't focus a button clicked, as Chromium does: the list's keys (E, ↓) then act on it.
        event.currentTarget.focus({ preventScroll: true });
        feeds.show(row.feed, post.id);
      }}
      {onkeydown}
      {oncontextmenu}
      {@attach measure}
      {@attach longPress(showMenu)}
    >
      <!-- Unread: a dot in a margin of its own, so titles line up either way. -->
      <span class="relative min-w-0 text-md leading-[1.35] font-semibold">
        {#if !post.read}<span class="absolute top-1/2 -left-[14px] size-[7px] -translate-y-1/2 rounded-full bg-accent" aria-hidden="true"></span>{/if}
        <!-- Room at its end for Dismiss, while that's shown. -->
        <span class={["block truncate group-hover/post:pr-7 group-focus-within/post:pr-7 coarse:pr-7", menuOpen && "pr-7"]}>{post.title}</span>{#if !post.read}<span class="sr-only">, {t("feeds.unread")}</span>{/if}
      </span>
      {#if post.excerpt}
        <span class="line-clamp-2 text-sm leading-[1.45] text-muted" id="excerpt-{post.key}" aria-hidden="true">{post.excerpt}</span>
      {/if}
      <span class={["mt-0.5 flex min-w-0 items-center gap-[5px] text-[11.5px] text-faint", selected && "in-data-[contrast=more]:text-muted", episode && "min-h-[26px] pr-9"]}>
        {#if post.audio}<Icon name="headphones" size={12} class="shrink-0" /><span class="sr-only">{t("feeds.episode")}</span>{/if}
        <span class="min-w-0 truncate">{source}</span>
        {#if post.date}<span aria-hidden="true">·</span><time class="shrink-0" datetime={new Date(post.date).toISOString()}>{formatDate(post.date, now)}</time>{/if}
        <!-- How much of an episode is left to hear: all of it, some, or none. -->
        {#if position?.played}
          <span aria-hidden="true">·</span><span class="flex shrink-0 items-center gap-0.5"><Icon name="check" size={12} />{t("player.played")}</span>
        {:else if left}
          <span aria-hidden="true">·</span><span class="tabular shrink-0">{t("player.left", { time: left })}</span>
        {:else if post.duration}
          <span aria-hidden="true">·</span><span class="tabular shrink-0">{clock(post.duration)}</span>
        {/if}
        {#if post.dismissed === "uninteresting"}
          <span aria-hidden="true">·</span><span class="flex shrink-0 items-center gap-0.5"><Icon name="thumbs-down" size={12} />{t("feeds.wasUninteresting")}</span>
        {/if}
      </span>
    </button>
    <!-- Beside the row rather than in it, which a button can't be; by keyboard they're in the row's menu and over the open post
         (and Dismiss is E). Dismiss shows while the row's pointed at or focused, and always on a touch screen. -->
    <IconButton
      class={["absolute top-1.5 right-1.5 opacity-0 group-hover/post:opacity-100 group-focus-within/post:opacity-100 coarse:opacity-100", menuOpen && "opacity-100"]}
      icon={post.dismissed ? "restore" : "archive"}
      iconSize={15}
      tabindex={-1}
      label={post.dismissed ? t("feeds.restore") : t("feeds.dismiss")}
      tooltip={post.dismissed ? undefined : t("feeds.dismissWithKey", { key: "E" })}
      onclick={() => ondismiss(post.dismissed ? null : "done")}
    />
    {#if episode}
      <IconButton
        class="absolute right-1.5 bottom-2"
        icon={playing ? "pause" : "play"}
        iconSize={15}
        tabindex={-1}
        label={playing ? t("player.pauseEpisode") : t("player.playEpisode")}
        onclick={() => player.toggle(episode)}
      />
    {/if}
  </div>
</li>
