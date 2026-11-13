<script lang="ts">
  import { EditorState, Prec } from "@codemirror/state";
  import { Decoration, EditorView } from "@codemirror/view";
  import { untrack } from "svelte";
  import { createExtensions, readOnly } from "../editor/setup";
  import { feeds, type Row } from "../feeds/feeds.svelte";
  import { escapeText, htmlToMarkdown } from "../feeds/markdown";
  import { formatDay } from "../format";
  import { t } from "../i18n/index.svelte";
  import { prefs } from "../prefs.svelte";

  // A feed's post in the note's place, drawn as a note is but read-only: its HTML as Markdown
  // (feeds/markdown.ts), under its title and a line of where it's from, by whom and when.

  let { row }: { row: Row } = $props();

  let host: HTMLDivElement;
  let view: EditorView | undefined;

  /** The line under the title, smaller and quieter than the text (editor.css). */
  const byline = EditorView.decorations.compute(["doc"], (state) =>
    state.doc.lines > 1 ? Decoration.set(Decoration.line({ class: "cm-post-byline" }).range(state.doc.line(2).from)) : Decoration.none,
  );

  function textOf({ feed, post }: Row, html: string | undefined) {
    const source = feeds.subscription(feed)?.title ?? feeds.records.get(feed)?.title;
    const by = [source, post.author, post.date && formatDay(post.date)].filter((part): part is string => !!part).map(escapeText).join(" · ");
    const body = html === undefined ? escapeText(post.excerpt) : htmlToMarkdown(html, post.base);
    return `# ${escapeText(post.title)}\n${by}\n\n${body}\n`;
  }

  // A new editor for each post, made once: marking it read changes its row, not what it says.
  const key = $derived(row.post.key);
  $effect(() => {
    void key;
    return untrack(() => {
      const shown = row;
      const editor = (view = new EditorView({
        parent: host,
        state: EditorState.create({
          doc: "",
          extensions: [
            createExtensions(() => {}),
            Prec.highest([readOnly(true), EditorView.contentAttributes.of({ "aria-label": t("feeds.postLabel", { title: shown.post.title }) })]),
            byline,
          ],
        }),
      }));
      let gone = false;
      void feeds.content(shown.post).then((html) => {
        if (!gone) editor.dispatch({ changes: { from: 0, insert: textOf(shown, html) } });
      });
      return () => {
        gone = true;
        editor.destroy();
        view = undefined;
      };
    });
  });

  $effect(() => {
    prefs.watchLayout();
    view?.requestMeasure();
  });
</script>

<div class="h-full min-h-0" bind:this={host}></div>
