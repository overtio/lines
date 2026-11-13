<script lang="ts">
  import { EditorState } from "@codemirror/state";
  import { Decoration, EditorView } from "@codemirror/view";
  import { onMount } from "svelte";
  import { readingExtensions } from "../editor/setup";
  import { feeds, type Row } from "../feeds/feeds.svelte";
  import { htmlToMarkdown } from "../feeds/markdown";
  import { formatDay } from "../format";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";
  import { escapeMarkdown } from "../notes/escape";
  import { prefs } from "../prefs.svelte";

  // A feed's post in the note's place, drawn as a note is but only to be read (setup.ts'
  // readingExtensions): its HTML as Markdown (feeds/markdown.ts), under its title and a line of where
  // it's from, by whom and when. A new one for each post (App.svelte keys it): marking it read
  // changes its row, not what it says.

  let { row }: { row: Row } = $props();

  let host: HTMLDivElement;
  let view: EditorView | undefined;
  /** Its content couldn't be read from this device's storage. */
  let unreadable = $state(false);

  /** The line under the title, smaller and quieter than the text (editor.css). */
  const byline = EditorView.decorations.compute(["doc"], (state) =>
    state.doc.lines > 1 ? Decoration.set(Decoration.line({ class: "cm-post-byline" }).range(state.doc.line(2).from)) : Decoration.none,
  );

  function textOf({ feed, post }: Row, html: string | undefined) {
    const source = feeds.subscription(feed)?.title ?? feeds.records.get(feed)?.title;
    const by = [source, post.author, post.date && formatDay(post.date)].filter((part): part is string => !!part).map(escapeMarkdown).join(" · ");
    const body = html === undefined ? escapeMarkdown(post.excerpt) : htmlToMarkdown(html, post.base);
    return `# ${escapeMarkdown(post.title)}\n${by}\n\n${body}\n`;
  }

  onMount(() => {
    const shown = row;
    const editor = (view = new EditorView({
      parent: host,
      state: EditorState.create({ extensions: [readingExtensions(t("feeds.postLabel", { title: shown.post.title })), byline] }),
    }));
    let gone = false;
    feeds
      .content(shown.post)
      .then((html) => {
        if (!gone) editor.dispatch({ changes: { from: 0, insert: textOf(shown, html) } });
      })
      .catch((error) => {
        console.error("lines: couldn't read the post", error);
        unreadable = true;
      });
    return () => {
      gone = true;
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
