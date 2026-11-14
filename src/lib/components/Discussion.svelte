<script module lang="ts">
  import type { Discussion } from "../plugins/types";

  /** Discussions read since lines started, by their page, the latest last: a post opened again shows its comments at once. */
  const read = new Map<string, Discussion>();
  const KEPT = 10;

  function keep(page: string, discussion: Discussion) {
    read.delete(page);
    read.set(page, discussion);
    if (read.size > KEPT) read.delete(read.keys().next().value!);
  }
</script>

<script lang="ts">
  import { onMount, tick } from "svelte";
  import { Thread, type ThreadComment } from "../feeds/thread.svelte";
  import { formatAgo } from "../format";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { openExternal } from "../platform";
  import type { DiscussionSource, TextBlock, TextSpan } from "../plugins/types";
  import Button from "./ui/Button.svelte";

  // A post's discussion, under it in the reader (PostView.svelte), from the plugin that reads its
  // comments link (`discussions`): each reply under what it answers, to a depth the width has room
  // for, and a comment's header folds it away with its replies. Drawn from the words the plugin
  // gives, never from a site's HTML, and its links are opened by lines, never followed by the page.
  // One stop for Tab, the comment the keyboard's on; the arrow keys go from comment to comment
  // (docs/accessibility.md). A big thread is drawn a few dozen comments a frame, each laid out only
  // near the view.

  let { source, link }: { source: DiscussionSource; link: string } = $props();

  /** About how many comments are drawn a frame. */
  const BATCH = 60;

  const id = $props.id();
  const page = $derived(source.page(new URL(link)));
  let section: HTMLElement;
  let thread = $state.raw<Thread | null>(null);
  let failed = $state(false);
  /** How many of the first comments are drawn, each with its replies. */
  let drawn = $state(0);
  let now = $state(Date.now());
  /** The comment the keyboard's on. */
  let current: ThreadComment | undefined;
  let loading: AbortController | undefined;
  let frame = 0;

  const total = $derived(thread?.all.length ?? 0);
  /** Comments the site counts that it didn't give. */
  const missing = $derived(Math.max(0, (thread?.discussion.count ?? 0) - total));
  /** What a screen reader says as the discussion loads, and once it has. */
  const status = $derived(
    failed
      ? ""
      : !thread
        ? t("feeds.discussion.loading")
        : total
          ? t("feeds.discussion.count", { count: total })
          : missing
            ? t("feeds.discussion.notYet", { site: source.name })
            : t("feeds.discussion.none"),
  );

  function show(discussion: Discussion) {
    now = Date.now();
    thread = new Thread(discussion);
    current = thread.all[0];
    if (current) current.current = true;
    drawn = 0;
    drawMore();
  }

  async function load() {
    loading?.abort();
    cancelAnimationFrame(frame);
    failed = false;
    const kept = read.get(page);
    if (kept) return show(kept);
    thread = null;
    const controller = (loading = new AbortController());
    try {
      const discussion = await source.load(new URL(link), controller.signal);
      if (controller.signal.aborted) return;
      keep(page, discussion);
      show(discussion);
    } catch {
      if (!controller.signal.aborted) failed = true;
    }
  }

  /** Draws the next few threads, and the rest in the frames after. */
  function drawMore() {
    const top = thread?.top ?? [];
    let next = drawn;
    for (let budget = BATCH; next < top.length && budget > 0; next++) budget -= top[next].size + 1;
    drawn = next;
    if (next < top.length) frame = requestAnimationFrame(drawMore);
  }

  onMount(() => {
    void load();
    return () => {
      loading?.abort();
      cancelAnimationFrame(frame);
    };
  });

  /** Moves the keyboard to the discussion: the comment it was on, or its heading while there's none. */
  export function focus() {
    (current ? headerOf(current) : section.querySelector<HTMLElement>("h2"))?.focus();
  }

  const headerOf = (entry: ThreadComment) => section.querySelector<HTMLElement>(`[data-comment="${entry.index}"] > [data-fold]`);

  /** The comment an element is in. */
  function entryOf(element: Element) {
    const index = element.closest<HTMLElement>("[data-comment]")?.dataset.comment;
    return index === undefined ? undefined : thread?.all[Number(index)];
  }

  function makeCurrent(entry: ThreadComment) {
    if (current) current.current = false;
    entry.current = true;
    current = entry;
  }

  /** Moves the keyboard to a comment, drawing it first if it isn't yet. */
  async function moveTo(entry: ThreadComment) {
    let top = entry;
    while (top.parent) top = top.parent;
    const at = thread!.top.indexOf(top);
    if (at >= drawn) {
      cancelAnimationFrame(frame);
      drawn = thread!.top.length;
      await tick();
    }
    makeCurrent(entry);
    // Focusing it brings it into view, laid out or not; scrollIntoView() doesn't in WebKit (content-visibility).
    headerOf(entry)?.focus();
  }

  function clicked(event: MouseEvent) {
    const target = event.target as Element;
    const href = target.closest<HTMLElement>("[data-href]")?.dataset.href;
    if (href) return void openExternal(href);
    const entry = target.closest("[data-fold]") && entryOf(target);
    if (!entry) return;
    entry.folded = !entry.folded;
    // The comment the keyboard was on, folded away with it: it's on this one now (WebKit doesn't focus a button clicked).
    if (entry.folded && current && current.index > entry.index && current.index < entry.end) makeCurrent(entry);
  }

  function pressed(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (event.key === "Enter" && target.getAttribute("role") === "link") {
      event.preventDefault();
      return void openExternal(target.dataset.href!);
    }
    const entry = entryOf(target);
    if (!thread || !entry || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    let to: ThreadComment | undefined = entry;
    switch (event.key) {
      case "ArrowDown":
      case "j":
        to = thread.next(entry);
        break;
      case "ArrowUp":
      case "k":
        to = thread.previous(entry);
        break;
      case "ArrowRight":
        if (entry.folded) entry.folded = false;
        else to = entry.replies[0];
        break;
      case "ArrowLeft":
        if (!entry.folded && entry.replies.length) entry.folded = true;
        else to = entry.parent ?? entry;
        break;
      case "Home":
        to = thread.all[0];
        break;
      case "End":
        to = thread.last();
        break;
      default:
        return;
    }
    event.preventDefault();
    if (to) void moveTo(to);
  }

  /** Tab, or a click, on a comment makes it the one the keyboard's on. */
  function focused(event: FocusEvent) {
    const entry = entryOf(event.target as Element);
    if (entry && entry !== current) makeCurrent(entry);
  }

  /**
   * Replies at a depth are drawn in from what they answer while there's room: four levels on a
   * phone, seven where it's wider. Deeper, they're drawn in line and say whom they answer.
   */
  function indent(depth: number) {
    if (depth < 5) return "ml-[7px] border-l border-line pl-3";
    if (depth < 8) return "@min-[30rem]:ml-[7px] @min-[30rem]:border-l @min-[30rem]:border-line @min-[30rem]:pl-3";
    return "";
  }

  /** Where a comment says whom it answers, as it isn't drawn in from them: its class there, or false. */
  const answering = (depth: number) => (depth >= 8 ? "" : depth >= 5 ? "@min-[30rem]:hidden" : false);

  const linkClass = "cursor-pointer text-(--text-link) underline decoration-(--link-soft) underline-offset-3 hover:decoration-current";
</script>

{#snippet words(span: TextSpan)}
  {#if span.code}<code class="rounded-sm bg-code px-1 py-px font-mono text-[0.86em] text-(--text-code)">{span.text}</code>{:else}<span class={[span.emphasis && "italic", span.strong && "font-semibold"]}>{span.text}</span>{/if}
{/snippet}

{#snippet spans(of: TextSpan[], tabbable: boolean)}
  {#each of as span, index (index)}{#if span.href}<span role="link" tabindex={tabbable ? 0 : -1} class={linkClass} title={span.href} data-href={span.href}>{@render words(span)}</span>{:else}{@render words(span)}{/if}{/each}
{/snippet}

{#snippet text(blocks: TextBlock[], tabbable: boolean)}
  {#each blocks as block, index (index)}
    {#if block.kind === "code"}
      <pre class="my-2 overflow-x-auto rounded-md bg-code px-3 py-2 font-mono text-[0.86em] leading-normal text-(--text-code)"><code>{block.spans.map((span) => span.text).join("")}</code></pre>
    {:else if block.kind === "quote"}
      <blockquote class="mx-0 my-1.5 border-l-3 border-accent-soft pl-3 text-(--text-quote)"><p class="m-0 whitespace-pre-line [overflow-wrap:anywhere]">{@render spans(block.spans, tabbable)}</p></blockquote>
    {:else}
      <p class="my-1.5 whitespace-pre-line [overflow-wrap:anywhere]">{@render spans(block.spans, tabbable)}</p>
    {/if}
  {/each}
{/snippet}

{#snippet comment(entry: ThreadComment)}
  {@const { author, time, text: blocks } = entry.comment}
  {@const poster = !!author && author === thread?.discussion.author}
  {@const says = answering(entry.depth)}
  <!-- Laid out and painted only near the view, each comment: a big thread scrolls as a short one does. -->
  <div class="pt-4 [contain-intrinsic-size:auto_160px] [content-visibility:auto]" data-comment={entry.index}>
    <button
      type="button"
      class="flex max-w-full items-center gap-1.5 rounded-sm py-0.5 pr-1.5 text-[0.82em] text-muted hover:text-fg"
      aria-expanded={!entry.folded}
      tabindex={entry.current ? 0 : -1}
      aria-describedby={entry.index === 0 ? `${id}-keys` : undefined}
      data-fold
    >
      <Icon name={entry.folded ? "chevron-right" : "chevron-down"} size={14} />
      <span class={["truncate font-semibold", poster ? "text-accent" : "text-fg"]}>{author}</span>{#if poster}<span class="sr-only">, {t("feeds.discussion.poster")}</span>{/if}
      {#if says !== false}
        <span class={["min-w-0 shrink truncate", says]}>↳ {t("feeds.discussion.replyTo", { name: entry.parent!.comment.author })}</span>
      {/if}
      {#if Number.isFinite(time)}<time class="shrink-0" datetime={new Date(time!).toISOString()}>{formatAgo(time!, now)}</time>{/if}
      {#if entry.folded && entry.size}<span class="shrink-0">· {t("feeds.discussion.replies", { count: entry.size })}</span>{/if}
    </button>
    {#if !entry.folded}
      <div class="pl-5">{@render text(blocks, entry.current)}</div>
      {#if entry.replies.length}
        <ul class={indent(entry.depth + 1)}>
          {#each entry.replies as reply (reply.comment.id)}
            <li>{@render comment(reply)}</li>
          {/each}
        </ul>
      {/if}
    {/if}
  </div>
{/snippet}

<!-- The comments' buttons and links take its clicks and keys, handled here for them all. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  bind:this={section}
  class="@container mx-auto max-w-(--editor-width) px-(--editor-pad-x) pb-(--editor-pad-bottom) font-text text-[calc(var(--editor-size)*0.9)] leading-[1.55] text-fg"
  aria-labelledby="{id}-heading"
  onclick={clicked}
  onkeydown={pressed}
  onfocusin={focused}
>
  <header class="mt-6 flex items-baseline gap-3 border-t border-line pt-5">
    <h2 id="{id}-heading" tabindex="-1" class="m-0 flex-1 text-[1.05em] font-semibold">
      {total ? t("feeds.discussion.count", { count: total }) : t("feeds.comments")}
    </h2>
    <button type="button" class="inline-flex shrink-0 items-center gap-1 rounded-sm text-[0.82em] text-muted hover:text-fg" data-href={page}>
      {t("feeds.discussion.openOn", { site: source.name })}
      <Icon name="external-link" size={13} />
    </button>
  </header>
  <p class="sr-only" role="status">{status}</p>
  <!-- The keys, said with the first comment, where Tab comes into the discussion. -->
  <p id="{id}-keys" hidden>{t("feeds.discussion.keys")}</p>
  {#if failed}
    <div class="mt-4 flex flex-wrap items-center gap-3 text-muted" role="alert">
      <p class="m-0">{t("feeds.discussion.failed")}</p>
      <Button onclick={() => void load()}>{t("feeds.discussion.retry")}</Button>
    </div>
  {:else if !thread || !total}
    <!-- What the status above says. -->
    <p class="mt-4 text-faint" aria-hidden="true">{status}</p>
  {:else}
    <ul>
      {#each thread.top.slice(0, drawn) as entry (entry.comment.id)}
        <li>{@render comment(entry)}</li>
      {/each}
    </ul>
    {#if missing}
      <p class="mt-6 text-[0.82em]">
        <button type="button" class={linkClass} data-href={page}>{t("feeds.discussion.missing", { count: missing, site: source.name })}</button>
      </p>
    {/if}
  {/if}
</section>
