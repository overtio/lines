/*
 * A code block's fence, as text: for whatever writes code blocks (rendered.ts, the HTTP plugin, a
 * feed's posts as Markdown), without loading the editor to do it.
 */

/** A fence like `fence` for a block of `code`, longer than any run of its character in the code, so no line of the code ends the block. */
export function fenceFor(code: string, fence = "```") {
  const runs = code.match(fence[0] === "~" ? /~{3,}/g : /`{3,}/g) ?? [];
  return fence[0].repeat(Math.max(fence.length, ...runs.map((run) => run.length + 1)));
}
