<script lang="ts">
  import { speak } from "../a11y";
  import { feeds } from "../feeds/feeds.svelte";
  import { cleanStream } from "../feeds/streams";
  import { t } from "../i18n/index.svelte";
  import { ui } from "../ui.svelte";
  import Prompt from "./ui/Prompt.svelte";

  // The box a stream's name is typed in, where its menu was: a new one for a feed (its menu's Add to
  // Stream → New Stream…), or a stream's new name (its menu's Rename…).

  const prompt = $derived(ui.streamPrompt);
  /** What's typed, starting as the name it has when it's opened to rename it. */
  let value = $derived(prompt?.rename ?? "");
  const name = $derived(cleanStream(value));

  function close() {
    ui.streamPrompt = null;
  }

  function submit() {
    if (!prompt || !name) return;
    if (prompt.rename) {
      feeds.renameStream(prompt.rename, name);
      speak(t("feeds.streams.renamed", { name }));
    } else if (prompt.feed) {
      feeds.addToStream(prompt.feed, name);
      speak(t("feeds.streams.added", { title: feeds.subscription(prompt.feed)?.title ?? "", name }));
    }
    close();
  }
</script>

<Prompt
  at={prompt}
  title={prompt?.rename ? t("feeds.streams.renameTitle", { name: prompt.rename }) : t("feeds.streams.newTitle")}
  icon="waves"
  action={prompt?.rename ? t("feeds.streams.rename") : t("feeds.streams.add")}
  ready={!!name && name !== prompt?.rename}
  bind:value
  onclose={close}
  onsubmit={submit}
  placeholder={t("feeds.streams.name")}
  aria-label={t("feeds.streams.name")}
/>
