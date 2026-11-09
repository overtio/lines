<script lang="ts">
  // A ```typing block drawn as a drill (index.ts): its text to type over, what's typed right in the
  // text's color and what's missed in red, a cursor where the next character goes, what it comes to
  // so far above it, and how it went once it's done. A text field over the text takes the keys, so
  // dead keys, input methods and a phone's keyboard type here as anywhere.
  import { untrack } from "svelte";
  import { speak } from "../../lib/a11y";
  import Button from "../../lib/components/ui/Button.svelte";
  import IconButton from "../../lib/components/ui/IconButton.svelte";
  import { cheer } from "../../lib/editor/util";
  import { t } from "../../lib/i18n/index.svelte";
  import Icon from "../../lib/icons/Icon.svelte";
  import type { EditableBlock } from "../../lib/plugins/types";
  import { bestSpeed, Drill, keepBest, passageOf } from "./drill.svelte";

  const props: { block: EditableBlock } = $props();
  // The same block as long as it's drawn: what changes is in it, read again by update().
  const block = untrack(() => props.block);

  const id = $props.id();
  const drill = new Drill(passageOf(block.source));
  let field = $state<HTMLTextAreaElement>();
  let focused = $state(false);
  /** While an input method or a dead key is making a character, what's in the field isn't typed yet. */
  let composing = false;
  let readOnly = $state(block.readOnly);
  let best = $state(bestSpeed(drill.passage));
  let newBest = $state(false);

  /** Its code, or whether the note can be changed, changed: a new passage starts again. */
  export function update() {
    readOnly = block.readOnly;
    const passage = passageOf(block.source);
    if (passage !== drill.passage) restart(passage);
  }

  /** Takes the keyboard, from the note's text around it. */
  export function focus() {
    field?.focus();
  }

  function restart(passage?: string) {
    drill.reset(passage);
    if (field) field.value = "";
    best = bestSpeed(drill.passage);
    newBest = false;
  }

  const clock = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };

  /** A key as it's named: Space and Enter by name, the rest as themselves. */
  const keyName = (key: string) => (key === " " ? t("typing.space") : key === "\n" ? t("typing.enter") : key);

  function input() {
    if (!field) return;
    const done = drill.finished !== null;
    const text = drill.type(field.value);
    if (field.value !== text) field.value = text;
    if (done || drill.finished === null) return;
    newBest = keepBest(drill.passage, drill.speed);
    best = bestSpeed(drill.passage);
    speak(t("typing.done", { speed: drill.speed, accuracy: drill.accuracy, time: clock(drill.time) }));
    cheer();
  }

  /** The field's cursor stays at the end of what's typed: what's typed is never changed in the middle. */
  function toEnd() {
    if (field && (field.selectionStart !== field.value.length || field.selectionEnd !== field.value.length)) field.setSelectionRange(field.value.length, field.value.length);
  }

  function keydown(event: KeyboardEvent) {
    const fresh = drill.started === null;
    const done = drill.finished !== null;
    const leave = (up: boolean) => {
      event.preventDefault();
      block.leave(up);
    };
    if (event.key === "Escape") {
      event.stopPropagation();
      leave(false);
    } else if (event.key === "ArrowUp" && (fresh || done)) leave(true);
    else if (event.key === "ArrowDown" && (fresh || done)) leave(false);
    else if (event.key === "Enter" && done) {
      event.preventDefault();
      restart();
    } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.key)) event.preventDefault();
  }

  // The clock, while it's going and has the keyboard.
  $effect(() => {
    if (!drill.going || !focused) return;
    const timer = setInterval(() => (drill.now = performance.now()), 250);
    return () => clearInterval(timer);
  });

  /** A click anywhere on it, but its buttons, gives it the keyboard. */
  function pressed(event: MouseEvent) {
    if ((event.target as Element).closest("button")) return;
    event.preventDefault();
    field?.focus();
  }

  const CARET = "relative before:absolute before:inset-y-[0.15em] before:-left-px before:w-0.5 before:rounded-full before:bg-[var(--caret-color,var(--accent))]";

  /** How the character at `i` shows: typed right, missed, or still to type, and the cursor before the next. */
  function look(char: string, i: number) {
    const typed = i < drill.typed.length;
    const missed = typed && !drill.right(i);
    return [missed ? "rounded-[2px] bg-danger/15 text-danger" : char === "\n" ? "text-faint" : typed ? "text-fg" : "text-muted", i === drill.typed.length && focused && CARET];
  }

  const status = $derived(
    drill.started !== null
      ? [t("typing.speed", { speed: drill.speed }), t("typing.accuracy", { accuracy: drill.accuracy }), clock(drill.time)].join(" · ")
      : focused
        ? t("typing.ready")
        : t("typing.start"),
  );
