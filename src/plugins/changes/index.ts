import { t } from "../../lib/i18n/index.svelte";
import type { LineMarker, Plugin } from "../../lib/plugins/types";
import { diffLines } from "./diff";

/*
 * The lines changed in a note since it was opened, marked in its margin as a code editor marks them
 * against the last commit: added in green, changed in blue, and a wedge in red where lines were
 * taken out. Opening the note again starts afresh.
 */

function changes({ text, opened }: { text: string; opened: string }): LineMarker[] {
  return diffLines(opened.split("\n"), text.split("\n")).flatMap(({ before, after }) => {
    const removed = before[1] - before[0];
    const added = after[1] - after[0];
    const changed = Math.min(removed, added);
    const marks: LineMarker[] = [];
    if (changed) marks.push({ from: after[0] + 1, to: after[0] + changed, color: "blue", label: t("plugins.changes.changed") });
    if (added > changed) marks.push({ from: after[0] + changed + 1, to: after[1], color: "green", label: t("plugins.changes.added") });
    if (removed > changed) marks.push({ from: after[1] + 1, color: "red", between: true, label: t("plugins.changes.removed") });
    return marks;
  });
}

export const changesPlugin = (): Plugin => ({
  id: "changes",
  name: t("plugins.changes"),
  description: t("plugins.changes.description"),
  icon: "diff",
  enabledByDefault: false,
  contributes: { markers: [{ id: "changes", markers: changes }] },
});
