import { completionStatus } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { type EditorState, Prec, type Range, StateEffect, StateField } from "@codemirror/state";
import { type Command, Decoration, type DecorationSet, EditorView, keymap, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { mount, unmount } from "svelte";
import { speak } from "../a11y";
import { markupMode } from "../editor/markupMode";
import { named, SECTIONS, type SlashCommand } from "../editor/slashCommands";
import { editedNote, isEditing } from "../editor/util";
import { t } from "../i18n/index.svelte";
import Icon from "../icons/Icon.svelte";
import { notes } from "../notes/store.svelte";
import { isApple } from "../platform";
import { prefs } from "../prefs.svelte";
import { noteEpisode, soundEpisode } from "./episodes";
import { episodeAudio } from "./notePlay";
import { type Episode, player } from "./player.svelte";
import { fragmentTime, isSoundFile, readStamp, soundOf, stamp, timeEnter, timeIn } from "./times";

/*
 * Times in an episode written in a note (times.ts), drawn as chips that play the episode from there:
 * clicked, or with ⌥↵ on them. ⌃⌘T (Ctrl+Alt+S on Windows and Linux) and "/time" write the time the
 * player is at where the cursor is, and Enter after one, in the episode's note as it plays, starts the
 * next item with the time it's at. Markdown notes only: LaTeX notes don't have them yet.
 */

/** A time in the note: where it's written, as written, how far in it is, and the sound it plays (null: the note's own episode's). */
interface Time {
  from: number;
  to: number;
  text: string;
  seconds: number;
  audio: string | null;
}

/** The time a link is, `[12:34]` or `[12:34](…#t=754)`, if it's one. */
function timeOf(state: EditorState, link: SyntaxNode): Time | null {
  const marks = link.getChildren("LinkMark");
  if (marks.length < 2) return null;
  const text = state.sliceDoc(marks[0].to, marks[1].from);
  const seconds = readStamp(text);
  if (seconds === null) return null;
  const url = link.getChild("URL");
  // `[12:34]` alone, not a reference (`[12:34][1]`).
  if (!url) return marks.length === 2 ? { from: link.from, to: link.to, text, seconds, audio: null } : null;
  const href = state.sliceDoc(url.from, url.to).replace(/^<(.*)>$/, "$1");
  const audio = soundOf(href);
  // Played from where its address says, which other apps follow too, whatever its text says.
  const at = fragmentTime(href);
  if (at === null || !(isSoundFile(audio) || audio === player.episode?.audio)) return null;
  return { from: link.from, to: link.to, text, seconds: at, audio };
}

/** Plays a time from `note`: its link's sound, or the note's own episode. Whether there was one to play. */
function playTime(time: Time, note: string) {
  const entry = notes.get(note);
  const episode = time.audio ? soundEpisode(time.audio) : entry && noteEpisode(entry);
  if (!episode) return false;
  player.play(episode, time.seconds);
  return true;
}

/** Each chip's play icon, to unmount with it. */
const icons = new WeakMap<HTMLElement, ReturnType<typeof mount>>();

/** A time, drawn as a chip that plays it. */
class TimeWidget extends WidgetType {
  constructor(
    readonly time: Time,
    readonly note: string,
  ) {
    super();
  }

  eq(other: TimeWidget) {
    return other.time.text === this.time.text && other.time.seconds === this.time.seconds && other.time.audio === this.time.audio && other.note === this.note;
  }

  toDOM() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-time";
    const label = t("player.playFrom", { time: this.time.text });
    button.setAttribute("aria-label", label);
    button.title = label;
    const icon = document.createElement("span");
    icon.className = "cm-time-icon";
    icons.set(button, mount(Icon, { target: icon, props: { name: "play", size: 10, strokeWidth: 2.75 } }));
    button.append(icon, this.time.text);
    // Pressed without taking the cursor from the text.
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => playTime(this.time, this.note));
    return button;
  }

  destroy(dom: HTMLElement) {
    const icon = icons.get(dom);
    if (icon) void unmount(icon);
  }

  ignoreEvent() {
    return true;
  }
}

const written = Decoration.mark({ class: "cm-time-source" });

/** Chips for the times in view; as written where they're being edited, and while Markdown shows as written. */
function build(view: EditorView): DecorationSet {
  const { state } = view;
  const note = state.facet(editedNote);
  if (!note) return Decoration.none;
  const own = !!episodeAudio(state);
  const source = state.facet(markupMode) === "source";
  const drawn: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== "Link") return;
        const time = timeOf(state, node.node);
        if (time && (time.audio || own)) {
          const chip = !source && !isEditing(state, time.from, time.to);
          drawn.push(chip ? Decoration.replace({ widget: new TimeWidget(time, note) }).range(time.from, time.to) : written.range(time.from, time.to));
        }
        return false;
      },
    });
  }
  return Decoration.set(drawn, true);
}

