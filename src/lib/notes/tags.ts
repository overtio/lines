/*
 * What a #tag is made of, for everything that reads one: the note list (parse.ts), the editor
 * (editor/syntax.ts), and the formats whose tags go in comments.
 */

/** Characters allowed inside a #tag: letters and their marks (हिंदी, tiếng_việt), digits, `_`, `-`, and `/` for nested tags (`#work/meetings`). */
export const TAG_CHAR = /[\p{L}\p{M}\p{N}_\-/]/u;

/** A tag's name, to make patterns of. */
export const TAG_NAME = `${TAG_CHAR.source}+`;

/** Text of nothing but tags, `#work #ideas`, as a comment of tags is. */
export const TAGS_ONLY = new RegExp(`^(?:#${TAG_NAME}\\s*)+$`, "u");
