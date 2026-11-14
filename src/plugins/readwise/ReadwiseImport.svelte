<script lang="ts">
  // Readwise's group of Settings → Library: an access token, to ask Readwise what it has (api.ts),
  // kept only in the field, which empties once Readwise has answered; then what importing it would
  // do, the import, and Undo (ImportStep.svelte, lib/imports/imports.svelte.ts).
  import { onDestroy, tick } from "svelte";
  import { speak } from "../../lib/a11y";
  import ImportStep from "../../lib/components/settings/ImportStep.svelte";
  import Button from "../../lib/components/ui/Button.svelte";
  import Callout from "../../lib/components/ui/Callout.svelte";
  import FieldRow from "../../lib/components/ui/FieldRow.svelte";
  import TextField from "../../lib/components/ui/TextField.svelte";
  import { locale, t } from "../../lib/i18n/index.svelte";
  import { imports } from "../../lib/imports/imports.svelte";
  import { notes } from "../../lib/notes/store.svelte";
  import { openExternal } from "../../lib/platform";
  import type { ImportFile } from "../../lib/plugins/types";
  import { fetchAll, checkToken, type Progress, ReadwiseError } from "./api";
  import { type Plan, plan } from "./plan";
  import { sourcesOf } from "./sources";

  const ID = "readwise";
  const TOKEN_PAGE = "https://readwise.io/access_token";
  /** The kinds a summary names, in its order, and how it counts them. */
  const KINDS = [
    ["book", "readwise.count.book"],
    ["article", "readwise.count.article"],
    ["episode", "readwise.count.episode"],
    ["video", "readwise.count.video"],
    ["paper", "readwise.count.paper"],
  ] as const;
  /** How many titles of notes there it names, before saying how many more. */
  const NAMED = 5;

  // Readwise's things are asked for, not in files: `files` is never given.
  let { onclose }: { files?: ImportFile[]; onclose?: () => void } = $props();
  const id = $props.id();
  let token = $state("");
  let field = $state<HTMLInputElement>();
  let asking = $state<Progress | null>(null);
  let error = $state<string | null>(null);
  /** What Readwise has (as fetched, to import), and what importing it would do. Large: not made deeply reactive. */
  let found = $state.raw<{ input: Awaited<ReturnType<typeof fetchAll>>; plan: Plan } | null>(null);
  let controller: AbortController | undefined;

  // It has the token.
  onDestroy(() => controller?.abort());

  const list = (parts: string[]) => new Intl.ListFormat(locale, { type: "conjunction" }).format(parts);

  /** What importing would do, a line each: what's new, what's added to notes there, what's left out. */
  const lines = $derived.by(() => {
    if (!found) return [];
    const { kinds, highlights, adding, addingTo, leftOut } = found.plan;
    const things = KINDS.flatMap(([type, count]) => (kinds.get(type) ? [t(count, { count: kinds.get(type)! })] : []));
    const named = addingTo.slice(0, NAMED);
    if (addingTo.length > NAMED) named.push(t("readwise.more", { count: addingTo.length - NAMED }));
    return [
      ...(things.length ? [t("readwise.found", { things: list(things), highlights })] : adding ? [] : [t("readwise.nothingNew")]),
      ...(adding ? [t("readwise.adding", { count: adding, notes: list(named) })] : []),
      ...(leftOut ? [t("readwise.leftOut", { count: leftOut })] : []),
    ];
  });
  const writes = $derived(found ? found.plan.work.add.length + found.plan.work.append.length : 0);

  /** Why Readwise couldn't be asked, as people read it: anything but its own answers is one lines couldn't read. */
  function messageOf(problem: unknown) {
    if (!(problem instanceof ReadwiseError)) return t("readwise.unreadable");
    if (problem.reason === "token") return t("readwise.badToken");
    return problem.reason === "status" ? t("readwise.answered", { status: problem.status ?? 0 }) : t("readwise.unreachable");
  }

  async function find() {
    const given = token.trim();
    if (!given || asking) return;
    const current = (controller = new AbortController());
    error = null;
    found = null;
    imports.clear(ID);
    asking = { pages: 0 };
    try {
      await checkToken(given, current.signal);
      const input = await fetchAll(given, current.signal, (progress) => (asking = progress));
      found = { input, plan: plan(sourcesOf(input.books, input.documents), notes.entries) };
      token = "";
      speak(lines.join(" "));
    } catch (problem) {
      if (current.signal.aborted) return;
      console.warn("lines: couldn't ask Readwise", problem);
      error = messageOf(problem);
    } finally {
      if (controller === current) asking = null;
    }
    // Back in the field to correct it, once it can take focus again.
    if (!error) return;
    await tick();
    field?.focus();
  }

  async function stopAsking() {
    controller?.abort();
    asking = null;
    await tick();
    field?.focus();
  }

  function close() {
    found = null;
    imports.clear(ID);
    if (onclose) onclose();
    else field?.focus();
  }

  const focus = (element: HTMLElement) => element.focus();
</script>

<FieldRow label={t("readwise.token")} note={t("readwise.tokenNote")} for="{id}-token">
  <TextField
    id="{id}-token"
    type="password"
    autocomplete="off"
    spellcheck={false}
    class="w-56"
    bind:value={token}
    bind:input={field}
    disabled={!!asking}
    aria-describedby="{id}-token-note"
    onkeydown={(event) => {
      if (event.key === "Enter") void find();
    }}
  />
  <Button onclick={find} disabled={!token.trim() || !!asking}>{t("readwise.find")}</Button>
  {#snippet below()}
    {#if asking}
      <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p class="m-0 flex-1 text-sm leading-normal text-muted" role="status">
          {asking.waiting ? t("readwise.waiting", { seconds: asking.waiting }) : t("readwise.asking", { pages: asking.pages })}
        </p>
        <Button variant="quiet" onclick={stopAsking} {@attach focus}>{t("settings.cancel")}</Button>
      </div>
    {:else if error}
      <Callout tone="danger" class="mt-3 w-full">{error}</Callout>
    {:else if !found && imports.state?.id !== ID}
      <Button variant="quiet" icon="external-link" class="-ml-2.5 mt-2" onclick={() => openExternal(TOKEN_PAGE)}>{t("readwise.getToken")}</Button>
    {/if}
  {/snippet}
</FieldRow>
{#if found || imports.state?.id === ID}
  {#key found}
    <ImportStep
      id={ID}
      {lines}
      action={writes ? t("readwise.import") : undefined}
      onimport={() => found && imports.start(ID, found.input)}
      oncancel={close}
      result={(done) => [t("readwise.added", { count: done.added }), ...(done.appended ? [t("readwise.updated", { count: done.appended })] : [])].join(" ")}
      undone={(undone) => [t("readwise.undone", { count: undone.trashed }), ...(undone.restored ? [t("readwise.restored", { count: undone.restored })] : [])].join(" ")}
    />
  {/key}
{/if}