const chips = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = build(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet || update.focusChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) {
        this.decorations = build(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

/** ⌥↵ on a time plays it; on anything else, it opens what it's on (livePreview.ts). */
const playAtCursor: Command = (view) => {
  const { state } = view;
  const note = state.facet(editedNote);
  const { head } = state.selection.main;
  if (!note) return false;
  for (const side of [-1, 1] as const) {
    for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(head, side); node; node = node.parent) {
      if (node.name !== "Link") continue;
      const time = timeOf(state, node);
      return !!time && (!!time.audio || !!episodeAudio(state)) && playTime(time, note);
    }
  }
  return false;
};

/** A time in an episode as it's written in this note: in the episode's own, `[12:34]`; elsewhere a link to its sound. */
export const writtenTime = (state: EditorState, episode: Episode, seconds: number) => timeIn(episodeAudio(state)?.value.trim(), episode.audio, seconds);

/** How long the note says there's no time to write. */
const SAID_FOR = 4000;

/** The note saying, after the cursor, that nothing's in the player to write the time of; or no longer (null). */
const sayNothing = StateEffect.define<number | null>();

/** What it says, quietly as a link's lookup does (linkNotes.ts); screen readers hear it from `speak`. */
class NothingPlayingWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-time-notice";
    el.setAttribute("aria-hidden", "true");
    el.textContent = t("player.nothingPlaying");
    return el;
  }
}

/** Where the note says so, until it's been said a while or the note changes. */
const nothingPlaying = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(sayNothing)) return effect.value === null ? Decoration.none : Decoration.set(Decoration.widget({ widget: new NothingPlayingWidget(), side: 1 }).range(effect.value));
    }
    return tr.docChanged ? Decoration.none : value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** Writes the time the player is at in place of `from`–`to` (the selection, or a "/time" typed), with a space either side. */
function writeTime(view: EditorView, from: number, to: number) {
  const time = player.episode && writtenTime(view.state, player.episode, player.time);
  if (!time) {
    // A "/time" typed goes either way; the note says why nothing took its place.
    view.dispatch({ changes: { from, to }, selection: { anchor: from }, effects: sayNothing.of(from), userEvent: "delete" });
    speak(t("player.nothingPlaying"));
    setTimeout(() => {
      if (view.dom.isConnected && view.state.field(nothingPlaying, false)?.size) view.dispatch({ effects: sayNothing.of(null) });
    }, SAID_FOR);
    return;
  }
  const before = view.state.sliceDoc(from - 1, from);
  const after = view.state.sliceDoc(to, to + 1);
  const insert = `${before && !/\s/.test(before) ? " " : ""}${time}${/\s/.test(after) ? "" : " "}`;
  view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length }, scrollIntoView: true, userEvent: "input" });
}

const writeTimeKey: Command = (view) => {
  if (view.state.readOnly) return false;
  const { from, to } = view.state.selection.main;
  writeTime(view, from, to);
  return true;
};

/**
 * Enter at the end of an item of a list of times, in the episode's own note while it's playing, or
 * paused after playing since it was put in the player (not one put back after a restart, paused days
 * ago): the next item starts with the time it's at, and screen readers hear it; on the last, just
 * started, the list ends (times.ts). Settings → Library turns it off.
 */
const continueTimes: Command = (view) => {
  const { state } = view;
  const episode = player.episode;
  // Not while a menu of completions is open, whose Enter it is (one still being worked out isn't).
  if (!prefs.timeNotes || !episode || !player.heard || state.readOnly || completionStatus(state) === "active") return false;
  if (episodeAudio(state)?.value.trim() !== soundOf(episode.audio)) return false;
  const time = stamp(player.time);
  const enter = timeEnter(state, `[${time}]`);
  if (!enter) return false;
  view.dispatch(enter.spec);
  if (enter.continued) speak(t("player.timeWritten", { time }));
  return true;
};

/** Drawn over what live preview draws of a link, and their keys before its; Enter before Markdown's own, which goes on with a list. */
export const noteTimes = [
  Prec.high([
    chips,
    nothingPlaying,
    keymap.of([
      { key: "Alt-Enter", run: playAtCursor },
      // Not Ctrl+Alt+T on Windows and Linux, which opens a terminal on Ubuntu. On a Mac as lines tells
      // one (its keys.ts too), not as CodeMirror does: they differ in WebKit on Linux.
      { key: isApple ? "Ctrl-Meta-t" : "Ctrl-Alt-s", run: writeTimeKey },
    ]),
  ]),
  Prec.highest(keymap.of([{ key: "Enter", run: continueTimes }])),
];

/** "/time": the time the player is at. */
export const timeCommand: SlashCommand = {
  ...named("editor.slash.time"),
  hint: "[12:34]",
  icon: "clock",
  section: SECTIONS.insert,
  after: "date",
  apply: writeTime,
};
