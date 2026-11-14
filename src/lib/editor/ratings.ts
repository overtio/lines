import { type Completion, type CompletionContext, type CompletionResult, startCompletion } from "@codemirror/autocomplete";
import { isolateHistory } from "@codemirror/commands";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { rateItems, ratings, sayRated } from "../library/ratings.svelte";
import { frontMatter, keyOf, typeOf } from "../notes/properties";
import { ui } from "../ui.svelte";
import { keyValue } from "./keyValue";
import { frontMatterField, type IconCompletion } from "./objects";
import { type Scale, type Score, scoreIn, scoreOn, scoresOf, scoreText, spokenScore } from "./scores";

/*
 * Rating in a note. A click on a score's mark sets it, as one change ⌘Z takes back, and a click on
 * the one set takes it out (a property, the whole line; a `Key: Value` line's, to 0); a click on a
 * word (`A`) offers its scale's others. In a library note's properties, a key being typed is offered
 * the kind's ratings the note hasn't got, and once one's written, its scale's values, so a note is
 * rated by keyboard too.
 */

/** A score's value: where it's written, what it's on, what it is (if it fits), and whether it's a property. */
interface Rated {
  from: number;
  to: number;
  scale: Scale;
  score: Score | null;
  property: boolean;
}

/** The score on `pos`'s line, as it's drawn there: a property on its kind's scale, or marks out of 2 to 10. */
function ratedAt(state: EditorState, pos: number): Rated | null {
  const line = state.doc.lineAt(pos);
  const to = line.from + line.text.trimEnd().length;
  const front = state.field(frontMatterField, false);
  if (front && line.number < front.lines) {
    const property = front.properties.find((each) => each.line === line.number);
    if (!property) return null;
    const scale = ratings.scaleFor(typeOf(front.properties), property.key);
    const score = scale ? scoreIn(property.value, scale) : scoreIn(property.value);
    const on = scale ?? (score && { kind: "marks" as const, of: score.of });
    return on ? { from: line.from + /^[^:]*:[ \t]*/.exec(line.text)![0].length, to, scale: on, score, property: true } : null;
  }
  const lead = /^[\s>]*/.exec(line.text)![0].length;
  const value = keyValue(line.text.slice(lead));
  const score = value && scoreIn(line.text.slice(lead + value.from, lead + value.to));
  return value && score ? { from: line.from + lead + value.from, to: line.from + lead + value.to, scale: { kind: "marks", of: score.of }, score, property: false } : null;
}

/** Sets the score on `pos`'s line, or takes it out (null): one change. */
function rate(view: EditorView, pos: number, score: number | null) {
  const at = ratedAt(view.state, pos);
  if (!at || view.state.readOnly) return;
  const line = view.state.doc.lineAt(pos);
  const changes =
    score === null && at.property ? { from: line.from, to: line.to + 1 } : { from: at.from, to: at.to, insert: scoreText(score ?? 0, at.scale) };
  view.dispatch({ changes, userEvent: "input.rate", annotations: isolateHistory.of("full") });
  sayRated(score, at.scale);
}

/** A click on a score's mark, or its word, as the editor's mousedown has it: whether it was one, now taken care of. */
export function clickScore(event: MouseEvent, view: EditorView): boolean {
  const target = event.target as HTMLElement;
  const mark = target.closest<HTMLElement>(".cm-lp-score-mark");
  const word = mark ? null : target.closest<HTMLElement>(".cm-lp-score-label");
  if ((!mark && !word) || event.button !== 0 || view.state.readOnly) return false;
  event.preventDefault();
  const pos = view.posAtDOM((mark ?? word)!);
  const at = ratedAt(view.state, pos);
  if (!at) return true;
  if (mark) {
    const chosen = Number(mark.dataset.score);
    rate(view, pos, at.score?.score === chosen ? null : chosen);
  } else {
    const { left, bottom } = word!.getBoundingClientRect();
    ui.openMenu({ x: left, y: bottom + 4, items: rateItems(at.scale, at.score, (score) => rate(view, pos, score)) });
  }
  return true;
}

/** What can start a property's key (notes/properties.ts), as it's typed. */
const TYPING_KEY = /^[\p{L}\p{N}_][\p{L}\p{N} _-]*$/u;

/**
 * In a library note's properties: as a key's typed, the kind's ratings the note hasn't got (`rating`,
 * `story`), and after a rating's key, its scale's values, the best first.
 */
export function ratingSource(context: CompletionContext): CompletionResult | null {
  const { state, pos } = context;
  const line = state.doc.lineAt(pos);
  // As if this line were blank: a key typed so far, with no `:` yet, isn't a property, nor are properties with it.
  const end = state.doc.line(Math.min(state.doc.lines, 101)).to;
  const front = line.number <= 101 ? frontMatter(state.sliceDoc(0, line.from) + state.sliceDoc(line.to, Math.max(line.to, end))) : null;
  if (!front || line.number === 1 || line.number >= front.lines) return null;
  const type = typeOf(front.properties);
  const before = line.text.slice(0, pos - line.from);
  const valued = /^([^:]+):[ \t]+(.*)$/.exec(before);
  if (valued) {
    const scale = ratings.scaleFor(type, valued[1].trim());
    if (!scale) return null;
    const typed = valued[2].toLowerCase();
    const options = scoresOf(scale)
      .map((score): IconCompletion => {
        const label = scoreText(score, scale);
        // A word as it shows, where that's another (Thumbs Up, for `thumbs up`).
        const shown = spokenScore(scoreOn(score, scale), scale);
        return { label, icon: null, ...(scale.kind === "labels" && shown !== label && { detail: shown }) };
      })
      .filter(({ label }) => label.toLowerCase().startsWith(typed) && label.toLowerCase() !== typed);
    return options.length ? { from: pos - typed.length, to: Math.max(pos, line.from + line.text.trimEnd().length), filter: false, options } : null;
  }
  // A key on a line of its own so far.
  const typed = TYPING_KEY.test(before) && !line.text.slice(before.length).trim() ? before.toLowerCase() : null;
  if (typed === null || (!typed && !context.explicit)) return null;
  const has = new Set(front.properties.filter((property) => property.line !== line.number).map((property) => keyOf(property.key)));
  const options = ratings
    .of(type)
    .filter((rating) => !has.has(keyOf(rating.key)) && rating.key.startsWith(typed))
    .map(
      (rating): IconCompletion => ({
        label: rating.key,
        ...(rating.name.toLowerCase() !== rating.key && { detail: rating.name }),
        icon: "star",
        // Its key, and then its values to choose from.
        apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
          const insert = `${rating.key}: `;
          view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length }, userEvent: "input.complete" });
          startCompletion(view);
        },
      }),
    );
  return options.length ? { from: line.from, filter: false, options } : null;
}
