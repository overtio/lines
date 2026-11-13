<script lang="ts">
  import { EditorState } from "@codemirror/state";
  import { Decoration, EditorView } from "@codemirror/view";
  import { onMount } from "svelte";
  import { readingExtensions } from "../editor/setup";
  import { feeds, type Row } from "../feeds/feeds.svelte";
  import { destination, htmlToMarkdown, markdownLink, saysMore } from "../feeds/markdown";
  import { formatDay } from "../format";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { pageSummary, readsPages } from "../library/web";
  import { escapeMarkdown } from "../notes/escape";
  import { prefs } from "../prefs.svelte";

  // A feed's post in the note's place, drawn as a note is but only to be read (setup.ts'
  // readingExtensions): its HTML as Markdown (feeds/markdown.ts), under its title, a link to it,
  // and a line of where it's from, by whom and when, and where it's talked about. A post that says
  // nothing of its own, only a link (Hacker News'), shows what the page it links to says of itself,
  // where pages are read. A new one for each post (App.svelte keys it): marking it read changes its
  // row, not what it says.

  type Summary = Awaited<ReturnType<typeof pageSummary>>;

  let { row }: { row: Row } = $props();

  let host: HTMLDivElement;
  let view: EditorView | undefined;
  /** Its content couldn't be read from this device's storage. */
  let unreadable = $state(false);

  /** The title, a link to the post in its own color, and the line under it, smaller and quieter than the text (editor.css). */
  const byline = EditorView.decorations.compute(["doc"], (state) =>
    state.doc.lines > 1
      ? Decoration.set([Decoration.line({ class: "cm-post-title" }).range(0), Decoration.line({ class: "cm-post-byline" }).range(state.doc.line(2).from)])
      : Decoration.none,
  );

  const hostOf = (href: string) => new URL(href).hostname.replace(/^www\./, "");

  function textOf({ feed, post }: Row, html: string | undefined, summary?: Summary) {
    const record = feeds.records.get(feed);
    const source = feeds.subscription(feed)?.title ?? record?.title;
    // A post of another site's, as an aggregator's are: which one.
    const elsewhere = post.link && hostOf(post.link) !== hostOf(record?.link ?? feed) ? markdownLink(hostOf(post.link), post.link) : undefined;
    const by = [
      source && escapeMarkdown(source),
      elsewhere,
      post.author && escapeMarkdown(post.author),
      post.date && escapeMarkdown(formatDay(post.date)),
      post.comments && markdownLink(t("feeds.comments"), post.comments),
    ].filter(Boolean);
    const title = post.link ? markdownLink(post.title, post.link) : escapeMarkdown(post.title);
    return `# ${title}\n${by.join(" · ")}\n\n${bodyOf(post, html, summary)}\n`;
  }

  function bodyOf(post: Row["post"], html: string | undefined, summary?: Summary) {
    if (html === undefined) return escapeMarkdown(post.excerpt);
    if (saysMore(html, post.base, [post.link, post.comments])) return htmlToMarkdown(html, post.base);
    return [summary?.image && `![](${destination(summary.image)})`, summary?.description && escapeMarkdown(summary.description)].filter(Boolean).join("\n\n");
  }

  /** Whether to ask the page a post links to what it says of itself: it says nothing of its own. */
  const asksPage = (post: Row["post"], html: string) => !!post.link && prefs.lookUpLinks && readsPages() && !saysMore(html, post.base, [post.link, post.comments]);

  onMount(() => {
    const shown = row;
    const editor = (view = new EditorView({
      parent: host,
      state: EditorState.create({ extensions: [readingExtensions(t("feeds.postLabel", { title: shown.post.title })), byline] }),
    }));
    const leaving = new AbortController();
    feeds
      .content(shown.post)
      .then(async (html) => {
        if (leaving.signal.aborted) return;
        editor.dispatch({ changes: { from: 0, insert: textOf(shown, html) } });
        if (html === undefined || !asksPage(shown.post, html)) return;
        const summary = await pageSummary(shown.post.link!, leaving.signal).catch(() => null);
        if (summary && !leaving.signal.aborted) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: textOf(shown, html, summary) } });
      })
      .catch((error) => {
        console.error("lines: couldn't read the post", error);
        unreadable = true;
      });
    return () => {
      leaving.abort();
      editor.destroy();
      view = undefined;
    };
  });

  $effect(() => {
    prefs.watchLayout();
    view?.requestMeasure();
  });
</script>

<div class="h-full min-h-0" hidden={unreadable} bind:this={host}></div>
{#if unreadable}
  <div class="flex flex-1 flex-col items-center justify-center gap-3 pb-(--titlebar-h) text-faint" role="alert">
    <Icon name="circle-alert" size={36} strokeWidth={1.25} />
    <p class="m-0 text-md">{t("feeds.unreadable")}</p>
  </div>
{/if}
