import type { EditorState, TransactionSpec } from "@codemirror/state";
import { flushSync } from "svelte";
import { on } from "svelte/events";
import { speak } from "../../lib/a11y";
import { openIn, writeIn } from "../../lib/editor/writeIn";
import { feeds } from "../../lib/feeds/feeds.svelte";
import { t } from "../../lib/i18n/index.svelte";
import { isClosed, notes } from "../../lib/notes/store.svelte";
import { MAIN } from "../../lib/panes";
import { noteEpisode, postOf } from "../../lib/player/episodes";
import { writtenTime } from "../../lib/player/noteTimes";
import { type Episode, player } from "../../lib/player/player.svelte";
import { quoteItem, timeItem } from "../../lib/player/times";
import { DEFAULT_LANGUAGE } from "../../lib/plugins/registry.svelte";
import { ui } from "../../lib/ui.svelte";
import { listening } from "./listening.svelte";
import type { Cue } from "./transcripts";

/*
 * Writing in a note from the podcast player: Take Notes, at the end of the episode's note, and a
 * sentence of its transcript quoted. What's written goes in the note open in the main pane, as if
 * typed there (writeIn.ts), and ⌘Z takes it back.
 */

/** Whether an episode has a note to take notes in: its own, or one its post can be saved as. A sound alone has none. */
export const takesNotes = (episode: Episode) => !("sound" in episode.from);

/** Whether someone types while `wait` is under way, so the cursor isn't taken from where they are once it's done. */
async function untyped<T>(wait: Promise<T>): Promise<{ value: T; typed: boolean }> {
  let typed = false;
  const stop = on(document, "beforeinput", () => (typed = true), { capture: true });
  try {
    return { value: await wait, typed };
  } finally {
    stop();
  }
}

/**
 * The episode's note to write in: its own, or its post saved to the Library as one (the player has
 * the episode by that note from then on). None, said why: in the Trash, locked, or not saved; or,
 * once saved, if someone typed meanwhile (they're told it's ready).
 */
async function episodeNote(episode: Episode): Promise<string | null> {
  if ("note" in episode.from) {
    const entry = notes.get(episode.from.note);
    if (!entry || entry.note.trashed) speak(t("player.noteTrashed"));
    else if (isClosed(entry.note)) speak(t("player.noteLocked"));
    else return entry.note.id;
    return null;
  }
  const row = postOf(episode);
  if (!row) return null;
  listening.taking = true;
  try {
    const { value: id, typed } = await untyped(feeds.save(row));
    const entry = notes.get(id);
    const saved = entry && noteEpisode(entry);
    if (saved) player.rename(saved);
    if (!typed) return id;
    speak(t("player.noteReady"));
  } catch (error) {
    console.error("lines: couldn't save the episode to the Library", error);
    speak(t("player.couldntSave"));
  } finally {
    listening.taking = false;
  }
  return null;
}

/** Opens a note in the main pane and writes in it what `edit` makes of it, saying so if it can't be written in. */
function write(id: string, edit: (state: EditorState) => TransactionSpec) {
  flushSync(() => notes.show(id));
  ui.closeDrawer();
  if (!writeIn(MAIN, id, edit)) speak(t("player.cantWrite"));
}

/**
 * Take Notes, in the mini player: opens the episode's note at its end, on a new item of a list
 * starting with the time it's at, to write what you're hearing.
 */
export async function takeNotes() {
  const episode = player.episode;
  if (!episode || listening.taking) return;
  const id = await episodeNote(episode);
  if (id) write(id, (state) => timeItem(state, writtenTime(state, episode, player.time)));
}

/**
 * Quotes a sentence of the episode playing, with its time: after the cursor's line in the Markdown
 * note open in the main pane, or else at the end of the episode's note.
 */
export async function quote(cue: Cue) {
  const episode = player.episode;
  if (!episode || listening.taking) return;
  const open = openIn(MAIN);
  const entry = open ? notes.get(open) : undefined;
  const here = entry && !entry.note.trashed && !isClosed(entry.note) && (entry.note.format ?? DEFAULT_LANGUAGE) === DEFAULT_LANGUAGE;
  const id = here ? entry.note.id : takesNotes(episode) ? await episodeNote(episode) : null;
  if (id) write(id, (state) => quoteItem(state, writtenTime(state, episode, cue.start), cue.text, cue.speaker, !here));
}