</script>

<!-- A click on it is the text field's: the keyboard's way in is the field itself. It's in the note's
     text, which keeps its spaces, but its own spacing is its markup's. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="cm-lp-own-input overflow-hidden rounded-xl border border-card-line bg-card whitespace-normal" role="group" aria-labelledby="{id}-label" onmousedown={pressed}>
  <div class="flex min-h-10 items-center gap-2 py-1 pr-1.5 pl-3.5 font-ui text-sm text-muted">
    <Icon name="keyboard" size={15} />
    <span id="{id}-label" class="font-medium text-fg">{t("typing.label")}</span>
    <span class="ml-auto truncate tabular-nums">{status}</span>
    <IconButton icon="refresh" iconSize={15} label={t("typing.restart")} disabled={drill.started === null} onclick={() => (restart(), field?.focus())} />
  </div>
  {#if drill.wanted.length}
    <div class="relative px-4 pt-1 pb-4">
      <p class="m-0 font-text text-(length:--editor-size) leading-(--editor-line-height) break-words whitespace-pre-wrap" aria-hidden="true">{#each drill.wanted as char, i (i)}<span class={look(char, i)}>{char === "\n" ? "↵\n" : char}</span>{/each}</p>
      <p id="{id}-text" class="sr-only">{drill.passage}</p>
      <textarea
        bind:this={field}
        class="absolute inset-0 size-full cursor-text resize-none border-0 bg-transparent p-0 text-transparent caret-transparent opacity-0 outline-none"
        aria-label={t("typing.field")}
        aria-describedby="{id}-text"
        autocomplete="off"
        autocapitalize="off"
        {@attach (node) => node.setAttribute("autocorrect", "off")}
        spellcheck="false"
        oninput={() => !composing && input()}
        oncompositionstart={() => (composing = true)}
        oncompositionend={() => ((composing = false), input())}
        onkeydown={keydown}
        onfocus={() => ((focused = true), drill.away(false), toEnd())}
        onblur={() => ((focused = false), drill.away(true))}
        onselect={toEnd}
        onpointerup={toEnd}
        onpaste={(event) => event.preventDefault()}
        ondrop={(event) => event.preventDefault()}
      ></textarea>
    </div>
  {:else}
    <div class="flex flex-wrap items-center gap-3 px-4 pb-4 font-ui text-sm text-muted">
      {t("typing.empty")}
      {#if !readOnly}<Button variant="secondary" icon="pencil" onclick={() => block.showCode()}>{t("typing.editText")}</Button>{/if}
    </div>
  {/if}
  {#if drill.finished !== null}
    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-3 font-ui text-sm text-muted">
      <span><strong class="text-xl font-semibold text-fg tabular-nums">{drill.speed}</strong> {t("typing.unit")}</span>
      <span class="tabular-nums">{t("typing.accuracy", { accuracy: drill.accuracy })}</span>
      <span class="tabular-nums">{clock(drill.time)}</span>
      <span>{t("typing.mistakes", { count: drill.mistakes })}</span>
      {#if drill.missed().length}
        <span class="flex items-center gap-1.5">
          {t("typing.missed")}
          {#each drill.missed() as key (key)}<kbd class="rounded-sm bg-input px-1.5 py-px font-mono text-xs text-fg">{keyName(key)}</kbd>{/each}
        </span>
      {/if}
      {#if newBest}
        <span class="flex items-center gap-1.5 font-medium text-accent"><Icon name="trophy" size={15} />{t("typing.newBest")}</span>
      {:else if best}
        <span>{t("typing.best", { speed: best })}</span>
      {/if}
      <Button class="ml-auto" icon="refresh" onclick={() => (restart(), field?.focus())}>{t("typing.again")}</Button>
    </div>
  {/if}
</div>
