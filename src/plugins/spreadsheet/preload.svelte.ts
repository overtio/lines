import { notes } from "../../lib/notes/store.svelte";
import { loadFormulas } from "../../lib/sheets/formulas";

/*
 * The formula engine loads while nothing else is going on, once the notes have, if any of them needs
 * it (a spreadsheet, a ```csv block or a table with a formula), so the first of them opened shows
 * what its formulas work out to at once rather than waiting for the engine.
 */

const FORMULAS = /^(?:`{3,}|~{3,})[ \t]*csv|\|[ \t]*=/im;

const needed = () => notes.entries.some(({ note }) => !note.trashed && (note.format === "spreadsheet" || (!note.format && FORMULAS.test(note.body))));

const whenIdle = (run: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(run, { timeout: 5000 }) : setTimeout(run, 1000));

$effect.root(() => {
  $effect(() => {
    if (!notes.ready) return;
    // Not loaded now, it's tried again when a note needs it.
    whenIdle(() => void (needed() && loadFormulas().catch(() => {})));
  });
});
